import { Router, Request, Response } from 'express';
import { MarketDataService } from '../services/MarketDataService';
import { TrendingAlgorithm } from '../services/TrendingAlgorithm';
import { DatabaseService } from '../services/DatabaseService';
import { MarketController } from '../controllers/MarketController';
import { validateRequest, validationSchemas, sanitizeRequest, rateLimit } from '../middleware/validation';
import winston from 'winston';

export interface MarketDataRouterDependencies {
  marketDataService: MarketDataService;
  trendingAlgorithm: TrendingAlgorithm;
  databaseService: DatabaseService;
}

export function createMarketDataRouter(deps: MarketDataRouterDependencies): Router {
  const router = Router();
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

  // Initialize market controller
  const marketController = new MarketController(
    deps.databaseService,
    deps.marketDataService,
    deps.trendingAlgorithm
  );

  // Apply middleware
  router.use(sanitizeRequest);
  router.use(rateLimit(200, 60000)); // 200 requests per minute

  // Market CRUD endpoints with validation
  router.get('/markets', 
    validateRequest({ query: validationSchemas.marketFilters }), 
    marketController.getMarkets
  );
  
  router.get('/markets/trending', 
    validateRequest({ query: validationSchemas.trendingQuery }), 
    marketController.getTrendingMarkets
  );
  
  router.get('/markets/analytics', 
    validateRequest({ query: validationSchemas.analyticsQuery }), 
    marketController.getMarketAnalytics
  );
  
  router.get('/markets/:id', 
    validateRequest({ params: validationSchemas.marketId }), 
    marketController.getMarket
  );
  
  router.post('/markets', 
    validateRequest({ body: validationSchemas.createMarket }), 
    marketController.createMarket
  );
  
  router.put('/markets/:id', 
    validateRequest({ 
      params: validationSchemas.marketId, 
      body: validationSchemas.updateMarket 
    }), 
    marketController.updateMarket
  );

  /**
   * GET /api/v1/market-data/:marketId
   * Get real-time market data for a specific market
   */
  router.get('/:marketId', 
    validateRequest({ params: validationSchemas.marketId }), 
    async (req: Request, res: Response) => {
    try {
      const { marketId } = req.params;
      
      if (!marketId) {
        return res.status(400).json({ error: 'Market ID is required' });
      }

      const marketData = await deps.marketDataService.getMarketData(marketId);
      
      if (!marketData) {
        return res.status(404).json({ error: 'Market not found' });
      }

      // Calculate trending metrics
      const trendingMetrics = deps.trendingAlgorithm.calculateTrendingScore(marketData);
      
      return res.json({
        success: true,
        data: {
          ...marketData,
          trendingMetrics
        }
      });

    } catch (error) {
      logger.error('Error fetching market data:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/v1/market-data/:marketId/chart
   * Get chart data for a specific market outcome
   */
  router.get('/:marketId/chart', 
    validateRequest({ 
      params: validationSchemas.marketId, 
      query: validationSchemas.chartQuery 
    }), 
    async (req: Request, res: Response) => {
    try {
      const { marketId } = req.params;
      const { outcomeIndex = '0', timeframe = '24h' } = req.query;
      
      if (!marketId) {
        return res.status(400).json({ error: 'Market ID is required' });
      }

      const chartData = await deps.marketDataService.getChartData(
        marketId,
        parseInt(outcomeIndex as string),
        timeframe as string
      );

      return res.json({
        success: true,
        data: {
          marketId,
          outcomeIndex: parseInt(outcomeIndex as string),
          timeframe,
          chartData
        }
      });

    } catch (error) {
      logger.error('Error fetching chart data:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/v1/market-data/:marketId/trades
   * Get recent trades for a market
   */
  router.get('/:marketId/trades', 
    validateRequest({ 
      params: validationSchemas.marketId, 
      query: validationSchemas.tradesQuery 
    }), 
    async (req: Request, res: Response) => {
    try {
      const { marketId } = req.params;
      const { limit = '50', offset = '0' } = req.query;
      
      if (!marketId) {
        return res.status(400).json({ error: 'Market ID is required' });
      }

      const trades = await deps.databaseService.getMarketTrades(
        marketId,
        parseInt(limit as string),
        parseInt(offset as string)
      );

      return res.json({
        success: true,
        data: {
          marketId,
          trades,
          pagination: {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            total: trades.length
          }
        }
      });

    } catch (error) {
      logger.error('Error fetching market trades:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/v1/market-data/:marketId/stats
   * Get market statistics
   */
  router.get('/:marketId/stats', 
    validateRequest({ params: validationSchemas.marketId }), 
    async (req: Request, res: Response) => {
    try {
      const { marketId } = req.params;
      
      if (!marketId) {
        return res.status(400).json({ error: 'Market ID is required' });
      }

      const stats = await deps.databaseService.getMarketStats(marketId);
      
      if (!stats) {
        return res.status(404).json({ error: 'Market stats not found' });
      }

      return res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error fetching market stats:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/v1/market-data/trending (legacy endpoint)
   * Get trending markets - redirects to new endpoint
   */
  router.get('/trending', async (req: Request, res: Response) => {
    try {
      // Redirect to new markets endpoint
      const { limit = '10' } = req.query;
      req.url = `/markets/trending?limit=${limit}`;
      return marketController.getTrendingMarkets(req, res);
    } catch (error) {
      logger.error('Error fetching trending markets:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/v1/market-data/pumping
   * Get markets that are "pumping now"
   */
  router.get('/pumping', async (req: Request, res: Response) => {
    try {
      const { threshold = '0.7' } = req.query;
      
      const allMarkets = await deps.marketDataService.getTrendingMarkets(50);
      const pumpingMarkets = deps.trendingAlgorithm.getPumpingMarkets(
        allMarkets,
        parseFloat(threshold as string)
      );

      res.json({
        success: true,
        data: {
          pumping: pumpingMarkets,
          threshold: parseFloat(threshold as string),
          timestamp: Date.now()
        }
      });

    } catch (error) {
      logger.error('Error fetching pumping markets:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/v1/market-data/overview
   * Get platform overview statistics
   */
  router.get('/overview', async (req: Request, res: Response) => {
    try {
      // Get platform-wide statistics
      const trendingMarkets = await deps.databaseService.getTrendingMarkets(10);
      const totalVolume = trendingMarkets.reduce((sum, market) => sum + market.totalVolume, 0);
      const totalTraders = trendingMarkets.reduce((sum, market) => sum + market.traderCount, 0);

      res.json({
        success: true,
        data: {
          totalVolume,
          totalTraders,
          activeMarkets: trendingMarkets.length,
          topMarkets: trendingMarkets.slice(0, 5),
          timestamp: Date.now()
        }
      });

    } catch (error) {
      logger.error('Error fetching platform overview:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/v1/market-data/algorithm/weights
   * Update trending algorithm weights (admin endpoint)
   */
  router.post('/algorithm/weights', async (req: Request, res: Response) => {
    try {
      const { volumeWeight, volatilityWeight, momentumWeight, socialWeight } = req.body;
      
      // Validate weights
      if (
        typeof volumeWeight !== 'number' ||
        typeof volatilityWeight !== 'number' ||
        typeof momentumWeight !== 'number' ||
        typeof socialWeight !== 'number'
      ) {
        return res.status(400).json({ error: 'All weights must be numbers' });
      }

      deps.trendingAlgorithm.updateWeights(
        volumeWeight,
        volatilityWeight,
        momentumWeight,
        socialWeight
      );

      const newConfig = deps.trendingAlgorithm.getConfiguration();

      return res.json({
        success: true,
        data: {
          message: 'Algorithm weights updated successfully',
          configuration: newConfig
        }
      });

    } catch (error) {
      logger.error('Error updating algorithm weights:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/v1/market-data/algorithm/config
   * Get current trending algorithm configuration
   */
  router.get('/algorithm/config', async (req: Request, res: Response) => {
    try {
      const configuration = deps.trendingAlgorithm.getConfiguration();

      res.json({
        success: true,
        data: configuration
      });

    } catch (error) {
      logger.error('Error fetching algorithm configuration:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}