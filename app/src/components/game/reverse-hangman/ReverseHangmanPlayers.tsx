import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Zap, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReverseHangmanPlayer } from '@/game-engine/games/reverse-hangman/ReverseHangmanTypes';

interface ReverseHangmanPlayersProps {
  players: ReverseHangmanPlayer[];
  currentTurn: string;
  isAIThinking?: boolean;
  currentAgent?: { id: string; name: string };
}

export const ReverseHangmanPlayers: React.FC<ReverseHangmanPlayersProps> = ({
  players,
  currentTurn,
  isAIThinking,
  currentAgent
}) => {
  const getAvatarUrl = (avatarId: string): string => {
    const avatarMap: Record<string, string> = {
      'bot-1': '🤖',
      'bot-2': '🦾',
      'bot-3': '🛡️',
      'bot-aggressive': '🔥',
      'bot-defensive': '🛡️',
      'bot-strategic': '🧠',
      'bot-balanced': '⚖️',
      'bot-pattern': '🎯',
      'bot-creative': '🎨',
      'bot-chaotic': '🌀',
      'bot-zen-master': '🧘',
      'bot-calculator': '🧮',
      'bot-trickster': '🃏'
    };
    return avatarMap[avatarId] || '🤖';
  };

  return (
    <div className="w-full">
      {/* Simple horizontal grid layout */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {players.map((player, index) => {
          const isCurrentPlayer = currentTurn === player.id;
          const isThinking = isAIThinking && currentAgent?.id === player.id;

          return (
            <Card 
              key={player.id}
              className={cn(
                "w-full transition-all duration-200",
                isCurrentPlayer && "ring-2 ring-yellow-500 shadow-lg shadow-yellow-500/20",
                isThinking && "animate-pulse"
              )}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="text-lg">
                      {getAvatarUrl(player.avatar)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Player Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <h4 className="text-sm font-semibold truncate">
                        {player.name}
                      </h4>
                      {isThinking && (
                        <Zap className="h-3 w-3 text-yellow-500 animate-pulse" />
                      )}
                    </div>
                    
                    {/* Stats */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Trophy className="h-3 w-3" />
                        {player.roundsWon || 0}
                      </span>
                      <span>
                        Score: {player.totalScore || 0}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="mt-1">
                      {isCurrentPlayer ? (
                        <span className="text-xs text-yellow-400 font-medium">
                          {isThinking ? 'Thinking...' : 'Current Turn'}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Waiting
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Guess count for current round */}
                {player.currentRoundAttempts > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    <span className="text-xs text-muted-foreground">
                      Attempts: {player.currentRoundAttempts}/{6}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};