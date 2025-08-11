import { Pool, PoolClient } from 'pg';
import winston from 'winston';
import { TradeEvent, MarketEvent } from './BlockchainEventListener';
import { ChartDataPoint } from './MarketDataService';
import { dbConnection } from './DatabaseConnection';
import { migrationRunner } from './MigrationRunner';

export interface HistoricalTrade {
  id: string;
  marketId: string;
  userWallet: string;
  transactionSignature: string;
  tradeType: 'buy' | 'sell';
  outcomeIndex: number;
  tokenAmount: number;
  solAmount: number;
  price: number;
  createdAt: Date;
}

export interface MarketStats {
  marketId: string;
  totalVolume: number;
  traderCount: number;
  avgPrice: number;
  priceChange24h: number;
  volumeChange24h: number;
  lastTradeAt: Date;
}

export class DatabaseService {
  private pool: Pool;
  private logger: winston.Logger;

  // Getter to access the pool for other services
  public getPool(): Pool {
    return this.pool;
  }

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'database.log' })
      ]
    });
  }

  async initialize(): Promise<void> {
    try {
      // Initialize database connection
      await dbConnection.initialize();
      this.pool = dbConnection.getPool();
      
      // Run migrations
      await migrationRunner.runMigrations();
      
      // Validate schema
      const schemaValidation = await migrationRunner.validateSchema();
      if (!schemaValidation.isValid) {
        this.logger.error('Schema validation failed:', schemaValidation.errors);
        throw new Error(`Schema validation failed: ${schemaValidation.errors.join(', ')}`);
      }
      
      this.logger.info('Database service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize database service:', error);
      throw error;
    }
  }

  /**
   * Store a trade event in the database
   */
  async storeTradeEvent(tradeEvent: TradeEvent): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Insert trade record
      const tradeResult = await client.query(`
        INSERT INTO trades (
          market_id, user_wallet, transaction_signature, trade_type,
          outcome_index, token_amount, sol_amount, price, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (transaction_signature) DO NOTHING
        RETURNING id
      `, [
        tradeEvent.marketId,
        tradeEvent.trader,
        tradeEvent.signature,
        tradeEvent.tradeType,
        tradeEvent.outcomeIndex,
        tradeEvent.tokenAmount,
        tradeEvent.solAmount,
        tradeEvent.price,
        new Date(tradeEvent.timestamp)
      ]);

      // Only proceed if trade was actually inserted (not a duplicate)
      if (tradeResult.rows.length > 0) {
        // Update market statistics
        await this.updateMarketStats(client, tradeEvent.marketId);

        // Update user trading statistics
        await this.updateUserTradingStats(client, tradeEvent.trader, tradeEvent);
      }

      await client.query('COMMIT');
      
      this.logger.info(`Stored trade event: ${tradeEvent.signature}`);

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Error storing trade event:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update market statistics after a trade
   */
  private async updateMarketStats(client: PoolClient, marketId: string): Promise<void> {
    try {
      // Update total volume and trader count
      await client.query(`
        UPDATE markets SET 
          total_volume = (
            SELECT COALESCE(SUM(sol_amount), 0) 
            FROM trades 
            WHERE market_id = $1
          ),
          trader_count = (
            SELECT COUNT(DISTINCT user_wallet) 
            FROM trades 
            WHERE market_id = $1
          ),
          updated_at = NOW()
        WHERE program_account = $1
      `, [marketId]);

    } catch (error) {
      this.logger.error(`Error updating market stats for ${marketId}:`, error);
      throw error;
    }
  }

  /**
   * Update user trading statistics after a trade
   */
  private async updateUserTradingStats(client: PoolClient, userWallet: string, tradeEvent: TradeEvent): Promise<void> {
    try {
      // Ensure user exists in users table
      await client.query(`
        INSERT INTO users (wallet_address, last_active_at) 
        VALUES ($1, NOW()) 
        ON CONFLICT (wallet_address) DO UPDATE SET last_active_at = NOW()
      `, [userWallet]);

      // Update user statistics
      await client.query(`
        UPDATE users SET 
          total_trades = (
            SELECT COUNT(*) 
            FROM trades 
            WHERE user_wallet = $1
          ),
          total_volume = (
            SELECT COALESCE(SUM(sol_amount), 0) 
            FROM trades 
            WHERE user_wallet = $1
          ),
          updated_at = NOW()
        WHERE wallet_address = $1
      `, [userWallet]);

      // Calculate and update win rate (simplified - based on profitable trades)
      await client.query(`
        UPDATE users SET 
          win_rate = CASE 
            WHEN total_trades > 0 THEN (
              SELECT ROUND(
                (COUNT(CASE WHEN trade_type = 'sell' AND price > 
                  (SELECT AVG(price) FROM trades t2 WHERE t2.user_wallet = $1 AND t2.market_id = t1.market_id AND t2.trade_type = 'buy' AND t2.created_at < t1.created_at)
                THEN 1 END) * 100.0 / NULLIF(COUNT(CASE WHEN trade_type = 'sell' THEN 1 END), 0))::numeric, 2
              )
              FROM trades t1 
              WHERE user_wallet = $1
            )
            ELSE 0 
          END
        WHERE wallet_address = $1
      `, [userWallet]);

      // Award reputation points for trading activity
      const reputationChange = tradeEvent.tradeType === 'buy' ? 1 : 2; // More points for selling (taking profit/loss)
      
      await client.query(`
        INSERT INTO user_reputation_history (
          user_wallet, reputation_change, reason, related_trade_id
        ) VALUES ($1, $2, $3, (SELECT id FROM trades WHERE transaction_signature = $4))
      `, [userWallet, reputationChange, `${tradeEvent.tradeType} trade`, tradeEvent.signature]);

      await client.query(`
        UPDATE users SET reputation_score = reputation_score + $1 WHERE wallet_address = $2
      `, [reputationChange, userWallet]);

    } catch (error) {
      this.logger.error(`Error updating user trading stats for ${userWallet}:`, error);
      throw error;
    }
  }

  /**
   * Get historical trades for a market
   */
  async getMarketTrades(marketId: string, limit: number = 100, offset: number = 0): Promise<HistoricalTrade[]> {
    try {
      const result = await this.pool.query(`
        SELECT 
          id, market_id, user_wallet, transaction_signature,
          trade_type, outcome_index, token_amount, sol_amount,
          price, created_at
        FROM trades 
        WHERE market_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3
      `, [marketId, limit, offset]);

      return result.rows.map(row => ({
        id: row.id,
        marketId: row.market_id,
        userWallet: row.user_wallet,
        transactionSignature: row.transaction_signature,
        tradeType: row.trade_type,
        outcomeIndex: row.outcome_index,
        tokenAmount: parseInt(row.token_amount),
        solAmount: parseInt(row.sol_amount),
        price: parseFloat(row.price),
        createdAt: row.created_at
      }));

    } catch (error) {
      this.logger.error(`Error fetching trades for market ${marketId}:`, error);
      return [];
    }
  }

  /**
   * Generate chart data for a market outcome
   */
  async generateChartData(
    marketId: string, 
    outcomeIndex: number, 
    timeframe: string = '24h',
    interval: string = '1h'
  ): Promise<ChartDataPoint[]> {
    try {
      let timeCondition = '';
      let intervalGroup = '';

      // Set time range based on timeframe
      switch (timeframe) {
        case '1h':
          timeCondition = "created_at >= NOW() - INTERVAL '1 hour'";
          intervalGroup = "date_trunc('minute', created_at)";
          break;
        case '24h':
          timeCondition = "created_at >= NOW() - INTERVAL '24 hours'";
          intervalGroup = "date_trunc('hour', created_at)";
          break;
        case '7d':
          timeCondition = "created_at >= NOW() - INTERVAL '7 days'";
          intervalGroup = "date_trunc('hour', created_at)";
          break;
        case '30d':
          timeCondition = "created_at >= NOW() - INTERVAL '30 days'";
          intervalGroup = "date_trunc('day', created_at)";
          break;
        default:
          timeCondition = "created_at >= NOW() - INTERVAL '24 hours'";
          intervalGroup = "date_trunc('hour', created_at)";
      }

      const result = await this.pool.query(`
        SELECT 
          ${intervalGroup} as time_bucket,
          AVG(price) as avg_price,
          SUM(sol_amount) as volume,
          COUNT(*) as trade_count,
          MIN(price) as low_price,
          MAX(price) as high_price,
          (array_agg(price ORDER BY created_at))[1] as open_price,
          (array_agg(price ORDER BY created_at DESC))[1] as close_price
        FROM trades 
        WHERE market_id = $1 
          AND outcome_index = $2 
          AND ${timeCondition}
        GROUP BY ${intervalGroup}
        ORDER BY time_bucket ASC
      `, [marketId, outcomeIndex]);

      return result.rows.map(row => ({
        timestamp: new Date(row.time_bucket).getTime(),
        price: parseFloat(row.close_price || row.avg_price),
        volume: parseInt(row.volume),
        open: parseFloat(row.open_price),
        high: parseFloat(row.high_price),
        low: parseFloat(row.low_price),
        close: parseFloat(row.close_price)
      }));

    } catch (error) {
      this.logger.error(`Error generating chart data for ${marketId}:${outcomeIndex}:`, error);
      return [];
    }
  }

  /**
   * Get market statistics
   */
  async getMarketStats(marketId: string): Promise<MarketStats | null> {
    try {
      const result = await this.pool.query(`
        SELECT 
          m.program_account as market_id,
          m.total_volume,
          m.trader_count,
          COALESCE(recent.avg_price, 0) as avg_price,
          COALESCE(recent.price_change_24h, 0) as price_change_24h,
          COALESCE(recent.volume_change_24h, 0) as volume_change_24h,
          recent.last_trade_at
        FROM markets m
        LEFT JOIN (
          SELECT 
            market_id,
            AVG(price) as avg_price,
            (
              SELECT AVG(price) 
              FROM trades t2 
              WHERE t2.market_id = t1.market_id 
                AND t2.created_at >= NOW() - INTERVAL '24 hours'
            ) - (
              SELECT AVG(price) 
              FROM trades t3 
              WHERE t3.market_id = t1.market_id 
                AND t3.created_at >= NOW() - INTERVAL '48 hours'
                AND t3.created_at < NOW() - INTERVAL '24 hours'
            ) as price_change_24h,
            (
              SELECT SUM(sol_amount) 
              FROM trades t4 
              WHERE t4.market_id = t1.market_id 
                AND t4.created_at >= NOW() - INTERVAL '24 hours'
            ) - (
              SELECT SUM(sol_amount) 
              FROM trades t5 
              WHERE t5.market_id = t1.market_id 
                AND t5.created_at >= NOW() - INTERVAL '48 hours'
                AND t5.created_at < NOW() - INTERVAL '24 hours'
            ) as volume_change_24h,
            MAX(created_at) as last_trade_at
          FROM trades t1
          WHERE market_id = $1
          GROUP BY market_id
        ) recent ON m.program_account = recent.market_id
        WHERE m.program_account = $1
      `, [marketId]);

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        marketId: row.market_id,
        totalVolume: parseInt(row.total_volume),
        traderCount: parseInt(row.trader_count),
        avgPrice: parseFloat(row.avg_price),
        priceChange24h: parseFloat(row.price_change_24h),
        volumeChange24h: parseInt(row.volume_change_24h),
        lastTradeAt: row.last_trade_at
      };

    } catch (error) {
      this.logger.error(`Error fetching market stats for ${marketId}:`, error);
      return null;
    }
  }

  /**
   * Get trending markets based on recent activity
   */
  async getTrendingMarkets(limit: number = 10): Promise<MarketStats[]> {
    try {
      const result = await this.pool.query(`
        SELECT 
          m.program_account as market_id,
          m.total_volume,
          m.trader_count,
          COALESCE(recent.avg_price, 0) as avg_price,
          COALESCE(recent.price_change_24h, 0) as price_change_24h,
          COALESCE(recent.volume_24h, 0) as volume_change_24h,
          recent.last_trade_at,
          -- Trending score calculation
          (
            COALESCE(recent.volume_24h, 0) * 0.4 +
            ABS(COALESCE(recent.price_change_24h, 0)) * 1000 * 0.3 +
            m.trader_count * 0.3
          ) as trending_score
        FROM markets m
        LEFT JOIN (
          SELECT 
            market_id,
            AVG(price) as avg_price,
            SUM(sol_amount) as volume_24h,
            (
              SELECT AVG(price) 
              FROM trades t2 
              WHERE t2.market_id = t1.market_id 
                AND t2.created_at >= NOW() - INTERVAL '24 hours'
            ) - (
              SELECT AVG(price) 
              FROM trades t3 
              WHERE t3.market_id = t1.market_id 
                AND t3.created_at >= NOW() - INTERVAL '48 hours'
                AND t3.created_at < NOW() - INTERVAL '24 hours'
            ) as price_change_24h,
            MAX(created_at) as last_trade_at
          FROM trades t1
          WHERE created_at >= NOW() - INTERVAL '24 hours'
          GROUP BY market_id
        ) recent ON m.program_account = recent.market_id
        WHERE m.status = 'active'
        ORDER BY trending_score DESC
        LIMIT $1
      `, [limit]);

      return result.rows.map(row => ({
        marketId: row.market_id,
        totalVolume: parseInt(row.total_volume),
        traderCount: parseInt(row.trader_count),
        avgPrice: parseFloat(row.avg_price),
        priceChange24h: parseFloat(row.price_change_24h),
        volumeChange24h: parseInt(row.volume_change_24h),
        lastTradeAt: row.last_trade_at
      }));

    } catch (error) {
      this.logger.error('Error fetching trending markets:', error);
      return [];
    }
  }

  /**
   * Store market event in database
   */
  async storeMarketEvent(marketEvent: MarketEvent): Promise<void> {
    try {
      // This would store market creation, settlement, dispute events
      // For now, just log the event
      this.logger.info('Storing market event:', {
        marketId: marketEvent.marketId,
        eventType: marketEvent.eventType,
        timestamp: marketEvent.timestamp
      });

    } catch (error) {
      this.logger.error('Error storing market event:', error);
      throw error;
    }
  }

  /**
   * Get user trading history
   */
  async getUserTrades(userWallet: string, limit: number = 50): Promise<HistoricalTrade[]> {
    try {
      const result = await this.pool.query(`
        SELECT 
          id, market_id, user_wallet, transaction_signature,
          trade_type, outcome_index, token_amount, sol_amount,
          price, created_at
        FROM trades 
        WHERE user_wallet = $1 
        ORDER BY created_at DESC 
        LIMIT $2
      `, [userWallet, limit]);

      return result.rows.map(row => ({
        id: row.id,
        marketId: row.market_id,
        userWallet: row.user_wallet,
        transactionSignature: row.transaction_signature,
        tradeType: row.trade_type,
        outcomeIndex: row.outcome_index,
        tokenAmount: parseInt(row.token_amount),
        solAmount: parseInt(row.sol_amount),
        price: parseFloat(row.price),
        createdAt: row.created_at
      }));

    } catch (error) {
      this.logger.error(`Error fetching user trades for ${userWallet}:`, error);
      return [];
    }
  }

  /**
   * Close database connections
   */
  async shutdown(): Promise<void> {
    try {
      await dbConnection.shutdown();
      this.logger.info('Database service shutdown complete');
    } catch (error) {
      this.logger.error('Error shutting down database service:', error);
    }
  }

  /**
   * Get database health status
   */
  async getHealthStatus(): Promise<any> {
    try {
      return await dbConnection.healthCheck();
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<any> {
    try {
      return await migrationRunner.getMigrationStatus();
    } catch (error) {
      this.logger.error('Failed to get migration status:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Notification-related methods
  async storePriceAlert(alert: any): Promise<void> {
    try {
      const query = `
        INSERT INTO price_alerts (id, user_id, market_id, outcome_index, alert_type, target_price, change_threshold, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
      
      await this.pool.query(query, [
        alert.id,
        alert.userId,
        alert.marketId,
        alert.outcomeIndex,
        alert.alertType,
        alert.targetPrice,
        alert.changeThreshold,
        alert.isActive,
        alert.createdAt
      ]);
    } catch (error) {
      this.logger.error('Error storing price alert:', error);
      throw error;
    }
  }

  async deletePriceAlert(alertId: string): Promise<void> {
    try {
      const query = 'DELETE FROM price_alerts WHERE id = $1';
      await this.pool.query(query, [alertId]);
    } catch (error) {
      this.logger.error('Error deleting price alert:', error);
      throw error;
    }
  }

  async storeNotification(notification: any): Promise<void> {
    try {
      const query = `
        INSERT INTO notifications (id, user_id, type, title, message, data, is_read, created_at, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
      
      await this.pool.query(query, [
        notification.id,
        notification.userId,
        notification.type,
        notification.title,
        notification.message,
        JSON.stringify(notification.data),
        notification.isRead,
        notification.createdAt,
        notification.expiresAt
      ]);
    } catch (error) {
      this.logger.error('Error storing notification:', error);
      throw error;
    }
  }

  async getUserNotifications(userId: string, limit: number, offset: number): Promise<any[]> {
    try {
      const query = `
        SELECT * FROM notifications 
        WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3
      `;
      
      const result = await this.pool.query(query, [userId, limit, offset]);
      return result.rows.map(row => ({
        ...row,
        data: row.data ? JSON.parse(row.data) : null
      }));
    } catch (error) {
      this.logger.error('Error getting user notifications:', error);
      return [];
    }
  }

  async markNotificationAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const query = 'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2';
      const result = await this.pool.query(query, [notificationId, userId]);
      return result.rowCount > 0;
    } catch (error) {
      this.logger.error('Error marking notification as read:', error);
      return false;
    }
  }

  async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    try {
      const query = 'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false';
      const result = await this.pool.query(query, [userId]);
      return result.rowCount > 0;
    } catch (error) {
      this.logger.error('Error marking all notifications as read:', error);
      return false;
    }
  }

  async getUserNotificationPreferences(userId: string): Promise<any | null> {
    try {
      const query = 'SELECT * FROM notification_preferences WHERE user_id = $1';
      const result = await this.pool.query(query, [userId]);
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error('Error getting user notification preferences:', error);
      return null;
    }
  }

  async updateUserNotificationPreferences(userId: string, preferences: any): Promise<void> {
    try {
      const query = `
        INSERT INTO notification_preferences (
          user_id, price_alerts, market_settlements, social_notifications, 
          email_notifications, push_notifications, price_alert_threshold
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id) DO UPDATE SET
          price_alerts = $2,
          market_settlements = $3,
          social_notifications = $4,
          email_notifications = $5,
          push_notifications = $6,
          price_alert_threshold = $7,
          updated_at = NOW()
      `;
      
      await this.pool.query(query, [
        userId,
        preferences.priceAlerts,
        preferences.marketSettlements,
        preferences.socialNotifications,
        preferences.emailNotifications,
        preferences.pushNotifications,
        preferences.priceAlertThreshold
      ]);
    } catch (error) {
      this.logger.error('Error updating user notification preferences:', error);
      throw error;
    }
  }

  async getUserEmail(userId: string): Promise<string | null> {
    try {
      const query = 'SELECT email FROM users WHERE wallet_address = $1';
      const result = await this.pool.query(query, [userId]);
      return result.rows[0]?.email || null;
    } catch (error) {
      this.logger.error('Error getting user email:', error);
      return null;
    }
  }

  async getMarketParticipants(marketId: string): Promise<any[]> {
    try {
      const query = `
        SELECT DISTINCT user_wallet as userId, 0 as payout
        FROM trades 
        WHERE market_id = $1
      `;
      
      const result = await this.pool.query(query, [marketId]);
      return result.rows;
    } catch (error) {
      this.logger.error('Error getting market participants:', error);
      return [];
    }
  }
}