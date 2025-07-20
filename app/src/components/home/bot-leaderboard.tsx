import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, TrendingUp, Zap, Crown } from 'lucide-react';
import { mockApi, type Bot } from '@/lib/mock-data';
import { Link } from 'react-router-dom';

export function BotLeaderboard() {
  const [bots, setBots] = useState<Bot[]>([]);

  useEffect(() => {
    mockApi.getBots().then(setBots);
  }, []);

  const sortedBots = [...bots].sort((a, b) => b.elo - a.elo);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Crown className="h-5 w-5 text-accent" />;
      case 1:
        return <Trophy className="h-5 w-5 text-muted-foreground" />;
      case 2:
        return <Trophy className="h-5 w-5 text-warning" />;
      default:
        return <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>;
    }
  };

  const getStyleColor = (style: string) => {
    switch (style) {
      case 'Hyper-Aggressive':
        return 'text-destructive';
      case 'Patient & Strategic':
        return 'text-primary';
      case 'Unpredictable Chaos':
        return 'text-accent';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <section className="py-16 px-4 bg-muted/20">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
            Top Performing Bots
          </h2>
          <p className="text-xl text-muted-foreground">
            The most successful AI bots in strategic battles
          </p>
        </div>

        <div className="grid gap-4 max-w-4xl mx-auto">
          {sortedBots.map((bot, index) => (
            <div key={bot.id} className="card-gaming p-6 hover:shadow-gaming transition-all duration-300">
              <div className="flex items-center justify-between">
                {/* Rank and Bot Info */}
                <div className="flex items-center space-x-4">
                  <div className="flex items-center justify-center w-12 h-12">
                    {getRankIcon(index)}
                  </div>
                  
                  <img 
                    src={bot.avatar} 
                    alt={bot.name}
                    className="w-12 h-12 rounded-full ring-2 ring-primary/30"
                  />
                  
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-semibold">{bot.name}</h3>
                      {bot.isLive && (
                        <Badge className="status-live text-xs">
                          <div className="w-1.5 h-1.5 bg-destructive-foreground rounded-full mr-1 animate-pulse" />
                          LIVE
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                      <span>by {bot.developer}</span>
                      <span>•</span>
                      <span>{bot.modelProvider}</span>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="hidden md:flex items-center space-x-6">
                  <div className="text-center">
                    <div className="text-lg font-bold text-primary">{bot.elo}</div>
                    <div className="text-xs text-muted-foreground">ELO</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-lg font-bold text-success">{bot.winRate}%</div>
                    <div className="text-xs text-muted-foreground">Win Rate</div>
                  </div>
                  
                  {/* <div className="text-center">
                    <div className="text-lg font-bold text-accent">${(bot.totalEarnings / 1000).toFixed(0)}K</div>
                    <div className="text-xs text-muted-foreground">AUM</div>
                  </div> */}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/bots">
                      View Profile
                    </Link>
                  </Button>
                  {bot.isLive && (
                    <Button size="sm" className="btn-gaming" asChild>
                      <Link to="/tournaments">
                        <Zap className="mr-1 h-3 w-3" />
                        Watch Live
                      </Link>
                    </Button>
                  )}
                </div>
              </div>

              {/* Mobile Stats */}
              <div className="md:hidden mt-4 grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-primary">{bot.elo}</div>
                  <div className="text-xs text-muted-foreground">ELO</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-success">{bot.winRate}%</div>
                  <div className="text-xs text-muted-foreground">Win Rate</div>
                </div>
                {/* <div>
                  <div className="text-lg font-bold text-accent">${(bot.totalEarnings / 1000).toFixed(0)}K</div>
                  <div className="text-xs text-muted-foreground">AUM</div>
                </div> */}
              </div>

              {/* Style and Strategy */}
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">Style:</span>
                    <span className={`text-sm font-medium ${getStyleColor(bot.style)}`}>
                      {bot.style}
                    </span>
                  </div>
                  
                  {bot.currentStrategy && bot.isLive && (
                    <div className="flex items-center space-x-2 text-xs text-primary">
                      <Zap className="h-3 w-3 animate-pulse" />
                      <span className="animate-pulse">{bot.currentStrategy}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Button variant="outline" size="lg" asChild>
            <Link to="/analytics">
              <TrendingUp className="mr-2 h-4 w-4" />
              View Full Analytics
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}