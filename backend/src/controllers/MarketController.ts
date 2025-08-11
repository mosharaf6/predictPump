import { Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { MarketDataService } from '../services/MarketDataService';
import { TrendingAlgorithm } from '../services/TrendingAlgorithm';
import winston from 'winston';
import Joi from 'joi';

export interface MarketFilters {
  category?: string;
  status?: string;
  creator?: string;
  minVolume?: number;
  maxVolume?: number;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export interface MarketSortOptions {
  sortBy: 'created_at' | 'total_volume' | 'trader_count' | 'resolution_date' | 'trending_score';
  sortOrder: 'asc' | 'desc';
}

export interface PaginationOptions {
  page: number;
  limit: number;
  offset: number;
}

export class MarketController {
  private logger: winston.Logger;

  constructor(
    private databaseService: DatabaseService,
    private marketDataService: MarketDataService,
    private trendingAlgorithm: TrendingAlgorithm
  ) {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'market-controller.log' })
      ]
    });
  }

  /**
   * GET /api/v1/markets
   * Get markets with filtering, sorting, and pagination
   */
  public getMarkets = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters = this.parseFilters(req.query);
      const sortOptions = this.parseSortOptions(req.query);
      const pagination = this.parsePagination(req.query);

      const { markets, total } = await this.fetchMarketsWithFilters(filters, sortOptions, pagination);

      // Enhance markets with real-time data and trending scores
      const enhancedMarkets = await Promise.all(
        markets.map(async (market) => {
          const stats = await this.databaseService.getMarketStats(market.program_account);
          const trendingScore = stats ? this.trendingAlgorithm.calculateTrendingScore({
            marketId: market.program_account,
            volume24h: stats.volumeChange24h,
            priceChange24h: stats.priceChange24h,
            traderCount: stats.traderCount,
            lastTradeAt: stats.lastTradeAt
          }) : 0;

          return {
            ...market,
            stats,
            trendingScore
          };
        })
      );

      res.json({
        success: true,
        data: {
          markets: enhancedMarkets,
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total,
            totalPages: Math.ceil(total / pagination.limit),
            hasNext: pagination.offset + pagination.limit < total,
            hasPrev: pagination.page > 1
          },
          filters,
          sort: sortOptions
        }
      });

    } catch (error) {
      this.logger.error('Error fetching markets:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch markets'
      });
    }
  };

  /**
   * GET /api/v1/markets/:id
   * Get a specific market by ID
   */
  public getMarket = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Market ID is required'
        });
        return;
      }

      const market = await this.fetchMarketById(id);

      if (!market) {
        res.status(404).json({
          success: false,
          error: 'Market not found'
        });
        return;
      }

      // Get enhanced market data
      const stats = await this.databaseService.getMarketStats(id);
      const recentTrades = await this.databaseService.getMarketTrades(id, 10);
      const marketData = await this.marketDataService.getMarketData(id);

      res.json({
        success: true,
        data: {
          ...market,
          stats,
          recentTrades,
          realTimeData: marketData
        }
      });

    } catch (error) {
      this.logger.error(`Error fetching market ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch market'
      });
    }
  };

  /**
   * POST /api/v1/markets
   * Create a new market (for admin/testing purposes)
   */
  public createMarket = async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = Joi.object({
        program_account: Joi.string().required(),
        creator_wallet: Joi.string().required(),
        title: Joi.string().required().max(255),
        description: Joi.string().optional(),
        category: Joi.string().optional().max(50),
        resolution_date: Joi.date().optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const marketId = await this.createNewMarket(value);

      res.status(201).json({
        success: true,
        data: {
          marketId,
          message: 'Market created successfully'
        }
      });

    } catch (error) {
      this.logger.error('Error creating market:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create market'
      });
    }
  };

  /**
   * PUT /api/v1/markets/:id
   * Update market information
   */
  public updateMarket = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const schema = Joi.object({
        title: Joi.string().optional().max(255),
        description: Joi.string().optional(),
        category: Joi.string().optional().max(50),
        status: Joi.string().optional().valid('active', 'settled', 'disputed', 'cancelled')
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const updated = await this.updateMarketById(id, value);

      if (!updated) {
        res.status(404).json({
          success: false,
          error: 'Market not found'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          message: 'Market updated successfully'
        }
      });

    } catch (error) {
      this.logger.error(`Error updating market ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to update market'
      });
    }
  };

  /**
   * GET /api/v1/markets/trending
   * Get trending markets with enhanced algorithm
   */
  public getTrendingMarkets = async (req: Request, res: Response): Promise<void> => {
    try {
      const { limit = '20', timeframe = '24h' } = req.query;

      const markets = await this.databaseService.getTrendingMarkets(parseInt(limit as string));

      // Apply enhanced trending algorithm
      const trendingMarkets = await Promise.all(
        markets.map(async (market) => {
          const trendingScore = this.trendingAlgorithm.calculateTrendingScore({
            marketId: market.marketId,
            volume24h: market.volumeChange24h,
            priceChange24h: market.priceChange24h,
            traderCount: market.traderCount,
            lastTradeAt: market.lastTradeAt
          });

          return {
            ...market,
            trendingScore
          };
        })
      );

      // Sort by trending score
      trendingMarkets.sort((a, b) => b.trendingScore - a.trendingScore);

      res.json({
        success: true,
        data: {
          trending: trendingMarkets,
          timeframe,
          timestamp: Date.now(),
          algorithm: this.trendingAlgorithm.getConfiguration()
        }
      });

    } catch (error) {
      this.logger.error('Error fetching trending markets:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trending markets'
      });
    }
  };

  /**
   * GET /api/v1/markets/analytics
   * Get market analytics and statistics
   */
  public getMarketAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { timeframe = '24h' } = req.query;

      const analytics = await this.calculateMarketAnalytics(timeframe as string);

      res.json({
        success: true,
        data: {
          ...analytics,
          timeframe,
          timestamp: Date.now()
        }
      });

    } catch (error) {
      this.logger.error('Error fetching market analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch market analytics'
      });
    }
  };

  // Private helper methods

  private parseFilters(query: any): MarketFilters {
    return {
      category: query.category as string,
      status: query.status as string,
      creator: query.creator as string,
      minVolume: query.minVolume ? parseInt(query.minVolume) : undefined,
      maxVolume: query.maxVolume ? parseInt(query.maxVolume) : undefined,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      search: query.search as string
    };
  }

  private parseSortOptions(query: any): MarketSortOptions {
    return {
      sortBy: query.sortBy || 'created_at',
      sortOrder: query.sortOrder || 'desc'
    };
  }

  private parsePagination(query: any): PaginationOptions {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  private async fetchMarketsWithFilters(
    filters: MarketFilters,
    sort: MarketSortOptions,
    pagination: PaginationOptions
  ): Promise<{ markets: any[]; total: number }> {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    // Build WHERE clause based on filters
    if (filters.category) {
      whereClause += ` AND category = $${paramIndex}`;
      params.push(filters.category);
      paramIndex++;
    }

    if (filters.status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.creator) {
      whereClause += ` AND creator_wallet = $${paramIndex}`;
      params.push(filters.creator);
      paramIndex++;
    }

    if (filters.minVolume !== undefined) {
      whereClause += ` AND total_volume >= $${paramIndex}`;
      params.push(filters.minVolume);
      paramIndex++;
    }

    if (filters.maxVolume !== undefined) {
      whereClause += ` AND total_volume <= $${paramIndex}`;
      params.push(filters.maxVolume);
      paramIndex++;
    }

    if (filters.dateFrom) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      params.push(filters.dateFrom);
      paramIndex++;
    }

    if (filters.dateTo) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      params.push(filters.dateTo);
      paramIndex++;
    }

    if (filters.search) {
      whereClause += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM markets ${whereClause}`;
    const countResult = await this.databaseService.getPool().query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Get markets with pagination and sorting
    const orderClause = `ORDER BY ${sort.sortBy} ${sort.sortOrder.toUpperCase()}`;
    const limitClause = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(pagination.limit, pagination.offset);

    const marketsQuery = `
      SELECT * FROM markets 
      ${whereClause} 
      ${orderClause} 
      ${limitClause}
    `;

    const marketsResult = await this.databaseService.getPool().query(marketsQuery, params);

    return {
      markets: marketsResult.rows,
      total
    };
  }

  private async fetchMarketById(id: string): Promise<any | null> {
    const result = await this.databaseService.getPool().query(
      'SELECT * FROM markets WHERE program_account = $1 OR id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  private async createNewMarket(marketData: any): Promise<string> {
    const result = await this.databaseService.getPool().query(`
      INSERT INTO markets (program_account, creator_wallet, title, description, category, resolution_date)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      marketData.program_account,
      marketData.creator_wallet,
      marketData.title,
      marketData.description,
      marketData.category,
      marketData.resolution_date
    ]);

    return result.rows[0].id;
  }

  private async updateMarketById(id: string, updates: any): Promise<boolean> {
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    if (!setClause) return false;

    const result = await this.databaseService.getPool().query(`
      UPDATE markets 
      SET ${setClause}, updated_at = NOW()
      WHERE program_account = $1 OR id = $1
    `, [id, ...Object.values(updates)]);

    return result.rowCount > 0;
  }

  private async calculateMarketAnalytics(timeframe: string): Promise<any> {
    const timeCondition = this.getTimeCondition(timeframe);

    const analyticsQuery = `
      SELECT 
        COUNT(*) as total_markets,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_markets,
        COUNT(CASE WHEN status = 'settled' THEN 1 END) as settled_markets,
        SUM(total_volume) as total_platform_volume,
        SUM(trader_count) as total_unique_traders,
        AVG(total_volume) as avg_market_volume,
        AVG(trader_count) as avg_traders_per_market,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '${timeframe}' THEN 1 END) as new_markets
      FROM markets
    `;

    const result = await this.databaseService.getPool().query(analyticsQuery);
    const analytics = result.rows[0];

    // Get top categories
    const categoriesQuery = `
      SELECT category, COUNT(*) as count, SUM(total_volume) as volume
      FROM markets 
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY volume DESC
      LIMIT 10
    `;

    const categoriesResult = await this.databaseService.getPool().query(categoriesQuery);

    return {
      overview: {
        totalMarkets: parseInt(analytics.total_markets),
        activeMarkets: parseInt(analytics.active_markets),
        settledMarkets: parseInt(analytics.settled_markets),
        totalVolume: parseInt(analytics.total_platform_volume || 0),
        totalTraders: parseInt(analytics.total_unique_traders || 0),
        avgMarketVolume: parseFloat(analytics.avg_market_volume || 0),
        avgTradersPerMarket: parseFloat(analytics.avg_traders_per_market || 0),
        newMarkets: parseInt(analytics.new_markets)
      },
      topCategories: categoriesResult.rows.map(row => ({
        category: row.category,
        marketCount: parseInt(row.count),
        totalVolume: parseInt(row.volume || 0)
      }))
    };
  }

  private getTimeCondition(timeframe: string): string {
    switch (timeframe) {
      case '1h': return '1 hour';
      case '24h': return '24 hours';
      case '7d': return '7 days';
      case '30d': return '30 days';
      default: return '24 hours';
    }
  }
}