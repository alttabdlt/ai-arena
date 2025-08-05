import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TournamentPlayer } from '@shared/types/tournament';
import { Trophy, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Connect4Player {
  id: string;
  name: string;
  color: 'red' | 'yellow';
  isAI: boolean;
  aiModel?: string;
}

interface Connect4StatusProps {
  currentPlayer: Connect4Player | null;
  isAIThinking: boolean;
  winner: Connect4Player | null;
  isDraw: boolean;
  players: TournamentPlayer[];
}

export function Connect4Status({
  currentPlayer,
  isAIThinking,
  winner,
  isDraw,
  players
}: Connect4StatusProps) {
  if (winner) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center gap-2 mb-1">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="text-base font-medium">
            {winner.name} Wins!
          </h3>
        </div>
        
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <div className={cn(
            "w-3 h-3 rounded-full",
            winner.color === 'red' ? 'bg-red-500' : 'bg-yellow-500'
          )} />
          <span className="text-xs">{winner.aiModel}</span>
        </div>
      </div>
    );
  }

  if (isDraw) {
    return (
      <div className="text-center">
        <h3 className="text-base font-medium text-muted-foreground">
          It's a Draw!
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          No more moves available
        </p>
      </div>
    );
  }

  return (
    <div className="text-center">
      {currentPlayer ? (
        <div className="flex items-center justify-center gap-2">
          <div className={cn(
            "w-4 h-4 rounded-full",
            currentPlayer.color === 'red' ? 'bg-red-500' : 'bg-yellow-500'
          )} />
          <h3 className="text-sm font-medium">
            {currentPlayer.name}'s Turn
          </h3>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Waiting for game to start...
        </p>
      )}
    </div>
  );
}