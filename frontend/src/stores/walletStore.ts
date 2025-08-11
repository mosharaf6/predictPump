import { create } from 'zustand';
import { Connection, PublicKey } from '@solana/web3.js';
import { Wallet } from '@solana/wallet-adapter-react';

interface WalletState {
  // Connection state
  wallet: Wallet | null;
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  disconnecting: boolean;
  
  // Connection details
  connection: Connection;
  
  // Actions
  setWallet: (wallet: Wallet | null) => void;
  setPublicKey: (publicKey: PublicKey | null) => void;
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setDisconnecting: (disconnecting: boolean) => void;
  
  // Helper methods
  disconnect: () => Promise<void>;
  connect: () => Promise<void>;
}

// Default Solana connection - can be configured for different networks
const DEFAULT_CONNECTION = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  'confirmed'
);

export const useWalletStore = create<WalletState>((set, get) => ({
  // Initial state
  wallet: null,
  publicKey: null,
  connected: false,
  connecting: false,
  disconnecting: false,
  connection: DEFAULT_CONNECTION,
  
  // Actions
  setWallet: (wallet) => set({ wallet }),
  setPublicKey: (publicKey) => set({ publicKey }),
  setConnected: (connected) => set({ connected }),
  setConnecting: (connecting) => set({ connecting }),
  setDisconnecting: (disconnecting) => set({ disconnecting }),
  
  // Helper methods
  connect: async () => {
    const { wallet } = get();
    if (!wallet?.adapter) return;
    
    try {
      set({ connecting: true });
      await wallet.adapter.connect();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    } finally {
      set({ connecting: false });
    }
  },
  
  disconnect: async () => {
    const { wallet } = get();
    if (!wallet?.adapter) return;
    
    try {
      set({ disconnecting: true });
      await wallet.adapter.disconnect();
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      throw error;
    } finally {
      set({ disconnecting: false });
    }
  },
}));