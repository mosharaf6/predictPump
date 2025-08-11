import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { Connection } from '@solana/web3.js';
import winston from 'winston';

import { MarketDataService } from './services/MarketDataService';
import { BlockchainEventListener } from './services/BlockchainEventListener';
import { TrendingAlgorithm } from './services/TrendingAlgorithm';
import { DatabaseService } from './services/DatabaseService';
import { SocialService } from './services/SocialService';
import { NotificationService } from './services/NotificationService';
import { WebSocketService } from './services/WebSocketService';
import { createMarketDataRouter } from './routes/marketData';
import { createSocialRouter } from './routes/social';
import { createNotificationRouter } from './routes/notifications';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const WS_PORT = process.env.WS_PORT || 8080;

// Setup logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'server.log' })
  ]
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize services
let marketDataService: MarketDataService;
let blockchainEventListener: BlockchainEventListener;
let trendingAlgorithm: TrendingAlgorithm;
let databaseService: DatabaseService;
let socialService: SocialService;
let notificationService: NotificationService;
let webSocketService: WebSocketService;

async function initializeServices() {
  try {
    // Initialize database service
    databaseService = new DatabaseService();
    await databaseService.initialize();

    // Initialize social service
    socialService = new SocialService(databaseService.getPool());

    // Initialize trending algorithm
    trendingAlgorithm = new TrendingAlgorithm();

    // Initialize market data service first
    const solanaRpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    marketDataService = new MarketDataService(solanaRpcUrl, redisUrl, Number(WS_PORT));
    await marketDataService.initialize();

    // Initialize WebSocket service with market data service
    webSocketService = new WebSocketService(Number(WS_PORT + 1), marketDataService); // Use different port to avoid conflict
    await webSocketService.initialize();

    // Initialize notification service
    notificationService = new NotificationService(databaseService, webSocketService);

    // Initialize blockchain event listener
    const connection = new Connection(solanaRpcUrl, 'confirmed');
    const programId = process.env.PROGRAM_ID || 'YourProgramIdHere';
    blockchainEventListener = new BlockchainEventListener(connection, marketDataService, programId);

    // Setup event handlers
    blockchainEventListener.on('tradeEvent', async (tradeEvent) => {
      try {
        await databaseService.storeTradeEvent(tradeEvent);
        // Emit trade event to notification service
        notificationService.emit('trade_event', tradeEvent);
        logger.info(`Processed trade event: ${tradeEvent.signature}`);
      } catch (error) {
        logger.error('Error processing trade event:', error);
      }
    });

    blockchainEventListener.on('marketEvent', async (marketEvent) => {
      try {
        await databaseService.storeMarketEvent(marketEvent);
        
        // Emit different notification events based on market event type
        if (marketEvent.eventType === 'market_settled') {
          notificationService.emit('market_settlement', marketEvent);
        }
        
        logger.info(`Processed market event: ${marketEvent.eventType} for ${marketEvent.marketId}`);
      } catch (error) {
        logger.error('Error processing market event:', error);
      }
    });

    // Setup market data updates for price alerts
    marketDataService.on('market_update', (marketData) => {
      notificationService.emit('market_update', marketData);
    });

    // Setup social event notifications
    socialService.on('social_event', (socialEvent) => {
      notificationService.emit('social_event', socialEvent);
    });

    // Start blockchain event listener
    await blockchainEventListener.startListening();

    logger.info('All services initialized successfully');

  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = databaseService ? await databaseService.getHealthStatus() : { status: 'disconnected' };
    const migrationStatus = databaseService ? await databaseService.getMigrationStatus() : null;
    
    const health = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbHealth.status,
          details: dbHealth.details || {},
          migrations: migrationStatus ? {
            applied: migrationStatus.applied?.length || 0,
            pending: migrationStatus.pending?.length || 0,
            total: migrationStatus.total || 0
          } : null
        },
        marketData: marketDataService ? 'active' : 'inactive',
        social: socialService ? 'active' : 'inactive',
        notifications: notificationService ? {
          status: 'active',
          stats: notificationService.getStats()
        } : 'inactive',
        blockchainListener: blockchainEventListener?.isActive() ? 'listening' : 'stopped',
        webSocket: `ws://localhost:${WS_PORT}`
      }
    };
    
    res.json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Initialize routes after services are ready
let marketDataRouter: express.Router;
let socialRouter: express.Router;
let notificationRouter: express.Router;

async function setupRoutes() {
  marketDataRouter = createMarketDataRouter({
    marketDataService,
    trendingAlgorithm,
    databaseService
  });
  
  socialRouter = createSocialRouter({
    socialService,
    databaseService
  });

  notificationRouter = createNotificationRouter({
    notificationService,
    databaseService
  });
  
  app.use('/api/v1/market-data', marketDataRouter);
  app.use('/api/v1/social', socialRouter);
  app.use('/api/v1/notifications', notificationRouter);
}

// Legacy markets endpoint for backward compatibility
app.get('/api/v1/markets', (req, res) => {
  res.json({ 
    message: 'Markets endpoint moved to /api/v1/market-data/trending',
    redirect: '/api/v1/market-data/trending'
  });
});

// WebSocket endpoint info
app.get('/api/v1/websocket', (req, res) => {
  const wsStats = marketDataService ? marketDataService.getWebSocketStats() : {};
  
  res.json({
    websocket: {
      url: `ws://localhost:${WS_PORT}`,
      protocols: ['market-data'],
      stats: wsStats,
      endpoints: {
        subscribe: 'Send {"type": "subscribe", "marketId": "market_id", "data": {"outcomeIndex": 0, "type": "all"}}',
        unsubscribe: 'Send {"type": "unsubscribe", "marketId": "market_id"}',
        getMarketData: 'Send {"type": "get_market_data", "marketId": "market_id"}',
        ping: 'Send {"type": "ping", "data": {"clientTime": timestamp}}',
        getSubscriptions: 'Send {"type": "get_subscriptions"}'
      },
      messageTypes: {
        incoming: ['subscribe', 'unsubscribe', 'get_market_data', 'ping', 'get_subscriptions'],
        outgoing: ['connection_established', 'market_data', 'market_update', 'trade_event', 'subscription_confirmed', 'unsubscription_confirmed', 'subscriptions_list', 'pong', 'error']
      }
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  if (blockchainEventListener) {
    await blockchainEventListener.stopListening();
  }
  
  if (marketDataService) {
    await marketDataService.shutdown();
  }

  if (notificationService) {
    await notificationService.shutdown();
  }

  if (webSocketService) {
    await webSocketService.shutdown();
  }
  
  if (databaseService) {
    await databaseService.shutdown();
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  if (blockchainEventListener) {
    await blockchainEventListener.stopListening();
  }
  
  if (marketDataService) {
    await marketDataService.shutdown();
  }

  if (notificationService) {
    await notificationService.shutdown();
  }

  if (webSocketService) {
    await webSocketService.shutdown();
  }
  
  if (databaseService) {
    await databaseService.shutdown();
  }
  
  process.exit(0);
});

// Start server
async function startServer() {
  await initializeServices();
  await setupRoutes();
  
  app.listen(PORT, () => {
    logger.info(`🚀 Backend server running on port ${PORT}`);
    logger.info(`📊 Market data WebSocket server running on port ${WS_PORT}`);
    logger.info(`🔗 API endpoints available at http://localhost:${PORT}/api/v1/`);
  });
}

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});