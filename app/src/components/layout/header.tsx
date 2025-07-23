import { WalletNetworkButton } from '@/components/ui/wallet-network-button';
import { Button } from '@/components/ui/button';
import { MobileNav } from '@/components/mobile/mobile-nav';
import { Zap, Users, Trophy, Activity, Rocket, LayoutDashboard, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';

export function Header() {
  const { isConnected } = useAccount();

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur-md sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center">
        {/* Mobile Layout: Nav + Centered Logo + Wallet */}
        <div className="md:hidden flex items-center justify-between w-full">
          <MobileNav />
          <Link to="/" className="flex items-center space-x-3 absolute left-1/2 transform -translate-x-1/2">
            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-lg">
              <Zap className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent tracking-tight">
              AI ARENA
            </span>
          </Link>
          <WalletNetworkButton />
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:flex items-center justify-between w-full">
          {/* Logo - Left aligned on desktop */}
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-lg">
              <Zap className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent tracking-tight">
              AI BATTLE ARENA
            </span>
          </Link>

          {/* Navigation - Simplified */}
          <nav className="hidden md:flex items-center space-x-3">
            {isConnected && (
              <Button variant="ghost" className="text-foreground hover:text-primary" asChild>
                <Link to="/dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
            )}
            <Button variant="ghost" className="text-foreground hover:text-primary" asChild>
              <Link to="/tournaments">
                <Trophy className="mr-2 h-4 w-4" />
                Tournaments
              </Link>
            </Button>
            <Button variant="ghost" className="text-foreground hover:text-primary" asChild>
              <Link to="/bots">
                <Activity className="mr-2 h-4 w-4" />
                Bots
              </Link>
            </Button>
            <Button variant="ghost" className="text-foreground hover:text-primary" asChild>
              <Link to="/queue">
                <Users className="mr-2 h-4 w-4" />
                Queue
              </Link>
            </Button>
            <Button variant="default" size="sm" asChild>
              <Link to="/deploy">
                <Rocket className="mr-2 h-4 w-4" />
                Deploy Bot
              </Link>
            </Button>
          </nav>

          {/* Right side - Help, Wallet/User */}
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/learn">
                <HelpCircle className="h-5 w-5" />
              </Link>
            </Button>
            <WalletNetworkButton />
          </div>
        </div>
      </div>
    </header>
  );
}