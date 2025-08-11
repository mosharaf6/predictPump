import { Connection, PublicKey, AccountInfo, Context, ConfirmedSignatureInfo } from '@solana/web3.js';
import { EventEmitter } from 'events';
import winston from 'winston';
import { MarketDataService } from './MarketDataService';
import { dbConnection } from './DatabaseConnection';

export interface TradeEvent {
  marketId: string;
  programAccount: string;
  trader: string;
  tradeType: 'buy' | 'sell';
  outcomeIndex: number;
  tokenAmount: number;
  solAmount: number;
  price: number;
  timestamp: number;
  signature: string;
}

export interface MarketEvent {
  marketId: string;
  programAccount: string;
  eventType: 'created' | 'settled' | 'disputed';
  data: any;
  timestamp: number;
  signature: string;
}

export class BlockchainEventListener extends EventEmitter {
  private connection: Connection;
  private logger: winston.Logger;
  private marketDataService: MarketDataService;
  private programId: PublicKey;
  private subscriptionIds: number[] = [];
  private isListening: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000;
  private lastProcessedSlot: number = 0;
  private eventQueue: (TradeEvent | MarketEvent)[] = [];
  private processingQueue: boolean = false;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(
    connection: Connection,
    marketDataService: MarketDataService,
    programId: string
  ) {
    super();
    
    this.connection = connection;
    this.marketDataService = marketDataService;
    this.programId = new PublicKey(programId);
    
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'blockchain-events.log' })
      ]
    });

    // Setup error handlers
    this.setupErrorHandlers();
    
    // Start event queue processor
    this.startEventQueueProcessor();
  }

  private setupErrorHandlers(): void {
    this.on('error', (error) => {
      this.logger.error('BlockchainEventListener error:', error);
      this.handleConnectionError(error);
    });

    // Handle connection errors
    this.connection.onSlotChange = (slotInfo) => {
      this.lastProcessedSlot = slotInfo.slot;
    };
  }

  private async handleConnectionError(error: Error): Promise<void> {
    this.logger.warn('Connection error detected, attempting to reconnect...', error);
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      
      setTimeout(async () => {
        try {
          await this.reconnect();
        } catch (reconnectError) {
          this.logger.error('Reconnection failed:', reconnectError);
          this.handleConnectionError(reconnectError as Error);
        }
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      this.logger.error('Max reconnection attempts reached, stopping listener');
      await this.stopListening();
    }
  }

  private async reconnect(): Promise<void> {
    this.logger.info('Attempting to reconnect to Solana RPC...');
    
    // Stop current listeners
    await this.stopListening();
    
    // Create new connection
    this.connection = new Connection(this.connection.rpcEndpoint, 'confirmed');
    
    // Restart listening
    await this.startListening();
    
    this.reconnectAttempts = 0;
    this.logger.info('Successfully reconnected to Solana RPC');
  }

  async startListening(): Promise<void> {
    if (this.isListening) {
      this.logger.warn('BlockchainEventListener is already listening');
      return;
    }

    try {
      // Get the last processed slot from database to catch up on missed events
      await this.loadLastProcessedSlot();
      
      // Catch up on missed events if any
      await this.catchUpMissedEvents();

      // Listen to all program account changes
      const subscriptionId = this.connection.onProgramAccountChange(
        this.programId,
        (keyedAccountInfo, context) => {
          this.handleProgramAccountChange(keyedAccountInfo.accountInfo, context);
        },
        'confirmed'
      );

      this.subscriptionIds.push(subscriptionId);
      
      // Also listen to transaction logs for more detailed event parsing
      await this.setupLogListeners();
      
      // Start health check
      this.startHealthCheck();
      
      this.isListening = true;
      this.logger.info(`Started listening to program ${this.programId.toString()}`);
      
    } catch (error) {
      this.logger.error('Failed to start blockchain event listener:', error);
      throw error;
    }
  }

  private async loadLastProcessedSlot(): Promise<void> {
    try {
      const result = await dbConnection.query(
        'SELECT last_processed_slot FROM blockchain_sync_state WHERE program_id = $1',
        [this.programId.toString()]
      );
      
      if (result.rows.length > 0) {
        this.lastProcessedSlot = parseInt(result.rows[0].last_processed_slot);
        this.logger.info(`Loaded last processed slot: ${this.lastProcessedSlot}`);
      }
    } catch (error) {
      this.logger.warn('Could not load last processed slot:', error);
      // Continue without catching up - will start from current slot
    }
  }

  private async saveLastProcessedSlot(): Promise<void> {
    try {
      await dbConnection.query(`
        INSERT INTO blockchain_sync_state (program_id, last_processed_slot, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (program_id) 
        DO UPDATE SET last_processed_slot = $2, updated_at = NOW()
      `, [this.programId.toString(), this.lastProcessedSlot]);
    } catch (error) {
      this.logger.error('Failed to save last processed slot:', error);
    }
  }

  private async catchUpMissedEvents(): Promise<void> {
    if (this.lastProcessedSlot === 0) {
      this.logger.info('No previous slot found, starting from current slot');
      return;
    }

    try {
      const currentSlot = await this.connection.getSlot('confirmed');
      const slotDifference = currentSlot - this.lastProcessedSlot;
      
      if (slotDifference > 1000) {
        this.logger.warn(`Large slot gap detected (${slotDifference} slots), limiting catch-up to last 1000 slots`);
        this.lastProcessedSlot = currentSlot - 1000;
      }

      if (slotDifference > 0) {
        this.logger.info(`Catching up on ${slotDifference} missed slots...`);
        await this.processHistoricalTransactions();
      }
    } catch (error) {
      this.logger.error('Failed to catch up on missed events:', error);
    }
  }

  private async processHistoricalTransactions(): Promise<void> {
    try {
      const signatures = await this.connection.getSignaturesForAddress(
        this.programId,
        { limit: 1000 },
        'confirmed'
      );

      for (const signatureInfo of signatures) {
        try {
          const transaction = await this.connection.getTransaction(signatureInfo.signature, {
            commitment: 'confirmed'
          });

          if (transaction && transaction.meta && !transaction.meta.err) {
            await this.processTransactionLogs(transaction.meta.logMessages || [], signatureInfo.signature);
          }
        } catch (error) {
          this.logger.warn(`Failed to process historical transaction ${signatureInfo.signature}:`, error);
        }
      }

      this.logger.info('Completed historical transaction processing');
    } catch (error) {
      this.logger.error('Failed to process historical transactions:', error);
    }
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const currentSlot = await this.connection.getSlot('confirmed');
        const slotDifference = currentSlot - this.lastProcessedSlot;
        
        if (slotDifference > 100) {
          this.logger.warn(`Health check: Large slot gap detected (${slotDifference} slots)`);
          // Trigger catch-up process
          await this.catchUpMissedEvents();
        }
        
        // Update metrics
        this.emit('healthCheck', {
          isListening: this.isListening,
          currentSlot,
          lastProcessedSlot: this.lastProcessedSlot,
          slotDifference,
          queueSize: this.eventQueue.length
        });
        
      } catch (error) {
        this.logger.error('Health check failed:', error);
        this.emit('error', error);
      }
    }, 30000); // Check every 30 seconds
  }

  private async setupLogListeners(): Promise<void> {
    try {
      // Listen to program logs for detailed event information
      const logSubscriptionId = this.connection.onLogs(
        this.programId,
        (logs, context) => {
          this.handleProgramLogs(logs, context);
        },
        'confirmed'
      );

      this.subscriptionIds.push(logSubscriptionId);
      this.logger.info('Setup program log listeners');
      
    } catch (error) {
      this.logger.error('Failed to setup log listeners:', error);
    }
  }

  private handleProgramAccountChange(accountInfo: AccountInfo<Buffer>, context: Context): void {
    try {
      // Parse the account data to determine what changed
      const accountData = this.parseAccountData(accountInfo.data);
      
      if (accountData) {
        this.processAccountChange(accountData, context);
      }
      
    } catch (error) {
      this.logger.error('Error handling program account change:', error);
    }
  }

  private handleProgramLogs(logs: any, context: Context): void {
    try {
      // Parse program logs to extract trade and market events
      const events = this.parseLogsForEvents(logs);
      
      for (const event of events) {
        this.processEvent(event);
      }
      
    } catch (error) {
      this.logger.error('Error handling program logs:', error);
    }
  }

  private parseAccountData(data: Buffer): any {
    try {
      // This would implement the actual parsing logic based on the program's account structure
      // For now, return a placeholder structure
      
      if (data.length < 8) return null;
      
      // Read discriminator to determine account type
      const discriminator = data.readBigUInt64LE(0);
      
      switch (discriminator.toString()) {
        case '1': // Market account
          return this.parseMarketAccount(data);
        case '2': // User position account
          return this.parseUserPositionAccount(data);
        default:
          return null;
      }
      
    } catch (error) {
      this.logger.error('Error parsing account data:', error);
      return null;
    }
  }

  private parseMarketAccount(data: Buffer): any {
    try {
      // Parse market account structure
      // This is a simplified version - actual implementation would match the Rust struct
      
      let offset = 8; // Skip discriminator
      
      // Read creator (32 bytes)
      const creator = data.subarray(offset, offset + 32);
      offset += 32;
      
      // Read description length and string
      const descriptionLength = data.readUInt32LE(offset);
      offset += 4;
      const description = data.subarray(offset, offset + descriptionLength).toString('utf8');
      offset += descriptionLength;
      
      // Read resolution date (8 bytes)
      const resolutionDate = data.readBigInt64LE(offset);
      offset += 8;
      
      // Read total volume (8 bytes)
      const totalVolume = data.readBigUInt64LE(offset);
      offset += 8;
      
      return {
        type: 'market',
        creator: creator.toString('hex'),
        description,
        resolutionDate: Number(resolutionDate),
        totalVolume: Number(totalVolume)
      };
      
    } catch (error) {
      this.logger.error('Error parsing market account:', error);
      return null;
    }
  }

  private parseUserPositionAccount(data: Buffer): any {
    try {
      // Parse user position account structure
      // Simplified implementation
      
      let offset = 8; // Skip discriminator
      
      const market = data.subarray(offset, offset + 32);
      offset += 32;
      
      const user = data.subarray(offset, offset + 32);
      offset += 32;
      
      const tokenAmount = data.readBigUInt64LE(offset);
      offset += 8;
      
      return {
        type: 'position',
        market: market.toString('hex'),
        user: user.toString('hex'),
        tokenAmount: Number(tokenAmount)
      };
      
    } catch (error) {
      this.logger.error('Error parsing user position account:', error);
      return null;
    }
  }

  private parseLogsForEvents(logs: any): (TradeEvent | MarketEvent)[] {
    const events: (TradeEvent | MarketEvent)[] = [];
    
    try {
      // Parse program logs to extract structured events
      // This would implement actual log parsing based on the program's event structure
      
      if (logs.logs) {
        for (const log of logs.logs) {
          if (log.includes('Program log: TradeExecuted')) {
            const tradeEvent = this.parseTradeLog(log, logs.signature);
            if (tradeEvent) events.push(tradeEvent);
          } else if (log.includes('Program log: MarketCreated')) {
            const marketEvent = this.parseMarketLog(log, logs.signature);
            if (marketEvent) events.push(marketEvent);
          }
        }
      }
      
    } catch (error) {
      this.logger.error('Error parsing logs for events:', error);
    }
    
    return events;
  }

  private parseTradeLog(log: string, signature: string): TradeEvent | null {
    try {
      // Parse trade event from log string
      // Example log: "Program log: TradeExecuted market:ABC123 trader:DEF456 type:buy outcome:0 amount:1000 price:0.65"
      
      const parts = log.split(' ');
      const data: any = {};
      
      for (const part of parts) {
        if (part.includes(':')) {
          const [key, value] = part.split(':');
          data[key] = value;
        }
      }
      
      if (data.market && data.trader && data.type) {
        return {
          marketId: data.market,
          programAccount: data.market,
          trader: data.trader,
          tradeType: data.type as 'buy' | 'sell',
          outcomeIndex: parseInt(data.outcome || '0'),
          tokenAmount: parseInt(data.amount || '0'),
          solAmount: parseInt(data.sol || '0'),
          price: parseFloat(data.price || '0'),
          timestamp: Date.now(),
          signature
        };
      }
      
    } catch (error) {
      this.logger.error('Error parsing trade log:', error);
    }
    
    return null;
  }

  private parseMarketLog(log: string, signature: string): MarketEvent | null {
    try {
      // Parse market event from log string
      const parts = log.split(' ');
      const data: any = {};
      
      for (const part of parts) {
        if (part.includes(':')) {
          const [key, value] = part.split(':');
          data[key] = value;
        }
      }
      
      if (data.market) {
        return {
          marketId: data.market,
          programAccount: data.market,
          eventType: 'created',
          data: data,
          timestamp: Date.now(),
          signature
        };
      }
      
    } catch (error) {
      this.logger.error('Error parsing market log:', error);
    }
    
    return null;
  }

  private processAccountChange(accountData: any, context: Context): void {
    try {
      if (accountData.type === 'market') {
        this.emit('marketUpdate', {
          marketId: accountData.creator, // Using creator as market ID for now
          data: accountData,
          slot: context.slot
        });
      } else if (accountData.type === 'position') {
        this.emit('positionUpdate', {
          marketId: accountData.market,
          user: accountData.user,
          data: accountData,
          slot: context.slot
        });
      }
      
    } catch (error) {
      this.logger.error('Error processing account change:', error);
    }
  }

  private processEvent(event: TradeEvent | MarketEvent): void {
    try {
      if ('tradeType' in event) {
        // Handle trade event
        this.handleTradeEvent(event as TradeEvent);
      } else {
        // Handle market event
        this.handleMarketEvent(event as MarketEvent);
      }
      
    } catch (error) {
      this.logger.error('Error processing event:', error);
    }
  }

  private startEventQueueProcessor(): void {
    setInterval(async () => {
      if (!this.processingQueue && this.eventQueue.length > 0) {
        await this.processEventQueue();
      }
    }, 1000); // Process queue every second
  }

  private async processEventQueue(): Promise<void> {
    if (this.processingQueue || this.eventQueue.length === 0) {
      return;
    }

    this.processingQueue = true;
    const batchSize = 10;
    
    try {
      while (this.eventQueue.length > 0) {
        const batch = this.eventQueue.splice(0, batchSize);
        
        await Promise.all(batch.map(async (event) => {
          try {
            if ('tradeType' in event) {
              await this.handleTradeEvent(event as TradeEvent);
            } else {
              await this.handleMarketEvent(event as MarketEvent);
            }
          } catch (error) {
            this.logger.error('Error processing queued event:', error);
            // Re-queue failed events for retry
            this.eventQueue.push(event);
          }
        }));
        
        // Small delay between batches to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      this.logger.error('Error processing event queue:', error);
    } finally {
      this.processingQueue = false;
    }
  }

  private async handleTradeEvent(event: TradeEvent): Promise<void> {
    try {
      this.logger.info(`Processing trade event: ${event.tradeType} ${event.tokenAmount} tokens for market ${event.marketId}`);
      
      // Store trade in database with retry logic
      await this.storeTradeEventWithRetry(event);
      
      // Emit event for other services to handle
      this.emit('tradeEvent', event);
      
      // Update real-time market data
      await this.updateMarketDataCache(event);
      
      // Update last processed slot
      this.lastProcessedSlot = Math.max(this.lastProcessedSlot, event.timestamp);
      await this.saveLastProcessedSlot();
      
    } catch (error) {
      this.logger.error('Error handling trade event:', error);
      throw error; // Re-throw to trigger retry
    }
  }

  private async handleMarketEvent(event: MarketEvent): Promise<void> {
    try {
      this.logger.info(`Processing market event: ${event.eventType} for market ${event.marketId}`);
      
      // Store market event in database with retry logic
      await this.storeMarketEventWithRetry(event);
      
      // Emit event for other services to handle
      this.emit('marketEvent', event);
      
      // Update market metadata cache
      await this.updateMarketMetadataCache(event);
      
      // Update last processed slot
      this.lastProcessedSlot = Math.max(this.lastProcessedSlot, event.timestamp);
      await this.saveLastProcessedSlot();
      
    } catch (error) {
      this.logger.error('Error handling market event:', error);
      throw error; // Re-throw to trigger retry
    }
  }

  private async storeTradeEventWithRetry(event: TradeEvent, maxRetries: number = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await dbConnection.transaction(async (client) => {
          // Check if event already exists to prevent duplicates
          const existingEvent = await client.query(
            'SELECT id FROM trades WHERE transaction_signature = $1',
            [event.signature]
          );

          if (existingEvent.rows.length > 0) {
            this.logger.debug(`Trade event ${event.signature} already exists, skipping`);
            return;
          }

          // Insert trade event
          await client.query(`
            INSERT INTO trades (
              market_id, user_wallet, transaction_signature, trade_type,
              outcome_index, token_amount, sol_amount, price, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_timestamp($9))
          `, [
            event.marketId,
            event.trader,
            event.signature,
            event.tradeType,
            event.outcomeIndex,
            event.tokenAmount,
            event.solAmount,
            event.price,
            event.timestamp / 1000 // Convert to seconds
          ]);

          // Update market statistics
          await client.query(`
            UPDATE markets SET 
              total_volume = total_volume + $2,
              trader_count = (
                SELECT COUNT(DISTINCT user_wallet) 
                FROM trades 
                WHERE market_id = $1
              ),
              updated_at = NOW()
            WHERE program_account = $1
          `, [event.marketId, event.solAmount]);
        });

        this.logger.debug(`Successfully stored trade event: ${event.signature}`);
        return;
        
      } catch (error) {
        this.logger.warn(`Attempt ${attempt} to store trade event failed:`, error);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  private async storeMarketEventWithRetry(event: MarketEvent, maxRetries: number = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await dbConnection.transaction(async (client) => {
          // Check if event already exists
          const existingEvent = await client.query(
            'SELECT id FROM market_events WHERE transaction_signature = $1',
            [event.signature]
          );

          if (existingEvent.rows.length > 0) {
            this.logger.debug(`Market event ${event.signature} already exists, skipping`);
            return;
          }

          // Create market_events table if it doesn't exist
          await client.query(`
            CREATE TABLE IF NOT EXISTS market_events (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              market_id VARCHAR(44) NOT NULL,
              event_type VARCHAR(50) NOT NULL,
              event_data JSONB,
              transaction_signature VARCHAR(88) NOT NULL UNIQUE,
              created_at TIMESTAMP DEFAULT NOW()
            )
          `);

          // Insert market event
          await client.query(`
            INSERT INTO market_events (
              market_id, event_type, event_data, transaction_signature, created_at
            ) VALUES ($1, $2, $3, $4, to_timestamp($5))
          `, [
            event.marketId,
            event.eventType,
            JSON.stringify(event.data),
            event.signature,
            event.timestamp / 1000
          ]);

          // Update market status if needed
          if (event.eventType === 'settled') {
            await client.query(`
              UPDATE markets SET status = 'settled', updated_at = NOW()
              WHERE program_account = $1
            `, [event.marketId]);
          }
        });

        this.logger.debug(`Successfully stored market event: ${event.signature}`);
        return;
        
      } catch (error) {
        this.logger.warn(`Attempt ${attempt} to store market event failed:`, error);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  private async updateMarketDataCache(event: TradeEvent): Promise<void> {
    try {
      // Notify market data service of new trade
      this.marketDataService.emit('newTrade', {
        marketId: event.marketId,
        price: event.price,
        volume: event.solAmount,
        timestamp: event.timestamp
      });
    } catch (error) {
      this.logger.error('Error updating market data cache:', error);
    }
  }

  private async updateMarketMetadataCache(event: MarketEvent): Promise<void> {
    try {
      // Notify market data service of market event
      this.marketDataService.emit('marketEvent', event);
    } catch (error) {
      this.logger.error('Error updating market metadata cache:', error);
    }
  }

  private async processTransactionLogs(logs: string[], signature: string): Promise<void> {
    try {
      const events = this.parseLogsForEvents({ logs, signature });
      
      for (const event of events) {
        this.eventQueue.push(event);
      }
    } catch (error) {
      this.logger.error('Error processing transaction logs:', error);
    }
  }

  async stopListening(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    try {
      this.logger.info('Stopping blockchain event listener...');
      
      // Stop health check
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = undefined;
      }
      
      // Process remaining events in queue
      if (this.eventQueue.length > 0) {
        this.logger.info(`Processing ${this.eventQueue.length} remaining events...`);
        await this.processEventQueue();
      }
      
      // Remove all subscriptions
      for (const subscriptionId of this.subscriptionIds) {
        try {
          await this.connection.removeAccountChangeListener(subscriptionId);
        } catch (error) {
          this.logger.warn(`Failed to remove subscription ${subscriptionId}:`, error);
        }
      }
      
      this.subscriptionIds = [];
      this.isListening = false;
      
      // Save final processed slot
      await this.saveLastProcessedSlot();
      
      this.logger.info('Blockchain event listener stopped successfully');
      
    } catch (error) {
      this.logger.error('Error stopping blockchain event listener:', error);
      throw error;
    }
  }

  /**
   * Get listener status and metrics
   */
  getStatus(): {
    isListening: boolean;
    lastProcessedSlot: number;
    queueSize: number;
    subscriptionCount: number;
    reconnectAttempts: number;
  } {
    return {
      isListening: this.isListening,
      lastProcessedSlot: this.lastProcessedSlot,
      queueSize: this.eventQueue.length,
      subscriptionCount: this.subscriptionIds.length,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Force process all queued events
   */
  async flushEventQueue(): Promise<void> {
    if (this.eventQueue.length > 0) {
      this.logger.info(`Flushing ${this.eventQueue.length} queued events...`);
      await this.processEventQueue();
    }
  }

  /**
   * Manually trigger catch-up for missed events
   */
  async triggerCatchUp(): Promise<void> {
    this.logger.info('Manually triggering catch-up process...');
    await this.catchUpMissedEvents();
  }

  isActive(): boolean {
    return this.isListening;
  }
}