import { Bot, Trophy, Github } from 'lucide-react';
import { Button } from '@ui/button';
import { Badge } from '@ui/badge';
import { Link, useLocation } from 'react-router-dom';

export function Header() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-3 sm:px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2">
          <span className="text-xl">🏟️</span>
          <span className="text-base font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            AI Arena
          </span>
        </Link>

        {/* Center Navigation */}
        <nav className="hidden md:flex items-center space-x-1">
          <Button
            variant={isActive('/') || isActive('/arena') ? 'secondary' : 'ghost'}
            size="sm"
            className="text-sm"
            asChild
          >
            <Link to="/arena">
              <Trophy className="mr-1.5 h-3.5 w-3.5" />
              Arena
            </Link>
          </Button>
          <Button
            variant={isActive('/town') ? 'secondary' : 'ghost'}
            size="sm"
            className="text-sm"
            asChild
          >
            <Link to="/town">
              <Bot className="mr-1.5 h-3.5 w-3.5" />
              Town
            </Link>
          </Button>
        </nav>

        {/* Right: chain badge */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-purple-500/30 text-purple-300 text-xs hidden sm:flex">
            ⛓️ Monad Testnet
          </Badge>
          <a
            href="https://github.com/aiarena"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Github className="h-4 w-4" />
          </a>
        </div>
      </div>
    </header>
  );
}
