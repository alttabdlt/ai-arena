import { Card, CardContent } from '@ui/card';
import { Badge } from '@ui/badge';
import { Trophy, Swords } from 'lucide-react';
import { motion } from 'framer-motion';

interface TournamentMatch {
  id: string;
  player1: {
    id: string;
    name: string;
    avatar?: string;
  };
  player2: {
    id: string;
    name: string;
    avatar?: string;
  };
  winner?: string;
  status: 'pending' | 'active' | 'completed';
}

interface TournamentBracketProps {
  semifinals: [TournamentMatch, TournamentMatch];
  finals?: TournamentMatch;
  currentMatchId?: string;
}

export function TournamentBracket({ semifinals, finals, currentMatchId }: TournamentBracketProps) {
  const renderPlayer = (player: { id: string; name: string; avatar?: string }, isWinner: boolean) => (
    <div className={`flex items-center gap-2 p-2 rounded ${isWinner ? 'bg-primary/10' : ''}`}>
      <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
        {player.avatar ? (
          <img src={player.avatar} alt={player.name} className="w-full h-full rounded-full" />
        ) : (
          <span className="text-xs font-bold">{player.name[0]}</span>
        )}
      </div>
      <span className={`text-sm ${isWinner ? 'font-bold' : ''}`}>{player.name}</span>
      {isWinner && <Trophy className="h-3 w-3 text-primary" />}
    </div>
  );

  const renderMatch = (match: TournamentMatch, round: string) => {
    const isActive = match.id === currentMatchId;
    const isCompleted = match.status === 'completed';
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className={`${isActive ? 'ring-2 ring-primary' : ''} ${isCompleted ? 'opacity-75' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Badge variant={isActive ? 'default' : isCompleted ? 'secondary' : 'outline'}>
                {round}
              </Badge>
              {isActive && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Swords className="h-4 w-4 text-primary" />
                </motion.div>
              )}
            </div>
            
            <div className="space-y-2">
              {renderPlayer(match.player1, match.winner === match.player1.id)}
              <div className="text-center text-xs text-muted-foreground">VS</div>
              {renderPlayer(match.player2, match.winner === match.player2.id)}
            </div>
            
            {isActive && (
              <div className="mt-3 text-center">
                <Badge variant="destructive" className="animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
                  LIVE
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
        {/* Semi-finals */}
        <div className="space-y-4">
          <h3 className="text-center font-semibold text-muted-foreground mb-4">Semi-Finals</h3>
          {renderMatch(semifinals[0], 'Semi-Final 1')}
          {renderMatch(semifinals[1], 'Semi-Final 2')}
        </div>

        {/* Connection lines */}
        <div className="hidden lg:flex flex-col items-center justify-center h-full">
          <div className="relative w-full h-64">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path
                d="M 0 25 L 50 25 L 50 50 L 100 50"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                className="text-muted-foreground/30"
              />
              <path
                d="M 0 75 L 50 75 L 50 50 L 100 50"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                className="text-muted-foreground/30"
              />
            </svg>
          </div>
        </div>

        {/* Finals */}
        <div>
          <h3 className="text-center font-semibold text-muted-foreground mb-4">Finals</h3>
          {finals ? (
            renderMatch(finals, 'Grand Final')
          ) : (
            <Card className="opacity-50">
              <CardContent className="p-8 text-center">
                <Trophy className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Waiting for semi-final winners</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}