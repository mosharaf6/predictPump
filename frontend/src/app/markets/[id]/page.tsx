'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { TradingInterface } from '@/components/trading/TradingInterface';
import { PriceChart } from '@/components/trading/PriceChart';
import { UserPositions } from '@/components/trading/UserPositions';
import { PriceAlertManager } from '@/components/notifications/PriceAlertManager';
import { CommentSystem } from '@/components/social/CommentSystem';
import { SocialShare } from '@/components/social/SocialShare';
import { TradeSuccessModal } from '@/components/trading/TradeSuccessModal';
import { Market, MarketStatus } from '@/types/market';
import { MockMarketService } from '@/services/mockMarketService';
import { 
  ArrowLeft, 
  Clock, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Star, 
  Flame,
  Calendar,
  Tag,
  AlertCircle,
  Loader
} from 'lucide-react';

export default function MarketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const marketId = params.id as string;
  
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTradeSuccess, setShowTradeSuccess] = useState(false);
  const [lastTrade, setLastTrade] = useState<{
    action: 'buy' | 'sell';
    outcome: string;
    amount: number;
    tokens: number;
    marketTitle: string;
    price: number;
  } | null>(null);

  useEffect(() => {
    const loadMarket = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // In a real app, this would be an API call to get market by ID
        // For now, we'll get all markets and find the one with matching ID
        const result = await MockMarketService.getMarkets();
        const foundMarket = result.markets.find(m => m.id === marketId);
        
        if (!foundMarket) {
          setError('Market not found');
          return;
        }
        
        setMarket(foundMarket);
      } catch (err) {
        setError('Failed to load market details');
        console.error('Error loading market:', err);
      } finally {
        setLoading(false);
      }
    };

    if (marketId) {
      loadMarket();
    }
  }, [marketId]);

  const handleTrade = async (outcome: number, action: 'buy' | 'sell', amount: number) => {
    if (!market) return;
    
    // TODO: Implement actual trading logic with smart contract
    console.log('Trade:', { outcome, action, amount });
    
    // Mock trade success - calculate tokens received
    const outcomeData = market.outcomes[outcome];
    const tokens = amount / outcomeData.currentPrice;
    
    // Set trade details for success modal
    setLastTrade({
      action,
      outcome: outcomeData.name,
      amount,
      tokens,
      marketTitle: market.title,
      price: outcomeData.currentPrice
    });
    
    // Show success modal
    setShowTradeSuccess(true);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Loading Market Details
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Please wait while we fetch the market information...
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {error || 'Market Not Found'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                The market you're looking for doesn't exist or couldn't be loaded.
              </p>
              <button
                onClick={() => router.push('/markets')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Back to Markets
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.push('/markets')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Markets
        </button>

        {/* Market Header */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${getCategoryColor(market.category)}`}>
                <Tag className="w-4 h-4 inline mr-1" />
                {market.category.charAt(0).toUpperCase() + market.category.slice(1)}
              </span>
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(market.status)}`}>
                {market.status.charAt(0).toUpperCase() + market.status.slice(1)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {market.featured && (
                <Star className="w-5 h-5 text-yellow-500 fill-current" />
              )}
              {market.trending && (
                <Flame className="w-5 h-5 text-red-500" />
              )}
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            {market.title}
          </h1>
          
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
            {market.description}
          </p>

          {/* Market Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-600 bg-green-100 dark:bg-green-900/20 rounded-lg p-2" />
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Volume</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  ${(market.totalVolume / 1000).toFixed(1)}K
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600 bg-blue-100 dark:bg-blue-900/20 rounded-lg p-2" />
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Traders</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {market.traderCount}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-purple-600 bg-purple-100 dark:bg-purple-900/20 rounded-lg p-2" />
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Volatility</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {(market.volatility * 100).toFixed(1)}%
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-red-600 bg-red-100 dark:bg-red-900/20 rounded-lg p-2" />
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Resolution</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">
                  {formatDate(market.resolutionDate)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Chart and Positions */}
          <div className="lg:col-span-2 space-y-8">
            <PriceChart market={market} />
            <UserPositions market={market} />
          </div>

          {/* Right Column - Trading Interface and Price Alerts */}
          <div className="lg:col-span-1 space-y-6">
            <TradingInterface market={market} onTrade={handleTrade} />
            <PriceAlertManager
              marketId={market.id}
              marketTitle={market.title}
              outcomeOptions={market.outcomes.map(o => o.name)}
              currentPrices={market.outcomes.map(o => o.currentPrice)}
            />
          </div>
        </div>

        {/* Market Details */}
        <div className="mt-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Market Information
            </h3>
            <SocialShare
              content={{
                type: 'market',
                title: market.title,
                description: market.description,
                url: window.location.href,
                metadata: {
                  marketTitle: market.title
                }
              }}
              size="sm"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Creator</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                {market.creator.slice(0, 8)}...{market.creator.slice(-8)}
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Created</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {formatDate(market.createdAt)}
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Program Account</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                {market.programAccount.slice(0, 8)}...{market.programAccount.slice(-8)}
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Resolution Date</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {formatDate(market.resolutionDate)}
              </p>
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="mt-8">
          <CommentSystem
            marketId={market.id}
            marketTitle={market.title}
          />
        </div>

        {/* Trade Success Modal */}
        {showTradeSuccess && lastTrade && (
          <TradeSuccessModal
            isOpen={showTradeSuccess}
            onClose={() => setShowTradeSuccess(false)}
            tradeDetails={lastTrade}
          />
        )}
      </main>
    </div>
  );
}