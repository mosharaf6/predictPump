import express from 'express';
import { PublicKey } from '@solana/web3.js';
import winston from 'winston';
import crypto from 'crypto';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

export interface AuthenticatedRequest extends express.Request {
  userWallet?: string;
  isAuthenticated?: boolean;
}

/**
 * Middleware to validate Solana wallet signatures
 * This is a simplified version - in production you'd want to verify actual signatures
 */
export function authenticateWallet(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Missing or invalid authorization header',
        message: 'Expected format: Bearer <wallet_address>'
      });
    }

    const walletAddress = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate wallet address format
    if (!isValidSolanaAddress(walletAddress)) {
      return res.status(401).json({
        error: 'Invalid wallet address format'
      });
    }

    // In a real implementation, you would:
    // 1. Verify a signed message from the wallet
    // 2. Check the signature against the wallet's public key
    // 3. Ensure the message includes a timestamp to prevent replay attacks
    
    req.userWallet = walletAddress;
    req.isAuthenticated = true;
    
    logger.info(`Authenticated wallet: ${walletAddress}`);
    return next();

  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({
      error: 'Authentication failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Optional authentication middleware - doesn't fail if no auth provided
 */
export function optionalAuth(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const walletAddress = authHeader.substring(7);
      
      if (isValidSolanaAddress(walletAddress)) {
        req.userWallet = walletAddress;
        req.isAuthenticated = true;
      }
    }
    
    return next();

  } catch (error) {
    logger.warn('Optional auth error:', error);
    return next(); // Continue without authentication
  }
}

/**
 * Validate Solana wallet address format
 */
function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a challenge message for wallet signature verification
 */
export function generateAuthChallenge(walletAddress: string): string {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');
  
  return `PredictionPump Authentication\nWallet: ${walletAddress}\nTimestamp: ${timestamp}\nNonce: ${nonce}`;
}

/**
 * Verify wallet signature (placeholder implementation)
 * In production, this would verify the actual cryptographic signature
 */
export function verifyWalletSignature(
  message: string,
  signature: string,
  walletAddress: string
): boolean {
  // This is a placeholder implementation
  // In production, you would:
  // 1. Parse the signature
  // 2. Verify it against the message using the wallet's public key
  // 3. Check timestamp to prevent replay attacks
  
  logger.info(`Verifying signature for wallet: ${walletAddress}`);
  
  // For now, just validate the format
  return signature.length > 0 && isValidSolanaAddress(walletAddress);
}

/**
 * Rate limiting middleware for API endpoints
 */
export function rateLimit(windowMs: number = 60000, maxRequests: number = 100) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    const clientData = requests.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      // Reset or initialize
      requests.set(clientId, {
        count: 1,
        resetTime: now + windowMs
      });
      next();
    } else if (clientData.count < maxRequests) {
      // Increment count
      clientData.count++;
      next();
    } else {
      // Rate limit exceeded
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Too many requests. Try again in ${Math.ceil((clientData.resetTime - now) / 1000)} seconds.`
      });
    }
  };
}