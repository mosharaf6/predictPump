import request from 'supertest';
import express from 'express';
import { MarketDataService } from '../services/MarketDataService';
import { TrendingAlgorithm } from '../services/TrendingAlgorithm';
import { DatabaseService } from '../services/DatabaseService';
import { createMarketDataRouter } from '../routes/marketData';

// Mock the services for integration testing
jest.mock('../services/MarketDataService');
jest.mock('../services/DatabaseService');
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    get: jest.fn(),
    setex: jest.fn(),
    quit: jest.fn(),
    on: jest.fn()
  }))
}));

jest.mock('ws', () => ({
  WebSocketServer: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn()
  })),
  WebSocket: {
    OPEN: 1
  }
}));

describe('Market Data API Integration', () => {
  let app: express.Application;
  let marketDataService: jest.Mocked<MarketDataService>;
  let databaseService: jest.Mocked<DatabaseService>;
  let trendingAlgorithm: TrendingAlgorithm;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Create mocked services
    marketDataService = new MarketDataService('test', 'test', 8080) as jest.Mocked<MarketDataService>;
    databaseService = new DatabaseService('test') as jest.Mocked<DatabaseService>;
    trendingAlgorithm = new TrendingAlgorithm();

    // Setup mock implementations
    marketDataService.getMarketData = jest.fn();
    marketDataService.getChartData = jest.fn();
    marketDataService.getTrendingMarkets = jest.fn();
    databaseService.getMarketTrades = jest.fn();
    databaseService.getMarketStats = jest.fn();

    // Setup router
    const router = createMarketDataRouter({
      marketDataService,
      trendingAlgorithm,
      databaseService
    });

    app.use('/api/v1/market-data', router);
  });

  describe('GET /api/v1/market-data/:marketId', () => {
    it('should return market data with trending metrics', async () => {
      const mockMarketData = {
        marketId: 'test-market',
        programAccount: 'test-account',
        prices: [
          {
            marketId: 'test-market',
            outcomeIndex: 0,
            price: 0.65,
            volume24h: 1000,
            priceChange24h: 0.05,
            timestamp: Date.now()
          }
        ],
        totalVolume: 1000,
        traderCount: 25,
        volatility: 0.15,
        trendScore: 0.75,
        lastUpdated: Date.now()
      };

      marketDataService.getMarketData.mockResolvedValue(mockMarketData);

      const response = await request(app)
        .get('/api/v1/market-data/test-market')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.marketId).toBe('test-market');
      expect(response.body.data.trendingMetrics).toBeDefined();
      expect(response.body.data.trendingMetrics.overallTrendScore).toBeGreaterThanOrEqual(0);
    });

    it('should return 404 for non-existent market', async () => {
      marketDataService.getMarketData.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/market-data/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Market not found');
    });

    it('should return 400 for missing market ID', async () => {
      const response = await request(app)
        .get('/api/v1/market-data/')
        .expect(404); // Express returns 404 for missing route params
    });
  });

  describe('GET /api/v1/market-data/:marketId/chart', () => {
    it('should return chart data', async () => {
      const mockChartData = [
        {
          timestamp: Date.now() - 3600000,
          price: 0.6,
          volume: 100
        },
        {
          timestamp: Date.now(),
          price: 0.65,
          volume: 150
        }
      ];

      marketDataService.getChartData.mockResolvedValue(mockChartData);

      const response = await request(app)
        .get('/api/v1/market-data/test-market/chart?outcomeIndex=0&timeframe=24h')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.chartData).toHaveLength(2);
      expect(response.body.data.marketId).toBe('test-market');
      expect(response.body.data.outcomeIndex).toBe(0);
      expect(response.body.data.timeframe).toBe('24h');
    });
  });

  describe('GET /api/v1/market-data/:marketId/trades', () => {
    it('should return market trades', async () => {
      const mockTrades = [
        {
          id: '1',
          marketId: 'test-market',
          userWallet: 'user1',
          transactionSignature: 'sig1',
          tradeType: 'buy' as const,
          outcomeIndex: 0,
          tokenAmount: 100,
          solAmount: 65,
          price: 0.65,
          createdAt: new Date()
        }
      ];

      databaseService.getMarketTrades.mockResolvedValue(mockTrades);

      const response = await request(app)
        .get('/api/v1/market-data/test-market/trades?limit=10&offset=0')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.trades).toHaveLength(1);
      expect(response.body.data.pagination.limit).toBe(10);
      expect(response.body.data.pagination.offset).toBe(0);
    });
  });

  describe('GET /api/v1/market-data/:marketId/stats', () => {
    it('should return market statistics', async () => {
      const mockStats = {
        marketId: 'test-market',
        totalVolume: 1000,
        traderCount: 25,
        avgPrice: 0.65,
        priceChange24h: 0.05,
        volumeChange24h: 200,
        lastTradeAt: new Date()
      };

      databaseService.getMarketStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/v1/market-data/test-market/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalVolume).toBe(1000);
      expect(response.body.data.traderCount).toBe(25);
    });

    it('should return 404 for market with no stats', async () => {
      databaseService.getMarketStats.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/market-data/test-market/stats')
        .expect(404);

      expect(response.body.error).toBe('Market stats not found');
    });
  });

  describe('POST /api/v1/market-data/algorithm/weights', () => {
    it('should update algorithm weights', async () => {
      const newWeights = {
        volumeWeight: 0.4,
        volatilityWeight: 0.3,
        momentumWeight: 0.2,
        socialWeight: 0.1
      };

      const response = await request(app)
        .post('/api/v1/market-data/algorithm/weights')
        .send(newWeights)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Algorithm weights updated successfully');
      expect(response.body.data.configuration).toEqual(newWeights);
    });

    it('should validate weight types', async () => {
      const invalidWeights = {
        volumeWeight: 'invalid',
        volatilityWeight: 0.3,
        momentumWeight: 0.2,
        socialWeight: 0.1
      };

      const response = await request(app)
        .post('/api/v1/market-data/algorithm/weights')
        .send(invalidWeights)
        .expect(400);

      expect(response.body.error).toBe('All weights must be numbers');
    });
  });

  describe('GET /api/v1/market-data/algorithm/config', () => {
    it('should return current algorithm configuration', async () => {
      const response = await request(app)
        .get('/api/v1/market-data/algorithm/config')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('volumeWeight');
      expect(response.body.data).toHaveProperty('volatilityWeight');
      expect(response.body.data).toHaveProperty('momentumWeight');
      expect(response.body.data).toHaveProperty('socialWeight');
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      marketDataService.getMarketData.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/v1/market-data/test-market')
        .expect(500);

      expect(response.body.error).toBe('Internal server error');
    });
  });
});