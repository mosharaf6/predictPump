'use client';

import React from 'react';
import { WalletButton } from '@/components/wallet/WalletButton';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { TrendingUp } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and brand */}
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <TrendingUp className="h-8 w-8 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              PredictionPump
            </h1>
          </a>

          {/* Navigation - placeholder for future menu items */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="/markets" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
              Markets
            </a>
            <a href="#" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
              Create
            </a>
            <a href="#" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
              Portfolio
            </a>
            <a href="/leaderboard" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
              Leaderboard
            </a>
          </nav>

          {/* Notifications and Wallet */}
          <div className="flex items-center space-x-4">
            <NotificationCenter />
            <WalletButton />
          </div>
        </div>
      </div>
    </header>
  );
}