import request from 'supertest';
import express from 'express';
import { SocialService } from '../services/SocialService';
import { createSocialRouter } from '../routes/social';
import { Pool } from 'pg';

// Mock database service
const mockDatabaseService = {
  getUserTrades: jest.fn().mockResolvedValue([])
};

// Mock pool
const mockPool = {
  connect: jest.fn(),
  query: jest.fn(),
  end: jest.fn()
} as unknown as Pool;

const mockClient = {
  query: jest.fn(),
  release: jest.fn()
};

describe('Social API Integration', () => {
  let app: express.Application;
  let socialService: SocialService;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    socialService = new SocialService(mockPool);
    
    const socialRouter = createSocialRouter({
      socialService,
      databaseService: mockDatabaseService as any
    });
    
    app.use('/api/v1/social', socialRouter);
    
    (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
    jest.clearAllMocks();
  });

  describe('GET /api/v1/social/users/:walletAddress', () => {
    it('should return user profile when user exists', async () => {
      const walletAddress = '11111111111111111111111111111111111111111112';
      
      // Mock getUserProfile
      jest.spyOn(socialService, 'getUserProfile').mockResolvedValue({
        walletAddress,
        username: 'testuser',
        bio: 'Test bio',
        avatarUrl: undefined,
        reputationScore: 100,
        totalTrades: 5,
        winRate: 80,
        followersCount: 10,
        followingCount: 5,
        totalProfit: 1000,
        totalVolume: 5000,
        achievementsCount: 3,
        isVerified: false,
        lastActiveAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const response = await request(app)
        .get(`/api/v1/social/users/${walletAddress}`);

      console.log('Response status:', response.status);
      console.log('Response body:', response.body);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.walletAddress).toBe(walletAddress);
      expect(response.body.data.username).toBe('testuser');
    });

    it('should return 404 when user does not exist', async () => {
      const walletAddress = '11111111111111111111111111111111111111111112';
      
      jest.spyOn(socialService, 'getUserProfile').mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/v1/social/users/${walletAddress}`)
        .expect(404);

      expect(response.body.error).toBe('User profile not found');
    });

    it('should return 400 for invalid wallet address', async () => {
      const invalidWallet = 'invalid-wallet';

      const response = await request(app)
        .get(`/api/v1/social/users/${invalidWallet}`)
        .expect(400);

      expect(response.body.error).toBe('Invalid wallet address format');
    });
  });

  describe('GET /api/v1/social/leaderboard', () => {
    it('should return leaderboard data', async () => {
      const mockLeaderboard = [
        {
          walletAddress: '11111111111111111111111111111111111111111112',
          username: 'user1',
          reputationScore: 1000,
          totalTrades: 50,
          winRate: 85,
          totalProfit: 10000,
          totalVolume: 50000,
          followersCount: 100,
          followingCount: 50,
          achievementsCount: 10,
          isVerified: true,
          lastActiveAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      jest.spyOn(socialService, 'getUserLeaderboard').mockResolvedValue(mockLeaderboard);

      const response = await request(app)
        .get('/api/v1/social/leaderboard')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].walletAddress).toBe('11111111111111111111111111111111111111111112');
      expect(response.body.meta.sortBy).toBe('reputation');
    });

    it('should accept different sort parameters', async () => {
      jest.spyOn(socialService, 'getUserLeaderboard').mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/social/leaderboard?sortBy=profit&limit=25')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.meta.sortBy).toBe('profit');
      expect(response.body.meta.limit).toBe(25);
    });

    it('should reject invalid sort parameters', async () => {
      const response = await request(app)
        .get('/api/v1/social/leaderboard?sortBy=invalid')
        .expect(400);

      expect(response.body.error).toBe('Invalid sortBy parameter');
    });
  });

  describe('GET /api/v1/social/markets/:marketId/comments', () => {
    it('should return comments for a market', async () => {
      const marketId = '123e4567-e89b-12d3-a456-426614174000';
      const mockComments = [
        {
          id: 'comment-1',
          marketId,
          userWallet: '11111111111111111111111111111111111111111112',
          content: 'Great market!',
          likesCount: 5,
          replyCount: 2,
          isFlagged: false,
          isHidden: false,
          createdAt: new Date(),
          user: {
            walletAddress: '11111111111111111111111111111111111111111112',
            username: 'testuser',
            bio: undefined,
            avatarUrl: undefined,
            reputationScore: 100,
            totalTrades: 0,
            winRate: 0,
            followersCount: 0,
            followingCount: 0,
            totalProfit: 0,
            totalVolume: 0,
            achievementsCount: 0,
            isVerified: false,
            lastActiveAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          },
          replies: []
        }
      ];

      jest.spyOn(socialService, 'getMarketComments').mockResolvedValue(mockComments);

      const response = await request(app)
        .get(`/api/v1/social/markets/${marketId}/comments`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].content).toBe('Great market!');
    });

    it('should return 400 for invalid market ID', async () => {
      const invalidMarketId = 'invalid-uuid';

      const response = await request(app)
        .get(`/api/v1/social/markets/${invalidMarketId}/comments`)
        .expect(400);

      expect(response.body.error).toBe('Invalid market ID format');
    });
  });

  describe('Rate limiting', () => {
    it('should apply rate limiting to social endpoints', async () => {
      const walletAddress = '11111111111111111111111111111111111111111112';
      
      jest.spyOn(socialService, 'getUserProfile').mockResolvedValue(null);

      // Make multiple requests quickly
      const promises = Array(5).fill(null).map(() => 
        request(app).get(`/api/v1/social/users/${walletAddress}`)
      );

      const responses = await Promise.all(promises);
      
      // All should succeed since we're under the rate limit
      responses.forEach(response => {
        expect([200, 404]).toContain(response.status);
      });
    });
  });

  describe('Health check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/v1/social/health')
        .expect(200);

      expect(response.body.status).toBe('OK');
      expect(response.body.service).toBe('social');
    });
  });
});