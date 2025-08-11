import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

export interface ValidationSchema {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}

/**
 * Middleware for request validation using Joi schemas
 */
export function validateRequest(schema: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    // Validate request body
    if (schema.body) {
      const { error } = schema.body.validate(req.body);
      if (error) {
        errors.push(`Body: ${error.details[0].message}`);
      }
    }

    // Validate query parameters
    if (schema.query) {
      const { error } = schema.query.validate(req.query);
      if (error) {
        errors.push(`Query: ${error.details[0].message}`);
      }
    }

    // Validate path parameters
    if (schema.params) {
      const { error } = schema.params.validate(req.params);
      if (error) {
        errors.push(`Params: ${error.details[0].message}`);
      }
    }

    if (errors.length > 0) {
      logger.warn('Request validation failed:', { errors, url: req.url });
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }

    next();
  };
}

/**
 * Common validation schemas
 */
export const validationSchemas = {
  // Market ID parameter validation
  marketId: Joi.object({
    id: Joi.string().required().min(1).max(100)
  }),

  // Pagination query validation
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('created_at', 'total_volume', 'trader_count', 'resolution_date', 'trending_score').default('created_at'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }),

  // Market filters validation
  marketFilters: Joi.object({
    category: Joi.string().max(50),
    status: Joi.string().valid('active', 'settled', 'disputed', 'cancelled'),
    creator: Joi.string().max(44), // Solana wallet address length
    minVolume: Joi.number().integer().min(0),
    maxVolume: Joi.number().integer().min(0),
    dateFrom: Joi.date().iso(),
    dateTo: Joi.date().iso().min(Joi.ref('dateFrom')),
    search: Joi.string().max(255),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('created_at', 'total_volume', 'trader_count', 'resolution_date', 'trending_score').default('created_at'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }),

  // Market creation validation
  createMarket: Joi.object({
    program_account: Joi.string().required().max(44),
    creator_wallet: Joi.string().required().max(44),
    title: Joi.string().required().min(1).max(255),
    description: Joi.string().max(2000),
    category: Joi.string().max(50),
    resolution_date: Joi.date().iso().greater('now')
  }),

  // Market update validation
  updateMarket: Joi.object({
    title: Joi.string().min(1).max(255),
    description: Joi.string().max(2000),
    category: Joi.string().max(50),
    status: Joi.string().valid('active', 'settled', 'disputed', 'cancelled')
  }).min(1), // At least one field must be provided

  // Chart data query validation
  chartQuery: Joi.object({
    outcomeIndex: Joi.number().integer().min(0).default(0),
    timeframe: Joi.string().valid('1h', '24h', '7d', '30d').default('24h'),
    interval: Joi.string().valid('1m', '5m', '15m', '1h', '4h', '1d').default('1h')
  }),

  // Trades query validation
  tradesQuery: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(50),
    offset: Joi.number().integer().min(0).default(0),
    tradeType: Joi.string().valid('buy', 'sell'),
    outcomeIndex: Joi.number().integer().min(0)
  }),

  // Trending query validation
  trendingQuery: Joi.object({
    limit: Joi.number().integer().min(1).max(50).default(20),
    timeframe: Joi.string().valid('1h', '24h', '7d', '30d').default('24h'),
    threshold: Joi.number().min(0).max(1).default(0.7)
  }),

  // Analytics query validation
  analyticsQuery: Joi.object({
    timeframe: Joi.string().valid('1h', '24h', '7d', '30d').default('24h'),
    category: Joi.string().max(50)
  })
};

/**
 * Middleware for sanitizing request data
 */
export function sanitizeRequest(req: Request, res: Response, next: NextFunction) {
  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        // Remove potentially dangerous characters
        req.query[key] = (req.query[key] as string)
          .replace(/[<>]/g, '')
          .trim();
      }
    });
  }

  // Sanitize body data
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key]
          .replace(/[<>]/g, '')
          .trim();
      }
    });
  }

  next();
}

/**
 * Simple rate limiting middleware
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(maxRequests: number = 100, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    const clientData = requestCounts.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      // Reset or initialize counter
      requestCounts.set(clientId, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }
    
    if (clientData.count >= maxRequests) {
      logger.warn(`Rate limit exceeded for client: ${clientId}`);
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
      });
    }
    
    clientData.count++;
    next();
  };
}

/**
 * Error handling middleware for validation errors
 */
export function handleValidationError(error: Error, req: Request, res: Response, next: NextFunction) {
  if (error.name === 'ValidationError') {
    logger.warn('Validation error:', { error: error.message, url: req.url });
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.message
    });
  }
  
  next(error);
}