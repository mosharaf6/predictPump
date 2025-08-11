'use client';

import React, { useState } from 'react';
import { Market, MarketOutcome } from '@/types/market';
import { useWallet } from '@/hooks/useWallet';
import { TrendingUp, TrendingDown, DollarSign, Wallet, AlertCircle } from 'lucide-react';

interface TradingInterfaceProps {
  market: Market;
  onTrade?: (outcome: number, action: 'buy' | 'sell', amount: number) => void;
}

export function TradingInterface({ market, onTrade }: TradingInterfaceProps) {
  const { connected, publicKey } = useWallet();
  const [selectedOutcome, setSelectedOutcome] = useState<number>(0);
  const [tradeAction, setTradeAction] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const selectedOutcomeData = market.outcomes[selectedOutcome];
  const estimatedTokens = amount ? parseFloat(amount) / selectedOutcomeData.currentPrice : 0;
  const estimatedCost = amount ? parseFloat(amount) : 0;
  const slippage = 0.02; // 2% slippage estimate
  const fees = estimatedCost * 0.01; // 1% fee

  const handleTrade = async () => {
    if (!connected || !amount || !onTrade) return;

    try {
      setLoading(true);
      await onTrade(selectedOutcome, tradeAction, parseFloat(amount));
      setAmount('');
    } catch (error) {
      console.error('Trade failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => `$${price.toFixed(3)}`;
  const formatTokens = (tokens: number) => tokens.toFixed(2);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
        Trading Interface
      </h3>

      {!connected && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-yellow-600" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Connect your wallet to start trading
            </p>
          </div>
        </div>
      )}

      {/* Outcome Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Select Outcome
        </label>
        <div className="grid grid-cols-1 gap-2">
          {market.outcomes.map((outcome, index) => {
            const priceChange = market.priceChange24h[index];
            const isPositive = priceChange >= 0;
            const isSelected = selectedOutcome === index;

            return (
              <button
                key={outcome.index}
                onClick={() => setSelectedOutcome(index)}
                className={`p-4 border rounded-lg text-left transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {outcome.name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {outcome.holders} holders • {formatTokens(outcome.totalSupply)} supply
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatPrice(outcome.currentPrice)}
                    </div>
                    <div className={`flex items-center gap-1 text-sm ${
                      isPositive ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {isPositive ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      {Math.abs(priceChange * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Buy/Sell Toggle */}
      <div className="mb-6">
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setTradeAction('buy')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              tradeAction === 'buy'
                ? 'bg-green-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setTradeAction('sell')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              tradeAction === 'sell'
                ? 'bg-red-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Sell
          </button>
        </div>
      </div>

      {/* Amount Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Amount (SOL)
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={!connected}
          />
          <div className="absolute right-3 top-3 text-gray-500 dark:text-gray-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
        
        {/* Quick amount buttons */}
        <div className="flex gap-2 mt-2">
          {[0.1, 0.5, 1, 5].map(quickAmount => (
            <button
              key={quickAmount}
              onClick={() => setAmount(quickAmount.toString())}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              disabled={!connected}
            >
              {quickAmount} SOL
            </button>
          ))}
        </div>
      </div>

      {/* Trade Preview */}
      {amount && parseFloat(amount) > 0 && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
            Trade Preview
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                {tradeAction === 'buy' ? 'You pay' : 'You receive'}:
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {estimatedCost.toFixed(3)} SOL
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                {tradeAction === 'buy' ? 'You receive' : 'You sell'}:
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatTokens(estimatedTokens)} {selectedOutcomeData.name} tokens
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Price per token:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatPrice(selectedOutcomeData.currentPrice)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Est. slippage:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {(slippage * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Platform fee:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {fees.toFixed(3)} SOL
              </span>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900 dark:text-white">Total:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {(estimatedCost + fees).toFixed(3)} SOL
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slippage Warning */}
      {amount && parseFloat(amount) > 10 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <p className="text-sm text-orange-800 dark:text-orange-200">
              Large trades may experience higher slippage. Consider breaking into smaller trades.
            </p>
          </div>
        </div>
      )}

      {/* Trade Button */}
      <button
        onClick={handleTrade}
        disabled={!connected || !amount || parseFloat(amount) <= 0 || loading}
        className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
          tradeAction === 'buy'
            ? 'bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-400'
            : 'bg-red-600 hover:bg-red-700 text-white disabled:bg-gray-400'
        } disabled:cursor-not-allowed`}
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Processing...
          </div>
        ) : (
          `${tradeAction === 'buy' ? 'Buy' : 'Sell'} ${selectedOutcomeData.name} Tokens`
        )}
      </button>

      {/* Market Info */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400">Total Volume:</span>
            <div className="font-semibold text-gray-900 dark:text-white">
              ${(market.totalVolume / 1000).toFixed(1)}K
            </div>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Traders:</span>
            <div className="font-semibold text-gray-900 dark:text-white">
              {market.traderCount}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}