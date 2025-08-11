import { useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from '../stores/websocketStore';

interface UseWebSocketConnectionOptions {
  autoConnect?: boolean;
  reconnectOnMount?: boolean;
}

export const useWebSocketConnection = (options: UseWebSocketConnectionOptions = {}) => {
  const { autoConnect = true, reconnectOnMount = true } = options;
  const { 
    connected, 
    connecting, 
    reconnecting, 
    reconnectAttempts, 
    lastError,
    connect, 
    disconnect 
  } = useWebSocket();
  
  const hasAttemptedConnection = useRef(false);

  useEffect(() => {
    if (autoConnect && !connected && !connecting && !hasAttemptedConnection.current) {
      hasAttemptedConnection.current = true;
      connect().catch(error => {
        console.error('Failed to establish WebSocket connection:', error);
      });
    }
  }, [autoConnect, connected, connecting, connect]);

  useEffect(() => {
    if (reconnectOnMount && !connected && hasAttemptedConnection.current) {
      const timer = setTimeout(() => {
        if (!connected && !connecting) {
          connect().catch(error => {
            console.error('Failed to reconnect WebSocket:', error);
          });
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [reconnectOnMount, connected, connecting, connect]);

  const forceReconnect = useCallback(async () => {
    disconnect();
    await new Promise(resolve => setTimeout(resolve, 100));
    return connect();
  }, [disconnect, connect]);

  return {
    connected,
    connecting,
    reconnecting,
    reconnectAttempts,
    lastError,
    connect,
    disconnect,
    forceReconnect
  };
};

interface UseMarketSubscriptionOptions {
  outcomeIndex?: number;
  type?: string;
  autoSubscribe?: boolean;
  autoConnect?: boolean;
}

export const useMarketSubscription = (
  marketId: string, 
  options: UseMarketSubscriptionOptions = {}
) => {
  const { 
    outcomeIndex, 
    type, 
    autoSubscribe = true, 
    autoConnect = true 
  } = options;
  
  const { 
    connected, 
    connecting, 
    subscribeToMarket, 
    unsubscribeFromMarket, 
    getMarketDataById,
    subscriptions
  } = useWebSocket();
  
  const { connect } = useWebSocketConnection({ autoConnect });
  
  const subscriptionKey = `${marketId}:${outcomeIndex || 'all'}:${type || 'all'}`;
  const isSubscribed = subscriptions.includes(subscriptionKey);
  const marketData = getMarketDataById(marketId);
  
  const hasAttemptedSubscription = useRef(false);

  // Auto-subscribe when connected
  useEffect(() => {
    if (
      autoSubscribe && 
      connected && 
      !isSubscribed && 
      !hasAttemptedSubscription.current
    ) {
      hasAttemptedSubscription.current = true;
      subscribeToMarket(marketId, { outcomeIndex, type }).catch(error => {
        console.error(`Failed to subscribe to market ${marketId}:`, error);
        hasAttemptedSubscription.current = false;
      });
    }
  }, [autoSubscribe, connected, isSubscribed, marketId, outcomeIndex, type, subscribeToMarket]);

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      if (isSubscribed) {
        unsubscribeFromMarket(marketId, { outcomeIndex, type }).catch(error => {
          console.error(`Failed to unsubscribe from market ${marketId}:`, error);
        });
      }
    };
  }, []);

  const subscribe = useCallback(async () => {
    if (!connected) {
      await connect();
    }
    return subscribeToMarket(marketId, { outcomeIndex, type });
  }, [connected, connect, subscribeToMarket, marketId, outcomeIndex, type]);

  const unsubscribe = useCallback(() => {
    return unsubscribeFromMarket(marketId, { outcomeIndex, type });
  }, [unsubscribeFromMarket, marketId, outcomeIndex, type]);

  return {
    marketData,
    isSubscribed,
    connected,
    connecting,
    subscribe,
    unsubscribe,
    subscriptionKey
  };
};

// Hook for managing multiple market subscriptions
export const useMultipleMarketSubscriptions = (
  marketIds: string[], 
  options: UseMarketSubscriptionOptions = {}
) => {
  const { connected, subscribeToMarket, unsubscribeFromMarket, getAllMarketData } = useWebSocket();
  const { connect } = useWebSocketConnection({ autoConnect: options.autoConnect });
  
  const { outcomeIndex, type, autoSubscribe = true } = options;
  const hasAttemptedSubscriptions = useRef(new Set<string>());

  // Auto-subscribe to all markets when connected
  useEffect(() => {
    if (autoSubscribe && connected) {
      marketIds.forEach(marketId => {
        if (!hasAttemptedSubscriptions.current.has(marketId)) {
          hasAttemptedSubscriptions.current.add(marketId);
          subscribeToMarket(marketId, { outcomeIndex, type }).catch(error => {
            console.error(`Failed to subscribe to market ${marketId}:`, error);
            hasAttemptedSubscriptions.current.delete(marketId);
          });
        }
      });
    }
  }, [autoSubscribe, connected, marketIds, outcomeIndex, type, subscribeToMarket]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      marketIds.forEach(marketId => {
        unsubscribeFromMarket(marketId, { outcomeIndex, type }).catch(error => {
          console.error(`Failed to unsubscribe from market ${marketId}:`, error);
        });
      });
    };
  }, []);

  const subscribeToAll = useCallback(async () => {
    if (!connected) {
      await connect();
    }
    
    const subscriptionPromises = marketIds.map(marketId => 
      subscribeToMarket(marketId, { outcomeIndex, type })
    );
    
    return Promise.all(subscriptionPromises);
  }, [connected, connect, marketIds, outcomeIndex, type, subscribeToMarket]);

  const unsubscribeFromAll = useCallback(() => {
    const unsubscriptionPromises = marketIds.map(marketId => 
      unsubscribeFromMarket(marketId, { outcomeIndex, type })
    );
    
    return Promise.all(unsubscriptionPromises);
  }, [marketIds, outcomeIndex, type, unsubscribeFromMarket]);

  // Get market data for all subscribed markets
  const allMarketData = getAllMarketData();
  const relevantMarketData = allMarketData.filter(data => 
    marketIds.includes(data.marketId)
  );

  return {
    marketData: relevantMarketData,
    connected,
    subscribeToAll,
    unsubscribeFromAll,
    marketIds
  };
};