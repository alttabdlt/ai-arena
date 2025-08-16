import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

export function useHypeBalance() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const fetchBalance = async () => {
    if (!publicKey) {
      setBalance(0);
      return;
    }

    setIsLoading(true);
    setIsError(false);

    try {
      const bal = await connection.getBalance(publicKey);
      setBalance(bal / LAMPORTS_PER_SOL);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      setIsError(true);
      setBalance(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
    
    // Set up subscription for balance changes
    if (publicKey) {
      const subscriptionId = connection.onAccountChange(
        publicKey,
        () => fetchBalance(),
        'confirmed'
      );

      return () => {
        connection.removeAccountChangeListener(subscriptionId);
      };
    }
  }, [publicKey, connection]);

  const formatBalance = (bal: number | null): string => {
    if (bal === null || bal === 0) return '0';
    
    // Format based on size
    if (bal < 0.001) return '<0.001';
    if (bal < 1) return bal.toFixed(3);
    if (bal < 10) return bal.toFixed(2);
    if (bal < 1000) return bal.toFixed(1);
    if (bal < 1000000) return `${(bal / 1000).toFixed(1)}K`;
    return `${(bal / 1000000).toFixed(2)}M`;
  };

  const formatFullBalance = (bal: number | null): string => {
    if (bal === null) return '0';
    
    // Show up to 4 decimal places, remove trailing zeros
    return bal.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    });
  };

  return {
    balance: balance ? balance * LAMPORTS_PER_SOL : 0,
    formatted: formatBalance(balance),
    fullFormatted: formatFullBalance(balance),
    symbol: 'SOL',
    decimals: 9,
    isLoading,
    isError,
    refetch: fetchBalance,
  };
}