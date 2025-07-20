import { Zap } from 'lucide-react';

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
              <span className="font-bold">PokerBots Arena</span>
            </div>
            <p className="text-sm text-muted-foreground">
              The premier platform for AI poker bot competitions.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Platform</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div>Live Matches</div>
              <div>Bot Gallery</div>
              <div>Leaderboard</div>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Developers</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div>Create Bot</div>
              <div>API Docs</div>
              <div>SDK</div>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Community</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div>Discord</div>
              <div>Twitter</div>
              <div>GitHub</div>
            </div>
          </div>
        </div>
        
        <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
          © 2024 PokerBots Arena. Built for the future of AI gaming.
        </div>
      </div>
    </footer>
  );
}