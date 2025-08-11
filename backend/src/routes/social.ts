import express from 'express';
import { SocialService } from '../services/SocialService';
import { DatabaseService } from '../services/DatabaseService';
import { authenticateWallet, optionalAuth, rateLimit, AuthenticatedRequest } from '../middleware/auth';
import winston from 'winston';
import Joi from 'joi';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'social-api.log' })
  ]
});

// Validation schemas
const createProfileSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(50).optional(),
  bio: Joi.string().max(500).optional(),
  avatarUrl: Joi.string().uri().optional()
});

const createCommentSchema = Joi.object({
  content: Joi.string().min(1).max(1000).required(),
  parentCommentId: Joi.string().uuid().optional()
});

const walletAddressSchema = Joi.string().length(44).pattern(/^[1-9A-HJ-NP-Za-km-z]{44}$/).required();

export function createSocialRouter(services: {
  socialService: SocialService;
  databaseService: DatabaseService;
}): express.Router {
  const router = express.Router();
  const { socialService, databaseService } = services;

  // Apply rate limiting to all social routes
  router.use(rateLimit(60000, 200)); // 200 requests per minute

  // Middleware to validate wallet address in params
  const validateWalletParam = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { walletAddress } = req.params;
    const { error } = walletAddressSchema.validate(walletAddress);
    
    if (error) {
      return res.status(400).json({
        error: 'Invalid wallet address format',
        details: error.details[0].message
      });
    }
    
    return next();
  };

  // User Profile Routes

  /**
   * GET /api/v1/social/users/:walletAddress
   * Get user profile by wallet address
   */
  router.get('/users/:walletAddress', validateWalletParam, async (req, res) => {
    try {
      const { walletAddress } = req.params;
      
      const profile = await socialService.getUserProfile(walletAddress);
      
      if (!profile) {
        return res.status(404).json({
          error: 'User profile not found'
        });
      }

      res.json({
        success: true,
        data: profile
      });

    } catch (error) {
      logger.error('Error fetching user profile:', error);
      res.status(500).json({
        error: 'Failed to fetch user profile',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/social/users/:walletAddress
   * Create or update user profile
   */
  router.post('/users/:walletAddress', validateWalletParam, authenticateWallet, async (req: AuthenticatedRequest, res) => {
    try {
      const { walletAddress } = req.params;
      
      // Ensure user can only update their own profile
      if (req.userWallet !== walletAddress) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only update your own profile'
        });
      }
      
      // Validate request body
      const { error, value } = createProfileSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Invalid profile data',
          details: error.details[0].message
        });
      }

      const profile = await socialService.createOrUpdateUserProfile(walletAddress, value);

      res.json({
        success: true,
        data: profile
      });

    } catch (error) {
      logger.error('Error creating/updating user profile:', error);
      res.status(500).json({
        error: 'Failed to create/update user profile',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/v1/social/users/:walletAddress/achievements
   * Get user achievements
   */
  router.get('/users/:walletAddress/achievements', validateWalletParam, async (req, res) => {
    try {
      const { walletAddress } = req.params;
      
      const achievements = await socialService.checkMilestoneAchievements(walletAddress);

      res.json({
        success: true,
        data: achievements
      });

    } catch (error) {
      logger.error('Error fetching user achievements:', error);
      res.status(500).json({
        error: 'Failed to fetch user achievements',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/v1/social/users/:walletAddress/trades
   * Get user trading history
   */
  router.get('/users/:walletAddress/trades', validateWalletParam, async (req, res) => {
    try {
      const { walletAddress } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      
      const trades = await databaseService.getUserTrades(walletAddress, limit);

      res.json({
        success: true,
        data: trades,
        pagination: {
          limit,
          count: trades.length
        }
      });

    } catch (error) {
      logger.error('Error fetching user trades:', error);
      res.status(500).json({
        error: 'Failed to fetch user trades',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Follow System Routes

  /**
   * POST /api/v1/social/users/:walletAddress/follow
   * Follow or unfollow a user
   */
  router.post('/users/:walletAddress/follow', validateWalletParam, authenticateWallet, async (req: AuthenticatedRequest, res) => {
    try {
      const { walletAddress: targetWallet } = req.params;
      const followerWallet = req.userWallet!; // From authentication middleware

      const isFollowing = await socialService.toggleUserFollow(followerWallet, targetWallet);

      res.json({
        success: true,
        data: {
          isFollowing,
          followerWallet,
          followingWallet: targetWallet
        }
      });

    } catch (error) {
      logger.error('Error toggling user follow:', error);
      res.status(500).json({
        error: 'Failed to toggle user follow',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Comment System Routes

  /**
   * GET /api/v1/social/markets/:marketId/comments
   * Get comments for a market
   */
  router.get('/markets/:marketId/comments', async (req, res) => {
    try {
      const { marketId } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
      const includeReplies = req.query.includeReplies !== 'false';

      // Validate marketId as UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(marketId)) {
        return res.status(400).json({
          error: 'Invalid market ID format'
        });
      }

      const comments = await socialService.getMarketComments(marketId, limit, offset, includeReplies);

      res.json({
        success: true,
        data: comments,
        pagination: {
          limit,
          offset,
          count: comments.length
        }
      });

    } catch (error) {
      logger.error('Error fetching market comments:', error);
      res.status(500).json({
        error: 'Failed to fetch market comments',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/social/markets/:marketId/comments
   * Create a comment on a market
   */
  router.post('/markets/:marketId/comments', authenticateWallet, async (req: AuthenticatedRequest, res) => {
    try {
      const { marketId } = req.params;
      const userWallet = req.userWallet!; // From authentication middleware

      // Validate marketId as UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(marketId)) {
        return res.status(400).json({
          error: 'Invalid market ID format'
        });
      }

      // Validate comment data
      const { error, value } = createCommentSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Invalid comment data',
          details: error.details[0].message
        });
      }

      const comment = await socialService.createComment(
        marketId,
        userWallet,
        value.content,
        value.parentCommentId
      );

      res.status(201).json({
        success: true,
        data: comment
      });

    } catch (error) {
      logger.error('Error creating comment:', error);
      res.status(500).json({
        error: 'Failed to create comment',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/social/comments/:commentId/like
   * Like or unlike a comment
   */
  router.post('/comments/:commentId/like', authenticateWallet, async (req: AuthenticatedRequest, res) => {
    try {
      const { commentId } = req.params;
      const userWallet = req.userWallet!; // From authentication middleware

      // Validate commentId as UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(commentId)) {
        return res.status(400).json({
          error: 'Invalid comment ID format'
        });
      }

      const isLiked = await socialService.toggleCommentLike(commentId, userWallet);

      res.json({
        success: true,
        data: {
          isLiked,
          commentId,
          userWallet
        }
      });

    } catch (error) {
      logger.error('Error toggling comment like:', error);
      res.status(500).json({
        error: 'Failed to toggle comment like',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Leaderboard Routes

  /**
   * GET /api/v1/social/leaderboard
   * Get user leaderboard
   */
  router.get('/leaderboard', async (req, res) => {
    try {
      const sortBy = req.query.sortBy as 'reputation' | 'profit' | 'volume' | 'winRate' || 'reputation';
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      const validSortOptions = ['reputation', 'profit', 'volume', 'winRate'];
      if (!validSortOptions.includes(sortBy)) {
        return res.status(400).json({
          error: 'Invalid sortBy parameter',
          validOptions: validSortOptions
        });
      }

      const leaderboard = await socialService.getUserLeaderboard(sortBy, limit);

      res.json({
        success: true,
        data: leaderboard,
        meta: {
          sortBy,
          limit,
          count: leaderboard.length
        }
      });

    } catch (error) {
      logger.error('Error fetching leaderboard:', error);
      res.status(500).json({
        error: 'Failed to fetch leaderboard',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/v1/social/feed
   * Get social feed with user activities
   */
  router.get('/feed', optionalAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userWallet = req.query.userWallet as string;
      const following = req.query.following === 'true';
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

      // Mock feed data for now - in real implementation, this would aggregate from various sources
      const mockFeedItems = [
        {
          id: '1',
          type: 'trade',
          userWallet: 'ABC123...XYZ789',
          username: 'CryptoTrader',
          avatarUrl: null,
          isVerified: true,
          timestamp: new Date(Date.now() - 1000 * 60 * 30),
          content: {
            marketId: 'market-1',
            marketTitle: 'Will Bitcoin reach $100K by end of 2024?',
            tradeAmount: 50,
            outcome: 'Yes'
          },
          engagement: {
            likes: 12,
            comments: 3,
            shares: 2,
            isLiked: false
          }
        },
        {
          id: '2',
          type: 'achievement',
          userWallet: 'DEF456...ABC123',
          username: 'PredictionMaster',
          avatarUrl: null,
          isVerified: false,
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
          content: {
            achievementName: 'Oracle',
            achievementDescription: 'Achieved 70% win rate with 20+ trades'
          },
          engagement: {
            likes: 25,
            comments: 8,
            shares: 5,
            isLiked: true
          }
        }
      ];

      res.json({
        success: true,
        data: mockFeedItems,
        pagination: {
          limit,
          offset,
          count: mockFeedItems.length,
          hasMore: offset + mockFeedItems.length < 100 // Mock total
        }
      });

    } catch (error) {
      logger.error('Error fetching social feed:', error);
      res.status(500).json({
        error: 'Failed to fetch social feed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Health check for social service
  router.get('/health', (req, res) => {
    res.json({
      status: 'OK',
      service: 'social',
      timestamp: new Date().toISOString()
    });
  });

  return router;
}