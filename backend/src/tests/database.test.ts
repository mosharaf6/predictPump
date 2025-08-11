import { dbConnection } from '../services/DatabaseConnection';
import { migrationRunner } from '../services/MigrationRunner';
import { DatabaseService } from '../services/DatabaseService';
import { databaseConfig } from '../config/database';

describe('Database Connection and ORM Setup', () => {
  let databaseService: DatabaseService;

  beforeAll(async () => {
    // Set test environment variables
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/prediction_pump_test';
    process.env.NODE_ENV = 'test';
  });

  afterAll(async () => {
    if (databaseService) {
      await databaseService.shutdown();
    }
  });

  describe('Database Configuration', () => {
    it('should load database configuration correctly', () => {
      const config = databaseConfig.getConfig();
      
      expect(config).toBeDefined();
      expect(config.connectionString).toBeDefined();
      expect(config.pool).toBeDefined();
      expect(config.pool.max).toBeGreaterThan(0);
      expect(config.pool.min).toBeGreaterThanOrEqual(0);
    });

    it('should create valid pool configuration', () => {
      const poolConfig = databaseConfig.createPoolConfig();
      
      expect(poolConfig).toBeDefined();
      expect(poolConfig.connectionString).toBeDefined();
      expect(poolConfig.max).toBeGreaterThan(0);
      expect(poolConfig.idleTimeoutMillis).toBeGreaterThan(0);
    });

    it('should validate connection string format', async () => {
      const isValid = await databaseConfig.testConnection();
      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('Database Connection', () => {
    it('should initialize database connection successfully', async () => {
      await dbConnection.initialize();
      expect(dbConnection.isReady()).toBe(true);
    });

    it('should execute simple queries', async () => {
      const result = await dbConnection.query('SELECT NOW() as current_time');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].current_time).toBeDefined();
    });

    it('should handle transactions correctly', async () => {
      const result = await dbConnection.transaction(async (client) => {
        const res1 = await client.query('SELECT 1 as test_value');
        const res2 = await client.query('SELECT 2 as test_value');
        return { res1: res1.rows[0], res2: res2.rows[0] };
      });

      expect(result.res1.test_value).toBe(1);
      expect(result.res2.test_value).toBe(2);
    });

    it('should rollback transactions on error', async () => {
      await expect(
        dbConnection.transaction(async (client) => {
          await client.query('SELECT 1');
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });

    it('should provide health check information', async () => {
      const health = await dbConnection.healthCheck();
      
      expect(health).toBeDefined();
      expect(health.status).toMatch(/healthy|unhealthy/);
      expect(health.details).toBeDefined();
      expect(typeof health.details.totalConnections).toBe('number');
      expect(typeof health.details.responseTime).toBe('number');
    });
  });

  describe('Migration Runner', () => {
    it('should initialize migration runner', async () => {
      await migrationRunner.initialize();
      
      // Check if migrations table exists
      const result = await dbConnection.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'schema_migrations'
        )
      `);
      
      expect(result.rows[0].exists).toBe(true);
    });

    it('should load migration files', async () => {
      const migrations = await migrationRunner.loadMigrations();
      expect(Array.isArray(migrations)).toBe(true);
      expect(migrations.length).toBeGreaterThan(0);
      
      migrations.forEach(migration => {
        expect(migration.id).toBeDefined();
        expect(migration.filename).toBeDefined();
        expect(migration.sql).toBeDefined();
      });
    });

    it('should get migration status', async () => {
      const status = await migrationRunner.getMigrationStatus();
      
      expect(status).toBeDefined();
      expect(Array.isArray(status.applied)).toBe(true);
      expect(Array.isArray(status.pending)).toBe(true);
      expect(typeof status.total).toBe('number');
    });

    it('should validate database schema', async () => {
      // Run migrations first
      await migrationRunner.runMigrations();
      
      const validation = await migrationRunner.validateSchema();
      
      expect(validation).toBeDefined();
      expect(typeof validation.isValid).toBe('boolean');
      expect(Array.isArray(validation.missingTables)).toBe(true);
      expect(Array.isArray(validation.errors)).toBe(true);
    });
  });

  describe('Database Service', () => {
    it('should initialize database service', async () => {
      databaseService = new DatabaseService();
      await databaseService.initialize();
      
      const pool = databaseService.getPool();
      expect(pool).toBeDefined();
    });

    it('should provide health status', async () => {
      const health = await databaseService.getHealthStatus();
      expect(health).toBeDefined();
      expect(health.status).toMatch(/healthy|unhealthy/);
    });

    it('should provide migration status', async () => {
      const status = await databaseService.getMigrationStatus();
      expect(status).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      // Test with invalid query
      await expect(
        dbConnection.query('INVALID SQL QUERY')
      ).rejects.toThrow();
    });

    it('should handle transaction errors gracefully', async () => {
      await expect(
        dbConnection.transaction(async (client) => {
          await client.query('INVALID SQL QUERY');
        })
      ).rejects.toThrow();
    });

    it('should retry failed operations', async () => {
      // This test would require mocking to simulate temporary failures
      // For now, just ensure the retry mechanism exists
      expect(databaseConfig.retryConnection).toBeDefined();
    });
  });

  describe('Connection Pooling', () => {
    it('should manage connection pool correctly', async () => {
      const health = await dbConnection.healthCheck();
      
      expect(health.details.totalConnections).toBeGreaterThanOrEqual(0);
      expect(health.details.idleConnections).toBeGreaterThanOrEqual(0);
      expect(health.details.waitingClients).toBeGreaterThanOrEqual(0);
    });

    it('should handle concurrent connections', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        dbConnection.query('SELECT $1 as connection_id', [i])
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result.rows[0].connection_id).toBe(index);
      });
    });
  });
});