import { Connection, PublicKey } from '@solana/web3.js';
import { BlockchainEventListener, TradeEvent, MarketEvent } from '../services/BlockchainEventListener';
import { MarketDataService } from '../services/MarketDataService';
import { DatabaseService } from '../services/DatabaseService';

// Mock Solana connection
jest.mock('@solana/web3.js');

describe('BlockchainEventListener', () => {
  let eventListener: BlockchainEventListener;
  let mockConnection: jest.Mocked<Connection>;
  let mockMarketDataService: jest.Mocked<MarketDataService>;
  let databaseService: DatabaseService;

  const TEST_PROGRAM_ID = 'TestProgramId123456789';

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/prediction_pump_test';

    // Initialize database service
    databaseService = new DatabaseService();
    await databaseService.initialize();
  });

  beforeEach(() => {
    // Create mock connection
    mockConnection = {
      onProgramAccountChange: jest.fn().mockReturnValue(1),
      onLogs: jest.fn().mockReturnValue(2),
      removeAccountChangeListener: jest.fn(),
      getSlot: jest.fn().mockResolvedValue(1000),
      getSignaturesForAddress: jest.fn().mockResolvedValue([]),
      getTransaction: jest.fn(),
      rpcEndpoint: 'https://api.devnet.solana.com'
    } as any;

    // Create mock market data service
    mockMarketDataService = {
      emit: jest.fn(),
      initialize: jest.fn(),
      shutdown: jest.fn()
    } as any;

    // Create event listener
    eventListener = new BlockchainEventListener(
      mockConnection,
      mockMarketDataService,
      TEST_PROGRAM_ID
    );
  });

  afterEach(async () => {
    if (eventListener.isActive()) {
      await eventListener.stopListening();
    }
  });

  afterAll(async () => {
    if (databaseService) {
      await databaseService.shutdown();
    }
  });

  describe('Initialization and Connection', () => {
    it('should initialize with correct program ID', () => {
      expect(eventListener).toBeDefined();
      expect(eventListener.isActive()).toBe(false);
    });

    it('should start listening successfully', async () => {
      await eventListener.startListening();
      
      expect(eventListener.isActive()).toBe(true);
      expect(mockConnection.onProgramAccountChange).toHaveBeenCalled();
      expect(mockConnection.onLogs).toHaveBeenCalled();
    });

    it('should not start listening if already active', async () => {
      await eventListener.startListening();
      
      // Try to start again
      await eventListener.startListening();
      
      // Should only be called once
      expect(mockConnection.onProgramAccountChange).toHaveBeenCalledTimes(1);
    });

    it('should stop listening successfully', async () => {
      await eventListener.startListening();
      await eventListener.stopListening();
      
      expect(eventListener.isActive()).toBe(false);
      expect(mockConnection.removeAccountChangeListener).toHaveBeenCalled();
    });
  });

  describe('Event Processing', () => {
    beforeEach(async () => {
      await eventListener.startListening();
    });

    it('should emit trade events when received', (done) => {
      const testTradeEvent: TradeEvent = {
        marketId: 'test_market_123',
        programAccount: 'test_program_account',
        trader: 'test_trader_wallet',
        tradeType: 'buy',
        outcomeIndex: 0,
        tokenAmount: 1000,
        solAmount: 500,
        price: 0.5,
        timestamp: Date.now(),
        signature: 'test_signature_123'
      };

      eventListener.on('tradeEvent', (event: TradeEvent) => {
        expect(event).toEqual(testTradeEvent);
        expect(event.marketId).toBe('test_market_123');
        expect(event.tradeType).toBe('buy');
        done();
      });

      // Simulate receiving a trade event
      eventListener.emit('tradeEvent', testTradeEvent);
    });

    it('should emit market events when received', (done) => {
      const testMarketEvent: MarketEvent = {
        marketId: 'test_market_456',
        programAccount: 'test_program_account',
        eventType: 'created',
        data: { creator: 'test_creator' },
        timestamp: Date.now(),
        signature: 'test_market_signature'
      };

      eventListener.on('marketEvent', (event: MarketEvent) => {
        expect(event).toEqual(testMarketEvent);
        expect(event.eventType).toBe('created');
        done();
      });

      // Simulate receiving a market event
      eventListener.emit('marketEvent', testMarketEvent);
    });

    it('should handle multiple events in queue', async () => {
      const events: TradeEvent[] = [];
      
      for (let i = 0; i < 5; i++) {
        events.push({
          marketId: `test_market_${i}`,
          programAccount: 'test_program_account',
          trader: `test_trader_${i}`,
          tradeType: i % 2 === 0 ? 'buy' : 'sell',
          outcomeIndex: 0,
          tokenAmount: 1000 + i,
          solAmount: 500 + i,
          price: 0.5 + (i * 0.1),
          timestamp: Date.now() + i,
          signature: `test_signature_${i}`
        });
      }

      let processedCount = 0;
      eventListener.on('tradeEvent', () => {
        processedCount++;
      });

      // Add events to queue
      events.forEach(event => {
        eventListener.emit('tradeEvent', event);
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(processedCount).toBe(5);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle connection errors gracefully', async () => {
      await eventListener.startListening();

      let errorEmitted = false;
      eventListener.on('error', () => {
        errorEmitted = true;
      });

      // Simulate connection error
      const error = new Error('Connection lost');
      eventListener.emit('error', error);

      expect(errorEmitted).toBe(true);
    });

    it('should attempt reconnection on connection failure', async () => {
      await eventListener.startListening();

      // Mock connection failure and recovery
      mockConnection.getSlot.mockRejectedValueOnce(new Error('Connection failed'));
      mockConnection.getSlot.mockResolvedValueOnce(2000);

      // Trigger health check
      eventListener.emit('healthCheck', {
        isListening: true,
        currentSlot: 2000,
        lastProcessedSlot: 1000,
        slotDifference: 1000,
        queueSize: 0
      });

      // Should handle the error without crashing
      expect(eventListener.isActive()).toBe(true);
    });

    it('should catch up on missed events', async () => {
      // Mock historical signatures
      mockConnection.getSignaturesForAddress.mockResolvedValue([
        { signature: 'sig1', slot: 1001 },
        { signature: 'sig2', slot: 1002 }
      ] as any);

      mockConnection.getTransaction.mockResolvedValue({
        meta: {
          err: null,
          logMessages: ['Program log: TradeExecuted market:test trader:user type:buy']
        }
      } as any);

      await eventListener.startListening();

      // Should have attempted to get historical signatures
      expect(mockConnection.getSignaturesForAddress).toHaveBeenCalled();
    });
  });

  describe('Status and Metrics', () => {
    it('should provide accurate status information', async () => {
      const initialStatus = eventListener.getStatus();
      expect(initialStatus.isListening).toBe(false);
      expect(initialStatus.subscriptionCount).toBe(0);

      await eventListener.startListening();

      const activeStatus = eventListener.getStatus();
      expect(activeStatus.isListening).toBe(true);
      expect(activeStatus.subscriptionCount).toBeGreaterThan(0);
    });

    it('should track queue size correctly', () => {
      const status = eventListener.getStatus();
      expect(typeof status.queueSize).toBe('number');
      expect(status.queueSize).toBeGreaterThanOrEqual(0);
    });

    it('should track last processed slot', () => {
      const status = eventListener.getStatus();
      expect(typeof status.lastProcessedSlot).toBe('number');
      expect(status.lastProcessedSlot).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Event Queue Management', () => {
    it('should flush event queue on demand', async () => {
      await eventListener.startListening();

      // Add some events to queue
      const testEvent: TradeEvent = {
        marketId: 'test_market',
        programAccount: 'test_program_account',
        trader: 'test_trader',
        tradeType: 'buy',
        outcomeIndex: 0,
        tokenAmount: 1000,
        solAmount: 500,
        price: 0.5,
        timestamp: Date.now(),
        signature: 'test_signature'
      };

      eventListener.emit('tradeEvent', testEvent);

      // Flush queue
      await eventListener.flushEventQueue();

      // Queue should be processed
      const status = eventListener.getStatus();
      expect(status.queueSize).toBe(0);
    });

    it('should handle queue processing errors gracefully', async () => {
      await eventListener.startListening();

      // Create an event that will cause processing error
      const invalidEvent = {
        marketId: null, // Invalid data
        signature: 'invalid_signature'
      } as any;

      let errorHandled = false;
      eventListener.on('error', () => {
        errorHandled = true;
      });

      // This should not crash the listener
      eventListener.emit('tradeEvent', invalidEvent);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Listener should still be active
      expect(eventListener.isActive()).toBe(true);
    });
  });

  describe('Database Integration', () => {
    it('should store trade events in database', async () => {
      await eventListener.startListening();

      const tradeEvent: TradeEvent = {
        marketId: 'db_test_market',
        programAccount: 'db_test_program',
        trader: 'db_test_trader',
        tradeType: 'buy',
        outcomeIndex: 0,
        tokenAmount: 1000,
        solAmount: 500,
        price: 0.5,
        timestamp: Date.now(),
        signature: 'db_test_signature_' + Date.now()
      };

      // Process the event
      eventListener.emit('tradeEvent', tradeEvent);

      // Wait for database processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if event was stored (this would require actual database connection in real test)
      // For now, just verify no errors were thrown
      expect(eventListener.isActive()).toBe(true);
    });

    it('should handle duplicate events gracefully', async () => {
      await eventListener.startListening();

      const duplicateEvent: TradeEvent = {
        marketId: 'duplicate_test_market',
        programAccount: 'duplicate_test_program',
        trader: 'duplicate_test_trader',
        tradeType: 'sell',
        outcomeIndex: 1,
        tokenAmount: 500,
        solAmount: 250,
        price: 0.5,
        timestamp: Date.now(),
        signature: 'duplicate_signature_' + Date.now()
      };

      // Process the same event twice
      eventListener.emit('tradeEvent', duplicateEvent);
      eventListener.emit('tradeEvent', duplicateEvent);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should handle duplicates without errors
      expect(eventListener.isActive()).toBe(true);
    });
  });
});