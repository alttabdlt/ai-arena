import type { IGameDecision as AIDecision, Card as PokerCard, PokerPhase, PokerPlayer } from '@game/shared/types';
import {
    formatChips,
    getCardColor,
    getCardDisplayValue,
    getPhaseDisplayName,
    getPlayerPosition,
    getPlayerStatusColor,
    shouldShowCard
} from '@game/shared/utils/poker-helpers';
import { Badge } from '@ui/badge';
import { Button } from '@ui/button';
import { Card, CardContent } from '@ui/card';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@ui/tooltip';
import { Eye, Zap } from 'lucide-react';
import React, { useEffect, useState } from 'react';

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
  dealerPosition?: number | null;
  smallBlindPosition?: number | null;
  bigBlindPosition?: number | null;
}

function getActionAmount(action: AIDecision['action']): number | undefined {
  const actionPayload = action as unknown as { amount?: number; data?: { amount?: number } };
  if (typeof actionPayload?.amount === 'number') return actionPayload.amount;
  if (typeof actionPayload?.data?.amount === 'number') return actionPayload.data.amount;
  return undefined;
}

function getActionType(action: unknown): string | undefined {
  if (typeof action === 'string') return action;
  if (!action || typeof action !== 'object') return undefined;
  const actionPayload = action as { type?: unknown };
  return typeof actionPayload.type === 'string' ? actionPayload.type : undefined;
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
  getPlayerPoints,
  dealerPosition = null,
  smallBlindPosition = null,
  bigBlindPosition = null
}) => {
  const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null);
  const [revealedCommunityCount, setRevealedCommunityCount] = useState(0);
  const [flipShowdown, setFlipShowdown] = useState(false);

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

  // Sequentially reveal community cards with flip animation
  useEffect(() => {
    // Reset on new hand
    if ((phase === 'waiting' || phase === 'preflop') && communityCards.length === 0) {
      setRevealedCommunityCount(0);
      setFlipShowdown(false);
      return;
    }

    if (communityCards.length > revealedCommunityCount) {
      let i = revealedCommunityCount;
      const interval = setInterval(() => {
        i += 1;
        setRevealedCommunityCount(i);
        if (i >= communityCards.length) clearInterval(interval);
      }, 250); // flip each ~250ms
      return () => clearInterval(interval);
    }
    // If cards decreased (new hand), clamp
    if (communityCards.length < revealedCommunityCount) {
      setRevealedCommunityCount(communityCards.length);
    }
  }, [communityCards, phase, revealedCommunityCount]);

  // Trigger flip for hole cards at showdown
  useEffect(() => {
    if (phase === 'showdown') {
      setFlipShowdown(true);
    }
  }, [phase]);

  return (
    <div className="poker-table-container relative bg-green-800 dark:bg-green-900 rounded-lg p-4 min-h-[500px] overflow-hidden">
      <div className="absolute inset-8 bg-green-700 dark:bg-green-800 rounded-full opacity-50"></div>
      
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="text-center mb-4">
          <div className="text-white text-base font-medium mb-2">
            Pot: {formatChips(pot)} chips
          </div>
          <div className="flex gap-2 justify-center">
            {[0, 1, 2, 3, 4].map((index) => {
              const card = communityCards[index];
              const shouldReveal = index < revealedCommunityCount && !!card;
              const { rank, suit } = card ? getCardDisplayValue(card) : { rank: '', suit: '' };
              const color = card ? getCardColor(card) : 'black';
              return (
                <div key={index} className="card-flip w-10 h-14">
                  <div className={`card-inner ${shouldReveal ? 'is-flipped' : ''}`}>
                    {/* Back */}
                    <div className="card-face card-back w-10 h-14 bg-blue-800 rounded border-2 border-blue-600 shadow-lg" />
                    {/* Front */}
                    <div className="card-face card-front w-10 h-14 bg-white rounded border border-gray-300 flex items-center justify-center font-medium shadow-sm">
                      <span className={`text-sm ${color === 'red' ? 'text-red-600' : 'text-black'}`}>
                        {rank}{suit}
                      </span>
                    </div>
                  </div>
                </div>
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

      {players.map((player, index) => {
        const isCurrentPlayer = currentPlayer?.id === player.id;
        const hasWon = winners.some(w => w.playerId === player.id);
        const isThinking = currentAIThinking === player.id;
        const position = getPlayerPosition(index, players.length);
        const aiDecision = aiDecisionHistory?.get(player.id);
        const isDealer = dealerPosition === index;
        const isSB = smallBlindPosition === index;
        const isBB = bigBlindPosition === index;
        
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
                          <div className="flex items-center gap-2 mb-1">
                            <img 
                              src={player.avatar || '/default-bot-avatar.png'} 
                              alt={player.name}
                              className="w-8 h-8 rounded-full"
                            />
                            <div className="flex-1 min-w-0">
                          <div className="font-semibold text-xs truncate flex items-center gap-1">
                            {isDealer && <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-yellow-400 text-[10px] text-black font-bold">D</span>}
                            {isSB && <span className="px-1 rounded bg-blue-600 text-white text-[10px]">SB</span>}
                            {isBB && <span className="px-1 rounded bg-red-600 text-white text-[10px]">BB</span>}
                            <span className="truncate">{player.name}</span>
                          </div>
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
                          
                          <div className="flex gap-0.5 mb-1 justify-center">
                            {player.cards && player.cards.length > 0 && player.cards.map((card, cardIndex) => {
                              const { rank, suit } = getCardDisplayValue(card);
                              const color = getCardColor(card);
                              return (
                                <div key={cardIndex} className="card-flip w-6 h-8">
                                  <div className={`card-inner is-flipped`}>
                                    <div className="card-face card-back w-6 h-8 bg-blue-800 rounded border border-blue-600 shadow-sm" />
                                    <div className="card-face card-front w-6 h-8 bg-white rounded border flex items-center justify-center text-[10px] font-bold shadow-sm">
                                      <span className={color === 'red' ? 'text-red-600' : 'text-black'}>
                                        {rank}{suit}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          <div className="text-center">
                            {player.folded ? (
                              <span className="text-xs text-muted-foreground">Folded</span>
                            ) : player.allIn ? (
                              <span className="text-xs text-red-400 font-semibold">All-In</span>
                            ) : aiDecision ? (
                              <span className="text-xs font-medium">
                                {(() => {
                                  const type = getActionType(aiDecision.action);
                                  const amt = getActionAmount(aiDecision.action);
                                  if (type === 'check') return 'Check';
                                  if (type === 'call') return 'Call';
                                  if (type === 'raise') return amt !== undefined ? `Raise $${amt}` : 'Raise';
                                  if (type === 'bet') return amt !== undefined ? `Bet $${amt}` : 'Bet';
                                  if (type === 'all-in') return 'All-In';
                                  return type;
                                })()}
                              </span>
                            ) : player.bet > 0 ? (
                              <span className="text-xs text-yellow-400">Bet ${formatChips(player.bet)}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Waiting</span>
                            )}
                          </div>
                          
                          {hasWon && (
                            <div className="mt-1 text-[10px] text-yellow-400 font-bold text-center">
                              Won ${formatChips(winners.find(w => w.playerId === player.id)?.amount || 0)}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TooltipTrigger>
                  { player.isAI && aiDecision && (
                    <TooltipContent side="top" className="max-w-lg p-0 border-0">
                      <div className="bg-background/95 backdrop-blur border rounded-lg shadow-lg max-h-96 overflow-hidden">
                        <div className="sticky top-0 bg-background border-b px-4 py-3">
                          <div className="font-semibold text-lg">{player.name}'s Thinking</div>
                          <div className="text-xs text-muted-foreground">AI Analysis</div>
                        </div>
                        <div className="overflow-y-auto max-h-80 px-4 py-3 space-y-3">
                          <div className="font-medium text-sm">
                            Action: {(() => {
                              const type = getActionType(aiDecision.action);
                              return type ? type.toUpperCase() : '';
                            })()}
                            {(() => {
                              const amt = getActionAmount(aiDecision.action);
                              return amt ? ` $${amt}` : '';
                            })()}
                          </div>
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Reasoning:</div>
                            <div className="text-sm whitespace-pre-wrap">{aiDecision.reasoning}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Confidence:</span>
                            <div className="flex-1 bg-secondary rounded-full h-2">
                              <div 
                                className="bg-primary h-2 rounded-full transition-all duration-300"
                                style={{ width: `${((aiDecision.confidence || 0) * 100).toFixed(0)}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{((aiDecision.confidence || 0) * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            );
      })}

      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
        <div className="text-white text-sm opacity-85">
          {getPhaseDisplayName(phase)}
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="destructive" className="animate-pulse">LIVE</Badge>
          <div className="flex items-center text-sm text-white opacity-75">
            <Eye className="h-4 w-4 mr-1" />
            {viewers}
          </div>
        </div>
      </div>
    </div>
  );
};
