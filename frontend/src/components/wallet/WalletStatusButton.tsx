'use client';

import React, { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { ChevronDown, Wallet, LogOut, Copy, Check, Wifi, WifiOff } from 'lucide-react';

export function WalletStatusButton() {
  const { 
    connected, 
    connecting, 
    disconnect, 
    publicKey, 
    publicKeyShort, 
    walletName 
  } = useWallet();
  
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setShowDropdown(false);
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleCopyAddress = async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!connected) {
    return null; // Don't show anything when not connected
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-full text-sm font-medium hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors"
      >
        <Wifi className="w-4 h-4" />
        <span className="hidden sm:inline">Connected to {walletName}</span>
        <span className="sm:hidden">Connected</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {walletName}
              </span>
            </div>
            <div className="font-mono text-xs text-gray-600 dark:text-gray-400 break-all">
              {publicKey?.toString()}
            </div>
          </div>
          
          <div className="p-2">
            <button
              onClick={handleCopyAddress}
              className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-sm"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Address'}
            </button>
            
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-sm text-red-600"
            >
              <LogOut className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        </div>
      )}
      
      {/* Backdrop to close dropdown */}
      {showDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}