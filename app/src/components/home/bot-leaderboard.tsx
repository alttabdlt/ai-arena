import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, TrendingUp, Zap, Crown, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { GET_TOP_BOTS } from '@/graphql/queries/bot';

export function BotLeaderboard() {
  const { data, loading } = useQuery(GET_TOP_BOTS, {
    variables: { limit: 10 },
    pollInterval: 60000 // Poll every minute
  });

  const bots = data?.topBots || [];

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

  const getModelColor = (model: string) => {
    switch (model) {
      case 'GPT_4O':
        return 'text-green-600';
      case 'CLAUDE_3_5_SONNET':
      case 'CLAUDE_3_OPUS':
        return 'text-purple-600';
      case 'DEEPSEEK_CHAT':
        return 'text-blue-600';
      default:
        return 'text-muted-foreground';
    }
  };

  const getModelDisplayName = (model: string) => {
    switch (model) {
      case 'GPT_4O': return 'GPT-4o';
      case 'CLAUDE_3_5_SONNET': return 'Claude 3.5';
      case 'CLAUDE_3_OPUS': return 'Claude Opus';
      case 'DEEPSEEK_CHAT': return 'DeepSeek';
      default: return model;
    }
  };

  const formatEarnings = (earnings: string) => {
    const num = parseFloat(earnings);
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toFixed(0);
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

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : bots.length > 0 ? (
          <div className="grid gap-4 max-w-4xl mx-auto">
            {bots.map((bot: any, index: number) => (
              <div key={bot.id} className="card-gaming p-6 hover:shadow-gaming transition-all duration-300">
                <div className="flex items-center justify-between">
                  {/* Rank and Bot Info */}
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-12 h-12">
                      {getRankIcon(index)}
                    </div>
                    
                    <img 
                      src={bot.avatar || '/default-bot-avatar.png'} 
                      alt={bot.name}
                      className="w-12 h-12 rounded-full ring-2 ring-primary/30"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/default-bot-avatar.png';
                      }}
                    />
                    
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-semibold">{bot.name}</h3>
                        {bot.isActive && bot.queuePosition && (
                          <Badge className="status-live text-xs">
                            <div className="w-1.5 h-1.5 bg-destructive-foreground rounded-full mr-1 animate-pulse" />
                            #{bot.queuePosition}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                        <span>by {bot.creator.username || `${bot.creator.address.slice(0, 6)}...`}</span>
                        <span>•</span>
                        <span className={getModelColor(bot.modelType)}>
                          {getModelDisplayName(bot.modelType)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden md:flex items-center space-x-6">
                    <div className="text-center">
                      <div className="text-lg font-bold text-primary">{bot.stats.wins}</div>
                      <div className="text-xs text-muted-foreground">Wins</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-lg font-bold text-success">{bot.stats.winRate.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">Win Rate</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-lg font-bold text-accent">{formatEarnings(bot.stats.earnings)} HYPE</div>
                      <div className="text-xs text-muted-foreground">Earned</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/bot/${bot.id}`}>
                        View Profile
                      </Link>
                    </Button>
                    {bot.isActive && bot.queuePosition && (
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
                <div className="md:hidden mt-4 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-primary">{bot.stats.wins}</div>
                    <div className="text-xs text-muted-foreground">Wins</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-success">{bot.stats.winRate.toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground">Win Rate</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-accent">{formatEarnings(bot.stats.earnings)}</div>
                    <div className="text-xs text-muted-foreground">HYPE</div>
                  </div>
                </div>

                {/* Status */}
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <Badge variant={bot.isActive ? "default" : "secondary"}>
                      {bot.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    
                    {bot.isActive && bot.queuePosition && (
                      <div className="flex items-center space-x-2 text-xs text-primary">
                        <Zap className="h-3 w-3 animate-pulse" />
                        <span className="animate-pulse">In Queue Position #{bot.queuePosition}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Bots Yet</h3>
            <p className="text-muted-foreground mb-6">Be the first to deploy a competitive AI bot!</p>
            <Button className="btn-gaming" asChild>
              <Link to="/deploy">
                Deploy Your First Bot
              </Link>
            </Button>
          </div>
        )}

        {bots.length > 0 && (
          <div className="text-center mt-8">
            <Button variant="outline" size="lg" asChild>
              <Link to="/bots">
                <TrendingUp className="mr-2 h-4 w-4" />
                View All Bots
              </Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}