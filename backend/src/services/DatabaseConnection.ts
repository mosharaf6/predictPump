import { Pool, PoolClient, QueryResult } from 'pg';
import winston from 'winston';
import { databaseConfig } from '../config/database';

export interface QueryOptions {
  timeout?: number;
  retries?: number;
}

export interface TransactionCallback<T> {
  (client: PoolClient): Promise<T>;
}

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: Pool;
  private logger: winston.Logger;
  private isInitialized: boolean = false;

  private constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'database-connection.log' })
      ]
    });
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Database connection already initialized');
      return;
    }

    try {
      const poolConfig = databaseConfig.createPoolConfig();
      this.pool = new Pool(poolConfig);

      this.setupEventHandlers();
      await this.testConnection();
      
      this.isInitialized = true;
      databaseConfig.logConfig();
      this.logger.info('Database connection initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize database connection:', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    this.pool.on('error', (err, client) => {
      this.logger.error('Unexpected error on idle client:', err);
    });

    this.pool.on('connect', (client) => {
      this.logger.debug('New client connected to database');
    });

    this.pool.on('acquire', (client) => {
      this.logger.debug('Client acquired from pool');
    });

    this.pool.on('remove', (client) => {
      this.logger.debug('Client removed from pool');
    });
  }

  private async testConnection(): Promise<void> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
      this.logger.info('Database connection test successful:', {
        currentTime: result.rows[0].current_time,
        version: result.rows[0].pg_version.split(' ')[0]
      });
    } finally {
      client.release();
    }
  }

  public getPool(): Pool {
    if (!this.isInitialized) {
      throw new Error('Database connection not initialized. Call initialize() first.');
    }
    return this.pool;
  }

  public async query<T = any>(
    text: string, 
    params?: any[], 
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    if (!this.isInitialized) {
      throw new Error('Database connection not initialized');
    }

    const startTime = Date.now();
    const queryId = Math.random().toString(36).substring(7);

    try {
      this.logger.debug(`Executing query ${queryId}:`, { text, params });

      const result = await databaseConfig.retryConnection(async () => {
        if (options.timeout) {
          return await Promise.race([
            this.pool.query<T>(text, params),
            this.createTimeoutPromise(options.timeout)
          ]);
        }
        return await this.pool.query<T>(text, params);
      });

      const duration = Date.now() - startTime;
      this.logger.debug(`Query ${queryId} completed in ${duration}ms`);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Query ${queryId} failed after ${duration}ms:`, {
        error: error instanceof Error ? error.message : error,
        text,
        params
      });
      throw error;
    }
  }

  public async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
    if (!this.isInitialized) {
      throw new Error('Database connection not initialized');
    }

    const client = await this.pool.connect();
    const transactionId = Math.random().toString(36).substring(7);

    try {
      this.logger.debug(`Starting transaction ${transactionId}`);
      await client.query('BEGIN');

      const result = await callback(client);

      await client.query('COMMIT');
      this.logger.debug(`Transaction ${transactionId} committed successfully`);

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Transaction ${transactionId} rolled back:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  public async getClient(): Promise<PoolClient> {
    if (!this.isInitialized) {
      throw new Error('Database connection not initialized');
    }
    return await this.pool.connect();
  }

  private createTimeoutPromise<T>(timeout: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Query timeout after ${timeout}ms`));
      }, timeout);
    });
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      totalConnections: number;
      idleConnections: number;
      waitingClients: number;
      responseTime: number;
    };
  }> {
    try {
      const startTime = Date.now();
      await this.query('SELECT 1');
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        details: {
          totalConnections: this.pool.totalCount,
          idleConnections: this.pool.idleCount,
          waitingClients: this.pool.waitingCount,
          responseTime
        }
      };
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
        details: {
          totalConnections: this.pool.totalCount,
          idleConnections: this.pool.idleCount,
          waitingClients: this.pool.waitingCount,
          responseTime: -1
        }
      };
    }
  }

  public async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      this.logger.warn('Database connection not initialized, nothing to shutdown');
      return;
    }

    try {
      this.logger.info('Shutting down database connection...');
      await this.pool.end();
      this.isInitialized = false;
      this.logger.info('Database connection shutdown complete');
    } catch (error) {
      this.logger.error('Error during database shutdown:', error);
      throw error;
    }
  }

  public isReady(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const dbConnection = DatabaseConnection.getInstance();