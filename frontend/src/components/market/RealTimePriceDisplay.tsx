import React, { useEffect, useState } from 'react';
import { useMarketSubscription } from '../../hooks/useWebSocketConnection';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

interface RealTimePriceDisplayProps {
  marketId: string;
  outcomeIndex?: number;
  showVolume?: boolean;
  showChange?: boolean;
  className?: string;
}

export const RealTimePriceDisplay: React.FC<RealTimePriceDisplayProps> = ({
  marketId,
  outcomeIndex = 0,
  showVolume = true,
  showChange = true,
  className = ''
}) => {
  const { marketData, isSubscribed, connected } = useMarketSubscription(marketId, {
    outcomeIndex,
    autoSubscribe: true,
    autoConnect: true
  });

  const [previousPrice, setPreviousPrice] = useState<number | null>(null);
  const [priceAnimation, setPriceAnimation] = useState<'up' | 'down' | null>(null);

  const currentPrice = marketData?.prices?.find(p => p.outcomeIndex === outcomeIndex);

  // Animate price changes
  useEffect(() => {
    if (currentPrice && previousPrice !== null && currentPrice.price !== previousPrice) {
      setPriceAnimation(currentPrice.price > previousPrice ? 'up' : 'down');
      
      const timer = setTimeout(() => {
        setPriceAnimation(null);
      }, 1000);

      return () => clearTimeout(timer);
    }
    
    if (currentPrice) {
      setPreviousPrice(currentPrice.price);
    }
  }, [currentPrice?.price, previousPrice]);

  const formatPrice = (price: number) => {
    return (price * 100).toFixed(1) + '¢';
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return (volume / 1000000).toFixed(1) + 'M';
    } else if (volume >= 1000) {
      return (volume / 1000).toFixed(1) + 'K';
    }
    return volume.toString();
  };

  const getPriceChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getPriceChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getAnimationClass = () => {
    if (priceAnimation === 'up') return 'animate-pulse bg-green-100';
    if (priceAnimation === 'down') return 'animate-pulse bg-red-100';
    return '';
  };

  if (!connected) {
    return (
      <div className={`flex items-center space-x-2 text-gray-400 ${className}`}>
        <Activity className="w-4 h-4" />
        <span className="text-sm">Connecting...</span>
      </div>
    );
  }

  if (!isSubscribed || !currentPrice) {
    return (
      <div className={`flex items-center space-x-2 text-gray-400 ${className}`}>
        <Activity className="w-4 h-4 animate-pulse" />
        <span className="text-sm">Loading price...</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-4 ${getAnimationClass()} rounded-lg p-2 transition-all duration-300 ${className}`}>
      {/* Current Price */}
      <div className="flex items-center space-x-2">
        <span className="text-2xl font-bold text-gray-900">
          {formatPrice(currentPrice.price)}
        </span>
        {priceAnimation && (
          <div className={`text-sm ${priceAnimation === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {priceAnimation === 'up' ? '↗' : '↘'}
          </div>
        )}
      </div>

      {/* Price Change */}
      {showChange && (
        <div className="flex items-center space-x-1">
          {getPriceChangeIcon(currentPrice.priceChange24h)}
          <span className={`text-sm font-medium ${getPriceChangeColor(currentPrice.priceChange24h)}`}>
            {currentPrice.priceChange24h > 0 ? '+' : ''}
            {(currentPrice.priceChange24h * 100).toFixed(1)}%
          </span>
        </div>
      )}

      {/* Volume */}
      {showVolume && (
        <div className="flex items-center space-x-1 text-gray-600">
          <span className="text-xs">Vol:</span>
          <span className="text-sm font-medium">
            {formatVolume(currentPrice.volume24h)}
          </span>
        </div>
      )}

      {/* Connection Status Indicator */}
      <div className="flex items-center space-x-1">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
        <span className="text-xs text-gray-500">
          {connected ? 'Live' : 'Offline'}
        </span>
      </div>
    </div>
  );
};

export default RealTimePriceDisplay;