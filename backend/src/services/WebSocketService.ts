import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import winston from 'winston';
import { MarketDataService } from './MarketDataService';

export interface WebSocketMessage {
  type: string;
  marketId?: string;
  data?: any;
  timestamp?: number;
  clientId?: string;
}

export interface ClientSubscription {
  marketId: string;
  outcomeIndex?: number;
  subscriptionType: 'price' | 'trades' | 'all';
}

export interface WebSocketClient {
  ws: WebSocket;
  id: string;
  subscriptions: Set<string>;
  lastPing: number;
  isAlive: boolean;
  metadata: {
    userAgent?: string;
    ip?: string;
    connectedAt: number;
    userId?: string;
  };
}

export class WebSocketService extends EventEmitter {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();
  private marketSubscriptions: Map<string, Set<string>> = new Map();
  private logger: winston.Logger;
  private marketDataService: MarketDataService;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts: Map<string, number> = new Map();
  private maxReconnectAttempts = 5;
  private heartbeatIntervalMs = 30000; // 30 seconds

  constructor(port: number, marketDataService?: MarketDataService) {
    super();
    
    this.marketDataService = marketDataService;
    this.wss = new WebSocketServer({ 
      port,
      perMessageDeflate: {
        zlibDeflateOptions: {
          level: 3,
          chunkSize: 1024,
        },
        threshold: 1024,
        concurrencyLimit: 10,
      }
    });
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'websocket.log' })
      ]
    });

  }

  public async initialize(): Promise<void> {
    this.setupWebSocketServer();
    this.startHeartbeat();
    this.logger.info('WebSocket service initialized successfully');
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, request) => {
      const clientId = this.generateClientId();
      const client: WebSocketClient = {
        ws,
        id: clientId,
        subscriptions: new Set(),
        lastPing: Date.now(),
        isAlive: true,
        metadata: {
          userAgent: request.headers['user-agent'],
          ip: request.socket.remoteAddress,
          connectedAt: Date.now()
        }
      };

      this.clients.set(clientId, client);
      this.logger.info(`New WebSocket connection: ${clientId}`, {
        clientId,
        ip: client.metadata.ip,
        userAgent: client.metadata.userAgent
      });

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connection_established',
        data: {
          clientId,
          serverTime: Date.now(),
          supportedMessageTypes: [
            'subscribe',
            'unsubscribe',
            'get_market_data',
            'ping',
            'get_subscriptions'
          ]
        }
      });

      // Setup message handler
      ws.on('message', async (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          message.clientId = clientId;
          await this.handleMessage(clientId, message);
        } catch (error) {
          this.logger.error(`Error handling message from ${clientId}:`, error);
          this.sendError(clientId, 'Invalid message format', 'INVALID_JSON');
        }
      });

      // Setup pong handler for heartbeat
      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.isAlive = true;
          client.lastPing = Date.now();
        }
      });

      // Setup close handler
      ws.on('close', (code: number, reason: Buffer) => {
        this.handleClientDisconnect(clientId, code, reason.toString());
      });

      // Setup error handler
      ws.on('error', (error: Error) => {
        this.logger.error(`WebSocket error for client ${clientId}:`, error);
        this.handleClientError(clientId, error);
      });

      this.emit('client_connected', { clientId, client });
    });

    this.wss.on('error', (error: Error) => {
      this.logger.error('WebSocket server error:', error);
      this.emit('server_error', error);
    });

    this.logger.info(`WebSocket server started on port ${this.wss.options.port}`);
  }

  private async handleMessage(clientId: string, message: WebSocketMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      this.logger.warn(`Message from unknown client: ${clientId}`);
      return;
    }

    this.logger.debug(`Message from ${clientId}:`, { type: message.type, marketId: message.marketId });

    try {
      switch (message.type) {
        case 'subscribe':
          await this.handleSubscribe(clientId, message);
          break;
        case 'unsubscribe':
          await this.handleUnsubscribe(clientId, message);
          break;
        case 'get_market_data':
          await this.handleGetMarketData(clientId, message);
          break;
        case 'ping':
          await this.handlePing(clientId, message);
          break;
        case 'get_subscriptions':
          await this.handleGetSubscriptions(clientId);
          break;
        default:
          this.sendError(clientId, `Unknown message type: ${message.type}`, 'UNKNOWN_MESSAGE_TYPE');
      }
    } catch (error) {
      this.logger.error(`Error processing message from ${clientId}:`, error);
      this.sendError(clientId, 'Internal server error', 'INTERNAL_ERROR');
    }
  }

  private async handleSubscribe(clientId: string, message: WebSocketMessage): Promise<void> {
    const { marketId, data } = message;
    
    if (!marketId) {
      this.sendError(clientId, 'Market ID is required for subscription', 'MISSING_MARKET_ID');
      return;
    }

    const client = this.clients.get(clientId);
    if (!client) return;

    const subscriptionKey = `${marketId}:${data?.outcomeIndex || 'all'}:${data?.type || 'all'}`;
    
    // Add to client subscriptions
    client.subscriptions.add(subscriptionKey);
    
    // Add to market subscriptions
    if (!this.marketSubscriptions.has(marketId)) {
      this.marketSubscriptions.set(marketId, new Set());
    }
    this.marketSubscriptions.get(marketId)!.add(clientId);

    // Send current market data immediately
    await this.sendCurrentMarketData(clientId, marketId, data?.outcomeIndex);

    // Send confirmation
    this.sendToClient(clientId, {
      type: 'subscription_confirmed',
      marketId,
      data: {
        subscriptionKey,
        outcomeIndex: data?.outcomeIndex,
        subscriptionType: data?.type || 'all'
      }
    });

    this.logger.info(`Client ${clientId} subscribed to ${subscriptionKey}`);
    this.emit('subscription_added', { clientId, marketId, subscriptionKey });
  }

  private async handleUnsubscribe(clientId: string, message: WebSocketMessage): Promise<void> {
    const { marketId, data } = message;
    
    if (!marketId) {
      this.sendError(clientId, 'Market ID is required for unsubscription', 'MISSING_MARKET_ID');
      return;
    }

    const client = this.clients.get(clientId);
    if (!client) return;

    const subscriptionKey = `${marketId}:${data?.outcomeIndex || 'all'}:${data?.type || 'all'}`;
    
    // Remove from client subscriptions
    client.subscriptions.delete(subscriptionKey);
    
    // Remove from market subscriptions
    const marketSubs = this.marketSubscriptions.get(marketId);
    if (marketSubs) {
      marketSubs.delete(clientId);
      if (marketSubs.size === 0) {
        this.marketSubscriptions.delete(marketId);
      }
    }

    // Send confirmation
    this.sendToClient(clientId, {
      type: 'unsubscription_confirmed',
      marketId,
      data: { subscriptionKey }
    });

    this.logger.info(`Client ${clientId} unsubscribed from ${subscriptionKey}`);
    this.emit('subscription_removed', { clientId, marketId, subscriptionKey });
  }

  private async handleGetMarketData(clientId: string, message: WebSocketMessage): Promise<void> {
    const { marketId } = message;
    
    if (!marketId) {
      this.sendError(clientId, 'Market ID is required', 'MISSING_MARKET_ID');
      return;
    }

    await this.sendCurrentMarketData(clientId, marketId);
  }

  private async handlePing(clientId: string, message: WebSocketMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastPing = Date.now();
    client.isAlive = true;

    this.sendToClient(clientId, {
      type: 'pong',
      data: {
        serverTime: Date.now(),
        clientTime: message.data?.clientTime
      }
    });
  }

  private async handleGetSubscriptions(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    this.sendToClient(clientId, {
      type: 'subscriptions_list',
      data: {
        subscriptions: Array.from(client.subscriptions),
        count: client.subscriptions.size
      }
    });
  }

  private async sendCurrentMarketData(clientId: string, marketId: string, outcomeIndex?: number): Promise<void> {
    try {
      if (!this.marketDataService) {
        this.sendError(clientId, 'Market data service not available', 'SERVICE_UNAVAILABLE');
        return;
      }

      const marketData = await this.marketDataService.getMarketData(marketId);
      
      if (!marketData) {
        this.sendError(clientId, `Market data not found for ${marketId}`, 'MARKET_NOT_FOUND');
        return;
      }

      let responseData = marketData;
      
      // Filter by outcome index if specified
      if (outcomeIndex !== undefined && marketData.prices) {
        responseData = {
          ...marketData,
          prices: marketData.prices.filter(p => p.outcomeIndex === outcomeIndex)
        };
      }

      this.sendToClient(clientId, {
        type: 'market_data',
        marketId,
        data: responseData
      });

    } catch (error) {
      this.logger.error(`Error sending market data to ${clientId}:`, error);
      this.sendError(clientId, 'Failed to fetch market data', 'DATA_FETCH_ERROR');
    }
  }

  private handleClientDisconnect(clientId: string, code: number, reason: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from all market subscriptions
    for (const [marketId, subscribers] of this.marketSubscriptions.entries()) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.marketSubscriptions.delete(marketId);
      }
    }

    // Remove client
    this.clients.delete(clientId);

    this.logger.info(`Client ${clientId} disconnected`, {
      code,
      reason,
      connectedDuration: Date.now() - client.metadata.connectedAt
    });

    this.emit('client_disconnected', { clientId, code, reason });
  }

  private handleClientError(clientId: string, error: Error): void {
    this.logger.error(`Client ${clientId} error:`, error);
    
    // Attempt to send error message if connection is still open
    try {
      this.sendError(clientId, 'Connection error occurred', 'CONNECTION_ERROR');
    } catch (sendError) {
      this.logger.error(`Failed to send error message to ${clientId}:`, sendError);
    }

    this.emit('client_error', { clientId, error });
  }

  private sendToClient(clientId: string, message: WebSocketMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const messageWithTimestamp = {
        ...message,
        timestamp: Date.now()
      };
      
      client.ws.send(JSON.stringify(messageWithTimestamp));
      return true;
    } catch (error) {
      this.logger.error(`Error sending message to ${clientId}:`, error);
      return false;
    }
  }

  private sendError(clientId: string, message: string, code: string): void {
    this.sendToClient(clientId, {
      type: 'error',
      data: {
        message,
        code,
        timestamp: Date.now()
      }
    });
  }

  public broadcastMarketUpdate(marketId: string, marketData: any): void {
    const subscribers = this.marketSubscriptions.get(marketId);
    if (!subscribers || subscribers.size === 0) return;

    const message: WebSocketMessage = {
      type: 'market_update',
      marketId,
      data: marketData,
      timestamp: Date.now()
    };

    let successCount = 0;
    let failureCount = 0;

    for (const clientId of subscribers) {
      if (this.sendToClient(clientId, message)) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    this.logger.debug(`Broadcast market update for ${marketId}`, {
      subscribers: subscribers.size,
      successful: successCount,
      failed: failureCount
    });

    this.emit('market_update_broadcast', { marketId, successCount, failureCount });
  }

  public broadcastTradeEvent(marketId: string, tradeData: any): void {
    const subscribers = this.marketSubscriptions.get(marketId);
    if (!subscribers || subscribers.size === 0) return;

    const message: WebSocketMessage = {
      type: 'trade_event',
      marketId,
      data: tradeData,
      timestamp: Date.now()
    };

    for (const clientId of subscribers) {
      this.sendToClient(clientId, message);
    }

    this.logger.debug(`Broadcast trade event for ${marketId}`, {
      subscribers: subscribers.size
    });

    this.emit('trade_event_broadcast', { marketId, tradeData });
  }

  public broadcastToUser(userId: string, message: WebSocketMessage): void {
    // Find all clients for this user (users might have multiple connections)
    const userClients = Array.from(this.clients.values())
      .filter(client => client.metadata.userId === userId);

    if (userClients.length === 0) {
      this.logger.debug(`No active connections found for user: ${userId}`);
      return;
    }

    let successCount = 0;
    for (const client of userClients) {
      if (this.sendToClient(client.id, message)) {
        successCount++;
      }
    }

    this.logger.debug(`Broadcast to user ${userId}`, {
      connections: userClients.length,
      successful: successCount
    });

    this.emit('user_broadcast', { userId, successCount, totalConnections: userClients.length });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeat();
    }, this.heartbeatIntervalMs);

    this.logger.info(`Heartbeat started with ${this.heartbeatIntervalMs}ms interval`);
  }

  private performHeartbeat(): void {
    const now = Date.now();
    const deadClients: string[] = [];

    for (const [clientId, client] of this.clients.entries()) {
      if (!client.isAlive || (now - client.lastPing) > this.heartbeatIntervalMs * 2) {
        deadClients.push(clientId);
        continue;
      }

      client.isAlive = false;
      
      try {
        client.ws.ping();
      } catch (error) {
        this.logger.error(`Error pinging client ${clientId}:`, error);
        deadClients.push(clientId);
      }
    }

    // Clean up dead clients
    for (const clientId of deadClients) {
      this.logger.info(`Removing dead client: ${clientId}`);
      this.handleClientDisconnect(clientId, 1006, 'Heartbeat timeout');
    }

    if (deadClients.length > 0) {
      this.logger.info(`Heartbeat cleanup: removed ${deadClients.length} dead clients`);
    }
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public getStats(): any {
    const marketStats = new Map<string, number>();
    for (const [marketId, subscribers] of this.marketSubscriptions.entries()) {
      marketStats.set(marketId, subscribers.size);
    }

    return {
      totalClients: this.clients.size,
      totalMarketSubscriptions: this.marketSubscriptions.size,
      marketSubscriptionStats: Object.fromEntries(marketStats),
      serverUptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down WebSocket service...');

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all client connections
    for (const [clientId, client] of this.clients.entries()) {
      try {
        client.ws.close(1001, 'Server shutting down');
      } catch (error) {
        this.logger.error(`Error closing client ${clientId}:`, error);
      }
    }

    // Close server
    return new Promise((resolve) => {
      this.wss.close(() => {
        this.logger.info('WebSocket service shutdown complete');
        resolve();
      });
    });
  }
}