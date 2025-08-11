'use client';

import React, { useState } from 'react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@/hooks/useWallet';
import { ChevronDown, Wallet, LogOut, Copy, Check } from 'lucide-react';

export function WalletButton() {
  const { setVisible } = useWalletModal();
  const { 
    connected, 
    connecting, 
    disconnect, 
    publicKey, 
    publicKeyShort, 
    walletName,
    wallets 
  } = useWallet();
  
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleConnect = () => {
    // Check if any wallets are available
    const availableWallets = wallets.filter(wallet => wallet.readyState === 'Installed');
    
    if (availableWallets.length === 0) {
      alert('No Solana wallets detected. Please install Phantom (https://phantom.app) or Solflare (https://solflare.com) wallet and refresh the page.');
      return;
    }
    
    try {
      setVisible(true);
    } catch (error) {
      console.error('Failed to open wallet modal:', error);
    }
  };

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

  if (connecting) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg opacity-50 cursor-not-allowed"
      >
        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        Connecting...
      </button>
    );
  }

  if (!connected) {
    return (
      <button
        onClick={handleConnect}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
      >
        <Wallet size={16} />
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Wallet Name Badge */}
      <div className="px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 text-sm font-medium rounded-full border border-green-200 dark:border-green-800">
        {walletName}
      </div>
      
      {/* Address Dropdown Button */}
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors border border-gray-200 dark:border-gray-600"
        >
          <span className="font-mono text-sm">{publicKeyShort}</span>
          <ChevronDown size={14} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {showDropdown && (
          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Full Address</div>
              <div className="font-mono text-sm break-all text-gray-900 dark:text-white">{publicKey?.toString()}</div>
            </div>
            
            <div className="p-2">
              <button
                onClick={handleCopyAddress}
                className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-gray-700 dark:text-gray-300"
              >
                {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy Address'}
              </button>
              
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-red-600"
              >
                <LogOut size={16} />
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
    </div>
  );
}