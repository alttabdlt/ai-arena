import { useAccount, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Wallet,
  Network,
  Copy,
  ExternalLink,
  LogOut,
  User,
  Settings,
  Activity,
  ChevronDown,
  AlertCircle,
  Loader2,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export function WalletNetworkButton() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { disconnect } = useDisconnect();
  const { user, isAuthenticated, login, logout } = useAuth();

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

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus ||
            authenticationStatus === 'authenticated');

        // Auto-login when wallet connects
        useEffect(() => {
          if (connected && !isAuthenticated) {
            login();
          }
        }, [connected, isAuthenticated, login]);

        if (!ready) {
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

        if (!connected) {
          return (
            <Button
              onClick={openConnectModal}
              className="relative h-10 px-4 bg-gradient-to-r from-primary/20 to-accent/20 backdrop-blur-md border border-primary/20 hover:border-primary/40 transition-all duration-200"
            >
              <Wallet className="mr-2 h-4 w-4" />
              Connect to HyperEVM
            </Button>
          );
        }

        const isWrongNetwork = chain.unsupported;
        const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "relative h-10 px-3 backdrop-blur-md border transition-all duration-200 group",
                  isWrongNetwork 
                    ? "bg-destructive/10 border-destructive/20 hover:border-destructive/40" 
                    : "bg-background/50 border-border/50 hover:border-primary/40"
                )}
              >
                <div className="flex items-center gap-2">
                  {/* Network Section */}
                  <div className="flex items-center gap-1.5">
                    {isWrongNetwork ? (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    ) : chain.hasIcon && chain.iconUrl ? (
                      <img
                        src={chain.iconUrl}
                        alt={chain.name}
                        className="h-4 w-4 rounded-full"
                      />
                    ) : (
                      <Zap className="h-4 w-4 text-primary" />
                    )}
                    <span className={cn(
                      "text-sm font-medium",
                      isWrongNetwork && "text-destructive"
                    )}>
                      {isWrongNetwork ? "Wrong Network" : chain.name}
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
                      {shortenAddress(account.address)}
                    </span>
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
              <DropdownMenuItem 
                onClick={openChainModal}
                className={cn(
                  "flex items-center justify-between",
                  isWrongNetwork && "text-destructive"
                )}
              >
                <div className="flex items-center gap-2">
                  {chain.hasIcon && chain.iconUrl && (
                    <img
                      src={chain.iconUrl}
                      alt={chain.name}
                      className="h-4 w-4 rounded-full"
                    />
                  )}
                  <span>{chain.name}</span>
                </div>
                {isWrongNetwork && (
                  <Badge variant="destructive" className="text-xs">Switch</Badge>
                )}
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
                <span className="text-sm">{shortenAddress(account.address)}</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyAddress(account.address);
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      openAccountModal();
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </DropdownMenuItem>
              {account.displayBalance && (
                <DropdownMenuItem disabled>
                  <span className="text-sm text-muted-foreground">
                    Balance: {account.displayBalance}
                  </span>
                </DropdownMenuItem>
              )}
              
              {!isAuthenticated && (
                <DropdownMenuItem onClick={login} className="text-primary">
                  <Zap className="mr-2 h-4 w-4" />
                  <span>Authenticate</span>
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
      }}
    </ConnectButton.Custom>
  );
}