import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Users, Clock, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface LiveMatchCardProps {
  currentMatch: {
    id: string;
    type: string;
    status: string;
    startedAt: string;
    participants: Array<{
      bot: {
        id: string;
        name: string;
        avatar?: string;
      };
    }>;
  };
  botId: string;
}

export function LiveMatchCard({ currentMatch, botId }: LiveMatchCardProps) {
  const navigate = useNavigate();

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
      default:
        return '🎮';
    }
  };

  const opponents = currentMatch.participants.filter(p => p.bot.id !== botId);

  return (
    <Card className="border-green-500/50 bg-green-950/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live Match
          </CardTitle>
          <Badge variant="outline" className="text-green-500 border-green-500">
            {currentMatch.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{getGameIcon(currentMatch.type)}</span>
              <span className="font-medium">{currentMatch.type}</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              Started {formatDistanceToNow(new Date(currentMatch.startedAt), { addSuffix: true })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Opponents:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {opponents.map((opponent) => (
                <div key={opponent.bot.id} className="flex items-center gap-2 px-3 py-1 rounded-lg bg-muted/50">
                  <span className="text-lg">{opponent.bot.avatar || '🤖'}</span>
                  <span className="text-sm font-medium">{opponent.bot.name}</span>
                </div>
              ))}
            </div>
          </div>

          <Button 
            className="w-full btn-gaming"
            onClick={() => navigate(`/tournament/${currentMatch.id}`)}
          >
            <Play className="mr-2 h-4 w-4" />
            Watch Live Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}