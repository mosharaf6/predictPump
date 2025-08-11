import { Pool, PoolClient } from 'pg';
import winston from 'winston';
import { PublicKey } from '@solana/web3.js';
import crypto from 'crypto';

export interface UserProfile {
  walletAddress: string;
  username?: string;
  bio?: string;
  avatarUrl?: string;
  reputationScore: number;
  totalTrades: number;
  winRate: number;
  followersCount: number;
  followingCount: number;
  totalProfit: number;
  totalVolume: number;
  achievementsCount: number;
  isVerified: boolean;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: string;
  marketId: string;
  userWallet: string;
  content: string;
  likesCount: number;
  replyCount: number;
  parentCommentId?: string;
  isFlagged: boolean;
  isHidden: boolean;
  createdAt: Date;
  user?: UserProfile;
  replies?: Comment[];
}

export interface Achievement {
  id: string;
  userWallet: string;
  achievementType: string;
  achievementName: string;
  description: string;
  earnedAt: Date;
  metadata: Record<string, any>;
}

export interface UserFollow {
  id: string;
  followerWallet: string;
  followingWallet: string;
  createdAt: Date;
}

export interface ReputationChange {
  id: string;
  userWallet: string;
  reputationChange: number;
  reason: string;
  relatedMarketId?: string;
  relatedTradeId?: string;
  createdAt: Date;
}

export interface MarketPrediction {
  id: string;
  marketId: string;
  userWallet: string;
  predictedOutcome: number;
  confidenceLevel: number;
  reasoning?: string;
  createdAt: Date;
}

export interface UserNotification {
  id: string;
  userWallet: string;
  notificationType: string;
  title: string;
  message: string;
  isRead: boolean;
  relatedMarketId?: string;
  relatedUserWallet?: string;
  createdAt: Date;
}

export class SocialService {
  private pool: Pool;
  private logger: winston.Logger;

  constructor(pool: Pool) {
    this.pool = pool;
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'social.log' })
      ]
    });
  }

  /**
   * Create or update user profile
   */
  async createOrUpdateUserProfile(
    walletAddress: string,
    profileData: Partial<UserProfile>
  ): Promise<UserProfile> {
    const client = await this.pool.connect();
    
    try {
      // Validate wallet address
      if (!this.isValidSolanaAddress(walletAddress)) {
        throw new Error('Invalid Solana wallet address');
      }

      await client.query('BEGIN');

      // Check if user exists
      const existingUser = await client.query(
        'SELECT * FROM users WHERE wallet_address = $1',
        [walletAddress]
      );

      let user: UserProfile;

      if (existingUser.rows.length === 0) {
        // Create new user
        const result = await client.query(`
          INSERT INTO users (
            wallet_address, username, bio, avatar_url, last_active_at
          ) VALUES ($1, $2, $3, $4, NOW())
          RETURNING *
        `, [
          walletAddress,
          profileData.username || null,
          profileData.bio || null,
          profileData.avatarUrl || null
        ]);

        user = this.mapUserRow(result.rows[0]);
        this.logger.info(`Created new user profile: ${walletAddress}`);
      } else {
        // Update existing user
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;

        if (profileData.username !== undefined) {
          updateFields.push(`username = $${paramIndex++}`);
          updateValues.push(profileData.username);
        }
        if (profileData.bio !== undefined) {
          updateFields.push(`bio = $${paramIndex++}`);
          updateValues.push(profileData.bio);
        }
        if (profileData.avatarUrl !== undefined) {
          updateFields.push(`avatar_url = $${paramIndex++}`);
          updateValues.push(profileData.avatarUrl);
        }

        updateFields.push(`updated_at = NOW()`);
        updateFields.push(`last_active_at = NOW()`);
        updateValues.push(walletAddress);

        const result = await client.query(`
          UPDATE users SET ${updateFields.join(', ')}
          WHERE wallet_address = $${paramIndex}
          RETURNING *
        `, updateValues);

        user = this.mapUserRow(result.rows[0]);
        this.logger.info(`Updated user profile: ${walletAddress}`);
      }

      await client.query('COMMIT');
      return user;

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Error creating/updating user profile:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user profile by wallet address
   */
  async getUserProfile(walletAddress: string): Promise<UserProfile | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM users WHERE wallet_address = $1',
        [walletAddress]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapUserRow(result.rows[0]);

    } catch (error) {
      this.logger.error(`Error fetching user profile for ${walletAddress}:`, error);
      return null;
    }
  }

  /**
   * Create a comment on a market
   */
  async createComment(
    marketId: string,
    userWallet: string,
    content: string,
    parentCommentId?: string
  ): Promise<Comment> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Validate content
      if (!content || content.trim().length === 0) {
        throw new Error('Comment content cannot be empty');
      }

      if (content.length > 1000) {
        throw new Error('Comment content too long (max 1000 characters)');
      }

      // Check if market exists
      const marketCheck = await client.query(
        'SELECT id FROM markets WHERE id = $1',
        [marketId]
      );

      if (marketCheck.rows.length === 0) {
        throw new Error('Market not found');
      }

      // Create comment
      const result = await client.query(`
        INSERT INTO comments (
          market_id, user_wallet, content, parent_comment_id
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [marketId, userWallet, content.trim(), parentCommentId || null]);

      // Update parent comment reply count if this is a reply
      if (parentCommentId) {
        await client.query(`
          UPDATE comments 
          SET reply_count = reply_count + 1 
          WHERE id = $1
        `, [parentCommentId]);
      }

      // Update user's last active timestamp
      await client.query(`
        UPDATE users 
        SET last_active_at = NOW() 
        WHERE wallet_address = $1
      `, [userWallet]);

      await client.query('COMMIT');

      const comment = this.mapCommentRow(result.rows[0]);
      this.logger.info(`Created comment: ${comment.id} by ${userWallet}`);

      return comment;

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Error creating comment:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get comments for a market with pagination
   */
  async getMarketComments(
    marketId: string,
    limit: number = 20,
    offset: number = 0,
    includeReplies: boolean = true
  ): Promise<Comment[]> {
    try {
      // Get top-level comments first
      const result = await this.pool.query(`
        SELECT 
          c.*,
          u.username,
          u.avatar_url,
          u.reputation_score,
          u.is_verified
        FROM comments c
        LEFT JOIN users u ON c.user_wallet = u.wallet_address
        WHERE c.market_id = $1 AND c.parent_comment_id IS NULL AND c.is_hidden = FALSE
        ORDER BY c.created_at DESC
        LIMIT $2 OFFSET $3
      `, [marketId, limit, offset]);

      const comments = result.rows.map(row => this.mapCommentRowWithUser(row));

      // Get replies if requested
      if (includeReplies && comments.length > 0) {
        const commentIds = comments.map(c => c.id);
        const repliesResult = await this.pool.query(`
          SELECT 
            c.*,
            u.username,
            u.avatar_url,
            u.reputation_score,
            u.is_verified
          FROM comments c
          LEFT JOIN users u ON c.user_wallet = u.wallet_address
          WHERE c.parent_comment_id = ANY($1) AND c.is_hidden = FALSE
          ORDER BY c.created_at ASC
        `, [commentIds]);

        const repliesMap = new Map<string, Comment[]>();
        repliesResult.rows.forEach(row => {
          const reply = this.mapCommentRowWithUser(row);
          const parentId = row.parent_comment_id;
          if (!repliesMap.has(parentId)) {
            repliesMap.set(parentId, []);
          }
          repliesMap.get(parentId)!.push(reply);
        });

        // Attach replies to comments
        comments.forEach(comment => {
          comment.replies = repliesMap.get(comment.id) || [];
        });
      }

      return comments;

    } catch (error) {
      this.logger.error(`Error fetching comments for market ${marketId}:`, error);
      return [];
    }
  }

  /**
   * Like or unlike a comment
   */
  async toggleCommentLike(commentId: string, userWallet: string): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if like already exists
      const existingLike = await client.query(
        'SELECT id FROM comment_likes WHERE comment_id = $1 AND user_wallet = $2',
        [commentId, userWallet]
      );

      let isLiked: boolean;

      if (existingLike.rows.length > 0) {
        // Remove like
        await client.query(
          'DELETE FROM comment_likes WHERE comment_id = $1 AND user_wallet = $2',
          [commentId, userWallet]
        );
        
        await client.query(
          'UPDATE comments SET likes_count = likes_count - 1 WHERE id = $1',
          [commentId]
        );
        
        isLiked = false;
        this.logger.info(`Removed like: ${commentId} by ${userWallet}`);
      } else {
        // Add like
        await client.query(
          'INSERT INTO comment_likes (comment_id, user_wallet) VALUES ($1, $2)',
          [commentId, userWallet]
        );
        
        await client.query(
          'UPDATE comments SET likes_count = likes_count + 1 WHERE id = $1',
          [commentId]
        );
        
        isLiked = true;
        this.logger.info(`Added like: ${commentId} by ${userWallet}`);
      }

      await client.query('COMMIT');
      return isLiked;

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Error toggling comment like:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Follow or unfollow a user
   */
  async toggleUserFollow(followerWallet: string, followingWallet: string): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      if (followerWallet === followingWallet) {
        throw new Error('Cannot follow yourself');
      }

      await client.query('BEGIN');

      // Check if follow already exists
      const existingFollow = await client.query(
        'SELECT id FROM user_follows WHERE follower_wallet = $1 AND following_wallet = $2',
        [followerWallet, followingWallet]
      );

      let isFollowing: boolean;

      if (existingFollow.rows.length > 0) {
        // Unfollow
        await client.query(
          'DELETE FROM user_follows WHERE follower_wallet = $1 AND following_wallet = $2',
          [followerWallet, followingWallet]
        );
        
        // Update counts
        await client.query(
          'UPDATE users SET following_count = following_count - 1 WHERE wallet_address = $1',
          [followerWallet]
        );
        await client.query(
          'UPDATE users SET followers_count = followers_count - 1 WHERE wallet_address = $1',
          [followingWallet]
        );
        
        isFollowing = false;
        this.logger.info(`Unfollowed: ${followerWallet} -> ${followingWallet}`);
      } else {
        // Follow
        await client.query(
          'INSERT INTO user_follows (follower_wallet, following_wallet) VALUES ($1, $2)',
          [followerWallet, followingWallet]
        );
        
        // Update counts
        await client.query(
          'UPDATE users SET following_count = following_count + 1 WHERE wallet_address = $1',
          [followerWallet]
        );
        await client.query(
          'UPDATE users SET followers_count = followers_count + 1 WHERE wallet_address = $1',
          [followingWallet]
        );
        
        isFollowing = true;
        this.logger.info(`Followed: ${followerWallet} -> ${followingWallet}`);
      }

      await client.query('COMMIT');
      return isFollowing;

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Error toggling user follow:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Award achievement to user
   */
  async awardAchievement(
    userWallet: string,
    achievementType: string,
    achievementName: string,
    description: string,
    metadata: Record<string, any> = {}
  ): Promise<Achievement> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if user already has this achievement
      const existingAchievement = await client.query(
        'SELECT id FROM user_achievements WHERE user_wallet = $1 AND achievement_type = $2',
        [userWallet, achievementType]
      );

      if (existingAchievement.rows.length > 0) {
        throw new Error('User already has this achievement');
      }

      // Create achievement
      const result = await client.query(`
        INSERT INTO user_achievements (
          user_wallet, achievement_type, achievement_name, description, metadata
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [userWallet, achievementType, achievementName, description, JSON.stringify(metadata)]);

      // Update user's achievement count
      await client.query(
        'UPDATE users SET achievements_count = achievements_count + 1 WHERE wallet_address = $1',
        [userWallet]
      );

      await client.query('COMMIT');

      const achievement = this.mapAchievementRow(result.rows[0]);
      this.logger.info(`Awarded achievement: ${achievementName} to ${userWallet}`);

      return achievement;

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Error awarding achievement:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update user reputation based on trading performance
   */
  async updateUserReputation(
    userWallet: string,
    reputationChange: number,
    reason: string,
    relatedMarketId?: string,
    relatedTradeId?: string
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Record reputation change
      await client.query(`
        INSERT INTO user_reputation_history (
          user_wallet, reputation_change, reason, related_market_id, related_trade_id
        ) VALUES ($1, $2, $3, $4, $5)
      `, [userWallet, reputationChange, reason, relatedMarketId, relatedTradeId]);

      // Update user's total reputation
      await client.query(
        'UPDATE users SET reputation_score = reputation_score + $1 WHERE wallet_address = $2',
        [reputationChange, userWallet]
      );

      await client.query('COMMIT');

      this.logger.info(`Updated reputation: ${userWallet} ${reputationChange > 0 ? '+' : ''}${reputationChange} (${reason})`);

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Error updating user reputation:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user leaderboard
   */
  async getUserLeaderboard(
    sortBy: 'reputation' | 'profit' | 'volume' | 'winRate' = 'reputation',
    limit: number = 50
  ): Promise<UserProfile[]> {
    try {
      let orderBy: string;
      switch (sortBy) {
        case 'profit':
          orderBy = 'total_profit DESC';
          break;
        case 'volume':
          orderBy = 'total_volume DESC';
          break;
        case 'winRate':
          orderBy = 'win_rate DESC, total_trades DESC';
          break;
        default:
          orderBy = 'reputation_score DESC';
      }

      const result = await this.pool.query(`
        SELECT * FROM users 
        WHERE total_trades > 0
        ORDER BY ${orderBy}
        LIMIT $1
      `, [limit]);

      return result.rows.map(row => this.mapUserRow(row));

    } catch (error) {
      this.logger.error('Error fetching user leaderboard:', error);
      return [];
    }
  }

  /**
   * Check and award milestone achievements
   */
  async checkMilestoneAchievements(userWallet: string): Promise<Achievement[]> {
    try {
      const user = await this.getUserProfile(userWallet);
      if (!user) return [];

      const newAchievements: Achievement[] = [];

      // Define milestone achievements
      const milestones = [
        { type: 'first_trade', name: 'First Trade', description: 'Made your first trade', threshold: 1, field: 'totalTrades' },
        { type: 'trader_10', name: 'Active Trader', description: 'Completed 10 trades', threshold: 10, field: 'totalTrades' },
        { type: 'trader_100', name: 'Veteran Trader', description: 'Completed 100 trades', threshold: 100, field: 'totalTrades' },
        { type: 'profitable', name: 'In the Green', description: 'Achieved positive total profit', threshold: 0, field: 'totalProfit', operator: '>' },
        { type: 'high_roller', name: 'High Roller', description: 'Traded over 1000 SOL in volume', threshold: 1000000000, field: 'totalVolume' }, // 1000 SOL in lamports
        { type: 'accurate_predictor', name: 'Oracle', description: 'Achieved 70% win rate with 20+ trades', threshold: 70, field: 'winRate', minTrades: 20 },
      ];

      for (const milestone of milestones) {
        // Check if user already has this achievement
        const existingAchievement = await this.pool.query(
          'SELECT id FROM user_achievements WHERE user_wallet = $1 AND achievement_type = $2',
          [userWallet, milestone.type]
        );

        if (existingAchievement.rows.length === 0) {
          let qualifies = false;
          const fieldValue = (user as any)[milestone.field];

          if (milestone.operator === '>') {
            qualifies = fieldValue > milestone.threshold;
          } else {
            qualifies = fieldValue >= milestone.threshold;
          }

          // Special case for win rate achievement
          if (milestone.minTrades && user.totalTrades < milestone.minTrades) {
            qualifies = false;
          }

          if (qualifies) {
            try {
              const achievement = await this.awardAchievement(
                userWallet,
                milestone.type,
                milestone.name,
                milestone.description,
                { threshold: milestone.threshold, currentValue: fieldValue }
              );
              newAchievements.push(achievement);
            } catch (error) {
              // Achievement might have been awarded by another process
              this.logger.warn(`Failed to award achievement ${milestone.type} to ${userWallet}:`, error);
            }
          }
        }
      }

      return newAchievements;

    } catch (error) {
      this.logger.error('Error checking milestone achievements:', error);
      return [];
    }
  }

  /**
   * Validate Solana wallet address
   */
  private isValidSolanaAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Map database row to UserProfile
   */
  private mapUserRow(row: any): UserProfile {
    return {
      walletAddress: row.wallet_address,
      username: row.username,
      bio: row.bio,
      avatarUrl: row.avatar_url,
      reputationScore: parseInt(row.reputation_score),
      totalTrades: parseInt(row.total_trades),
      winRate: parseFloat(row.win_rate),
      followersCount: parseInt(row.followers_count),
      followingCount: parseInt(row.following_count),
      totalProfit: parseInt(row.total_profit),
      totalVolume: parseInt(row.total_volume),
      achievementsCount: parseInt(row.achievements_count),
      isVerified: row.is_verified,
      lastActiveAt: row.last_active_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Map database row to Comment
   */
  private mapCommentRow(row: any): Comment {
    return {
      id: row.id,
      marketId: row.market_id,
      userWallet: row.user_wallet,
      content: row.content,
      likesCount: parseInt(row.likes_count),
      replyCount: parseInt(row.reply_count),
      parentCommentId: row.parent_comment_id,
      isFlagged: row.is_flagged,
      isHidden: row.is_hidden,
      createdAt: row.created_at
    };
  }

  /**
   * Map database row to Comment with user data
   */
  private mapCommentRowWithUser(row: any): Comment {
    const comment = this.mapCommentRow(row);
    comment.user = {
      walletAddress: row.user_wallet,
      username: row.username,
      avatarUrl: row.avatar_url,
      reputationScore: parseInt(row.reputation_score || 0),
      isVerified: row.is_verified || false,
    } as UserProfile;
    return comment;
  }

  /**
   * Map database row to Achievement
   */
  private mapAchievementRow(row: any): Achievement {
    return {
      id: row.id,
      userWallet: row.user_wallet,
      achievementType: row.achievement_type,
      achievementName: row.achievement_name,
      description: row.description,
      earnedAt: row.earned_at,
      metadata: JSON.parse(row.metadata || '{}')
    };
  }
}