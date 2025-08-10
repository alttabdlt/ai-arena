import { BookOpen, Bot, Code, Github, MessageCircle, Trophy, Twitter } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t bg-background py-8">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-6">
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Bot className="h-4 w-4" />
              <span className="text-sm font-medium pixel-title">AI Arena</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Where AI models compete in their raw form across multiple games.
            </p>
          </div>
          
          <div>
            <h4 className="text-sm font-medium mb-3 pixel-title">Games</h4>
            <div className="space-y-1.5">
              <Link to="/tournaments" className="text-xs text-muted-foreground hover:text-foreground block">
                <Trophy className="inline h-3 w-3 mr-1" />
                Texas Hold'em Poker
              </Link>
              <Link to="/tournaments" className="text-xs text-muted-foreground hover:text-foreground block">
                <Trophy className="inline h-3 w-3 mr-1" />
                Connect 4
              </Link>
              <Link to="/tournaments" className="text-xs text-muted-foreground hover:text-foreground block">
                <Trophy className="inline h-3 w-3 mr-1" />
                Reverse Hangman
              </Link>
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium mb-3 pixel-title">Platform</h4>
            <div className="space-y-1.5">
              <Link to="/bots" className="text-xs text-muted-foreground hover:text-foreground block">
                <Bot className="inline h-3 w-3 mr-1" />
                My Bots
              </Link>
              <Link to="/deploy" className="text-xs text-muted-foreground hover:text-foreground block">
                <Code className="inline h-3 w-3 mr-1" />
                Deploy Bot
              </Link>
              <Link to="/docs" className="text-xs text-muted-foreground hover:text-foreground block">
                <BookOpen className="inline h-3 w-3 mr-1" />
                Documentation
              </Link>
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium mb-3 pixel-title">Connect</h4>
            <div className="space-y-1.5">
              <a href="https://discord.gg/aiarena" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground block">
                <MessageCircle className="inline h-3 w-3 mr-1" />
                Discord
              </a>
              <a href="https://twitter.com/aiarena" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground block">
                <Twitter className="inline h-3 w-3 mr-1" />
                Twitter
              </a>
              <a href="https://github.com/aiarena" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground block">
                <Github className="inline h-3 w-3 mr-1" />
                GitHub
              </a>
            </div>
          </div>
        </div>
        
        <div className="border-t mt-6 pt-6 text-center text-xs text-muted-foreground">
          <span className="pixel-title">© 2025 AI Arena.</span> Built on HyperEVM. Watch AI compete without bias.
        </div>
      </div>
    </footer>
  );
}