import * as React from 'react';
import { useState, useEffect } from 'react';
import { AnimatedWordReveal } from './AnimatedWordReveal';
import { MatchProgressBar } from './MatchProgressBar';
import { MistakeDisplay } from './MistakeDisplay';
import { Loader2 } from 'lucide-react';
import type { ReverseHangmanGameState as ReverseHangmanState, GuessAttempt } from '@game/engine/games/reverse-hangman/ReverseHangmanTypes';

// Simple local mistake type - mistake detection was removed in framework migration
interface Mistake {
  promptPair: any;
  attemptDetails: any;
  type: 'semantic' | 'logic' | 'format';
  severity: 'minor' | 'major' | 'hilarious';
  category: string;
  description: string;
}

// Stub for mistake detection - always returns null for now
const MistakeDetector = {
  detectMistakes: (lastAttempt: any, attemptNumber: number, currentPromptPair: any, previousAttempts: any[]) => null
};

interface ReverseHangmanBoardProps {
  gameState: ReverseHangmanState;
  onGuessSubmit?: (guess: string) => void;
  isAIThinking?: boolean;
  currentAgent?: { name: string; personality?: string };
}

export const ReverseHangmanBoard: React.FC<ReverseHangmanBoardProps> = ({
  gameState,
  onGuessSubmit,
  isAIThinking = false,
  currentAgent
}) => {
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [isRevealing, setIsRevealing] = useState(false);
  const attemptsRemaining = (gameState.maxAttempts || 6) - (gameState.attempts?.length || 0);
  
  // Detect mistakes when new attempts are made
  useEffect(() => {
    if (gameState.attempts && gameState.attempts.length > 0 && gameState.currentPromptPair) {
      const lastAttempt = gameState.attempts[gameState.attempts.length - 1];
      const previousAttempts = gameState.attempts.slice(0, -1);
      
      const mistake = MistakeDetector.detectMistakes(
        lastAttempt,
        gameState.attempts?.length || 0,
        gameState.currentPromptPair,
        previousAttempts
      );
      
      if (mistake) {
        setMistakes(prev => [...prev, mistake]);
      }
    }
  }, [gameState.attempts?.length, gameState.currentPromptPair]);
  
  // Debug logging - commented out to reduce console spam
  // useEffect(() => {
  //   console.log('ReverseHangmanBoard state:', {
  //     phase: gameState.phase,
  //     hasCurrentPromptPair: !!gameState.currentPromptPair,
  //     promptPair: gameState.currentPromptPair,
  //     attempts: gameState.attempts?.length || 0,
  //     maxAttempts: gameState.maxAttempts,
  //     roundNumber: gameState.roundNumber,
  //     isGameOver: ['won', 'lost', 'round-complete'].includes(gameState.phase)
  //   });
  // }, [gameState]);
  
  // Show loading state if game is not ready
  if (!gameState.currentPromptPair || gameState.phase === 'waiting' || gameState.phase === 'selecting') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {gameState.phase === 'selecting' ? 'Generating prompt...' : 
             gameState.phase === 'playing' ? 'Loading game state...' : 
             'Preparing game...'}
          </p>
          <p className="text-xs text-muted-foreground mt-2">Phase: {gameState.phase}</p>
          {gameState.phase === 'playing' && !gameState.currentPromptPair && (
            <p className="text-xs text-muted-foreground mt-2">Waiting for prompt generation...</p>
          )}
        </div>
      </div>
    );
  }
  
  const getAttemptIcon = (attemptIndex: number) => {
    if (attemptIndex < (gameState.attempts?.length || 0)) {
      return '❌';
    } else if (attemptIndex < (gameState.maxAttempts || 6)) {
      return '⭕';
    }
    return null;
  };

  const getMatchTypeColor = (matchType: GuessAttempt['matchType']) => {
    switch (matchType) {
      case 'exact': return 'text-green-600 dark:text-green-400';
      case 'near': return 'text-yellow-600 dark:text-yellow-400';
      case 'partial': return 'text-orange-600 dark:text-orange-400';
      case 'semantic': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-red-600 dark:text-red-400';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-lg font-medium mb-2">Reverse Engineering Challenge</h2>
        {gameState.currentPromptPair && (
          <p className="text-sm text-muted-foreground">
            Difficulty: <span className="capitalize">{gameState.currentPromptPair.difficulty}</span> | 
            Category: <span className="capitalize">{gameState.currentPromptPair.category}</span>
          </p>
        )}
      </div>

      {/* Progress Bar */}
      {gameState.attempts && gameState.attempts.length > 0 && (
        <div className="max-w-md mx-auto">
          <MatchProgressBar
            matchPercentage={gameState.attempts[gameState.attempts.length - 1].matchPercentage}
            attemptsUsed={gameState.attempts.length}
            maxAttempts={gameState.maxAttempts || 6}
            matchType={gameState.attempts[gameState.attempts.length - 1].matchType}
          />
        </div>
      )}

      {/* Attempts Indicator */}
      <div className="flex justify-center space-x-2">
        {Array.from({ length: gameState.maxAttempts || 6 }).map((_, i) => (
          <div key={i} className="text-sm">
            {getAttemptIcon(i)}
          </div>
        ))}
      </div>

      {/* Output Display */}
      {gameState.currentPromptPair && (
        <div className="bg-muted rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">AI Output Generated!</h3>
          <p className="text-xs text-muted-foreground mb-2">Can you guess the original prompt?</p>
          <div className="bg-background p-3 rounded border whitespace-pre-wrap text-sm">
            {gameState.currentPromptPair.output || 'Loading output...'}
          </div>
        </div>
      )}

      {/* Game Status */}
      {gameState.phase === 'playing' && (
        <div className="text-center">
          <p className="text-sm">
            Attempts Remaining: <span className="font-medium">{attemptsRemaining}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Guess the prompt that generated this output (minimum 6 words)
          </p>
        </div>
      )}

      {/* Current Player's Attempts */}
      {gameState.attempts && gameState.currentTurn && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">
            {gameState.players.find(p => p.id === gameState.currentTurn)?.name}'s Attempts:
          </h3>
          {(() => {
            // Filter attempts for current player only
            const currentPlayer = gameState.players.find(p => p.id === gameState.currentTurn) as any;
            const playerAttempts = currentPlayer?.guessHistory || [];
            
            return playerAttempts.map((attempt: any, index: number) => (
            <div key={index} className="bg-background p-3 rounded border">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Attempt {index + 1}:</p>
                    <div className="mt-1">
                      <AnimatedWordReveal
                        text={attempt.guess}
                        isRevealing={index === (gameState.attempts?.length || 0) - 1 && isRevealing}
                        onRevealComplete={() => setIsRevealing(false)}
                      />
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <span className={`text-xs font-medium ${getMatchTypeColor(attempt.matchType)}`}>
                      {attempt.matchType.toUpperCase()}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {attempt.matchPercentage.toFixed(0)}% match
                    </p>
                  </div>
                </div>
                
                {/* Detailed Match Feedback */}
                {attempt.matchDetails && (
                  <div className="mt-2 pt-2 border-t space-y-1">
                    {/* Position Template (Hangman-style) */}
                    {attempt.matchDetails.positionTemplate && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Pattern:</span>{' '}
                        <span className="font-mono bg-muted px-1 rounded">
                          {attempt.matchDetails.positionTemplate}
                        </span>
                      </div>
                    )}
                    
                    {/* Word Match Summary */}
                    <div className="text-xs">
                      <span className="text-muted-foreground">Word Match:</span>{' '}
                      <span>
                        {attempt.matchDetails.wordMatches} / {attempt.matchDetails.totalWords} words
                      </span>
                    </div>
                    
                    {/* Matched Words */}
                    {attempt.matchDetails.matchedWords.length > 0 && (
                      <div className="text-xs">
                        <span className="text-green-600 dark:text-green-400">✓ Correct:</span>{' '}
                        <span className="text-green-600 dark:text-green-400">
                          {attempt.matchDetails.matchedWords.join(', ')}
                        </span>
                      </div>
                    )}
                    
                    {/* Semantic Matches */}
                    {attempt.matchDetails.semanticMatches.length > 0 && (
                      <div className="text-xs">
                        <span className="text-blue-600 dark:text-blue-400">≈ Similar:</span>{' '}
                        <span className="text-blue-600 dark:text-blue-400">
                          {attempt.matchDetails.semanticMatches.map(sm => 
                            `${sm.matched} → ${sm.original}`
                          ).join(', ')}
                        </span>
                      </div>
                    )}
                    
                    
                    {/* Extra Words */}
                    {attempt.matchDetails.extraWords.length > 0 && (
                      <div className="text-xs">
                        <span className="text-red-600 dark:text-red-400">+ Extra:</span>{' '}
                        <span className="text-red-600 dark:text-red-400">
                          {attempt.matchDetails.extraWords.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ));
          })()}
        </div>
      )}

      {/* Hangman Pattern Display - Show current progress */}
      {gameState.attempts && gameState.attempts.length > 0 && gameState.currentTurn && (
        <div className="bg-muted border rounded-lg p-3 text-center">
          <h3 className="text-sm font-medium mb-2">Current Pattern:</h3>
          {(() => {
            const currentPlayer = gameState.players.find(p => p.id === gameState.currentTurn) as any;
            const lastAttempt = currentPlayer?.guessHistory?.[currentPlayer.guessHistory.length - 1];
            const pattern = lastAttempt?.matchDetails?.positionTemplate || '_ _ _ _ _ _';
            
            return (
              <div className="font-mono text-lg tracking-wider">
                {pattern}
              </div>
            );
          })()}
          <p className="text-xs text-muted-foreground mt-2">
            Words you've correctly guessed will appear in the pattern above
          </p>
        </div>
      )}

      {/* Game Over Display */}
      {(['won', 'lost', 'round-complete'].includes(gameState.phase) && gameState.currentPromptPair && gameState.roundNumber > 0) && (
        <div className={`p-4 rounded-lg text-center ${
          gameState.phase === 'won' ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'
        }`}>
          <h3 className="text-base font-medium mb-2">
            {gameState.phase === 'won' ? '🎉 Success!' : '😔 Game Over'}
          </h3>
          <div className="mb-3">
            <p className="text-xs text-muted-foreground mb-1">The correct prompt was:</p>
            <p className="text-sm font-medium">{gameState.currentPromptPair.prompt}</p>
          </div>
          {gameState.phase === 'won' && gameState.endTime && (
            <div className="text-xs text-muted-foreground">
              <p>Solved in {gameState.attempts?.length || 0} attempt{(gameState.attempts?.length || 0) !== 1 ? 's' : ''}</p>
              {gameState.endTime && gameState.startTime && (
                <p>Time: {Math.round((new Date(gameState.endTime).getTime() - new Date(gameState.startTime).getTime()) / 1000)}s</p>
              )}
            </div>
          )}
        </div>
      )}

      
      {/* Mistake Display */}
      {mistakes.length > 0 && currentAgent && (
        <div className="max-w-md mx-auto">
          <MistakeDisplay
            mistakes={mistakes}
            agentName={currentAgent.name}
          />
        </div>
      )}
    </div>
  );
};