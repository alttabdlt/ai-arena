import { useBalance, useAccount, useChainId } from 'wagmi';
import { formatUnits } from 'viem';

export function useHypeBalance() {
  const { address } = useAccount();
  const chainId = useChainId();
  
  const { data, isLoading, isError, refetch } = useBalance({
    address,
    chainId,
  });

  const formatBalance = (balance: bigint | undefined, decimals: number = 18): string => {
    if (!balance) return '0';
    
    const formatted = formatUnits(balance, decimals);
    const num = parseFloat(formatted);
    
    // Format based on size
    if (num === 0) return '0';
    if (num < 0.001) return '<0.001';
    if (num < 1) return num.toFixed(3);
    if (num < 10) return num.toFixed(2);
    if (num < 1000) return num.toFixed(1);
    if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
    return `${(num / 1000000).toFixed(2)}M`;
  };

  const formatFullBalance = (balance: bigint | undefined, decimals: number = 18): string => {
    if (!balance) return '0';
    
    const formatted = formatUnits(balance, decimals);
    const num = parseFloat(formatted);
    
    // Show up to 4 decimal places, remove trailing zeros
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    });
  };

  return {
    balance: data?.value,
    formatted: formatBalance(data?.value),
    fullFormatted: formatFullBalance(data?.value),
    symbol: data?.symbol || 'HYPE',
    decimals: data?.decimals || 18,
    isLoading,
    isError,
    refetch,
  };
}