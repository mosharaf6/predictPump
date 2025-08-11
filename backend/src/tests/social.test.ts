import { SocialService } from '../services/SocialService';
import { Pool } from 'pg';

// Mock database pool for testing
const mockPool = {
  connect: jest.fn(),
  query: jest.fn(),
  end: jest.fn()
} as unknown as Pool;

const mockClient = {
  query: jest.fn(),
  release: jest.fn()
};

describe('SocialService', () => {
  let socialService: SocialService;

  beforeEach(() => {
    socialService = new SocialService(mockPool);
    (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
    jest.clearAllMocks();
  });

  describe('createOrUpdateUserProfile', () => {
    it('should create a new user profile', async () => {
      const walletAddress = '11111111111111111111111111111112'; // Valid base58 address
      const profileData = {
        username: 'testuser',
        bio: 'Test bio',
        avatarUrl: 'https://example.com/avatar.jpg'
      };

      // Mock database responses
      mockClient.query
        .mockResolvedValueOnce('BEGIN') // BEGIN transaction
        .mockResolvedValueOnce({ rows: [] }) // User doesn't exist
        .mockResolvedValueOnce({ // Insert new user
          rows: [{
            wallet_address: walletAddress,
            username: profileData.username,
            bio: profileData.bio,
            avatar_url: profileData.avatarUrl,
            reputation_score: 0,
            total_trades: 0,
            win_rate: 0,
            followers_count: 0,
            following_count: 0,
            total_profit: 0,
            total_volume: 0,
            achievements_count: 0,
            is_verified: false,
            last_active_at: new Date(),
            created_at: new Date(),
            updated_at: new Date()
          }]
        })
        .mockResolvedValueOnce('COMMIT'); // COMMIT transaction

      const result = await socialService.createOrUpdateUserProfile(walletAddress, profileData);

      expect(result.walletAddress).toBe(walletAddress);
      expect(result.username).toBe(profileData.username);
      expect(result.bio).toBe(profileData.bio);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should reject invalid wallet address', async () => {
      const invalidWallet = 'invalid-wallet';
      const profileData = { username: 'testuser' };

      await expect(
        socialService.createOrUpdateUserProfile(invalidWallet, profileData)
      ).rejects.toThrow('Invalid Solana wallet address');
    });
  });

  describe('createComment', () => {
    it('should create a comment successfully', async () => {
      const marketId = '123e4567-e89b-12d3-a456-426614174000';
      const userWallet = '11111111111111111111111111111112';
      const content = 'This is a test comment';

      mockClient.query
        .mockResolvedValueOnce('BEGIN') // BEGIN transaction
        .mockResolvedValueOnce({ rows: [{ id: marketId }] }) // Market exists
        .mockResolvedValueOnce({ // Insert comment
          rows: [{
            id: 'comment-id',
            market_id: marketId,
            user_wallet: userWallet,
            content: content,
            likes_count: 0,
            reply_count: 0,
            parent_comment_id: null,
            is_flagged: false,
            is_hidden: false,
            created_at: new Date()
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // Update user last active
        .mockResolvedValueOnce('COMMIT'); // COMMIT transaction

      const result = await socialService.createComment(marketId, userWallet, content);

      expect(result.content).toBe(content);
      expect(result.userWallet).toBe(userWallet);
      expect(result.marketId).toBe(marketId);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should reject empty comment content', async () => {
      const marketId = '123e4567-e89b-12d3-a456-426614174000';
      const userWallet = '11111111111111111111111111111112';
      const content = '';

      await expect(
        socialService.createComment(marketId, userWallet, content)
      ).rejects.toThrow('Comment content cannot be empty');
    });

    it('should reject comment content that is too long', async () => {
      const marketId = '123e4567-e89b-12d3-a456-426614174000';
      const userWallet = '11111111111111111111111111111112';
      const content = 'a'.repeat(1001); // Too long

      await expect(
        socialService.createComment(marketId, userWallet, content)
      ).rejects.toThrow('Comment content too long');
    });
  });

  describe('toggleUserFollow', () => {
    it('should follow a user successfully', async () => {
      const followerWallet = '11111111111111111111111111111112';
      const followingWallet = '11111111111111111111111111111113';

      mockClient.query
        .mockResolvedValueOnce('BEGIN') // BEGIN transaction
        .mockResolvedValueOnce({ rows: [] }) // No existing follow
        .mockResolvedValueOnce({ rows: [] }) // Insert follow
        .mockResolvedValueOnce({ rows: [] }) // Update follower count
        .mockResolvedValueOnce({ rows: [] }) // Update following count
        .mockResolvedValueOnce('COMMIT'); // COMMIT transaction

      const result = await socialService.toggleUserFollow(followerWallet, followingWallet);

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should prevent self-following', async () => {
      const wallet = '11111111111111111111111111111112';

      await expect(
        socialService.toggleUserFollow(wallet, wallet)
      ).rejects.toThrow('Cannot follow yourself');
    });
  });

  describe('awardAchievement', () => {
    it('should award achievement successfully', async () => {
      const userWallet = '11111111111111111111111111111112';
      const achievementType = 'first_trade';
      const achievementName = 'First Trade';
      const description = 'Made your first trade';

      mockClient.query
        .mockResolvedValueOnce('BEGIN') // BEGIN transaction
        .mockResolvedValueOnce({ rows: [] }) // No existing achievement
        .mockResolvedValueOnce({ // Insert achievement
          rows: [{
            id: 'achievement-id',
            user_wallet: userWallet,
            achievement_type: achievementType,
            achievement_name: achievementName,
            description: description,
            earned_at: new Date(),
            metadata: '{}'
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // Update achievement count
        .mockResolvedValueOnce('COMMIT'); // COMMIT transaction

      const result = await socialService.awardAchievement(
        userWallet,
        achievementType,
        achievementName,
        description
      );

      expect(result.achievementType).toBe(achievementType);
      expect(result.achievementName).toBe(achievementName);
      expect(result.userWallet).toBe(userWallet);
    });

    it('should prevent duplicate achievements', async () => {
      const userWallet = '11111111111111111111111111111112';
      const achievementType = 'first_trade';

      mockClient.query
        .mockResolvedValueOnce('BEGIN') // BEGIN transaction
        .mockResolvedValueOnce({ rows: [{ id: 'existing' }] }); // Achievement exists

      await expect(
        socialService.awardAchievement(userWallet, achievementType, 'Test', 'Test')
      ).rejects.toThrow('User already has this achievement');
    });
  });

  describe('checkMilestoneAchievements', () => {
    it('should check and award milestone achievements', async () => {
      const userWallet = '11111111111111111111111111111112';
      
      // Mock getUserProfile to return a user with qualifying stats
      const mockUser = {
        walletAddress: userWallet,
        totalTrades: 10,
        totalProfit: 1000,
        totalVolume: 5000,
        winRate: 75,
        reputationScore: 100,
        followersCount: 0,
        followingCount: 0,
        achievementsCount: 0,
        isVerified: false,
        lastActiveAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock the database calls for checking existing achievements and awarding new ones
      jest.spyOn(socialService, 'getUserProfile').mockResolvedValue(mockUser);
      
      // Mock pool.query for achievement checks
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // No first_trade achievement
        .mockResolvedValueOnce({ rows: [] }) // No trader_10 achievement
        .mockResolvedValueOnce({ rows: [{ id: 'existing' }] }); // Has trader_100 achievement

      // Mock awardAchievement calls
      jest.spyOn(socialService, 'awardAchievement')
        .mockResolvedValueOnce({
          id: 'ach1',
          userWallet,
          achievementType: 'first_trade',
          achievementName: 'First Trade',
          description: 'Made your first trade',
          earnedAt: new Date(),
          metadata: {}
        })
        .mockResolvedValueOnce({
          id: 'ach2',
          userWallet,
          achievementType: 'trader_10',
          achievementName: 'Active Trader',
          description: 'Completed 10 trades',
          earnedAt: new Date(),
          metadata: {}
        });

      const achievements = await socialService.checkMilestoneAchievements(userWallet);

      expect(achievements).toHaveLength(2);
      expect(achievements[0].achievementType).toBe('first_trade');
      expect(achievements[1].achievementType).toBe('trader_10');
    });
  });
});