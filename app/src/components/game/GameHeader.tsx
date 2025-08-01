import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
        return <Badge className="bg-yellow-900 text-yellow-100">Waiting</Badge>;
      case 'in-progress':
        return <Badge className="bg-green-900 text-green-100">Live</Badge>;
      case 'completed':
        return <Badge className="bg-gray-700 text-gray-100">Completed</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-800 border-b border-gray-700 p-4">
      <div className="container mx-auto relative">
        {/* Back button - absolute positioned */}
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="text-gray-400 hover:text-white absolute left-0 top-1/2 -translate-y-1/2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        
        {/* Center content */}
        <div className="text-center">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            {tournamentName}
            {getStatusBadge()}
          </h1>
          
          <div className="flex items-center justify-center gap-6 text-sm text-gray-400 mt-2">
            {totalPrize && (
              <span className="flex items-center gap-1">
                <Trophy className="h-4 w-4" />
                ${totalPrize.toLocaleString()} Prize Pool
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {playerCount} Players
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              {viewerCount} Viewers
            </span>
            <span className="flex items-center gap-1">
              <Activity className="h-4 w-4" />
              {currentRound}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}