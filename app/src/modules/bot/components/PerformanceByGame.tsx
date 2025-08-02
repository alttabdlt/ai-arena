import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Progress } from '@ui/progress';
import { TrendingUp, TrendingDown, Trophy, Target, Minus } from 'lucide-react';

interface GamePerformance {
  gameType: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPosition: number;
  totalPlayers: number;
  earnings: string;
}

interface PerformanceByGameProps {
  performances: GamePerformance[];
}

export function PerformanceByGame({ performances }: PerformanceByGameProps) {
  const getGameIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'poker':
        return '🃏';
      case 'connect4':
        return '🔴';
      case 'chess':
        return '♟️';
      case 'go':
        return '⚫';
      case 'hangman':
        return '📝';
      case 'blackjack':
        return '🎰';
      default:
        return '🎮';
    }
  };

  const getWinRateTrend = (winRate: number) => {
    if (winRate >= 60) return { icon: TrendingUp, color: 'text-green-500' };
    if (winRate >= 40) return { icon: Minus, color: 'text-yellow-500' };
    return { icon: TrendingDown, color: 'text-red-500' };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance by Game</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {performances.map((perf) => {
            const trend = getWinRateTrend(perf.winRate);
            const TrendIcon = trend.icon;
            
            return (
              <div key={perf.gameType} className="p-4 rounded-lg border bg-muted/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getGameIcon(perf.gameType)}</span>
                    <div>
                      <h4 className="font-semibold">{perf.gameType}</h4>
                      <p className="text-sm text-muted-foreground">
                        {perf.gamesPlayed} games played
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendIcon className={`h-5 w-5 ${trend.color}`} />
                    <span className={`text-2xl font-bold ${trend.color}`}>
                      {perf.winRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Win Rate</span>
                      <span>{perf.wins}W - {perf.losses}L</span>
                    </div>
                    <Progress value={perf.winRate} className="h-2" />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="text-center p-2 rounded bg-muted/50">
                      <Trophy className="h-4 w-4 mx-auto mb-1 text-yellow-500" />
                      <p className="font-medium">{perf.wins}</p>
                      <p className="text-xs text-muted-foreground">Wins</p>
                    </div>
                    <div className="text-center p-2 rounded bg-muted/50">
                      <Target className="h-4 w-4 mx-auto mb-1 text-primary" />
                      <p className="font-medium">#{perf.avgPosition.toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">Avg Rank</p>
                    </div>
                    <div className="text-center p-2 rounded bg-muted/50">
                      <span className="text-base mb-1">💰</span>
                      <p className="font-medium">{perf.earnings}</p>
                      <p className="text-xs text-muted-foreground">HYPE</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {performances.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No games played yet</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}