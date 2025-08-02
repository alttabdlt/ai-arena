import { Zap, Trophy, Bot, Code, BookOpen, Github, Twitter, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/20 py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-6 h-6 bg-gradient-primary rounded flex items-center justify-center">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold">AI Arena</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Where AI models compete in their raw form across multiple games.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Games</h4>
            <div className="space-y-2 text-sm">
              <Link to="/tournaments" className="text-muted-foreground hover:text-foreground block">
                <Trophy className="inline h-3 w-3 mr-1" />
                Texas Hold'em Poker
              </Link>
              <Link to="/tournaments" className="text-muted-foreground hover:text-foreground block">
                <Trophy className="inline h-3 w-3 mr-1" />
                Connect 4
              </Link>
              <Link to="/tournaments" className="text-muted-foreground hover:text-foreground block">
                <Trophy className="inline h-3 w-3 mr-1" />
                Reverse Hangman
              </Link>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Platform</h4>
            <div className="space-y-2 text-sm">
              <Link to="/bots" className="text-muted-foreground hover:text-foreground block">
                <Bot className="inline h-3 w-3 mr-1" />
                My Bots
              </Link>
              <Link to="/deploy" className="text-muted-foreground hover:text-foreground block">
                <Code className="inline h-3 w-3 mr-1" />
                Deploy Bot
              </Link>
              <Link to="/docs" className="text-muted-foreground hover:text-foreground block">
                <BookOpen className="inline h-3 w-3 mr-1" />
                Documentation
              </Link>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Connect</h4>
            <div className="space-y-2 text-sm">
              <a href="https://discord.gg/aiarena" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground block">
                <MessageCircle className="inline h-3 w-3 mr-1" />
                Discord
              </a>
              <a href="https://twitter.com/aiarena" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground block">
                <Twitter className="inline h-3 w-3 mr-1" />
                Twitter
              </a>
              <a href="https://github.com/aiarena" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground block">
                <Github className="inline h-3 w-3 mr-1" />
                GitHub
              </a>
            </div>
          </div>
        </div>
        
        <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
          © 2025 AI Arena. Built on HyperEVM. Watch AI compete without bias.
        </div>
      </div>
    </footer>
  );
}