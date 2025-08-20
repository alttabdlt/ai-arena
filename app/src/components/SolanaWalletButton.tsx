import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Connection, PublicKey } from '@solana/web3.js';
import { Button } from '../shared/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../shared/components/ui/dropdown-menu';
import { ChevronDown, Wallet, LogOut, Copy, ExternalLink, Coins } from 'lucide-react';
import { formatIdleAmount, fetchIdlePriceData, getExplorerLink } from '../config/solana';
import { endpoint, IDLE_TOKEN } from '../config/solana';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { useToast } from '../shared/hooks/use-toast';

export const SolanaWalletButton: React.FC = () => {
  const { publicKey, wallet, disconnect, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { toast } = useToast();
  const [solBalance, setSolBalance] = useState<number>(0);
  const [idleBalance, setIdleBalance] = useState<number>(0);
  const [idlePrice, setIdlePrice] = useState<number | null>(null);

  // Fetch balances when wallet connects
  useEffect(() => {
    if (publicKey) {
      fetchBalances();
      // Refresh balances every 30 seconds
      const interval = setInterval(fetchBalances, 30000);
      return () => clearInterval(interval);
    }
  }, [publicKey]);

  // Fetch $IDLE price data
  useEffect(() => {
    fetchIdlePriceData().then(data => {
      if (data) setIdlePrice(data.price);
    });
  }, []);

  const fetchBalances = async () => {
    if (!publicKey) return;
    
    try {
      const connection = new Connection(endpoint);
      
      // Fetch SOL balance
      const solBal = await connection.getBalance(publicKey);
      setSolBalance(solBal / 1e9); // Convert lamports to SOL
      
      // Fetch $IDLE balance
      try {
        const tokenAccount = await getAssociatedTokenAddress(
          IDLE_TOKEN.mint,
          publicKey
        );
        const tokenBalance = await connection.getTokenAccountBalance(tokenAccount);
        setIdleBalance(tokenBalance.value.uiAmount || 0);
      } catch {
        // Token account might not exist yet
        setIdleBalance(0);
      }
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  };

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toString());
      toast({
        title: 'Address Copied',
        description: 'Wallet address copied to clipboard',
      });
    }
  };

  const openExplorer = () => {
    if (publicKey) {
      window.open(getExplorerLink('address', publicKey.toString()), '_blank');
    }
  };

  const openPumpFun = () => {
    window.open(`https://pump.fun/coin/${IDLE_TOKEN.mint.toString()}`, '_blank');
  };

  if (!connected) {
    return (
      <Button
        onClick={() => setVisible(true)}
        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium"
      >
        <Wallet className="mr-2 h-4 w-4" />
        Connect Wallet
      </Button>
    );
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const usdValue = idlePrice ? idleBalance * idlePrice : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-w-[200px]">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center">
              {wallet && wallet.adapter.icon && (
                <img 
                  src={wallet.adapter.icon} 
                  alt={wallet.adapter.name} 
                  className="w-5 h-5 mr-2"
                />
              )}
              <div className="text-left">
                <div className="text-sm font-medium">
                  {formatAddress(publicKey!.toString())}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatIdleAmount(idleBalance * 1e6)} $IDLE
                  {usdValue && ` ($${usdValue.toFixed(2)})`}
                </div>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 ml-2" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-[280px]">
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">SOL Balance</span>
            <span className="text-sm font-mono">{solBalance.toFixed(4)} SOL</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">$IDLE Balance</span>
            <div className="text-right">
              <div className="text-sm font-mono">
                {formatIdleAmount(idleBalance * 1e6)} $IDLE
              </div>
              {usdValue && (
                <div className="text-xs text-muted-foreground">
                  ≈ ${usdValue.toFixed(2)} USD
                </div>
              )}
            </div>
          </div>
          {idlePrice && (
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-xs text-muted-foreground">$IDLE Price</span>
              <span className="text-xs font-mono">${idlePrice.toFixed(6)}</span>
            </div>
          )}
        </div>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={copyAddress}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Address
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={openExplorer}>
          <ExternalLink className="mr-2 h-4 w-4" />
          View on Solscan
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={openPumpFun}>
          <Coins className="mr-2 h-4 w-4" />
          View on Pump.fun
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={disconnect} className="text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};