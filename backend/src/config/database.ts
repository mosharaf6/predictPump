import { Pool, PoolConfig } from 'pg';
import winston from 'winston';

export interface DatabaseConfig {
  connectionString: string;
  pool: {
    max: number;
    min: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
    acquireTimeoutMillis: number;
  };
  ssl: boolean;
  retryAttempts: number;
  retryDelay: number;
}

export class DatabaseConfigManager {
  private static instance: DatabaseConfigManager;
  private config: DatabaseConfig;
  private logger: winston.Logger;

  private constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'database-config.log' })
      ]
    });

    this.config = this.loadConfig();
  }

  public static getInstance(): DatabaseConfigManager {
    if (!DatabaseConfigManager.instance) {
      DatabaseConfigManager.instance = new DatabaseConfigManager();
    }
    return DatabaseConfigManager.instance;
  }

  private loadConfig(): DatabaseConfig {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Validate connection string format
    if (!this.isValidConnectionString(connectionString)) {
      throw new Error('Invalid DATABASE_URL format. Expected: postgresql://user:password@host:port/database');
    }

    return {
      connectionString,
      pool: {
        max: parseInt(process.env.DB_POOL_MAX || '20'),
        min: parseInt(process.env.DB_POOL_MIN || '2'),
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
        connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
        acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000'),
      },
      ssl: process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true',
      retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS || '3'),
      retryDelay: parseInt(process.env.DB_RETRY_DELAY || '1000'),
    };
  }

  private isValidConnectionString(connectionString: string): boolean {
    const postgresUrlRegex = /^postgresql:\/\/[^:]+:[^@]+@[^:]+:\d+\/[^?]+(\?.*)?$/;
    return postgresUrlRegex.test(connectionString);
  }

  public getConfig(): DatabaseConfig {
    return { ...this.config };
  }

  public createPoolConfig(): PoolConfig {
    const config = this.getConfig();
    
    return {
      connectionString: config.connectionString,
      max: config.pool.max,
      min: config.pool.min,
      idleTimeoutMillis: config.pool.idleTimeoutMillis,
      connectionTimeoutMillis: config.pool.connectionTimeoutMillis,
      acquireTimeoutMillis: config.pool.acquireTimeoutMillis,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
    };
  }

  public async testConnection(): Promise<boolean> {
    const pool = new Pool(this.createPoolConfig());
    
    try {
      const client = await pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      await pool.end();
      
      this.logger.info('Database connection test successful');
      return true;
    } catch (error) {
      this.logger.error('Database connection test failed:', error);
      await pool.end();
      return false;
    }
  }

  public async retryConnection<T>(operation: () => Promise<T>): Promise<T> {
    const config = this.getConfig();
    let lastError: Error;

    for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Database operation attempt ${attempt} failed:`, error);
        
        if (attempt < config.retryAttempts) {
          await this.delay(config.retryDelay * attempt); // Exponential backoff
        }
      }
    }

    throw new Error(`Database operation failed after ${config.retryAttempts} attempts. Last error: ${lastError!.message}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public logConfig(): void {
    const safeConfig = {
      ...this.config,
      connectionString: this.maskConnectionString(this.config.connectionString)
    };
    
    this.logger.info('Database configuration loaded:', safeConfig);
  }

  private maskConnectionString(connectionString: string): string {
    return connectionString.replace(/:([^@]+)@/, ':****@');
  }
}

// Export singleton instance
export const databaseConfig = DatabaseConfigManager.getInstance();