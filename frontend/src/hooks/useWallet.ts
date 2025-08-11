import { useEffect } from 'react';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { useWalletStore } from '@/stores/walletStore';

export function useWallet() {
  const solanaWallet = useSolanaWallet();
  const {
    setWallet,
    setPublicKey,
    setConnected,
    setConnecting,
    setDisconnecting,
    ...walletStore
  } = useWalletStore();

  // Sync Solana wallet state with our Zustand store
  useEffect(() => {
    setWallet(solanaWallet.wallet);
    setPublicKey(solanaWallet.publicKey);
    setConnected(solanaWallet.connected);
    setConnecting(solanaWallet.connecting);
    setDisconnecting(solanaWallet.disconnecting);
  }, [
    solanaWallet.wallet,
    solanaWallet.publicKey,
    solanaWallet.connected,
    solanaWallet.connecting,
    solanaWallet.disconnecting,
    setWallet,
    setPublicKey,
    setConnected,
    setConnecting,
    setDisconnecting,
  ]);

  // Return combined interface with both Solana wallet methods and our store
  return {
    // Wallet state
    wallet: walletStore.wallet,
    publicKey: walletStore.publicKey,
    connected: walletStore.connected,
    connecting: walletStore.connecting,
    disconnecting: walletStore.disconnecting,
    connection: walletStore.connection,
    
    // Solana wallet methods
    connect: solanaWallet.connect,
    disconnect: solanaWallet.disconnect,
    select: solanaWallet.select,
    
    // Available wallets
    wallets: solanaWallet.wallets,
    
    // Utility methods
    signTransaction: solanaWallet.signTransaction,
    signAllTransactions: solanaWallet.signAllTransactions,
    signMessage: solanaWallet.signMessage,
    
    // Helper to get wallet display name
    walletName: walletStore.wallet?.adapter.name || 'Unknown',
    
    // Helper to get shortened public key
    publicKeyShort: walletStore.publicKey 
      ? `${walletStore.publicKey.toString().slice(0, 4)}...${walletStore.publicKey.toString().slice(-4)}`
      : null,
  };
}