import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, Zap, Shield, Target } from 'lucide-react';
import { formatChips } from '@/game-engine/games/poker/utils/poker-helpers';
// PlayerStats type is defined inline for now since it's not exported from PokerScoringSystem
interface PlayerStats {
  handsPlayed: number;
  handsWon: number;
  showdownsWon: number;
  bluffsWon: number;
  comebackWins: number;
  unconventionalWins: number;
  aggressiveActions: number;
  totalActions: number;
  biggestPotWon: number;
  totalWinnings: number;
  handMisreads: number;
  criticalMisreads: number;
  illogicalDecisions: number;
  correctHandReads: number;
}

interface LeaderboardEntry {
  playerId: string;
  chipCount: number;
  styleScore: number;
  stats: PlayerStats;
}

interface TournamentLeaderboardProps {
  leaderboard: LeaderboardEntry[];
  players: Array<{ id: string; name: string; avatar: string }>;
}

export function TournamentLeaderboard({ leaderboard, players }: TournamentLeaderboardProps) {
  const getPlayerInfo = (playerId: string) => {
    return players.find(p => p.id === playerId);
  };

  const getStyleMultiplier = (entry: LeaderboardEntry) => {
    if (entry.chipCount === 0) return 1;
    return entry.styleScore / entry.chipCount;
  };

  const getRankIcon = (position: number) => {
    switch (position) {
      case 0:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 1:
        return <Trophy className="h-5 w-5 text-gray-400" />;
      case 2:
        return <Trophy className="h-5 w-5 text-orange-600" />;
      default:
        return null;
    }
  };

  const getStyleBadges = (stats: PlayerStats) => {
    const badges = [];
    
    if (stats.unconventionalWins > 0) {
      badges.push(
        <Badge key="unconventional" variant="secondary" className="text-xs">
          <Zap className="h-3 w-3 mr-1" />
          {stats.unconventionalWins} Unconventional
        </Badge>
      );
    }
    
    if (stats.bluffsWon > 0) {
      badges.push(
        <Badge key="bluff" variant="secondary" className="text-xs">
          <Shield className="h-3 w-3 mr-1" />
          {stats.bluffsWon} Bluffs
        </Badge>
      );
    }
    
    if (stats.comebackWins > 0) {
      badges.push(
        <Badge key="comeback" variant="secondary" className="text-xs">
          <TrendingUp className="h-3 w-3 mr-1" />
          {stats.comebackWins} Comebacks
        </Badge>
      );
    }

    const participationRate = stats.totalActions > 0 
      ? (stats.handsPlayed / stats.totalActions * 100).toFixed(0) 
      : 0;
    
    if (Number(participationRate) > 60) {
      badges.push(
        <Badge key="active" variant="secondary" className="text-xs">
          <Target className="h-3 w-3 mr-1" />
          Active Player
        </Badge>
      );
    }
    
    return badges;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Tournament Leaderboard
          </span>
          <Badge variant="outline">Style-Adjusted Scores</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {leaderboard.map((entry, index) => {
            const player = getPlayerInfo(entry.playerId);
            const multiplier = getStyleMultiplier(entry);
            
            if (!player) return null;
            
            return (
              <div 
                key={entry.playerId} 
                className={`flex items-center justify-between p-3 rounded-lg ${
                  index === 0 ? 'bg-yellow-500/10 border border-yellow-500/20' :
                  index === 1 ? 'bg-gray-500/10 border border-gray-500/20' :
                  index === 2 ? 'bg-orange-500/10 border border-orange-500/20' :
                  'bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8">
                    {getRankIcon(index) || <span className="text-lg font-bold text-muted-foreground">{index + 1}</span>}
                  </div>
                  <img 
                    src={player.avatar} 
                    alt={player.name}
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <div className="font-semibold">{player.name}</div>
                    <div className="text-sm text-muted-foreground">
                      ${formatChips(entry.chipCount)} chips
                      {multiplier > 1 && (
                        <span className="text-green-500 ml-1">
                          ×{multiplier.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-lg font-bold">
                    ${formatChips(entry.styleScore)}
                  </div>
                  <div className="flex gap-1 justify-end mt-1">
                    {getStyleBadges(entry.stats).slice(0, 2)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {leaderboard.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No players yet. Start a game to see the leaderboard!
          </div>
        )}
      </CardContent>
    </Card>
  );
}