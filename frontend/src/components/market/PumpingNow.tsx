'use client';

import React, { useState, useEffect } from 'react';
import { Market } from '@/types/market';
import { MockMarketService } from '@/services/mockMarketService';
import { MarketCard } from './MarketCard';
import { Flame, Loader, AlertCircle } from 'lucide-react';

interface PumpingNowProps {
  onMarketClick?: (market: Market) => void;
  limit?: number;
}

export function PumpingNow({ onMarketClick, limit = 6 }: PumpingNowProps) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTrendingMarkets = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const trendingMarkets = await MockMarketService.getTrendingMarkets(limit);
      setMarkets(trendingMarkets);
    } catch (err) {
      setError('Failed to load trending markets');
      console.error('Error loading trending markets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrendingMarkets();
    
    // Refresh trending markets every 30 seconds
    const interval = setInterval(loadTrendingMarkets, 30000);
    return () => clearInterval(interval);
  }, [limit]);

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/10 dark:to-orange-900/10 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-6 h-6 text-red-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Pumping Now 🔥
          </h2>
        </div>
        
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <Loader className="w-6 h-6 text-red-500 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading trending markets...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/10 dark:to-orange-900/10 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-6 h-6 text-red-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Pumping Now 🔥
          </h2>
        </div>
        
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
            <button
              onClick={loadTrendingMarkets}
              className="mt-2 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/10 dark:to-orange-900/10 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-6 h-6 text-red-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Pumping Now 🔥
          </h2>
        </div>
        
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-400">
            No trending markets right now. Check back soon!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/10 dark:to-orange-900/10 border border-red-200 dark:border-red-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Flame className="w-6 h-6 text-red-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Pumping Now 🔥
          </h2>
        </div>
        
        <div className="text-sm text-gray-600 dark:text-gray-400">
          High volatility markets
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {markets.map(market => (
          <div key={market.id} className="relative">
            <MarketCard market={market} onClick={onMarketClick} />
            
            {/* Volatility indicator */}
            <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium">
              {(market.volatility * 100).toFixed(0)}% vol
            </div>
          </div>
        ))}
      </div>

      {/* Auto-refresh indicator */}
      <div className="flex items-center justify-center mt-4 pt-4 border-t border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          Updates every 30 seconds
        </div>
      </div>
    </div>
  );
}