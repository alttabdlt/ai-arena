import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/dropdown-menu';
import { Button } from '@ui/button';
import { Badge } from '@ui/badge';
import { 
  Wallet,
  Network,
  Copy,
  LogOut,
  User,
  Settings,
  Activity,
  ChevronDown,
  Loader2,
  Zap
} from 'lucide-react';
import { useToast } from '@shared/hooks/use-toast';
import { useAuth } from '@auth/contexts/AuthContext';
import { cn } from '@/lib/utils';

export function WalletNetworkButton() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { publicKey, connected, disconnect, connecting } = useWallet();
  const { user, isAuthenticated, isLoggingIn, login, logout } = useAuth();

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast({
      title: "Address copied",
      description: "Wallet address copied to clipboard",
    });
  };

  const handleDisconnect = () => {
    logout(); // This will handle clearing auth data
    disconnect();
    navigate('/');
  };

  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  // If wallet is not connected, show the standard WalletMultiButton
  if (!connected) {
    return <WalletMultiButton className="!bg-primary !text-primary-foreground hover:!bg-primary/90" />;
  }

  // If connecting, show loading state
  if (connecting) {
    return (
      <Button 
        variant="ghost" 
        className="relative h-10 px-4 bg-background/50 backdrop-blur-md border border-border/50"
        disabled
      >
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  const address = publicKey?.toString() || '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 px-3 backdrop-blur-md border bg-background/50 border-border/50 hover:border-primary/40 transition-all duration-200 group"
        >
          <div className="flex items-center gap-2">
            {/* Network Section */}
            <div className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                Solana Devnet
              </span>
            </div>
            
            {/* Divider */}
            <div className="h-4 w-px bg-border/50" />
            
            {/* Wallet Section */}
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "h-2 w-2 rounded-full",
                isAuthenticated ? "bg-green-500 animate-pulse" : "bg-yellow-500"
              )} />
              <span className="text-sm font-medium">
                {shortenAddress(address)}
              </span>
              <Badge variant="secondary" className="text-xs font-mono">
                SOL
              </Badge>
            </div>
            
            <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-64">
        {/* Network Section */}
        <DropdownMenuLabel className="flex items-center gap-2">
          <Network className="h-4 w-4" />
          Network
        </DropdownMenuLabel>
        <DropdownMenuItem disabled>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span>Solana Devnet</span>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Wallet Section */}
        <DropdownMenuLabel className="flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          Wallet
          {isAuthenticated && (
            <Badge variant="outline" className="ml-auto text-xs">
              Authenticated
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuItem className="flex items-center justify-between">
          <span className="text-sm">{shortenAddress(address)}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={(e) => {
              e.stopPropagation();
              handleCopyAddress(address);
            }}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </DropdownMenuItem>
        
        {!isAuthenticated && (
          <DropdownMenuItem onClick={login} className="text-primary" disabled={isLoggingIn}>
            <Zap className="mr-2 h-4 w-4" />
            <span>{isLoggingIn ? 'Authenticating...' : 'Authenticate'}</span>
          </DropdownMenuItem>
        )}
        
        <DropdownMenuSeparator />
        
        {/* User Menu */}
        <DropdownMenuItem onClick={() => navigate('/dashboard')}>
          <User className="mr-2 h-4 w-4" />
          <span>Dashboard</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => navigate('/bots?filter=my-bots')}>
          <Activity className="mr-2 h-4 w-4" />
          <span>My Bots</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => navigate('/settings')}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={handleDisconnect} 
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Disconnect</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}