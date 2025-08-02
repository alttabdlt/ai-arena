import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Badge } from '@ui/badge';
import { Button } from '@ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ui/select';
import { Trophy, Clock, Target, Users, TrendingUp, Filter } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface Match {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  participants: Array<{
    bot: {
      id: string;
      name: string;
      avatar?: string;
    };
    finalRank?: number;
    points: number;
  }>;
  winner?: {
    id: string;
    name: string;
  };
  gameHistory?: any;
}

interface MatchHistoryEnhancedProps {
  matches: Match[];
  botId: string;
  loading?: boolean;
}

export function MatchHistoryEnhanced({ matches, botId, loading = false }: MatchHistoryEnhancedProps) {
  const [filterGame, setFilterGame] = useState('all');
  const [filterResult, setFilterResult] = useState('all');
  const [showLimit, setShowLimit] = useState(10);

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

  const filteredMatches = matches.filter(match => {
    const gameTypeMatch = filterGame === 'all' || match.type.toLowerCase() === filterGame;
    const botParticipant = match.participants.find(p => p.bot.id === botId);
    const isWinner = match.winner?.id === botId;
    
    let resultMatch = true;
    if (filterResult === 'wins') {
      resultMatch = isWinner;
    } else if (filterResult === 'losses') {
      resultMatch = !isWinner && match.status === 'completed';
    } else if (filterResult === 'top3') {
      resultMatch = botParticipant?.finalRank ? botParticipant.finalRank <= 3 : false;
    }
    
    return gameTypeMatch && resultMatch;
  }).slice(0, showLimit);

  const getMatchOutcome = (match: Match) => {
    const isWinner = match.winner?.id === botId;
    const botParticipant = match.participants.find(p => p.bot.id === botId);
    const position = botParticipant?.finalRank;
    
    if (isWinner) {
      return { text: 'Victory', color: 'bg-green-500', icon: Trophy };
    } else if (position && position <= 3) {
      return { text: `#${position}`, color: 'bg-blue-500', icon: TrendingUp };
    } else if (position) {
      return { text: `#${position}`, color: 'bg-gray-500', icon: Target };
    }
    return { text: 'In Progress', color: 'bg-yellow-500', icon: Clock };
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Match History</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filterGame} onValueChange={setFilterGame}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Game" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Games</SelectItem>
                <SelectItem value="poker">Poker</SelectItem>
                <SelectItem value="connect4">Connect4</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterResult} onValueChange={setFilterResult}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="wins">Wins Only</SelectItem>
                <SelectItem value="losses">Losses Only</SelectItem>
                <SelectItem value="top3">Top 3 Finish</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {filteredMatches.map((match) => {
            const outcome = getMatchOutcome(match);
            const OutcomeIcon = outcome.icon;
            const botParticipant = match.participants.find(p => p.bot.id === botId);
            const opponents = match.participants.filter(p => p.bot.id !== botId);
            
            return (
              <div key={match.id} className="p-4 rounded-lg border bg-muted/10 hover:bg-muted/20 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getGameIcon(match.type)}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{match.type} Match</h4>
                        <Badge className={`${outcome.color} text-white`}>
                          <OutcomeIcon className="h-3 w-3 mr-1" />
                          {outcome.text}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(match.createdAt), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-lg font-bold">{botParticipant?.points || 0}</p>
                    <p className="text-xs text-muted-foreground">points</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">vs</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {opponents.map((opponent, idx) => (
                        <span key={opponent.bot.id} className="inline-flex items-center gap-1">
                          <span>{opponent.bot.avatar || '🤖'}</span>
                          <span className="font-medium">{opponent.bot.name}</span>
                          {idx < opponents.length - 1 && <span className="text-muted-foreground">,</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {match.completedAt ? formatDistanceToNow(new Date(match.completedAt), { addSuffix: false }) : 'In progress'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {match.participants.length} players
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          
          {filteredMatches.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Filter className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No matches found with current filters</p>
            </div>
          )}
          
          {filteredMatches.length > 0 && filteredMatches.length < matches.length && showLimit === 10 && (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setShowLimit(50)}
            >
              Show More
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}