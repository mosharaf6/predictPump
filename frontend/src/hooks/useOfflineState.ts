import { useState, useEffect } from 'react';

export interface OfflineState {
  isOnline: boolean;
  isOffline: boolean;
  wasOffline: boolean;
}

export interface CachedData<T = any> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export const useOfflineState = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    // Initialize online state
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        console.log('Connection restored');
        // You can trigger data sync here
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      console.log('Connection lost - entering offline mode');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  return {
    isOnline,
    isOffline: !isOnline,
    wasOffline,
  };
};

// Cache management utilities
export class OfflineCache {
  private static readonly CACHE_PREFIX = 'predictionpump_cache_';
  public static readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

  static set<T>(key: string, data: T, ttl: number = OfflineCache.DEFAULT_TTL): void {
    try {
      const cachedData: CachedData<T> = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttl,
      };
      
      localStorage.setItem(
        `${OfflineCache.CACHE_PREFIX}${key}`,
        JSON.stringify(cachedData)
      );
    } catch (error) {
      console.error('Failed to cache data:', error);
    }
  }

  static get<T>(key: string): T | null {
    try {
      const cached = localStorage.getItem(`${OfflineCache.CACHE_PREFIX}${key}`);
      if (!cached) return null;

      const cachedData: CachedData<T> = JSON.parse(cached);
      
      // Check if data has expired
      if (Date.now() > cachedData.expiresAt) {
        OfflineCache.remove(key);
        return null;
      }

      return cachedData.data;
    } catch (error) {
      console.error('Failed to retrieve cached data:', error);
      return null;
    }
  }

  static remove(key: string): void {
    try {
      localStorage.removeItem(`${OfflineCache.CACHE_PREFIX}${key}`);
    } catch (error) {
      console.error('Failed to remove cached data:', error);
    }
  }

  static clear(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(OfflineCache.CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  static getSize(): number {
    try {
      const keys = Object.keys(localStorage);
      return keys.filter(key => key.startsWith(OfflineCache.CACHE_PREFIX)).length;
    } catch (error) {
      console.error('Failed to get cache size:', error);
      return 0;
    }
  }
}

// Hook for cached API calls
export const useCachedData = <T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number;
    fallbackData?: T;
    refetchOnReconnect?: boolean;
  } = {}
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { isOnline, wasOffline } = useOfflineState();

  const {
    ttl = OfflineCache.DEFAULT_TTL,
    fallbackData = null,
    refetchOnReconnect = true,
  } = options;

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      // Try to get cached data first
      const cachedData = OfflineCache.get<T>(key);
      if (cachedData) {
        setData(cachedData);
        setLoading(false);
        
        // If online, still try to fetch fresh data in background
        if (isOnline) {
          try {
            const freshData = await fetcher();
            setData(freshData);
            OfflineCache.set(key, freshData, ttl);
          } catch (err) {
            // Keep cached data if fresh fetch fails
            console.warn('Failed to fetch fresh data, using cached version:', err);
          }
        }
        return;
      }

      // No cached data, try to fetch if online
      if (isOnline) {
        try {
          const freshData = await fetcher();
          setData(freshData);
          OfflineCache.set(key, freshData, ttl);
        } catch (err) {
          setError(err as Error);
          if (fallbackData) {
            setData(fallbackData);
          }
        }
      } else {
        // Offline and no cached data
        if (fallbackData) {
          setData(fallbackData);
        } else {
          setError(new Error('No cached data available and device is offline'));
        }
      }

      setLoading(false);
    };

    loadData();
  }, [key, isOnline, wasOffline && refetchOnReconnect]);

  const refetch = async () => {
    if (!isOnline) {
      console.warn('Cannot refetch while offline');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const freshData = await fetcher();
      setData(freshData);
      OfflineCache.set(key, freshData, ttl);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    loading,
    error,
    refetch,
    isFromCache: !isOnline && data !== null,
  };
};