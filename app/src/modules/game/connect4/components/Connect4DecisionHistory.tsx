import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Badge } from '@ui/badge';
import { ScrollArea } from '@ui/scroll-area';
import { Brain, Clock, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface Connect4Decision {
  playerId: string;
  playerName: string;
  playerColor: 'red' | 'yellow';
  column: number;
  reasoning: string;
  confidence: number;
  timestamp: Date;
  moveNumber: number;
}

interface Connect4DecisionHistoryProps {
  decisions: Connect4Decision[];
  currentMoveNumber: number;
}

export function Connect4DecisionHistory({ decisions, currentMoveNumber }: Connect4DecisionHistoryProps) {
  // Sort decisions by move number (most recent first)
  const sortedDecisions = [...decisions].sort((a, b) => b.moveNumber - a.moveNumber);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Decision History
          </span>
          <Badge variant="outline">
            Move #{currentMoveNumber}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {sortedDecisions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No moves yet. AI reasoning will appear here.
            </div>
          ) : (
            <div className="space-y-4">
              {sortedDecisions.map((decision, index) => {
                const isFallback = decision.confidence <= 0.1 || decision.reasoning.toLowerCase().includes('fallback');
                
                return (
                  <div 
                    key={`${decision.moveNumber}-${decision.playerId}`}
                    className={`border rounded-lg p-4 space-y-2 ${isFallback ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className={`w-4 h-4 rounded-full ${
                            decision.playerColor === 'red' ? 'bg-red-500' : 'bg-yellow-500'
                          }`} 
                        />
                        <span className="font-semibold">{decision.playerName}</span>
                        <Badge variant="secondary">Move {decision.moveNumber}</Badge>
                        {isFallback && (
                          <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Fallback</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(decision.timestamp, { addSuffix: true })}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Column {decision.column + 1}</span>
                      <Badge 
                        variant={decision.confidence > 0.8 ? 'default' : decision.confidence > 0.5 ? 'secondary' : isFallback ? 'destructive' : 'outline'}
                        className="text-xs"
                      >
                        {Math.round(decision.confidence * 100)}% confident
                      </Badge>
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      <p className="italic">"{decision.reasoning}"</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}