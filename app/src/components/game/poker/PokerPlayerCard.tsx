import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Zap } from 'lucide-react';
import { formatChips, getCardColor, getCardDisplayValue } from '@/game-engine/games/poker/utils/poker-helpers';
import type { PokerPlayer, Card as PokerCard } from '@/game-engine/games/poker/PokerTypes';
import type { IGameDecision as AIDecision } from '@/game-engine/core/interfaces';
import type { PokerAction } from '@/game-engine/games/poker';

interface PokerPlayerCardProps {
  player: PokerPlayer;
  isCurrentPlayer: boolean;
  hasWon: boolean;
  isThinking: boolean;
  winAmount?: number;
  aiDecision?: AIDecision | null;
  playerPoints?: { total: number; base: number; style: number; penalty: number } | null;
  showCards: boolean;
  phase: string;
  className?: string;
  compact?: boolean;
}

export const PokerPlayerCard: React.FC<PokerPlayerCardProps> = ({
  player,
  isCurrentPlayer,
  hasWon,
  isThinking,
  winAmount,
  aiDecision,
  playerPoints,
  showCards,
  phase,
  className = '',
  compact = false
}) => {
  const getStatusColor = () => {
    if (hasWon) return 'border-yellow-400 shadow-yellow-400/50 shadow-lg';
    if (player.folded) return 'opacity-50 grayscale';
    if (player.allIn) return 'border-red-500 shadow-red-500/50';
    if (isCurrentPlayer) return 'border-green-400 shadow-green-400/50 shadow-lg animate-pulse';
    return 'border-border';
  };

  const cardWidth = compact ? 'w-28' : 'w-36';

  return (
    <Card className={`${cardWidth} transition-all duration-300 ${getStatusColor()} ${className}`}>
      <CardContent className="p-2">
        {/* Header with avatar and name */}
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
            {playerPoints && playerPoints.total > 0 && (
              <div className="text-[10px] text-purple-400 font-medium">
                {playerPoints.total} pts
              </div>
            )}
          </div>
          {isThinking && (
            <Zap className="h-3 w-3 text-yellow-400 animate-pulse flex-shrink-0" />
          )}
        </div>
        
        {/* Cards Display */}
        <div className="flex gap-0.5 mb-1 justify-center">
          {player.cards && player.cards.length > 0 ? (
            player.cards.map((card, cardIndex) => {
              if (showCards) {
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
            })
          ) : (
            // Show placeholder cards if no cards dealt yet
            <>
              <div className="w-6 h-8 bg-gray-600 rounded border border-gray-500 shadow-sm opacity-50" />
              <div className="w-6 h-8 bg-gray-600 rounded border border-gray-500 shadow-sm opacity-50" />
            </>
          )}
        </div>
        
        {/* Action Display */}
        <div className="text-center">
          {player.folded ? (
            <span className="text-xs text-muted-foreground">Folded</span>
          ) : player.allIn ? (
            <span className="text-xs text-red-400 font-semibold">All-In</span>
          ) : aiDecision ? (
            <span className="text-xs font-medium">
              {getActionDisplay(aiDecision)}
            </span>
          ) : player.bet > 0 ? (
            <span className="text-xs text-yellow-400">Bet ${formatChips(player.bet)}</span>
          ) : (
            <span className="text-xs text-muted-foreground">Waiting</span>
          )}
        </div>
        
        {/* Winner Display */}
        {hasWon && winAmount !== undefined && (
          <div className="mt-1 text-[10px] text-yellow-400 font-bold text-center">
            Won ${formatChips(winAmount)}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

function getActionDisplay(aiDecision: AIDecision): string {
  const action = aiDecision.action;
  switch (action.type) {
    case 'check':
      return 'Check';
    case 'call':
      return 'Call';
    case 'raise':
      return `Raise $${(action as PokerAction).amount || 0}`;
    case 'bet':
      return `Bet $${(action as PokerAction).amount || 0}`;
    case 'all-in':
      return 'All-In';
    case 'fold':
      return 'Fold';
    default:
      return action.type;
  }
}