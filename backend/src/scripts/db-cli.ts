#!/usr/bin/env ts-node

import { Command } from 'commander';
import dotenv from 'dotenv';
import { dbConnection } from '../services/DatabaseConnection';
import { migrationRunner } from '../services/MigrationRunner';
import { databaseConfig } from '../config/database';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('db-cli')
  .description('Database management CLI for PredictionPump')
  .version('1.0.0');

program
  .command('test-connection')
  .description('Test database connection')
  .action(async () => {
    try {
      console.log('Testing database connection...');
      const isConnected = await databaseConfig.testConnection();
      
      if (isConnected) {
        console.log('✅ Database connection successful');
      } else {
        console.log('❌ Database connection failed');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      process.exit(1);
    }
  });

program
  .command('migrate')
  .description('Run pending database migrations')
  .action(async () => {
    try {
      console.log('Initializing database connection...');
      await dbConnection.initialize();
      
      console.log('Running migrations...');
      await migrationRunner.runMigrations();
      
      console.log('✅ Migrations completed successfully');
      await dbConnection.shutdown();
    } catch (error) {
      console.error('❌ Migration failed:', error);
      await dbConnection.shutdown();
      process.exit(1);
    }
  });

program
  .command('migration-status')
  .description('Show migration status')
  .action(async () => {
    try {
      await dbConnection.initialize();
      
      const status = await migrationRunner.getMigrationStatus();
      
      console.log('\n📊 Migration Status:');
      console.log(`Total migrations: ${status.total}`);
      console.log(`Applied: ${status.applied.length}`);
      console.log(`Pending: ${status.pending.length}`);
      
      if (status.applied.length > 0) {
        console.log('\n✅ Applied migrations:');
        status.applied.forEach(m => console.log(`  - ${m.filename}`));
      }
      
      if (status.pending.length > 0) {
        console.log('\n⏳ Pending migrations:');
        status.pending.forEach(m => console.log(`  - ${m.filename}`));
      }
      
      await dbConnection.shutdown();
    } catch (error) {
      console.error('❌ Failed to get migration status:', error);
      await dbConnection.shutdown();
      process.exit(1);
    }
  });

program
  .command('validate-schema')
  .description('Validate database schema')
  .action(async () => {
    try {
      await dbConnection.initialize();
      
      const validation = await migrationRunner.validateSchema();
      
      if (validation.isValid) {
        console.log('✅ Database schema is valid');
      } else {
        console.log('❌ Database schema validation failed:');
        validation.errors.forEach(error => console.log(`  - ${error}`));
        
        if (validation.missingTables.length > 0) {
          console.log('\n📋 Missing tables:');
          validation.missingTables.forEach(table => console.log(`  - ${table}`));
        }
      }
      
      await dbConnection.shutdown();
    } catch (error) {
      console.error('❌ Schema validation failed:', error);
      await dbConnection.shutdown();
      process.exit(1);
    }
  });

program
  .command('health-check')
  .description('Check database health')
  .action(async () => {
    try {
      await dbConnection.initialize();
      
      const health = await dbConnection.healthCheck();
      
      console.log('\n🏥 Database Health Check:');
      console.log(`Status: ${health.status === 'healthy' ? '✅ Healthy' : '❌ Unhealthy'}`);
      console.log(`Response time: ${health.details.responseTime}ms`);
      console.log(`Total connections: ${health.details.totalConnections}`);
      console.log(`Idle connections: ${health.details.idleConnections}`);
      console.log(`Waiting clients: ${health.details.waitingClients}`);
      
      await dbConnection.shutdown();
    } catch (error) {
      console.error('❌ Health check failed:', error);
      await dbConnection.shutdown();
      process.exit(1);
    }
  });

program
  .command('rollback')
  .description('Rollback a specific migration')
  .argument('<migration-id>', 'Migration ID to rollback')
  .action(async (migrationId: string) => {
    try {
      await dbConnection.initialize();
      
      console.log(`Rolling back migration: ${migrationId}`);
      await migrationRunner.rollbackMigration(migrationId);
      
      console.log('⚠️  Migration rolled back successfully');
      console.log('Note: You may need to manually clean up schema changes');
      
      await dbConnection.shutdown();
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      await dbConnection.shutdown();
      process.exit(1);
    }
  });

program
  .command('reset')
  .description('Reset database (WARNING: This will drop all data)')
  .option('--confirm', 'Confirm database reset')
  .action(async (options) => {
    if (!options.confirm) {
      console.log('❌ Database reset requires --confirm flag');
      console.log('WARNING: This will permanently delete all data');
      process.exit(1);
    }
    
    try {
      await dbConnection.initialize();
      
      console.log('⚠️  Resetting database...');
      
      // Drop all tables
      const tables = [
        'user_notifications',
        'market_predictions', 
        'user_reputation_history',
        'comment_likes',
        'user_follows',
        'user_achievements',
        'trades',
        'comments',
        'users',
        'markets',
        'schema_migrations'
      ];
      
      for (const table of tables) {
        await dbConnection.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`Dropped table: ${table}`);
      }
      
      console.log('✅ Database reset complete');
      console.log('Run "npm run db:migrate" to recreate schema');
      
      await dbConnection.shutdown();
    } catch (error) {
      console.error('❌ Database reset failed:', error);
      await dbConnection.shutdown();
      process.exit(1);
    }
  });

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  console.error('Uncaught exception:', error);
  await dbConnection.shutdown();
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  console.error('Unhandled rejection:', reason);
  await dbConnection.shutdown();
  process.exit(1);
});

program.parse();