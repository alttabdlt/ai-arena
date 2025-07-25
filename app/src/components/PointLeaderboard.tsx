import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatChips } from '@/game-engine/games/poker/utils/poker-helpers';

interface PointLeaderboardProps {
  leaderboard: Array<{
    playerId: string;
    totalPoints: number;
    basePoints: number;
    stylePoints: number;
    penaltyPoints: number;
  }>;
  players: Map<string, { name: string; avatar: string }>;
  currentMode: string;
}

export function PointLeaderboard({ leaderboard, players, currentMode }: PointLeaderboardProps) {
  const sortedLeaderboard = [...leaderboard].sort((a, b) => b.totalPoints - a.totalPoints);
  
  const getPositionIcon = (position: number) => {
    if (position === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (position === 1) return <Trophy className="h-5 w-5 text-gray-400" />;
    if (position === 2) return <Trophy className="h-5 w-5 text-orange-600" />;
    return null;
  };
  
  const getTrendIcon = (points: number) => {
    if (points > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (points < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Point Standings</span>
          <span className="text-sm font-normal text-muted-foreground">
            Mode: {currentMode}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedLeaderboard.map((entry, index) => {
            const player = players.get(entry.playerId);
            if (!player) return null;
            
            return (
              <div key={entry.playerId} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors">
                {/* Position */}
                <div className="w-8 text-center font-bold text-lg">
                  {getPositionIcon(index) || `#${index + 1}`}
                </div>
                
                {/* Player Info */}
                <div className="flex items-center gap-2 flex-1">
                  <img 
                    src={player.avatar} 
                    alt={player.name}
                    className="w-8 h-8 rounded-full"
                  />
                  <span className="font-medium">{player.name}</span>
                </div>
                
                {/* Points Breakdown */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Base:</span>
                    <span className="font-medium">{entry.basePoints}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Style:</span>
                    <span className="font-medium text-purple-500">+{entry.stylePoints}</span>
                  </div>
                  {entry.penaltyPoints > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Penalty:</span>
                      <span className="font-medium text-red-500">-{entry.penaltyPoints}</span>
                    </div>
                  )}
                </div>
                
                {/* Total Points */}
                <div className="flex items-center gap-2">
                  {getTrendIcon(entry.totalPoints)}
                  <span className="font-bold text-lg min-w-[80px] text-right">
                    {entry.totalPoints.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        
        {sortedLeaderboard.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No points awarded yet. Start playing to earn points!
          </div>
        )}
      </CardContent>
    </Card>
  );
}