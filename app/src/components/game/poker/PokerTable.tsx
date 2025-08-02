import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Eye, Play, Zap } from 'lucide-react';
import { 
  formatChips, 
  getPhaseDisplayName,
  shouldShowCard,
  getCardDisplayValue,
  getCardColor,
  getPlayerPosition,
  getPlayerStatusColor
} from '@/game-engine/games/poker/utils/poker-helpers';
import type { PokerPlayer, Card as PokerCard, PokerPhase } from '@/game-engine/games/poker/PokerTypes';
import type { IGameDecision as AIDecision } from '@/game-engine/core/interfaces';
import type { PokerAction } from '@/game-engine/games/poker';

interface PokerTableProps {
  players: PokerPlayer[];
  communityCards: PokerCard[];
  pot: number;
  currentBet: number;
  phase: PokerPhase;
  currentPlayer: PokerPlayer | null;
  winners: Array<{ playerId: string; amount: number }>;
  isHandComplete: boolean;
  currentAIThinking: string | null;
  aiDecisionHistory: Map<string, AIDecision>;
  onStartNewHand: () => void;
  viewers?: number;
  getPlayerPoints?: (playerId: string) => { total: number; base: number; style: number; penalty: number } | null;
}

export const PokerTable: React.FC<PokerTableProps> = ({
  players,
  communityCards,
  pot,
  currentBet,
  phase,
  currentPlayer,
  winners,
  isHandComplete,
  currentAIThinking,
  aiDecisionHistory,
  onStartNewHand,
  viewers = 0,
  getPlayerPoints
}) => {
  const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null);

  // Debug logging
  useEffect(() => {
    if (communityCards.length > 0 || phase === 'flop' || phase === 'turn' || phase === 'river') {
      console.log('🎴 [PokerTable] Rendering with:', {
        phase,
        communityCards,
        communityCardsLength: communityCards.length,
        pot
      });
    }
  }, [communityCards, phase, pot]);

  return (
    <Card>
      <CardContent>
        <div className="poker-table-container relative bg-gradient-to-br from-green-800 to-green-900 rounded-xl p-4 min-h-[600px] overflow-hidden">
          {/* Poker Table Felt */}
          <div className="absolute inset-8 bg-green-700 rounded-full opacity-90 shadow-inner"></div>
          
          {/* Community Cards */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="text-center mb-4">
              <div className="text-white text-lg font-bold mb-2">
                Pot: {formatChips(pot)} chips
              </div>
              <div className="flex gap-2 justify-center">
                {[0, 1, 2, 3, 4].map((index) => {
                  const card = communityCards[index];
                  const showCard = shouldShowCard(index, phase, communityCards.length);
                  
                  if (showCard && card) {
                    const { rank, suit } = getCardDisplayValue(card);
                    const color = getCardColor(card);
                    return (
                      <div
                        key={index}
                        className="w-12 h-16 bg-white rounded border-2 border-gray-300 flex items-center justify-center font-bold shadow-lg transition-all duration-500"
                      >
                        <span className={`text-lg ${color === 'red' ? 'text-red-600' : 'text-black'}`}>
                          {rank}{suit}
                        </span>
                      </div>
                    );
                  }
                  
                  return (
                    <div
                      key={index}
                      className="w-12 h-16 bg-blue-800 rounded border-2 border-blue-600 shadow-lg opacity-50"
                    />
                  );
                })}
              </div>
              <div className="text-green-200 text-sm mt-2">
                {getPhaseDisplayName(phase)}
              </div>
              {currentBet > 0 && (
                <div className="text-yellow-300 text-sm mt-1">
                  Current Bet: {formatChips(currentBet)} chips
                </div>
              )}
            </div>
          </div>

          {/* Players */}
          {players.map((player, index) => {
            const isCurrentPlayer = currentPlayer?.id === player.id;
            const hasWon = winners.some(w => w.playerId === player.id);
            const isThinking = currentAIThinking === player.id;
            const position = getPlayerPosition(index, players.length);
            const aiDecision = aiDecisionHistory?.get(player.id);
            
            return (
              <TooltipProvider key={player.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`absolute ${position} z-20`}
                      onMouseEnter={() => setHoveredPlayerId(player.id)}
                      onMouseLeave={() => setHoveredPlayerId(null)}
                    >
                      <Card className={`${
                        players.length > 6 ? 'w-28' : 
                        players.length > 4 ? 'w-32' : 'w-36'
                      } transition-all duration-300 ${
                        getPlayerStatusColor(isCurrentPlayer, player.folded, player.allIn, hasWon)
                      }`}>
                        <CardContent className="p-2">
                          {/* Compact header with avatar and name */}
                          <div className="flex items-center gap-2 mb-1">
                            <img 
                              src={player.avatar} 
                              alt={player.name}
                              className="w-8 h-8 rounded-full"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-xs truncate">{player.name}</div>
                              <div className="text-xs text-muted-foreground">
                                ${formatChips(player.chips)}
                              </div>
                              {(() => {
                                const playerPoints = getPlayerPoints?.(player.id);
                                if (playerPoints && playerPoints.total > 0) {
                                  return (
                                    <div className="text-[10px] text-purple-400 font-medium">
                                      {playerPoints.total} pts
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                            {isThinking && (
                              <Zap className="h-3 w-3 text-yellow-400 animate-pulse flex-shrink-0" />
                            )}
                          </div>
                          
                          {/* Compact Cards */}
                          <div className="flex gap-0.5 mb-1 justify-center">
                            {player.cards && player.cards.length > 0 && player.cards.map((card, cardIndex) => {
                              const showCard = phase === 'showdown' || !player.isAI || hoveredPlayerId === player.id;
                              if (showCard) {
                                const { rank, suit } = getCardDisplayValue(card);
                                const color = getCardColor(card);
                                return (
                                  <div
                                    key={cardIndex}
                                    className="w-6 h-8 bg-white rounded border flex items-center justify-center text-[10px] font-bold shadow-sm"
                                  >
                                    <span className={color === 'red' ? 'text-red-600' : 'text-black'}>
                                      {rank}{suit}
                                    </span>
                                  </div>
                                );
                              }
                              return (
                                <div
                                  key={cardIndex}
                                  className="w-6 h-8 bg-blue-800 rounded border border-blue-600 shadow-sm"
                                />
                              );
                            })}
                          </div>
                          
                          {/* Action display */}
                          <div className="text-center">
                            {player.folded ? (
                              <span className="text-xs text-muted-foreground">Folded</span>
                            ) : player.allIn ? (
                              <span className="text-xs text-red-400 font-semibold">All-In</span>
                            ) : aiDecision ? (
                              <span className="text-xs font-medium">
                                {aiDecision.action.type === 'check' ? 'Check' :
                                 aiDecision.action.type === 'call' ? 'Call' :
                                 aiDecision.action.type === 'raise' ? ((aiDecision.action as PokerAction).amount !== undefined ? `Raise $${(aiDecision.action as PokerAction).amount}` : 'Raise') :
                                 aiDecision.action.type === 'bet' ? ((aiDecision.action as PokerAction).amount !== undefined ? `Bet $${(aiDecision.action as PokerAction).amount}` : 'Bet') :
                                 aiDecision.action.type === 'all-in' ? 'All-In' :
                                 aiDecision.action.type}
                              </span>
                            ) : player.bet > 0 ? (
                              <span className="text-xs text-yellow-400">Bet ${formatChips(player.bet)}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Waiting</span>
                            )}
                          </div>
                          
                          {/* Winner display */}
                          {hasWon && (
                            <div className="mt-1 text-[10px] text-yellow-400 font-bold text-center">
                              Won ${formatChips(winners.find(w => w.playerId === player.id)?.amount || 0)}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TooltipTrigger>
                  {player.isAI && aiDecision && (
                    <TooltipContent side="top" className="max-w-lg p-0 border-0">
                      <div className="bg-background/95 backdrop-blur border rounded-lg shadow-lg max-h-96 overflow-hidden">
                        <div className="sticky top-0 bg-background border-b px-4 py-3">
                          <div className="font-semibold text-lg">{player.name}'s Thinking</div>
                          <div className="text-xs text-muted-foreground">
                            {aiDecision.metadata?.personality || 'AI Analysis'}
                          </div>
                        </div>
                        <div className="overflow-y-auto max-h-80 px-4 py-3 space-y-3">
                          {/* Action Taken */}
                          <div className="font-medium text-sm">
                            Action: {aiDecision.action.type.toUpperCase()}
                            {(aiDecision.action as PokerAction).amount && ` $${(aiDecision.action as PokerAction).amount}`}
                          </div>
                          
                          {/* Main Reasoning */}
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Reasoning:</div>
                            <div className="text-sm whitespace-pre-wrap">{aiDecision.reasoning}</div>
                          </div>
                          
                          {/* Confidence Level */}
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Confidence:</span>
                            <div className="flex-1 bg-secondary rounded-full h-2">
                              <div 
                                className="bg-primary h-2 rounded-full transition-all duration-300"
                                style={{ width: `${(aiDecision.confidence * 100).toFixed(0)}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{(aiDecision.confidence * 100).toFixed(0)}%</span>
                          </div>
                          
                          {/* Detailed Analysis if available */}
                          {aiDecision.metadata && (
                            <>
                              <div className="border-t pt-3 space-y-2">
                                <div className="text-sm font-medium">Detailed Analysis:</div>
                                
                                {/* Hand Evaluation */}
                                {aiDecision.metadata.cardEvaluation && (
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">Hand: </span>
                                    {aiDecision.metadata.cardEvaluation}
                                  </div>
                                )}
                                
                                {/* Mathematical Breakdown */}
                                {aiDecision.metadata.mathBreakdown && (
                                  <div className="text-sm whitespace-pre-wrap">
                                    <span className="text-muted-foreground">Math: </span>
                                    {aiDecision.metadata.mathBreakdown}
                                  </div>
                                )}
                                
                                {/* Bluffing Status */}
                                {aiDecision.metadata.isBluffing !== undefined && (
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">Bluffing: </span>
                                    <span className={aiDecision.metadata.isBluffing ? 'text-orange-500' : 'text-green-500'}>
                                      {aiDecision.metadata.isBluffing ? 'Yes - Attempting to deceive' : 'No - Playing honestly'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                          
                          {/* Model Info */}
                          <div className="border-t pt-3 text-xs text-muted-foreground">
                            {aiDecision.metadata?.modelUsed ? `Powered by ${aiDecision.metadata.modelUsed}` : 'Using fallback logic'}
                          </div>
                        </div>
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            );
          })}

          {/* Game Info Overlay */}
          <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
            <div className="text-white">
              <div className="text-sm opacity-75">
                {phase !== 'waiting' ? getPhaseDisplayName(phase) : 'Ready to Start'}
              </div>
              {isHandComplete && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onStartNewHand}
                  className="mt-2"
                >
                  Start New Hand
                </Button>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="destructive" className="animate-pulse">
                LIVE
              </Badge>
              <div className="flex items-center text-sm text-white opacity-75">
                <Eye className="h-4 w-4 mr-1" />
                {viewers}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};