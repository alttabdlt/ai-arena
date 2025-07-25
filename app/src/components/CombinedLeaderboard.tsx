import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, TrendingUp, Crown, X } from 'lucide-react';
import { formatChips } from '@/game-engine/games/poker/utils/poker-helpers';

interface Player {
  id: string;
  name: string;
  avatar: string;
}

interface LeaderboardEntry {
  playerId: string;
  chipCount: number;
  basePoints: number;
  stylePoints: number;
  penaltyPoints: number;
  totalPoints: number;
  rank: number;
}

interface CombinedLeaderboardProps {
  players: Map<string, Player>;
  getPointLeaderboard: () => Array<{
    playerId: string;
    basePoints: number;
    stylePoints: number;
    penaltyPoints: number;
    totalPoints: number;
  }>;
  currentChips: Map<string, number>;
  currentHandNumber: number;
  mode: 'CLASSIC' | 'BALANCED' | 'STYLE_MASTER';
  startingChips: number;
}

export function CombinedLeaderboard({
  players,
  getPointLeaderboard,
  currentChips,
  currentHandNumber,
  mode,
  startingChips
}: CombinedLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lastUpdateHand, setLastUpdateHand] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(10);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Update every 5 hands or on first hand
    if (currentHandNumber % 5 === 0 && currentHandNumber > 0) {
      const pointLeaderboard = getPointLeaderboard();
      
      const combined = pointLeaderboard.map(entry => ({
        playerId: entry.playerId,
        chipCount: currentChips.get(entry.playerId) || 0,
        basePoints: entry.basePoints,
        stylePoints: entry.stylePoints,
        penaltyPoints: entry.penaltyPoints,
        totalPoints: entry.totalPoints,
        rank: 0
      }));

      // Sort by total points (which already factors in the mode weights)
      combined.sort((a, b) => b.totalPoints - a.totalPoints);
      
      // Assign ranks
      combined.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      setLeaderboard(combined);
      setLastUpdateHand(currentHandNumber);
      
      // Show the popup
      setIsVisible(true);
      setTimeRemaining(10);
      
      // Clear any existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      // Start countdown timer
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setIsVisible(false);
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
            return 10;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [currentHandNumber, getPointLeaderboard, currentChips]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  if (!isVisible || leaderboard.length === 0) {
    return null;
  }

  const modeDisplay = mode === 'CLASSIC' ? 'Classic (70% chips, 30% style)' :
                      mode === 'BALANCED' ? 'Balanced (50% chips, 50% style)' :
                      'Style Master (30% chips, 70% style)';

  const handleClose = () => {
    setIsVisible(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/60 pointer-events-auto" onClick={handleClose} />
      <Card className="relative z-10 w-full max-w-3xl mx-4 pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Tournament Leaderboard - Hand {currentHandNumber}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{modeDisplay}</Badge>
              <Badge variant="secondary" className="text-xs">
                Closing in {timeRemaining}s
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleClose}
                className="h-6 w-6"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
        <div className="space-y-2">
          {leaderboard.map((entry) => {
            const player = players.get(entry.playerId);
            if (!player) return null;

            const isLeader = entry.rank === 1;
            const chipPercentage = ((entry.chipCount / startingChips) * 100).toFixed(1);

            return (
              <div 
                key={entry.playerId}
                className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                  isLeader ? 'bg-primary/10 border border-primary/30' : 'bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-lg font-bold text-muted-foreground w-8">
                    #{entry.rank}
                  </div>
                  <img 
                    src={player.avatar} 
                    alt={player.name}
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{player.name}</span>
                      {isLeader && <Crown className="h-4 w-4 text-yellow-500" />}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ${formatChips(entry.chipCount)} chips ({chipPercentage}%)
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">
                    {entry.totalPoints.toLocaleString()} pts
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Base: {entry.basePoints} | Style: {entry.stylePoints} | Penalty: -{entry.penaltyPoints}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
    </div>
  );
}