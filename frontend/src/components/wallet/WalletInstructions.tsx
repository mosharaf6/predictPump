'use client';

import React, { useState } from 'react';
import { X, ExternalLink, Download, Info } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';

export function WalletInstructions() {
  const [isVisible, setIsVisible] = useState(true);
  const { connected } = useWallet();

  // Don't show if wallet is connected or user dismissed
  if (!isVisible || connected) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Need a Solana Wallet?
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
              This app works with Solana wallets (not Ethereum wallets like MetaMask). 
              Here are some popular options:
            </p>
            
            <div className="space-y-2">
              <a
                href="https://phantom.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
              >
                <Download className="w-4 h-4" />
                Phantom Wallet (Recommended)
                <ExternalLink className="w-3 h-3" />
              </a>
              
              <a
                href="https://solflare.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
              >
                <Download className="w-4 h-4" />
                Solflare Wallet
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-3">
              After installing, refresh this page and click "Connect Wallet"
            </p>
          </div>
        </div>
        
        <button
          onClick={() => setIsVisible(false)}
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}