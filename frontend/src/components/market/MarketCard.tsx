'use client';

import React from 'react';
import { Market, MarketStatus } from '@/types/market';
import { TrendingUp, TrendingDown, Users, DollarSign, Clock, Star, Flame } from 'lucide-react';

interface MarketCardProps {
  market: Market;
  onClick?: (market: Market) => void;
}

export function MarketCard({ market, onClick }: MarketCardProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(market);
    } else {
      // Default navigation to market detail page
      window.location.href = `/markets/${market.id}`;
    }
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(1)}M`;
    } else if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(1)}K`;
    }
    return `$${volume}`;
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return 'Expired';
    } else if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else if (diffDays < 7) {
      return `${diffDays} days`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getStatusColor = (status: MarketStatus) => {
    switch (status) {
      case MarketStatus.ACTIVE:
        return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      case MarketStatus.SETTLING:
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      case MarketStatus.SETTLED:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
      case MarketStatus.DISPUTED:
        return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      crypto: 'text-orange-600 bg-orange-100 dark:bg-orange-900/20',
      sports: 'text-blue-600 bg-blue-100 dark:bg-blue-900/20',
      politics: 'text-purple-600 bg-purple-100 dark:bg-purple-900/20',
      technology: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/20',
      entertainment: 'text-pink-600 bg-pink-100 dark:bg-pink-900/20',
      economics: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/20',
      weather: 'text-cyan-600 bg-cyan-100 dark:bg-cyan-900/20',
      other: 'text-gray-600 bg-gray-100 dark:bg-gray-900/20',
    };
    return colors[category as keyof typeof colors] || colors.other;
  };

  return (
    <div
      onClick={handleClick}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-6 hover:shadow-lg transition-all duration-200 cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 tap-highlight-none touch-manipulation"
    >
      {/* Header with badges */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(market.category)}`}>
            {market.category.charAt(0).toUpperCase() + market.category.slice(1)}
          </span>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(market.status)}`}>
            {market.status.charAt(0).toUpperCase() + market.status.slice(1)}
          </span>
        </div>
        
        <div className="flex items-center gap-1 flex-shrink-0">
          {market.featured && (
            <Star className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 fill-current" />
          )}
          {market.trending && (
            <Flame className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
          )}
        </div>
      </div>

      {/* Title and description */}
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
        {market.title}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
        {market.description}
      </p>

      {/* Outcomes with prices - Mobile optimized */}
      <div className="space-y-2 mb-4">
        {market.outcomes.slice(0, 2).map((outcome, index) => {
          const priceChange = market.priceChange24h[index];
          const isPositive = priceChange >= 0;
          
          return (
            <div key={outcome.index} className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate pr-2">
                {outcome.name}
              </span>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  ${outcome.currentPrice.toFixed(2)}
                </span>
                <div className={`flex items-center gap-1 text-xs ${
                  isPositive ? 'text-green-600' : 'text-red-600'
                }`}>
                  {isPositive ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span className="hidden xs:inline">{Math.abs(priceChange * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          );
        })}
        
        {market.outcomes.length > 2 && (
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            +{market.outcomes.length - 2} more outcomes
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4" />
            <span>{formatVolume(market.totalVolume)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{market.traderCount}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          <span>{formatDate(market.resolutionDate)}</span>
        </div>
      </div>
    </div>
  );
}