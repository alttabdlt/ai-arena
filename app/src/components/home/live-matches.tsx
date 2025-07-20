import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Eye, Zap, Clock, TrendingUp } from 'lucide-react';
import { mockApi, type Match } from '@/lib/mock-data';

export function LiveMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [strategies, setStrategies] = useState<Record<number, { botA: string; botB: string }>>({});

  useEffect(() => {
    mockApi.getMatches().then(setMatches);

    // Subscribe to strategy updates for live matches
    const liveMatch = matches.find(m => m.status === 'LIVE');
    if (!liveMatch) return;

    const unsubscribe = mockApi.subscribeToMatch(liveMatch.id, (data) => {
      if (data.type === 'strategy_update') {
        setStrategies(prev => ({
          ...prev,
          [liveMatch.id]: {
            ...prev[liveMatch.id],
            [data.botId === 1 ? 'botA' : 'botB']: data.strategy
          }
        }));
      }
    });

    return unsubscribe;
  }, [matches]);

  const formatTimeLeft = (timestamp: number) => {
    const diff = timestamp - Date.now();
    if (diff <= 0) return 'Starting...';
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const formatDuration = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  };

  return (
    <section className="py-16 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Live Performance
          </h2>
          <p className="text-xl text-muted-foreground">
            Watch AI bots compete in real-time battles
          </p>
        </div>

        <div className="grid gap-6 max-w-4xl mx-auto">
          {matches.map((match) => (
            <div key={match.id} className="card-gaming p-6 hover:shadow-gaming transition-all duration-300">
              {/* Match Status */}
              <div className="flex items-center justify-between mb-4">
                <Badge className={`status-${match.status.toLowerCase()}`}>
                  {match.status === 'LIVE' && <div className="w-2 h-2 bg-destructive-foreground rounded-full mr-2 animate-pulse" />}
                  {match.status}
                </Badge>
                <div className="flex items-center text-sm text-muted-foreground">
                  {match.status === 'LIVE' && (
                    <>
                      <Clock className="h-4 w-4 mr-1" />
                      {formatDuration(match.startTime)}
                    </>
                  )}
                  {match.status === 'UPCOMING' && (
                    <>
                      <Clock className="h-4 w-4 mr-1" />
                      Starts in {formatTimeLeft(match.startTime)}
                    </>
                  )}
                </div>
              </div>

              {/* Bots */}
              <div className="grid md:grid-cols-3 gap-6 items-center mb-6">
                {/* Bot A */}
                <div className="text-center">
                  <img 
                    src={match.botAAvatar} 
                    alt={match.botA}
                    className="w-16 h-16 rounded-full mx-auto mb-3 ring-2 ring-primary/50"
                  />
                  <h3 className="font-semibold text-lg">{match.botA}</h3>
                  {/* <div className="text-sm text-muted-foreground mb-2">
                    AUM: ${match.poolA.toLocaleString()}
                  </div>
                  <div className="text-xs text-primary font-medium">
                    APY: {(match.oddsA * 10).toFixed(1)}%
                  </div> */}
                  {/* Strategy Display */}
                  {match.status === 'LIVE' && strategies[match.id]?.botA && (
                    <div className="mt-2 p-2 bg-primary/10 rounded text-xs text-primary animate-pulse">
                      <Zap className="h-3 w-3 inline mr-1" />
                      {strategies[match.id].botA}
                    </div>
                  )}
                </div>

                {/* VS Section */}
                <div className="text-center">
                  <div className="text-2xl font-bold text-muted-foreground mb-2">VS</div>
                  {match.status === 'LIVE' && (
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">
                        Trade {match.handsPlayed} / {match.totalHands}
                      </div>
                      <Progress 
                        value={(match.handsPlayed / match.totalHands) * 100} 
                        className="w-full h-2"
                      />
                    </div>
                  )}
                </div>

                {/* Bot B */}
                <div className="text-center">
                  <img 
                    src={match.botBAvatar} 
                    alt={match.botB}
                    className="w-16 h-16 rounded-full mx-auto mb-3 ring-2 ring-accent/50"
                  />
                  <h3 className="font-semibold text-lg">{match.botB}</h3>
                  {/* <div className="text-sm text-muted-foreground mb-2">
                    AUM: ${match.poolB.toLocaleString()}
                  </div>
                  <div className="text-xs text-accent font-medium">
                    APY: {(match.oddsB * 10).toFixed(1)}%
                  </div> */}
                  {/* Strategy Display */}
                  {match.status === 'LIVE' && strategies[match.id]?.botB && (
                    <div className="mt-2 p-2 bg-accent/10 rounded text-xs text-accent animate-pulse">
                      <Zap className="h-3 w-3 inline mr-1" />
                      {strategies[match.id].botB}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button className="flex-1" variant="outline">
                  <Eye className="mr-2 h-4 w-4" />
                  {match.status === 'LIVE' ? 'View Live' : 'View Details'}
                </Button>
                {/* {match.status !== 'COMPLETED' && (
                  <Button className="flex-1 btn-accent">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Invest Now
                  </Button>
                )} */}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Button variant="outline" size="lg">
            View All Bots
          </Button>
        </div>
      </div>
    </section>
  );
}