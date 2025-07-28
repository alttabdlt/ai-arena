import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TournamentPlayer } from '@/types/tournament';
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
      <motion.div 
        className="text-center"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", duration: 0.5 }}
      >
        <motion.div
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0]
          }}
          transition={{ 
            duration: 0.6,
            repeat: Infinity,
            repeatDelay: 2
          }}
          className="inline-flex items-center gap-2 mb-2"
        >
          <Trophy className="h-6 w-6 text-yellow-500" />
          <h3 className="text-2xl font-bold">
            {winner.name} Wins!
          </h3>
          <Trophy className="h-6 w-6 text-yellow-500" />
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-2 text-muted-foreground"
        >
          <div className={cn(
            "w-4 h-4 rounded-full",
            winner.color === 'red' ? 'bg-red-500' : 'bg-yellow-500'
          )} />
          <span className="text-sm">{winner.aiModel}</span>
        </motion.div>
      </motion.div>
    );
  }

  if (isDraw) {
    return (
      <motion.div 
        className="text-center"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3 className="text-xl font-semibold text-muted-foreground">
          It's a Draw!
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          No more moves available
        </p>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div 
        key={currentPlayer?.id || 'waiting'}
        className="text-center"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.2 }}
      >
        {currentPlayer ? (
          <>
            <div className="flex items-center justify-center gap-3 mb-2">
              <motion.div
                className={cn(
                  "w-6 h-6 rounded-full",
                  currentPlayer.color === 'red' 
                    ? 'bg-gradient-to-br from-red-400 to-red-600' 
                    : 'bg-gradient-to-br from-yellow-400 to-yellow-600'
                )}
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ 
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              <h3 className="text-lg font-medium">
                {currentPlayer.name}'s Turn
              </h3>
            </div>
            
            {isAIThinking && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>AI is thinking...</span>
              </motion.div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">
            Waiting for game to start...
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}