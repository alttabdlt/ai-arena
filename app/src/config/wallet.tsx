import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
// Phantom wallet is now auto-detected as a Standard Wallet
// No need to explicitly import PhantomWalletAdapter
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { endpoint } from './solana';
import { ReactNode } from 'react';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'
  const network = WalletAdapterNetwork.Devnet;
  
  // Use custom RPC endpoint from config or default to cluster URL
  const rpcEndpoint = useMemo(() => endpoint || clusterApiUrl(network), [network]);

  // Configure wallet adapters - empty array allows auto-detection of standard wallets
  const wallets = useMemo(
    () => [
      // Phantom and other standard wallets are auto-detected
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={rpcEndpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}