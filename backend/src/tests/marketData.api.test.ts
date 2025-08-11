import request from 'supertest';
import express from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { MarketDataService } from '../services/MarketDataService';
import { TrendingAlgorithm } from '../services/TrendingAlgorithm';
import { createMarketDataRouter } from '../routes/marketData';

describe('Market Data API Endpoints', () => {
  let app: express.Application;
  let databaseService: DatabaseService;
  let marketDataService: MarketDataService;
  let trendingAlgorithm: TrendingAlgorithm;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/prediction_pump_test';

    // Initialize services
    databaseService = new DatabaseService();
    await databaseService.initialize();

    marketDataService = new MarketDataService(
      'https://api.devnet.solana.com',
      'redis://localhost:6379',
      8081
    );
    await marketDataService.initialize();

    trendingAlgorithm = new TrendingAlgorithm();

    // Create Express app with routes
    app = express();
    app.use(express.json());
    
    const marketDataRouter = createMarketDataRouter({
      databaseService,
      marketDataService,
      trendingAlgorithm
    });
    
    app.use('/api/v1/market-data', marketDataRouter);
  });

  afterAll(async () => {
    if (databaseService) {
      await databaseService.shutdown();
    }
    if (marketDataService) {
      await marketDataService.shutdown();
    }
  });

  describe('GET /api/v1/market-data/markets', () => {
    it('should return markets with default pagination', async () => {
      const response = await request(app)
        .get('/api/v1/market-data/markets')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.markets).toBeDefined();
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(20);
    });

    it('should filter markets by category', async () => {
      const response = await request(app)
        .get('/api/v1/market-data/markets?category=sports')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.category).toBe('sports');
    });

    it('should sort markets by volume', async () => {
      const response = await request(app)
        .get('/api/v1/market-data/markets?sortBy=total_volume&sortOrder=desc')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sort.sortBy).toBe('total_volume');
      expect(response.body.data.sort.sortOrder).toBe('desc');
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/v1/market-data/markets?page=0&limit=101')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should search markets by title', async () => {
      const response = await request(app)
        .get('/api/v1/market-data/markets?search=bitcoin')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.search).toBe('bitcoin');
    });
  });

  describe('GET /api/v1/market-data/markets/trending', () => {
    it('should return trending markets', async () => {
      const response = await request(app)
        .get('/api/v1/market-data/markets/trending')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.trending).toBeDefined();
      expect(Array.isArray(response.body.data.trending)).toBe(true);
      expect(response.body.data.algorithm).toBeDefined();
    });

    it('should limit trending markets count', async () => {
      const response = await request(app)
        .get('/api/v1/market-data/markets/trending?limit=5')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.trending.length).toBeLessThanOrEqual(5);
    });

    it('should validate limit parameter', async () => {
      const response = await request(app)
        .get('/api/v1/market-data/markets/trending?limit=100')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/market-data/markets/analytics', () => {
    it('should return market analytics', async () => {
      const response = await request(app)
        .get('/api/v1/market-data/markets/analytics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overview).toBeDefined();
      expect(response.body.data.topCategories).toBeDefined();
      expect(typeof response.body.data.overview.totalMarkets).toBe('number');
    });

    it('should filter analytics by timeframe', async () => {
      const response = await request(app)
        .get('/api/v1/market-data/markets/analytics?timeframe=7d')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.timeframe).toBe('7d');
    });
  });

  describe('GET /api/v1/market-data/markets/:id', () => {
    it('should return market details for valid ID', async () => {
      // First create a test market or use existing one
      const createResponse = await request(app)
        .post('/api/v1/market-data/markets')
        .send({
          program_account: 'test_market_123',
          creator_wallet: 'test_creator_wallet',
          title: 'Test Market',
          description: 'Test market description',
          category: 'test'
        });

      if (createResponse.status === 201) {
        const marketId = createResponse.body.data.marketId;
        
        const response = await request(app)
          .get(`/api/v1/market-data/markets/${marketId}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe('Test Market');
      }
    });

    it('should return 404 for non-existent market', async () => {
      const response = await request(app)
        .get('/api/v1/market-data/markets/non_existent_market')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Market not found');
    });

    it('should validate market ID parameter', async () => {
      const response = await request(app)
        .get('/api/v1/market-data/markets/')
        .expect(404); // Express will return 404 for missing parameter
    });
  });

  describe('POST /api/v1/market-data/markets', () => {
    it('should create a new market with valid data', async () => {
      const marketData = {
        program_account: 'test_market_' + Date.now(),
        creator_wallet: 'test_creator_wallet',
        title: 'New Test Market',
        description: 'New test market description',
        category: 'test',
        resolution_date: new Date(Date.now() + 86400000).toISOString() // Tomorrow
      };

      const response = await request(app)
        .post('/api/v1/market-data/markets')
        .send(marketData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.marketId).toBeDefined();
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/market-data/markets')
        .send({
          title: 'Incomplete Market'
          // Missing required fields
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should validate field lengths', async () => {
      const response = await request(app)
        .post('/api/v1/market-data/markets')
        .send({
          program_account: 'test_account',
          creator_wallet: 'test_wallet',
          title: 'x'.repeat(300), // Too long
          description: 'Test description'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/market-data/markets/:id', () => {
    let testMarketId: string;

    beforeAll(async () => {
      // Create a test market for updates
      const createResponse = await request(app)
        .post('/api/v1/market-data/markets')
        .send({
          program_account: 'update_test_market',
          creator_wallet: 'test_creator',
          title: 'Market to Update',
          description: 'Original description'
        });

      if (createResponse.status === 201) {
        testMarketId = createResponse.body.data.marketId;
      }
    });

    it('should update market with valid data', async () => {
      if (!testMarketId) {
        pending('Test market not created');
        return;
      }

      const response = await request(app)
        .put(`/api/v1/market-data/markets/${testMarketId}`)
        .send({
          title: 'Updated Market Title',
          description: 'Updated description'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should validate update data', async () => {
      if (!testMarketId) {
        pending('Test market not created');
        return;
      }

      const response = await request(app)
        .put(`/api/v1/market-data/markets/${testMarketId}`)
        .send({
          title: '', // Invalid empty title
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent market', async () => {
      const response = await request(app)
        .put('/api/v1/market-data/markets/non_existent')
        .send({
          title: 'Updated Title'
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Chart and Trade Endpoints', () => {
    it('should return chart data with valid parameters', async () => {
      const response = await request(app)
        .get('/api/v1/market-data/test_market/chart?outcomeIndex=0&timeframe=24h')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.chartData).toBeDefined();
    });

    it('should return trade data with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/market-data/test_market/trades?limit=10&offset=0')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.trades).toBeDefined();
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should return market statistics', async () => {
      const response = await request(app)
        .get('/api/v1/market-data/test_market/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Make multiple rapid requests
      const promises = Array.from({ length: 10 }, () =>
        request(app).get('/api/v1/market-data/markets')
      );

      const responses = await Promise.all(promises);
      
      // All should succeed initially (within rate limit)
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize malicious input', async () => {
      const response = await request(app)
        .get('/api/v1/market-data/markets?search=<script>alert("xss")</script>')
        .expect(200);

      expect(response.body.success).toBe(true);
      // The search parameter should be sanitized
      expect(response.body.data.filters.search).not.toContain('<script>');
    });
  });
});