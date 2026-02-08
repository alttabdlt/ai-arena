import { useState, useEffect, useCallback } from 'react';
import { Button } from '@ui/button';
import { Badge } from '@ui/badge';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
      selectedAddress?: string;
      isMetaMask?: boolean;
    };
  }
}

// Monad Testnet chain config
const MONAD_TESTNET = {
  chainId: '0x279F', // 10143 in hex
  chainName: 'Monad Testnet',
  nativeCurrency: {
    name: 'MON',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: ['https://testnet-rpc.monad.xyz'],
  blockExplorerUrls: ['https://testnet.monadexplorer.com'],
};

// $ARENA token on nad.fun
const ARENA_TOKEN = {
  address: '0x0bA5E04470Fe327AC191179Cf6823E667B007777',
  symbol: 'ARENA',
  decimals: 18,
};

interface WalletConnectProps {
  compact?: boolean;
  onAddressChange?: (address: string | null) => void;
}

export function WalletConnect({ compact = false, onAddressChange }: WalletConnectProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if already connected
  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum?.selectedAddress) {
        setAddress(window.ethereum.selectedAddress);
        try {
          const chain = await window.ethereum.request({ method: 'eth_chainId' });
          setChainId(chain);
        } catch {}
      }
    };
    checkConnection();

    // Listen for account changes
    const handleAccountsChanged = (accounts: string[]) => {
      setAddress(accounts[0] || null);
    };
    const handleChainChanged = (chain: string) => {
      setChainId(chain);
    };

    window.ethereum?.on('accountsChanged', handleAccountsChanged);
    window.ethereum?.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('No wallet found. Install MetaMask!');
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      // Request accounts
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });
      setAddress(accounts[0]);

      // Get current chain
      const chain = await window.ethereum.request({ method: 'eth_chainId' });
      setChainId(chain);

      // Try to switch to Monad Testnet
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: MONAD_TESTNET.chainId }],
        });
      } catch (switchError: any) {
        // Chain not added, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [MONAD_TESTNET],
          });
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  }, []);

  const addToken = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: ARENA_TOKEN.address,
            symbol: ARENA_TOKEN.symbol,
            decimals: ARENA_TOKEN.decimals,
          },
        },
      });
    } catch {}
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
  }, []);

  // Notify parent of address changes
  useEffect(() => {
    onAddressChange?.(address);
  }, [address, onAddressChange]);

  const isMonad = chainId === MONAD_TESTNET.chainId;
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {address ? (
          <>
            <Badge 
              variant="outline" 
              className={`${isMonad ? 'border-green-600/50 text-green-400' : 'border-amber-600/50 text-amber-400'} text-[10px]`}
            >
              {isMonad ? '🟢 Monad' : '⚠️ Wrong Network'}
            </Badge>
            <Button size="sm" variant="ghost" className="text-xs font-mono" onClick={disconnect}>
              {shortAddress}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={connect} disabled={connecting}>
            {connecting ? '...' : '🔗 Connect'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/30 rounded px-2 py-1">
          {error}
        </div>
      )}

      {address ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Connected</span>
            <Badge 
              variant="outline" 
              className={`${isMonad ? 'border-green-600/50 text-green-400' : 'border-amber-600/50 text-amber-400'}`}
            >
              {isMonad ? '🟢 Monad Testnet' : '⚠️ Switch to Monad'}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-slate-200">{shortAddress}</span>
            <Button size="sm" variant="ghost" className="text-xs" onClick={disconnect}>
              Disconnect
            </Button>
          </div>

          {isMonad && (
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                className="flex-1 text-xs"
                onClick={addToken}
              >
                + Add $ARENA
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                className="flex-1 text-xs border-amber-600/50 text-amber-300"
                onClick={() => window.open(`https://testnet.nad.fun/token/${ARENA_TOKEN.address}`, '_blank')}
              >
                Buy on nad.fun
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Button 
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700" 
          onClick={connect}
          disabled={connecting}
        >
          {connecting ? 'Connecting...' : '🔗 Connect Wallet'}
        </Button>
      )}

      <div className="text-[10px] text-slate-500">
        Connect to Monad Testnet to interact with $ARENA
      </div>
    </div>
  );
}
