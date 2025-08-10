import { QueueStatusBar } from '@shared/components/layout/queue-status-bar';
import { MobileNav } from '@shared/components/mobile/mobile-nav';
import { Button } from '@ui/button';
import { WalletNetworkButton } from '@ui/wallet-network-button';
import { Bot, LayoutDashboard, Rocket, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';

export function Header() {
  const { isConnected } = useAccount();

  return (
    <header className="border-b bg-background sticky top-0 z-50">
      <div className="container mx-auto px-3 sm:px-4 h-14 flex items-center">
        {/* Mobile Layout */}
        <div className="md:hidden flex items-center justify-between w-full">
          <MobileNav />
          <Link to="/" className="flex items-center space-x-2 absolute left-1/2 -translate-x-1/2">
            <Bot className="h-5 w-5" />
            <span className="text-base font-medium pixel-title">AI Arena</span>
          </Link>
          <div className="flex items-center gap-2">
            {isConnected && <QueueStatusBar />}
            <WalletNetworkButton />
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:flex items-center justify-between w-full">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <Bot className="h-5 w-5" />
            <span className="text-base font-medium pixel-title">AI Arena</span>
          </Link>

          {/* Center Navigation */}
          <nav className="flex items-center space-x-1">
            {isConnected && (
              <Button variant="ghost" size="sm" className="text-sm pixel-btn" asChild>
                <Link to="/dashboard">
                  <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
                  Dashboard
                </Link>
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-sm pixel-btn" asChild>
              <Link to="/tournaments">
                <Trophy className="mr-1.5 h-3.5 w-3.5" />
                Tournaments
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="text-sm pixel-btn" asChild>
              <Link to="/bots">
                <Bot className="mr-1.5 h-3.5 w-3.5" />
                Bots
              </Link>
            </Button>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {isConnected && <QueueStatusBar />}
            <Button variant="ghost" size="sm" className="pixel-btn" asChild>
              <Link to="/deploy">
                <Rocket className="mr-1.5 h-3.5 w-3.5" />
                Deploy
              </Link>
            </Button>
            <WalletNetworkButton />
          </div>
        </div>
      </div>
    </header>
  );
}