import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Badge } from '@ui/badge';
import { ScrollArea } from '@ui/scroll-area';
import { Clock, Hash } from 'lucide-react';
import { DecisionHistoryEntry } from '@game/engine/games/poker/PokerGameManager';
import { formatChips, getCardColor, getCardDisplayValue } from '@game/engine/games/poker/utils/poker-helpers';
import { Card as PokerCard } from '@game/engine/games/poker/PokerTypes';

// Extended interface to support both poker and reverse hangman
interface FlexibleDecisionHistoryEntry extends Partial<DecisionHistoryEntry> {
  handNumber?: number;
  roundNumber?: number;
  playerId: string;
  playerName: string;
  gamePhase: string;
  decision: any;
  timestamp: number;
  playerCards?: string[];
  communityCards?: string[];
}

interface DecisionHistoryProps {
  history: FlexibleDecisionHistoryEntry[];
  currentHandNumber: number;
}

export function DecisionHistory({ history, currentHandNumber }: DecisionHistoryProps) {
  // Group by hand number (poker) or round number (reverse hangman)
  const handGroups = history.reduce((acc, entry) => {
    // Support both handNumber (poker) and roundNumber (reverse hangman)
    const groupKey = entry.handNumber ?? entry.roundNumber ?? 1;
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(entry);
    return acc;
  }, {} as Record<number, FlexibleDecisionHistoryEntry[]>);

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
            Round #{currentHandNumber}
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
              {sortedHandNumbers.map(handNumber => {
                const groupEntries = handGroups[handNumber];
                // Add null check to prevent slice() crash
                if (!groupEntries || !Array.isArray(groupEntries)) {
                  return null;
                }
                
                return (
                  <div key={handNumber} className="space-y-3">
                    <div className="flex items-center gap-2 sticky top-0 bg-background py-2">
                      <Hash className="h-4 w-4" />
                      <h3 className="font-semibold">
                        Round {handNumber}
                        {handNumber === currentHandNumber && (
                          <Badge className="ml-2" variant="default">Current</Badge>
                        )}
                      </h3>
                    </div>
                    
                    {groupEntries.slice().reverse().map((entry, idx) => {
                       // Use either handNumber (poker) or roundNumber (reverse hangman) for key
                       const entryKey = entry.handNumber ?? entry.roundNumber ?? handNumber;
                       return (
                         <div
                           key={`${entryKey}-${entry.playerId}-${idx}`}
                           className="bg-muted/50 rounded-lg p-3 space-y-2"
                         >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{entry.playerName}</span>
                          <Badge variant="outline" className="text-xs">
                            {entry.gamePhase}
                          </Badge>
                        </div>
                        
                        {entry.decision?.action && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm">Action:</span>
                            <Badge variant="secondary">
                              {entry.decision.action.type ? 
                                entry.decision.action.type.toUpperCase() : 
                                'UNKNOWN'}
                              {entry.decision.action.amount && ` $${entry.decision.action.amount}`}
                            </Badge>
                          </div>
                        )}
                        
                        {/* Guess display - For reverse hangman games */}
                        {entry.decision?.action?.guess && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm">Guess:</span>
                            <Badge variant="outline" className="max-w-xs truncate">
                              {entry.decision.action.guess}
                            </Badge>
                          </div>
                        )}
                        
                        {/* Player Cards - Only for poker games */}
                        {entry.playerCards && entry.playerCards.length > 0 && (
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
                        )}
                        
                        {/* Community Cards - Only for poker games */}
                        {entry.communityCards && entry.communityCards.length > 0 && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground font-semibold">Board:</span>
                            <div className="flex gap-1">
                              {entry.communityCards.map((card, cardIdx) => {
                                const { rank, suit } = getCardDisplayValue(card as PokerCard);
                                const color = getCardColor(card as PokerCard);
                                return (
                                  <div
                                    key={cardIdx}
                                    className="w-8 h-10 bg-white rounded border-2 border-gray-300 flex items-center justify-center text-xs font-bold shadow-sm"
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
                        
                        {entry.decision && entry.decision.reasoning && 
                          entry.decision.reasoning !== 'AI reasoning not available' && 
                          entry.decision.reasoning.trim() !== '' && (
                           <details className="cursor-pointer">
                             <summary className="text-xs text-muted-foreground hover:text-foreground">
                               View reasoning...
                             </summary>
                             <div className="mt-2 p-2 bg-background rounded text-xs whitespace-pre-wrap">
                               {entry.decision.reasoning}
                             </div>
                           </details>
                         )}
                      </div>
                    );
                  })}
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