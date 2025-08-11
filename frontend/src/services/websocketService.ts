export interface WebSocketMessage {
  type: string;
  marketId?: string;
  data?: any;
  timestamp?: number;
  clientId?: string;
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

export interface MarketPrice {
  marketId: string;
  outcomeIndex: number;
  price: number;
  volume24h: number;
  priceChange24h: number;
  timestamp: number;
}

export interface TradeEvent {
  marketId: string;
  outcomeIndex: number;
  tradeType: 'buy' | 'sell';
  amount: number;
  price: number;
  trader: string;
  timestamp: number;
  signature: string;
}

export interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  debug: boolean;
}

export type WebSocketEventType = 
  | 'connection_established'
  | 'market_data'
  | 'market_update'
  | 'trade_event'
  | 'subscription_confirmed'
  | 'unsubscription_confirmed'
  | 'subscriptions_list'
  | 'pong'
  | 'error'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'reconnected';

export type WebSocketEventHandler = (data: any) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private eventHandlers: Map<WebSocketEventType, Set<WebSocketEventHandler>> = new Map();
  private subscriptions: Set<string> = new Set();
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private isManuallyDisconnected = false;
  private lastPingTime = 0;
  private connectionId: string | null = null;

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      url: config.url || `ws://localhost:${process.env.NEXT_PUBLIC_WS_PORT || 8080}`,
      reconnectInterval: config.reconnectInterval || 3000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      heartbeatInterval: config.heartbeatInterval || 30000,
      debug: config.debug || false
    };

    this.log('WebSocket service initialized', { config: this.config });
  }

  private log(message: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[WebSocket] ${message}`, data || '');
    }
  }

  private error(message: string, error?: any): void {
    console.error(`[WebSocket] ${message}`, error || '');
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting) {
        reject(new Error('Connection already in progress'));
        return;
      }

      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.isConnecting = true;
      this.isManuallyDisconnected = false;

      try {
        this.log('Connecting to WebSocket server', { url: this.config.url });
        this.ws = new WebSocket(this.config.url);

        const onOpen = () => {
          this.log('WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.emit('connected', { connectionId: this.connectionId });
          resolve();
        };

        const onError = (event: Event) => {
          this.error('WebSocket connection error', event);
          this.isConnecting = false;
          if (this.reconnectAttempts === 0) {
            reject(new Error('Failed to connect to WebSocket server'));
          }
        };

        const onClose = (event: CloseEvent) => {
          this.log('WebSocket connection closed', { code: event.code, reason: event.reason });
          this.isConnecting = false;
          this.stopHeartbeat();
          this.emit('disconnected', { code: event.code, reason: event.reason });

          if (!this.isManuallyDisconnected && this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        const onMessage = (event: MessageEvent) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            this.error('Failed to parse WebSocket message', error);
          }
        };

        this.ws.addEventListener('open', onOpen);
        this.ws.addEventListener('error', onError);
        this.ws.addEventListener('close', onClose);
        this.ws.addEventListener('message', onMessage);

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  public disconnect(): void {
    this.log('Manually disconnecting WebSocket');
    this.isManuallyDisconnected = true;
    this.stopHeartbeat();
    this.clearReconnectTimer();

    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1), 30000);

    this.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts} in ${delay}ms`);
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
        this.emit('reconnected', { attempt: this.reconnectAttempts });
        
        // Resubscribe to all previous subscriptions
        for (const subscription of Array.from(this.subscriptions)) {
          const [marketId, outcomeIndex, type] = subscription.split(':');
          await this.subscribeToMarket(marketId, {
            outcomeIndex: outcomeIndex === 'all' ? undefined : parseInt(outcomeIndex),
            type: type === 'all' ? undefined : type
          });
        }
      } catch (error) {
        this.error('Reconnection failed', error);
        if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendPing();
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private sendPing(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.lastPingTime = Date.now();
      this.sendMessage({
        type: 'ping',
        data: { clientTime: this.lastPingTime }
      });
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    this.log('Received message', { type: message.type, marketId: message.marketId });

    switch (message.type) {
      case 'connection_established':
        this.connectionId = message.data?.clientId;
        this.log('Connection established', { clientId: this.connectionId });
        break;

      case 'pong':
        const latency = Date.now() - this.lastPingTime;
        this.log('Pong received', { latency });
        break;

      case 'subscription_confirmed':
        const subKey = `${message.marketId}:${message.data?.outcomeIndex || 'all'}:${message.data?.subscriptionType || 'all'}`;
        this.subscriptions.add(subKey);
        this.log('Subscription confirmed', { subscriptionKey: subKey });
        break;

      case 'unsubscription_confirmed':
        const unsubKey = `${message.marketId}:all:all`; // Simplified for now
        this.subscriptions.delete(unsubKey);
        this.log('Unsubscription confirmed', { subscriptionKey: unsubKey });
        break;

      case 'error':
        this.error('Server error', message.data);
        break;
    }

    // Emit the message to registered handlers
    this.emit(message.type as WebSocketEventType, message.data);
  }

  private sendMessage(message: WebSocketMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      this.log('Sent message', { type: message.type, marketId: message.marketId });
    } else {
      this.error('Cannot send message: WebSocket not connected', { message });
    }
  }

  public subscribeToMarket(marketId: string, options: {
    outcomeIndex?: number;
    type?: string;
  } = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const subscriptionHandler = (data: any) => {
        if (data.subscriptionKey?.includes(marketId)) {
          this.off('subscription_confirmed', subscriptionHandler);
          resolve();
        }
      };

      const errorHandler = (data: any) => {
        if (data.code) {
          this.off('error', errorHandler);
          reject(new Error(data.message || 'Subscription failed'));
        }
      };

      this.on('subscription_confirmed', subscriptionHandler);
      this.on('error', errorHandler);

      this.sendMessage({
        type: 'subscribe',
        marketId,
        data: options
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        this.off('subscription_confirmed', subscriptionHandler);
        this.off('error', errorHandler);
        reject(new Error('Subscription timeout'));
      }, 5000);
    });
  }

  public unsubscribeFromMarket(marketId: string, options: {
    outcomeIndex?: number;
    type?: string;
  } = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const unsubscriptionHandler = (data: any) => {
        this.off('unsubscription_confirmed', unsubscriptionHandler);
        resolve();
      };

      this.on('unsubscription_confirmed', unsubscriptionHandler);

      this.sendMessage({
        type: 'unsubscribe',
        marketId,
        data: options
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        this.off('unsubscription_confirmed', unsubscriptionHandler);
        reject(new Error('Unsubscription timeout'));
      }, 5000);
    });
  }

  public getMarketData(marketId: string): Promise<MarketData> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const dataHandler = (data: MarketData) => {
        if (data.marketId === marketId) {
          this.off('market_data', dataHandler);
          resolve(data);
        }
      };

      const errorHandler = (data: any) => {
        if (data.code) {
          this.off('error', errorHandler);
          reject(new Error(data.message || 'Failed to get market data'));
        }
      };

      this.on('market_data', dataHandler);
      this.on('error', errorHandler);

      this.sendMessage({
        type: 'get_market_data',
        marketId
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        this.off('market_data', dataHandler);
        this.off('error', errorHandler);
        reject(new Error('Get market data timeout'));
      }, 5000);
    });
  }

  public on(event: WebSocketEventType, handler: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  public off(event: WebSocketEventType, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: WebSocketEventType, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          this.error(`Error in event handler for ${event}`, error);
        }
      });
    }
  }

  public getConnectionStatus(): {
    connected: boolean;
    connecting: boolean;
    reconnectAttempts: number;
    subscriptions: string[];
    connectionId: string | null;
  } {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      connecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: Array.from(this.subscriptions),
      connectionId: this.connectionId
    };
  }

  public destroy(): void {
    this.log('Destroying WebSocket service');
    this.disconnect();
    this.eventHandlers.clear();
    this.subscriptions.clear();
  }
}