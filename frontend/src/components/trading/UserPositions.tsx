'use client';

import React, { useState, useEffect } from 'react';
import { Market } from '@/types/market';
import { useWallet } from '@/hooks/useWallet';
import { TrendingUp, TrendingDown, Wallet, PieChart } from 'lucide-react';

interface UserPosition {
  outcomeIndex: number;
  outcomeName: string;
  tokenAmount: number;
  averagePrice: number;
  currentPrice: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

interface UserPositionsProps {
  market: Market;
}

export function UserPositions({ market }: UserPositionsProps) {
  const { connected, publicKey } = useWallet();
  const [positions, setPositions] = useState<UserPosition[]>([]);
  const [loading, setLoading] = useState(false);

  // Mock user positions - in real app, this would fetch from blockchain/API
  useEffect(() => {
    if (!connected || !publicKey) {
      setPositions([]);
      return;
    }

    const generateMockPositions = () => {
      setLoading(true);
      
      // Simulate API delay
      setTimeout(() => {
        const mockPositions: UserPosition[] = [];
        
        // Generate some positions for demonstration
        if (Math.random() > 0.3) { // 70% chance of having positions
          market.outcomes.forEach((outcome, index) => {
            if (Math.random() > 0.5) { // 50% chance of having position in each outcome
              const tokenAmount = Math.random() * 100 + 10; // 10-110 tokens
              const averagePrice = outcome.currentPrice * (0.8 + Math.random() * 0.4); // ±20% from current
              const currentValue = tokenAmount * outcome.currentPrice;
              const costBasis = tokenAmount * averagePrice;
              const unrealizedPnL = currentValue - costBasis;
              const unrealizedPnLPercent = (unrealizedPnL / costBasis) * 100;

              mockPositions.push({
                outcomeIndex: index,
                outcomeName: outcome.name,
                tokenAmount,
                averagePrice,
                currentPrice: outcome.currentPrice,
                currentValue,
                unrealizedPnL,
                unrealizedPnLPercent,
              });
            }
          });
        }
        
        setPositions(mockPositions);
        setLoading(false);
      }, 500);
    };

    generateMockPositions();
  }, [connected, publicKey, market]);

  const totalValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
  const totalPnL = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
  const totalPnLPercent = positions.length > 0 
    ? (totalPnL / positions.reduce((sum, pos) => sum + (pos.tokenAmount * pos.averagePrice), 0)) * 100 
    : 0;

  if (!connected) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Your Positions
          </h3>
        </div>
        
        <div className="text-center py-8">
          <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Connect your wallet to view your positions
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Your Positions
          </h3>
        </div>
        
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Loading your positions...
          </p>
        </div>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Your Positions
          </h3>
        </div>
        
        <div className="text-center py-8">
          <div className="text-gray-400 dark:text-gray-600 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            No positions in this market
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Start trading to build your position
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <PieChart className="w-6 h-6 text-blue-600" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          Your Positions
        </h3>
      </div>

      {/* Portfolio Summary */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Total Value
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {totalValue.toFixed(3)} SOL
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Unrealized P&L
            </div>
            <div className={`text-xl font-bold flex items-center gap-1 ${
              totalPnL >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {totalPnL >= 0 ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )}
              {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(3)} SOL
              <span className="text-sm">
                ({totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Individual Positions */}
      <div className="space-y-4">
        {positions.map((position) => (
          <div
            key={position.outcomeIndex}
            className="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900 dark:text-white">
                {position.outcomeName}
              </h4>
              <div className={`flex items-center gap-1 text-sm font-medium ${
                position.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {position.unrealizedPnL >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {position.unrealizedPnLPercent >= 0 ? '+' : ''}{position.unrealizedPnLPercent.toFixed(1)}%
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-600 dark:text-gray-400 mb-1">Tokens</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {position.tokenAmount.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-gray-600 dark:text-gray-400 mb-1">Avg Price</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  ${position.averagePrice.toFixed(3)}
                </div>
              </div>
              <div>
                <div className="text-gray-600 dark:text-gray-400 mb-1">Current Price</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  ${position.currentPrice.toFixed(3)}
                </div>
              </div>
              <div>
                <div className="text-gray-600 dark:text-gray-400 mb-1">Value</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {position.currentValue.toFixed(3)} SOL
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Unrealized P&L:
                </span>
                <span className={`font-medium ${
                  position.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {position.unrealizedPnL >= 0 ? '+' : ''}{position.unrealizedPnL.toFixed(3)} SOL
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Position Actions */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Positions update in real-time based on current market prices
        </div>
      </div>
    </div>
  );
}