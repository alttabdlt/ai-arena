import { Button } from '@ui/button';
import { Badge } from '@ui/badge';
import { Trophy, Users, Eye, Activity, ArrowLeft } from 'lucide-react';

interface GameHeaderProps {
  tournamentName: string;
  matchId: string;
  totalPrize?: number;
  playerCount: number;
  viewerCount: number;
  currentRound: string;
  gameType: string;
  status: 'waiting' | 'in-progress' | 'completed';
  onBack: () => void;
}

export function GameHeader({
  tournamentName,
  matchId,
  totalPrize = 1000000,
  playerCount,
  viewerCount,
  currentRound,
  gameType,
  status,
  onBack
}: GameHeaderProps) {
  const getStatusBadge = () => {
    switch (status) {
      case 'waiting':
        return <Badge variant="secondary" className="text-xs">Waiting</Badge>;
      case 'in-progress':
        return (
          <Badge variant="secondary" className="text-xs">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1" />
            Live
          </Badge>
        );
      case 'completed':
        return <Badge variant="secondary" className="text-xs">Completed</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="border-b p-3">
      <div className="container mx-auto relative">
        {/* Back button - absolute positioned */}
        <Button 
          variant="ghost" 
          onClick={onBack}
          size="sm"
          className="absolute left-0 top-1/2 -translate-y-1/2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        
        {/* Center content */}
        <div className="text-center">
          <h1 className="text-lg font-medium flex items-center justify-center gap-2">
            {tournamentName}
            {getStatusBadge()}
          </h1>
          
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mt-1">
            {totalPrize && (
              <span className="flex items-center gap-1">
                <Trophy className="h-3 w-3" />
                ${totalPrize.toLocaleString()} Prize
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {playerCount} Players
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {viewerCount} Viewers
            </span>
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              {currentRound}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}