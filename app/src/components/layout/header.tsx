import { WalletNetworkButton } from '@/components/ui/wallet-network-button';
import { Button } from '@/components/ui/button';
import { MobileNav } from '@/components/mobile/mobile-nav';
import { QueueStatusBar } from '@/components/layout/queue-status-bar';
import { Zap, Trophy, Activity, Rocket, LayoutDashboard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';

export function Header() {
  const { isConnected } = useAccount();

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center">
        {/* Mobile Layout */}
        <div className="md:hidden flex items-center justify-between w-full">
          <MobileNav />
          <Link to="/" className="flex items-center space-x-2 absolute left-1/2 transform -translate-x-1/2">
            <div className="w-9 h-9 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              AI ARENA
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {isConnected && <QueueStatusBar />}
            <WalletNetworkButton />
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:flex items-center justify-between w-full">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 mr-8">
            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
              <Zap className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              AI BATTLE ARENA
            </span>
          </Link>

          {/* Center Navigation */}
          <nav className="flex items-center space-x-1">
            {isConnected && (
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-accent/10" asChild>
                <Link to="/dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
            )}
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-accent/10" asChild>
              <Link to="/tournaments">
                <Trophy className="mr-2 h-4 w-4" />
                Tournaments
              </Link>
            </Button>
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-accent/10" asChild>
              <Link to="/bots">
                <Activity className="mr-2 h-4 w-4" />
                Bots
              </Link>
            </Button>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center space-x-3">
            {isConnected && <QueueStatusBar />}
            <Button variant="outline" size="sm" asChild>
              <Link to="/deploy">
                <Rocket className="mr-2 h-4 w-4" />
                Deploy Bot
              </Link>
            </Button>
            <WalletNetworkButton />
          </div>
        </div>
      </div>
    </header>
  );
}