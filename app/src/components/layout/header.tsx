// import { WalletButton } from '@/components/ui/wallet-button';
import { Button } from '@/components/ui/button';
import { MobileNav } from '@/components/mobile/mobile-nav';
import { Zap, Users, Trophy, TrendingUp, BarChart3, Settings, Droplets, BookOpen, Code, Scale, MessageSquare, Activity, Target, Vault, Shield, Rocket } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Header() {
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
              HYPER
            </span>
          </Link>
          {/* <WalletButton /> */}
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

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-4">
            {/* <Button variant="ghost" className="text-foreground hover:text-primary" asChild>
              <Link to="/discover">
                <Target className="mr-2 h-4 w-4" />
                Discover
              </Link>
            </Button> */}
            <Button variant="ghost" className="text-foreground hover:text-primary" asChild>
              <Link to="/bots">
                <Activity className="mr-2 h-4 w-4" />
                Bots
              </Link>
            </Button>
            <Button variant="ghost" className="text-foreground hover:text-primary" asChild>
              <Link to="/tournaments">
                <Trophy className="mr-2 h-4 w-4" />
                Tournaments
              </Link>
            </Button>
            {/* <Button variant="ghost" className="text-foreground hover:text-primary" asChild>
              <Link to="/portfolio">
                <Users className="mr-2 h-4 w-4" />
                Portfolio
              </Link>
            </Button> */}
            {/* <Button variant="ghost" className="text-foreground hover:text-primary" asChild>
              <Link to="/vaults">
                <Vault className="mr-2 h-4 w-4" />
                Vaults
              </Link>
            </Button> */}
            <Button variant="ghost" className="text-foreground hover:text-primary" asChild>
              <Link to="/analytics">
                <BarChart3 className="mr-2 h-4 w-4" />
                Analytics
              </Link>
            </Button>
            <Button variant="ghost" className="text-foreground hover:text-primary" asChild>
              <Link to="/social">
                <MessageSquare className="mr-2 h-4 w-4" />
                Social
              </Link>
            </Button>
            {/* <Button variant="ghost" className="text-foreground hover:text-primary" asChild>
              <Link to="/kyc">
                <Shield className="mr-2 h-4 w-4" />
                KYC
              </Link>
            </Button> */}
            {/* <Button variant="ghost" className="text-foreground hover:text-primary" asChild>
              <Link to="/launch">
                <Rocket className="mr-2 h-4 w-4" />
                Launch Bot
              </Link>
            </Button> */}
            <Button variant="ghost" className="text-foreground hover:text-primary" asChild>
              <Link to="/learn">
                <BookOpen className="mr-2 h-4 w-4" />
                Learn
              </Link>
            </Button>
            <Button variant="ghost" className="text-foreground hover:text-primary" asChild>
              <Link to="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </Button>
          </nav>

          {/* Wallet Connection */}
          {/* <WalletButton /> */}
        </div>
      </div>
    </header>
  );
}