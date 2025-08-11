'use client';

import React from 'react';
import { CheckCircle, X, TrendingUp, TrendingDown } from 'lucide-react';
import { SocialShare } from '@/components/social/SocialShare';

interface TradeSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  tradeDetails: {
    action: 'buy' | 'sell';
    outcome: string;
    amount: number;
    tokens: number;
    marketTitle: string;
    price: number;
  };
}

export function TradeSuccessModal({ isOpen, onClose, tradeDetails }: TradeSuccessModalProps) {
  if (!isOpen) return null;

  const { action, outcome, amount, tokens, marketTitle, price } = tradeDetails;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Success Icon */}
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
          Trade Successful!
        </h3>

        {/* Trade Details */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            {action === 'buy' ? (
              <TrendingUp className="w-5 h-5 text-green-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-600" />
            )}
            <span className="font-semibold text-gray-900 dark:text-white">
              {action === 'buy' ? 'Bought' : 'Sold'} {outcome} tokens
            </span>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Amount:</span>
              <span className="font-medium text-gray-900 dark:text-white">{amount} SOL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Tokens:</span>
              <span className="font-medium text-gray-900 dark:text-white">{tokens.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Price:</span>
              <span className="font-medium text-gray-900 dark:text-white">{price.toFixed(3)} SOL</span>
            </div>
          </div>
        </div>

        {/* Market Info */}
        <div className="text-center mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Market:</p>
          <p className="font-medium text-gray-900 dark:text-white">{marketTitle}</p>
        </div>

        {/* Social Share */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-3">
            Share your trade with the community!
          </p>
          <div className="flex justify-center">
            <SocialShare
              content={{
                type: 'trade',
                title: `Just ${action === 'buy' ? 'bought' : 'sold'} ${outcome} tokens!`,
                description: `Traded ${amount} SOL on "${marketTitle}"`,
                metadata: {
                  marketTitle,
                  outcome,
                  amount
                }
              }}
              showLabel={true}
            />
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full mt-4 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Continue Trading
        </button>
      </div>
    </div>
  );
}