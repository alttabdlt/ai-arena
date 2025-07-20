import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Hash } from 'lucide-react';
import { DecisionHistoryEntry } from '@/poker/game/poker-game-manager';
import { formatChips, getCardColor, getCardDisplayValue } from '@/poker/engine/poker-helpers';
import { Card as PokerCard } from '@/poker/engine/poker-engine';

interface DecisionHistoryProps {
  history: DecisionHistoryEntry[];
  currentHandNumber: number;
}

export function DecisionHistory({ history, currentHandNumber }: DecisionHistoryProps) {
  // Group by hand number
  const handGroups = history.reduce((acc, entry) => {
    if (!acc[entry.handNumber]) {
      acc[entry.handNumber] = [];
    }
    acc[entry.handNumber].push(entry);
    return acc;
  }, {} as Record<number, DecisionHistoryEntry[]>);

  const sortedHandNumbers = Object.keys(handGroups)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Decision History
          </span>
          <Badge variant="outline">
            Hand #{currentHandNumber}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          {sortedHandNumbers.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No decisions yet. Start playing to see AI reasoning history.
            </div>
          ) : (
            <div className="space-y-6">
              {sortedHandNumbers.map(handNumber => (
                <div key={handNumber} className="space-y-3">
                  <div className="flex items-center gap-2 sticky top-0 bg-background py-2">
                    <Hash className="h-4 w-4" />
                    <h3 className="font-semibold">
                      Hand {handNumber}
                      {handNumber === currentHandNumber && (
                        <Badge className="ml-2" variant="default">Current</Badge>
                      )}
                    </h3>
                  </div>
                  
                  {handGroups[handNumber].slice().reverse().map((entry, idx) => (
                    <div
                      key={`${entry.handNumber}-${entry.playerId}-${idx}`}
                      className="bg-muted/50 rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{entry.playerName}</span>
                        <Badge variant="outline" className="text-xs">
                          {entry.gamePhase}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Action:</span>
                        <Badge variant="secondary">
                          {entry.decision.action.type.toUpperCase()}
                          {entry.decision.action.amount && ` $${entry.decision.action.amount}`}
                        </Badge>
                      </div>
                      
                      {/* Player Cards */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Hand:</span>
                        <div className="flex gap-1">
                          {entry.playerCards.map((card, cardIdx) => {
                            const { rank, suit } = getCardDisplayValue(card as PokerCard);
                            const color = getCardColor(card as PokerCard);
                            return (
                              <div
                                key={cardIdx}
                                className="w-8 h-10 bg-white rounded border flex items-center justify-center text-xs font-bold shadow-sm"
                              >
                                <span className={color === 'red' ? 'text-red-600' : 'text-black'}>
                                  {rank}{suit}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Community Cards */}
                      {entry.communityCards.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Board:</span>
                          <div className="flex gap-1">
                            {entry.communityCards.map((card, cardIdx) => {
                              const { rank, suit } = getCardDisplayValue(card as PokerCard);
                              const color = getCardColor(card as PokerCard);
                              return (
                                <div
                                  key={cardIdx}
                                  className="w-7 h-9 bg-white rounded border flex items-center justify-center text-xs font-bold shadow-sm"
                                >
                                  <span className={color === 'red' ? 'text-red-600' : 'text-black'}>
                                    {rank}{suit}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      <details className="cursor-pointer">
                        <summary className="text-xs text-muted-foreground hover:text-foreground">
                          View reasoning...
                        </summary>
                        <div className="mt-2 p-2 bg-background rounded text-xs whitespace-pre-wrap">
                          {entry.decision.reasoning}
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}