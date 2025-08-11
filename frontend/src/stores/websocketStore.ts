import { create } from 'zustand';
import { WebSocketService, MarketData, TradeEvent, WebSocketEventType } from '../services/websocketService';

interface WebSocketState {
  // Connection state
  connected: boolean;
  connecting: boolean;
  reconnecting: boolean;
  reconnectAttempts: number;
  connectionId: string | null;
  lastError: string | null;
  
  // Market data
  marketData: Map<string, MarketData>;
  subscriptions: Set<string>;
  
  // Service instance
  service: WebSocketService | null;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribeToMarket: (marketId: string, options?: { outcomeIndex?: number; type?: string }) => Promise<void>;
  unsubscribeFromMarket: (marketId: string, options?: { outcomeIndex?: number; type?: string }) => Promise<void>;
  getMarketData: (marketId: string) => Promise<MarketData>;
  
  // Internal actions
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setReconnecting: (reconnecting: boolean) => void;
  setReconnectAttempts: (attempts: number) => void;
  setConnectionId: (id: string | null) => void;
  setLastError: (error: string | null) => void;
  updateMarketData: (marketId: string, data: MarketData) => void;
  addSubscription: (subscription: string) => void;
  removeSubscription: (subscription: string) => void;
  
  // Cleanup
  destroy: () => void;
}

export const useWebSocketStore = create<WebSocketState>((set, get) => {
  let service: WebSocketService | null = null;

  const initializeService = () => {
    if (service) return service;

    service = new WebSocketService({
      url: `ws://localhost:${process.env.NEXT_PUBLIC_WS_PORT || 8080}`,
      debug: process.env.NODE_ENV === 'development'
    });

    // Setup event handlers
    service.on('connected', (data) => {
      set({ 
        connected: true, 
        connecting: false, 
        reconnecting: false,
        connectionId: data.connectionId,
        lastError: null
      });
    });

    service.on('disconnected', (data) => {
      set({ 
        connected: false, 
        connecting: false,
        lastError: data.reason || 'Connection lost'
      });
    });

    service.on('reconnecting', (data) => {
      set({ 
        reconnecting: true, 
        reconnectAttempts: data.attempt 
      });
    });

    service.on('reconnected', (data) => {
      set({ 
        reconnecting: false, 
        connected: true,
        lastError: null
      });
    });

    service.on('market_data', (data: MarketData) => {
      get().updateMarketData(data.marketId, data);
    });

    service.on('market_update', (data: MarketData) => {
      get().updateMarketData(data.marketId, data);
    });

    service.on('trade_event', (data: TradeEvent) => {
      // Update market data with new trade information
      const currentData = get().marketData.get(data.marketId);
      if (currentData) {
        // Update the price for the specific outcome
        const updatedPrices = currentData.prices.map(price => 
          price.outcomeIndex === data.outcomeIndex 
            ? { ...price, price: data.price, timestamp: data.timestamp }
            : price
        );
        
        const updatedData: MarketData = {
          ...currentData,
          prices: updatedPrices,
          totalVolume: currentData.totalVolume + data.amount,
          lastUpdated: data.timestamp
        };
        
        get().updateMarketData(data.marketId, updatedData);
      }
    });

    service.on('subscription_confirmed', (data) => {
      if (data.subscriptionKey) {
        get().addSubscription(data.subscriptionKey);
      }
    });

    service.on('unsubscription_confirmed', (data) => {
      if (data.subscriptionKey) {
        get().removeSubscription(data.subscriptionKey);
      }
    });

    service.on('error', (data) => {
      set({ lastError: data.message || 'WebSocket error occurred' });
    });

    set({ service });
    return service;
  };

  return {
    // Initial state
    connected: false,
    connecting: false,
    reconnecting: false,
    reconnectAttempts: 0,
    connectionId: null,
    lastError: null,
    marketData: new Map(),
    subscriptions: new Set(),
    service: null,

    // Actions
    connect: async () => {
      const service = initializeService();
      set({ connecting: true, lastError: null });
      
      try {
        await service.connect();
      } catch (error) {
        set({ 
          connecting: false, 
          lastError: error instanceof Error ? error.message : 'Connection failed' 
        });
        throw error;
      }
    },

    disconnect: () => {
      const { service } = get();
      if (service) {
        service.disconnect();
      }
      set({ 
        connected: false, 
        connecting: false, 
        reconnecting: false,
        connectionId: null 
      });
    },

    subscribeToMarket: async (marketId: string, options = {}) => {
      const { service } = get();
      if (!service) {
        throw new Error('WebSocket service not initialized');
      }
      
      try {
        await service.subscribeToMarket(marketId, options);
      } catch (error) {
        set({ lastError: error instanceof Error ? error.message : 'Subscription failed' });
        throw error;
      }
    },

    unsubscribeFromMarket: async (marketId: string, options = {}) => {
      const { service } = get();
      if (!service) {
        throw new Error('WebSocket service not initialized');
      }
      
      try {
        await service.unsubscribeFromMarket(marketId, options);
      } catch (error) {
        set({ lastError: error instanceof Error ? error.message : 'Unsubscription failed' });
        throw error;
      }
    },

    getMarketData: async (marketId: string) => {
      const { service } = get();
      if (!service) {
        throw new Error('WebSocket service not initialized');
      }
      
      try {
        return await service.getMarketData(marketId);
      } catch (error) {
        set({ lastError: error instanceof Error ? error.message : 'Failed to get market data' });
        throw error;
      }
    },

    // Internal actions
    setConnected: (connected) => set({ connected }),
    setConnecting: (connecting) => set({ connecting }),
    setReconnecting: (reconnecting) => set({ reconnecting }),
    setReconnectAttempts: (reconnectAttempts) => set({ reconnectAttempts }),
    setConnectionId: (connectionId) => set({ connectionId }),
    setLastError: (lastError) => set({ lastError }),

    updateMarketData: (marketId, data) => {
      const { marketData } = get();
      const newMarketData = new Map(marketData);
      newMarketData.set(marketId, data);
      set({ marketData: newMarketData });
    },

    addSubscription: (subscription) => {
      const { subscriptions } = get();
      const newSubscriptions = new Set(subscriptions);
      newSubscriptions.add(subscription);
      set({ subscriptions: newSubscriptions });
    },

    removeSubscription: (subscription) => {
      const { subscriptions } = get();
      const newSubscriptions = new Set(subscriptions);
      newSubscriptions.delete(subscription);
      set({ subscriptions: newSubscriptions });
    },

    destroy: () => {
      const { service } = get();
      if (service) {
        service.destroy();
      }
      set({
        connected: false,
        connecting: false,
        reconnecting: false,
        reconnectAttempts: 0,
        connectionId: null,
        lastError: null,
        marketData: new Map(),
        subscriptions: new Set(),
        service: null
      });
    }
  };
});

// Hook for easy access to WebSocket functionality
export const useWebSocket = () => {
  const store = useWebSocketStore();
  
  return {
    // State
    connected: store.connected,
    connecting: store.connecting,
    reconnecting: store.reconnecting,
    reconnectAttempts: store.reconnectAttempts,
    connectionId: store.connectionId,
    lastError: store.lastError,
    subscriptions: Array.from(store.subscriptions),
    
    // Actions
    connect: store.connect,
    disconnect: store.disconnect,
    subscribeToMarket: store.subscribeToMarket,
    unsubscribeFromMarket: store.unsubscribeFromMarket,
    getMarketData: store.getMarketData,
    
    // Market data access
    getMarketDataById: (marketId: string) => store.marketData.get(marketId),
    getAllMarketData: () => Array.from(store.marketData.values()),
    
    // Cleanup
    destroy: store.destroy
  };
};

// Hook for accessing market-specific data with automatic subscription
export const useMarketData = (marketId: string, options: {
  outcomeIndex?: number;
  type?: string;
  autoConnect?: boolean;
} = {}) => {
  const { 
    connected, 
    connecting, 
    subscribeToMarket, 
    unsubscribeFromMarket, 
    getMarketDataById,
    connect 
  } = useWebSocket();
  
  const marketData = getMarketDataById(marketId);
  const { autoConnect = true } = options;

  // Auto-connect and subscribe effect would be handled in a React component
  // This hook provides the data and methods needed
  
  return {
    marketData,
    connected,
    connecting,
    subscribe: () => subscribeToMarket(marketId, options),
    unsubscribe: () => unsubscribeFromMarket(marketId, options),
    connect: autoConnect ? connect : undefined
  };
};