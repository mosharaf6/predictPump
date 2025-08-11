import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import winston from 'winston';
import { dbConnection } from './DatabaseConnection';

export interface Migration {
  id: string;
  filename: string;
  sql: string;
  appliedAt?: Date;
}

export class MigrationRunner {
  private logger: winston.Logger;
  private migrationsPath: string;

  constructor(migrationsPath: string = join(__dirname, '../../migrations')) {
    this.migrationsPath = migrationsPath;
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'migrations.log' })
      ]
    });
  }

  public async initialize(): Promise<void> {
    try {
      // Create migrations table if it doesn't exist
      await dbConnection.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id VARCHAR(255) PRIMARY KEY,
          filename VARCHAR(255) NOT NULL,
          applied_at TIMESTAMP DEFAULT NOW()
        )
      `);

      this.logger.info('Migration runner initialized');
    } catch (error) {
      this.logger.error('Failed to initialize migration runner:', error);
      throw error;
    }
  }

  public async loadMigrations(): Promise<Migration[]> {
    try {
      const files = await readdir(this.migrationsPath);
      const migrationFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort(); // Ensure migrations run in order

      const migrations: Migration[] = [];

      for (const filename of migrationFiles) {
        const filePath = join(this.migrationsPath, filename);
        const sql = await readFile(filePath, 'utf-8');
        const id = filename.replace('.sql', '');

        migrations.push({
          id,
          filename,
          sql
        });
      }

      this.logger.info(`Loaded ${migrations.length} migration files`);
      return migrations;
    } catch (error) {
      this.logger.error('Failed to load migrations:', error);
      throw error;
    }
  }

  public async getAppliedMigrations(): Promise<string[]> {
    try {
      const result = await dbConnection.query(
        'SELECT id FROM schema_migrations ORDER BY applied_at'
      );
      return result.rows.map(row => row.id);
    } catch (error) {
      this.logger.error('Failed to get applied migrations:', error);
      throw error;
    }
  }

  public async runMigrations(): Promise<void> {
    try {
      await this.initialize();
      
      const allMigrations = await this.loadMigrations();
      const appliedMigrations = await this.getAppliedMigrations();
      
      const pendingMigrations = allMigrations.filter(
        migration => !appliedMigrations.includes(migration.id)
      );

      if (pendingMigrations.length === 0) {
        this.logger.info('No pending migrations to run');
        return;
      }

      this.logger.info(`Running ${pendingMigrations.length} pending migrations`);

      for (const migration of pendingMigrations) {
        await this.runMigration(migration);
      }

      this.logger.info('All migrations completed successfully');
    } catch (error) {
      this.logger.error('Migration run failed:', error);
      throw error;
    }
  }

  private async runMigration(migration: Migration): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Running migration: ${migration.filename}`);

      await dbConnection.transaction(async (client) => {
        // Execute the migration SQL
        await client.query(migration.sql);

        // Record the migration as applied
        await client.query(
          'INSERT INTO schema_migrations (id, filename) VALUES ($1, $2)',
          [migration.id, migration.filename]
        );
      });

      const duration = Date.now() - startTime;
      this.logger.info(`Migration ${migration.filename} completed in ${duration}ms`);
    } catch (error) {
      this.logger.error(`Migration ${migration.filename} failed:`, error);
      throw error;
    }
  }

  public async rollbackMigration(migrationId: string): Promise<void> {
    try {
      this.logger.warn(`Rolling back migration: ${migrationId}`);

      await dbConnection.transaction(async (client) => {
        // Remove migration record
        const result = await client.query(
          'DELETE FROM schema_migrations WHERE id = $1 RETURNING *',
          [migrationId]
        );

        if (result.rows.length === 0) {
          throw new Error(`Migration ${migrationId} not found in applied migrations`);
        }

        this.logger.warn(`Migration ${migrationId} rolled back (manual schema cleanup may be required)`);
      });
    } catch (error) {
      this.logger.error(`Failed to rollback migration ${migrationId}:`, error);
      throw error;
    }
  }

  public async getMigrationStatus(): Promise<{
    applied: Migration[];
    pending: Migration[];
    total: number;
  }> {
    try {
      const allMigrations = await this.loadMigrations();
      const appliedMigrationIds = await this.getAppliedMigrations();

      const applied = allMigrations.filter(m => appliedMigrationIds.includes(m.id));
      const pending = allMigrations.filter(m => !appliedMigrationIds.includes(m.id));

      return {
        applied,
        pending,
        total: allMigrations.length
      };
    } catch (error) {
      this.logger.error('Failed to get migration status:', error);
      throw error;
    }
  }

  public async validateSchema(): Promise<{
    isValid: boolean;
    missingTables: string[];
    errors: string[];
  }> {
    const requiredTables = [
      'markets',
      'users', 
      'comments',
      'trades',
      'user_achievements',
      'user_follows',
      'comment_likes',
      'user_reputation_history',
      'market_predictions',
      'user_notifications'
    ];

    const errors: string[] = [];
    const missingTables: string[] = [];

    try {
      for (const table of requiredTables) {
        const result = await dbConnection.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )
        `, [table]);

        if (!result.rows[0].exists) {
          missingTables.push(table);
        }
      }

      if (missingTables.length > 0) {
        errors.push(`Missing required tables: ${missingTables.join(', ')}`);
      }

      return {
        isValid: errors.length === 0,
        missingTables,
        errors
      };
    } catch (error) {
      errors.push(`Schema validation failed: ${error instanceof Error ? error.message : error}`);
      return {
        isValid: false,
        missingTables,
        errors
      };
    }
  }
}

// Export singleton instance
export const migrationRunner = new MigrationRunner();