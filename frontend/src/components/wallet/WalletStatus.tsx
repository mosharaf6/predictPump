'use client';

import React from 'react';
import { useWallet } from '@/hooks/useWallet';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';

export function WalletStatus() {
  const { connected, connecting, disconnecting, walletName, publicKeyShort } = useWallet();

  if (connecting) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <Loader size={16} className="animate-spin text-yellow-600" />
        <span className="text-sm text-yellow-800 dark:text-yellow-200">
          Connecting to {walletName}...
        </span>
      </div>
    );
  }

  if (disconnecting) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
        <Loader size={16} className="animate-spin text-orange-600" />
        <span className="text-sm text-orange-800 dark:text-orange-200">
          Disconnecting...
        </span>
      </div>
    );
  }

  if (connected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <CheckCircle size={16} className="text-green-600" />
        <span className="text-sm text-green-800 dark:text-green-200">
          Connected to {walletName} ({publicKeyShort})
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      <AlertCircle size={16} className="text-gray-500" />
      <span className="text-sm text-gray-600 dark:text-gray-400">
        Wallet not connected
      </span>
    </div>
  );
}