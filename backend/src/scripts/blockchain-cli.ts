#!/usr/bin/env ts-node

import { Command } from 'commander';
import { Connection } from '@solana/web3.js';
import dotenv from 'dotenv';
import { BlockchainEventListener } from '../services/BlockchainEventListener';
import { MarketDataService } from '../services/MarketDataService';
import { dbConnection } from '../services/DatabaseConnection';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('blockchain-cli')
  .description('Blockchain event listener management CLI')
  .version('1.0.0');

program
  .command('status')
  .description('Get blockchain event listener status')
  .action(async () => {
    try {
      await dbConnection.initialize();
      
      const result = await dbConnection.query(`
        SELECT 
          program_id,
          last_processed_slot,
          updated_at
        FROM blockchain_sync_state
        ORDER BY updated_at DESC
      `);

      console.log('\n📊 Blockchain Sync Status:');
      
      if (result.rows.length === 0) {
        console.log('No sync state found');
      } else {
        result.rows.forEach(row => {
          console.log(`Program: ${row.program_id}`);
          console.log(`Last Slot: ${row.last_processed_slot}`);
          console.log(`Updated: ${row.updated_at}`);
          console.log('---');
        });
      }

      // Get recent events
      const eventsResult = await dbConnection.query(`
        SELECT 
          event_type,
          COUNT(*) as count,
          MAX(created_at) as latest
        FROM market_events
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY event_type
        ORDER BY count DESC
      `);

      console.log('\n📈 Recent Events (24h):');
      if (eventsResult.rows.length === 0) {
        console.log('No recent events');
      } else {
        eventsResult.rows.forEach(row => {
          console.log(`${row.event_type}: ${row.count} events (latest: ${row.latest})`);
        });
      }

      await dbConnection.shutdown();
    } catch (error) {
      console.error('❌ Failed to get status:', error);
      process.exit(1);
    }
  });

program
  .command('listen')
  .description('Start blockchain event listener')
  .option('--program-id <id>', 'Program ID to listen to')
  .option('--duration <seconds>', 'Duration to listen (default: indefinite)')
  .action(async (options) => {
    try {
      const programId = options.programId || process.env.PROGRAM_ID;
      if (!programId) {
        console.error('❌ Program ID is required (use --program-id or set PROGRAM_ID env var)');
        process.exit(1);
      }

      console.log(`🎧 Starting blockchain event listener for program: ${programId}`);
      
      // Initialize services
      await dbConnection.initialize();
      
      const connection = new Connection(
        process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        'confirmed'
      );

      const marketDataService = new MarketDataService(
        process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        process.env.REDIS_URL || 'redis://localhost:6379',
        8080
      );
      await marketDataService.initialize();

      const eventListener = new BlockchainEventListener(
        connection,
        marketDataService,
        programId
      );

      // Setup event handlers
      eventListener.on('tradeEvent', (event) => {
        console.log(`📈 Trade: ${event.tradeType} ${event.tokenAmount} tokens at ${event.price} SOL`);
      });

      eventListener.on('marketEvent', (event) => {
        console.log(`🏪 Market: ${event.eventType} for ${event.marketId}`);
      });

      eventListener.on('healthCheck', (status) => {
        console.log(`💓 Health: Slot ${status.currentSlot}, Queue: ${status.queueSize}`);
      });

      eventListener.on('error', (error) => {
        console.error('❌ Listener error:', error);
      });

      // Start listening
      await eventListener.startListening();
      console.log('✅ Event listener started successfully');

      // Handle graceful shutdown
      const shutdown = async () => {
        console.log('\n🛑 Shutting down...');
        await eventListener.stopListening();
        await marketDataService.shutdown();
        await dbConnection.shutdown();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      // Set duration if specified
      if (options.duration) {
        const duration = parseInt(options.duration) * 1000;
        setTimeout(async () => {
          console.log(`⏰ Duration ${options.duration}s reached, stopping...`);
          await shutdown();
        }, duration);
      }

      // Keep process alive
      if (!options.duration) {
        console.log('Press Ctrl+C to stop listening...');
        await new Promise(() => {}); // Keep alive indefinitely
      }

    } catch (error) {
      console.error('❌ Failed to start listener:', error);
      process.exit(1);
    }
  });

program
  .command('catchup')
  .description('Catch up on missed events')
  .option('--program-id <id>', 'Program ID to catch up')
  .option('--from-slot <slot>', 'Start from specific slot')
  .action(async (options) => {
    try {
      const programId = options.programId || process.env.PROGRAM_ID;
      if (!programId) {
        console.error('❌ Program ID is required');
        process.exit(1);
      }

      console.log(`🔄 Starting catch-up for program: ${programId}`);
      
      await dbConnection.initialize();
      
      const connection = new Connection(
        process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        'confirmed'
      );

      const marketDataService = new MarketDataService(
        process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        process.env.REDIS_URL || 'redis://localhost:6379',
        8080
      );
      await marketDataService.initialize();

      const eventListener = new BlockchainEventListener(
        connection,
        marketDataService,
        programId
      );

      // Set starting slot if provided
      if (options.fromSlot) {
        await dbConnection.query(`
          UPDATE blockchain_sync_state 
          SET last_processed_slot = $1 
          WHERE program_id = $2
        `, [parseInt(options.fromSlot), programId]);
        console.log(`📍 Set starting slot to: ${options.fromSlot}`);
      }

      let eventCount = 0;
      eventListener.on('tradeEvent', () => eventCount++);
      eventListener.on('marketEvent', () => eventCount++);

      // Trigger catch-up
      await eventListener.triggerCatchUp();
      
      console.log(`✅ Catch-up completed. Processed ${eventCount} events.`);

      await marketDataService.shutdown();
      await dbConnection.shutdown();

    } catch (error) {
      console.error('❌ Catch-up failed:', error);
      process.exit(1);
    }
  });

program
  .command('events')
  .description('Query blockchain events')
  .option('--market-id <id>', 'Filter by market ID')
  .option('--event-type <type>', 'Filter by event type')
  .option('--limit <number>', 'Limit results', '50')
  .action(async (options) => {
    try {
      await dbConnection.initialize();

      let query = 'SELECT * FROM market_events WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (options.marketId) {
        query += ` AND market_id = $${paramIndex}`;
        params.push(options.marketId);
        paramIndex++;
      }

      if (options.eventType) {
        query += ` AND event_type = $${paramIndex}`;
        params.push(options.eventType);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
      params.push(parseInt(options.limit));

      const result = await dbConnection.query(query, params);

      console.log(`\n📋 Found ${result.rows.length} events:`);
      
      result.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. ${row.event_type.toUpperCase()}`);
        console.log(`   Market: ${row.market_id}`);
        console.log(`   Signature: ${row.transaction_signature}`);
        console.log(`   Time: ${row.created_at}`);
        if (row.event_data) {
          console.log(`   Data: ${JSON.stringify(row.event_data, null, 2)}`);
        }
      });

      await dbConnection.shutdown();

    } catch (error) {
      console.error('❌ Failed to query events:', error);
      process.exit(1);
    }
  });

program
  .command('cleanup')
  .description('Clean up old blockchain events')
  .option('--days <number>', 'Keep events from last N days', '30')
  .option('--dry-run', 'Show what would be deleted without deleting')
  .action(async (options) => {
    try {
      await dbConnection.initialize();

      const days = parseInt(options.days);
      
      if (options.dryRun) {
        const result = await dbConnection.query(`
          SELECT 
            COUNT(*) as count,
            MIN(created_at) as oldest,
            MAX(created_at) as newest
          FROM market_events 
          WHERE created_at < NOW() - INTERVAL '${days} days'
        `);

        console.log(`\n🔍 Dry run - Events that would be deleted:`);
        console.log(`Count: ${result.rows[0].count}`);
        console.log(`Oldest: ${result.rows[0].oldest}`);
        console.log(`Newest: ${result.rows[0].newest}`);
      } else {
        const result = await dbConnection.query(`
          DELETE FROM market_events 
          WHERE created_at < NOW() - INTERVAL '${days} days'
          RETURNING COUNT(*)
        `);

        console.log(`✅ Deleted ${result.rowCount} old events (older than ${days} days)`);
      }

      await dbConnection.shutdown();

    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    }
  });

program
  .command('reset')
  .description('Reset blockchain sync state')
  .option('--program-id <id>', 'Program ID to reset')
  .option('--confirm', 'Confirm reset')
  .action(async (options) => {
    if (!options.confirm) {
      console.log('❌ Reset requires --confirm flag');
      console.log('WARNING: This will reset sync state and may cause event reprocessing');
      process.exit(1);
    }

    try {
      await dbConnection.initialize();

      const programId = options.programId || process.env.PROGRAM_ID;
      if (!programId) {
        console.error('❌ Program ID is required');
        process.exit(1);
      }

      await dbConnection.query(`
        UPDATE blockchain_sync_state 
        SET last_processed_slot = 0, updated_at = NOW()
        WHERE program_id = $1
      `, [programId]);

      console.log(`✅ Reset sync state for program: ${programId}`);
      await dbConnection.shutdown();

    } catch (error) {
      console.error('❌ Reset failed:', error);
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