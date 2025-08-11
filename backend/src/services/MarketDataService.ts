import { Connection, PublicKey } from '@solana/web3.js';
import { EventEmitter } from 'events';
import { createClient } from 'redis';
import winston from 'winston';
import { WebSocketService } from './WebSocketService';

export interface MarketPrice {
  marketId: string;
  outcomeIndex: number;
  price: number;
  volume24h: number;
  priceChange24h: number;
  timestamp: number;
}

export interface MarketData {
  marketId: string;
  programAccount: string;
  prices: MarketPrice[];
  totalVolume: number;
  traderCount: number;
  volatility: number;
  trendScore: number;
  lastUpdated: number;
}

export interface ChartDataPoint {
  timestamp: number;
  price: number;
  volume: number;
}

export class MarketDataService extends EventEmitter {
  private connection: Connection;
  private webSocketService: WebSocketService;
  private redis: any;
  private logger: winston.Logger;
  private priceCache: Map<string, MarketData> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(
    solanaRpcUrl: string,
    redisUrl: string,
    wsPort: number = 8080
  ) {
    super();
    
    this.connection = new Connection(solanaRpcUrl, 'confirmed');
    this.redis = createClient({ url: redisUrl });
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'market-data.log' })
      ]
    });

    // Initialize WebSocket service
    this.webSocketService = new WebSocketService(wsPort, this);
    this.setupWebSocketEventHandlers();
    this.setupRedisConnection();
  }

  async initialize(): Promise<void> {
    try {
      await this.redis.connect();
      this.logger.info('MarketDataService initialized successfully');
      
      // Start periodic data updates
      this.startPeriodicUpdates();
      
      // Setup blockchain event listeners
      await this.setupBlockchainListeners();
      
    } catch (error) {
      this.logger.error('Failed to initialize MarketDataService:', error);
      throw error;
    }
  }

  private setupWebSocketEventHandlers(): void {
    // Handle WebSocket service events
    this.webSocketService.on('client_connected', (event) => {
      this.logger.info(`WebSocket client connected: ${event.clientId}`);
    });

    this.webSocketService.on('client_disconnected', (event) => {
      this.logger.info(`WebSocket client disconnected: ${event.clientId}`);
    });

    this.webSocketService.on('subscription_added', (event) => {
      this.logger.info(`New subscription: ${event.subscriptionKey} for client ${event.clientId}`);
    });

    this.webSocketService.on('subscription_removed', (event) => {
      this.logger.info(`Subscription removed: ${event.subscriptionKey} for client ${event.clientId}`);
    });

    this.webSocketService.on('client_error', (event) => {
      this.logger.error(`WebSocket client error for ${event.clientId}:`, event.error);
    });

    this.webSocketService.on('server_error', (error) => {
      this.logger.error('WebSocket server error:', error);
    });
  }

  private async setupRedisConnection(): Promise<void> {
    this.redis.on('error', (error: Error) => {
      this.logger.error('Redis connection error:', error);
    });

    this.redis.on('connect', () => {
      this.logger.info('Connected to Redis');
    });
  }

  // WebSocket functionality is now handled by WebSocketService
  // This service focuses on data aggregation and broadcasting

  async getMarketData(marketId: string): Promise<MarketData | null> {
    try {
      // Try cache first
      if (this.priceCache.has(marketId)) {
        const cached = this.priceCache.get(marketId)!;
        if (Date.now() - cached.lastUpdated < 5000) { // 5 second cache
          return cached;
        }
      }

      // Fetch from Redis
      const cachedData = await this.redis.get(`market:${marketId}`);
      if (cachedData) {
        const marketData = JSON.parse(cachedData);
        this.priceCache.set(marketId, marketData);
        return marketData;
      }

      return null;
    } catch (error) {
      this.logger.error(`Error fetching market data for ${marketId}:`, error);
      return null;
    }
  }

  private startPeriodicUpdates(): void {
    // Update market data every 10 seconds
    this.updateInterval = setInterval(async () => {
      await this.updateAllMarketData();
    }, 10000);
  }

  private async updateAllMarketData(): Promise<void> {
    try {
      const activeMarkets = await this.getActiveMarkets();
      
      for (const marketId of activeMarkets) {
        await this.updateMarketData(marketId);
      }
    } catch (error) {
      this.logger.error('Error updating market data:', error);
    }
  }

  private async getActiveMarkets(): Promise<string[]> {
    // Get markets with active WebSocket subscriptions
    const wsStats = this.webSocketService.getStats();
    return Object.keys(wsStats.marketSubscriptionStats || {});
  }

  private async updateMarketData(marketId: string): Promise<void> {
    try {
      // Fetch latest data from blockchain and database
      const marketData = await this.aggregateMarketData(marketId);
      
      if (marketData) {
        // Update cache
        this.priceCache.set(marketId, marketData);
        
        // Store in Redis
        await this.redis.setex(`market:${marketId}`, 300, JSON.stringify(marketData));
        
        // Broadcast to subscribers
        await this.broadcastMarketUpdate(marketId, marketData);
      }
    } catch (error) {
      this.logger.error(`Error updating market data for ${marketId}:`, error);
    }
  }

  private async broadcastMarketUpdate(marketId: string, marketData: MarketData): Promise<void> {
    // Use WebSocketService to broadcast updates
    this.webSocketService.broadcastMarketUpdate(marketId, marketData);
    
    // Emit event for other services
    this.emit('market_update', { marketId, marketData });
  }

  private async aggregateMarketData(marketId: string): Promise<MarketData | null> {
    // This method would aggregate data from various sources:
    // 1. Blockchain events for recent trades
    // 2. Database for historical data
    // 3. Calculate volatility and trend scores
    
    // Placeholder implementation - would be replaced with actual data aggregation
    return {
      marketId,
      programAccount: `market_${marketId}`,
      prices: [
        {
          marketId,
          outcomeIndex: 0,
          price: 0.65,
          volume24h: 1000,
          priceChange24h: 0.05,
          timestamp: Date.now()
        },
        {
          marketId,
          outcomeIndex: 1,
          price: 0.35,
          volume24h: 800,
          priceChange24h: -0.05,
          timestamp: Date.now()
        }
      ],
      totalVolume: 1800,
      traderCount: 25,
      volatility: 0.15,
      trendScore: 0.75,
      lastUpdated: Date.now()
    };
  }

  private async setupBlockchainListeners(): Promise<void> {
    // Setup listeners for program events
    // This would listen to the prediction market program for trade events
    this.logger.info('Setting up blockchain event listeners');
    
    // Placeholder - would implement actual program event listening
    // this.connection.onProgramAccountChange(
    //   new PublicKey(PROGRAM_ID),
    //   (accountInfo, context) => {
    //     this.handleProgramAccountChange(accountInfo, context);
    //   }
    // );
  }

  async getTrendingMarkets(limit: number = 10): Promise<MarketData[]> {
    try {
      // Get all cached market data
      const allMarkets = Array.from(this.priceCache.values());
      
      // Sort by trend score (combination of volume, volatility, and recent activity)
      const trending = allMarkets
        .sort((a, b) => b.trendScore - a.trendScore)
        .slice(0, limit);
      
      return trending;
    } catch (error) {
      this.logger.error('Error fetching trending markets:', error);
      return [];
    }
  }

  async getChartData(marketId: string, outcomeIndex: number, timeframe: string = '24h'): Promise<ChartDataPoint[]> {
    try {
      const cacheKey = `chart:${marketId}:${outcomeIndex}:${timeframe}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      // Generate chart data from historical trades
      const chartData = await this.generateChartData(marketId, outcomeIndex, timeframe);
      
      // Cache for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(chartData));
      
      return chartData;
    } catch (error) {
      this.logger.error(`Error fetching chart data for ${marketId}:`, error);
      return [];
    }
  }

  private async generateChartData(marketId: string, outcomeIndex: number, timeframe: string): Promise<ChartDataPoint[]> {
    // This would query the database for historical trade data
    // and generate OHLCV data points for charting
    
    // Placeholder implementation
    const now = Date.now();
    const points: ChartDataPoint[] = [];
    
    for (let i = 24; i >= 0; i--) {
      points.push({
        timestamp: now - (i * 60 * 60 * 1000), // hourly points
        price: 0.5 + (Math.random() - 0.5) * 0.3, // random price between 0.35-0.65
        volume: Math.random() * 100
      });
    }
    
    return points;
  }

  async shutdown(): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    await this.webSocketService.shutdown();
    await this.redis.quit();
    
    this.logger.info('MarketDataService shutdown complete');
  }

  // Public method to broadcast trade events
  public broadcastTradeEvent(marketId: string, tradeData: any): void {
    this.webSocketService.broadcastTradeEvent(marketId, tradeData);
    this.emit('trade_event', { marketId, tradeData });
  }

  // Public method to get WebSocket statistics
  public getWebSocketStats(): any {
    return this.webSocketService.getStats();
  }
}