import { useHypeBalance } from '@/hooks/useHypeBalance';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WalletButtonProps {
  address: string;
  className?: string;
  showFullBalance?: boolean;
}

export function WalletButton({ address, className, showFullBalance = false }: WalletButtonProps) {
  const { formatted, fullFormatted, symbol, isLoading } = useHypeBalance();
  
  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Balance Display */}
      <div className="flex items-center gap-1.5">
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : (
          <Badge variant="secondary" className="font-mono text-xs">
            {showFullBalance ? fullFormatted : formatted} {symbol}
          </Badge>
        )}
      </div>
      
      {/* Address Display */}
      <span className="text-sm font-medium">
        {shortenAddress(address)}
      </span>
    </div>
  );
}