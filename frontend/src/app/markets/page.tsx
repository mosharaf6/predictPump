'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { MarketList } from '@/components/market/MarketList';
import { PumpingNow } from '@/components/market/PumpingNow';
import { WalletInstructions } from '@/components/wallet/WalletInstructions';
import { Market } from '@/types/market';

export default function MarketsPage() {
  const router = useRouter();
  
  const handleMarketClick = (market: Market) => {
    router.push(`/markets/${market.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Prediction Markets
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Discover and trade on the future with dynamic bonding curve pricing
          </p>
        </div>

        {/* Wallet Instructions */}
        <WalletInstructions />

        {/* Pumping Now Section */}
        <div className="mb-8">
          <PumpingNow onMarketClick={handleMarketClick} />
        </div>

        {/* All Markets */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            All Markets
          </h2>
          <MarketList onMarketClick={handleMarketClick} />
        </div>
      </main>
    </div>
  );
}