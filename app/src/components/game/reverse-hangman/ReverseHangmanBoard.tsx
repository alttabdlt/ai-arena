import * as React from 'react';
import { useState, useEffect } from 'react';
import { AnimatedWordReveal } from './AnimatedWordReveal';
import { MatchProgressBar } from './MatchProgressBar';
import { EnhancedAIThinking } from './EnhancedAIThinking';
import { MistakeDisplay } from './MistakeDisplay';
import type { ReverseHangmanGameState as ReverseHangmanState, GuessAttempt } from '@/game-engine/games/reverse-hangman/ReverseHangmanTypes';

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
  const attemptsRemaining = gameState.maxAttempts - gameState.attempts.length;
  
  // Debug logging - commented out to reduce console spam
  // useEffect(() => {
  //   console.log('ReverseHangmanBoard state:', {
  //     phase: gameState.phase,
  //     hasCurrentPromptPair: !!gameState.currentPromptPair,
  //     promptPair: gameState.currentPromptPair,
  //     attempts: gameState.attempts.length,
  //     maxAttempts: gameState.maxAttempts,
  //     roundNumber: gameState.roundNumber,
  //     isGameOver: ['won', 'lost', 'round-complete'].includes(gameState.phase)
  //   });
  // }, [gameState]);
  
  // Show loading state if game is not ready
  if (!gameState.currentPromptPair || gameState.phase === 'waiting') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg text-gray-700">Preparing game...</p>
          <p className="text-sm text-gray-600 mt-2">Phase: {gameState.phase}</p>
        </div>
      </div>
    );
  }
  
  // Detect mistakes when new attempts are made
  useEffect(() => {
    if (gameState.attempts.length > 0) {
      const lastAttempt = gameState.attempts[gameState.attempts.length - 1];
      const previousAttempts = gameState.attempts.slice(0, -1);
      
      const mistake = MistakeDetector.detectMistakes(
        lastAttempt,
        gameState.attempts.length,
        gameState.currentPromptPair,
        previousAttempts
      );
      
      if (mistake) {
        setMistakes(prev => [...prev, mistake]);
      }
    }
  }, [gameState.attempts.length]);
  
  const getAttemptIcon = (attemptIndex: number) => {
    if (attemptIndex < gameState.attempts.length) {
      return '❌';
    } else if (attemptIndex < gameState.maxAttempts) {
      return '⭕';
    }
    return null;
  };

  const getMatchTypeColor = (matchType: GuessAttempt['matchType']) => {
    switch (matchType) {
      case 'exact': return 'text-green-500';
      case 'near': return 'text-yellow-500';
      case 'partial': return 'text-orange-500';
      case 'semantic': return 'text-blue-500';
      default: return 'text-red-500';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">Reverse Engineering Challenge</h2>
        {gameState.currentPromptPair && (
          <p className="text-gray-900">
            Difficulty: <span className="capitalize font-semibold">{gameState.currentPromptPair.difficulty}</span> | 
            Category: <span className="capitalize font-semibold">{gameState.currentPromptPair.category}</span>
          </p>
        )}
      </div>
      
      {/* Show animation during selecting phase */}
      {gameState.phase === 'selecting' && (
        <div className="text-center py-8">
          <div className="animate-pulse">
            <p className="text-lg font-semibold text-primary">Generating prompt...</p>
            <p className="text-sm text-gray-600 mt-2">Preparing your challenge</p>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {gameState.attempts.length > 0 && (
        <div className="max-w-md mx-auto">
          <MatchProgressBar
            matchPercentage={gameState.attempts[gameState.attempts.length - 1].matchPercentage}
            attemptsUsed={gameState.attempts.length}
            maxAttempts={gameState.maxAttempts}
            matchType={gameState.attempts[gameState.attempts.length - 1].matchType}
          />
        </div>
      )}

      {/* Attempts Indicator */}
      <div className="flex justify-center space-x-2">
        {Array.from({ length: gameState.maxAttempts }).map((_, i) => (
          <div key={i} className="text-2xl">
            {getAttemptIcon(i)}
          </div>
        ))}
      </div>

      {/* Output Display */}
      {gameState.currentPromptPair && (
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-900">AI Output:</h3>
          <div className="bg-white p-4 rounded border border-gray-300 whitespace-pre-wrap text-gray-900 font-medium">
            {gameState.currentPromptPair.output}
          </div>
        </div>
      )}

      {/* Game Status */}
      {gameState.phase === 'playing' && (
        <div className="text-center">
          <p className="text-lg">
            Attempts Remaining: <span className="font-bold">{attemptsRemaining}</span>
          </p>
          <p className="text-sm text-gray-900 mt-1">
            Guess the prompt that generated this output (minimum 6 words)
          </p>
        </div>
      )}

      {/* Previous Attempts */}
      {gameState.attempts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Previous Attempts:</h3>
          {gameState.attempts.map((attempt, index) => (
            <div key={index} className="bg-white p-4 rounded border border-gray-200">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm text-gray-800 font-medium">Attempt {index + 1}:</p>
                    <div className="mt-1">
                      <AnimatedWordReveal
                        text={attempt.guess}
                        isRevealing={index === gameState.attempts.length - 1 && isRevealing}
                        onRevealComplete={() => setIsRevealing(false)}
                      />
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <span className={`font-semibold ${getMatchTypeColor(attempt.matchType)}`}>
                      {attempt.matchType.toUpperCase()}
                    </span>
                    <p className="text-sm text-gray-900 font-medium">
                      {attempt.matchPercentage.toFixed(0)}% match
                    </p>
                  </div>
                </div>
                
                {/* Detailed Match Feedback */}
                {attempt.matchDetails && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                    {/* Position Template (Hangman-style) */}
                    {attempt.matchDetails.positionTemplate && (
                      <div className="text-sm mb-2">
                        <span className="font-medium text-gray-800">Pattern:</span>{' '}
                        <span className="font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">
                          {attempt.matchDetails.positionTemplate}
                        </span>
                      </div>
                    )}
                    
                    {/* Word Match Summary */}
                    <div className="text-sm">
                      <span className="font-medium text-gray-800">Word Match:</span>{' '}
                      <span className="text-gray-900">
                        {attempt.matchDetails.wordMatches} / {attempt.matchDetails.totalWords} words
                      </span>
                    </div>
                    
                    {/* Matched Words */}
                    {attempt.matchDetails.matchedWords.length > 0 && (
                      <div className="text-sm">
                        <span className="font-medium text-green-700">✓ Correct:</span>{' '}
                        <span className="text-green-600">
                          {attempt.matchDetails.matchedWords.join(', ')}
                        </span>
                      </div>
                    )}
                    
                    {/* Semantic Matches */}
                    {attempt.matchDetails.semanticMatches.length > 0 && (
                      <div className="text-sm">
                        <span className="font-medium text-blue-700">≈ Similar:</span>{' '}
                        <span className="text-blue-600">
                          {attempt.matchDetails.semanticMatches.map(sm => 
                            `${sm.matched} → ${sm.original}`
                          ).join(', ')}
                        </span>
                      </div>
                    )}
                    
                    
                    {/* Extra Words */}
                    {attempt.matchDetails.extraWords.length > 0 && (
                      <div className="text-sm">
                        <span className="font-medium text-red-700">+ Extra:</span>{' '}
                        <span className="text-red-600">
                          {attempt.matchDetails.extraWords.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Game Over Display */}
      {(['won', 'lost', 'round-complete'].includes(gameState.phase) && gameState.currentPromptPair && gameState.roundNumber > 0) && (
        <div className={`p-6 rounded-lg text-center ${
          gameState.phase === 'won' ? 'bg-green-100' : 'bg-red-100'
        }`}>
          <h3 className="text-2xl font-bold mb-3">
            {gameState.phase === 'won' ? '🎉 Success!' : '😔 Game Over'}
          </h3>
          <div className="mb-4">
            <p className="text-sm text-gray-900 mb-1">The correct prompt was:</p>
            <p className="font-semibold text-lg">{gameState.currentPromptPair.prompt}</p>
          </div>
          {gameState.phase === 'won' && gameState.endTime && (
            <div className="text-sm text-gray-900">
              <p>Solved in {gameState.attempts.length} attempt{gameState.attempts.length !== 1 ? 's' : ''}</p>
              <p>Time: {Math.round((gameState.endTime.getTime() - gameState.startTime.getTime()) / 1000)}s</p>
            </div>
          )}
        </div>
      )}

      {/* AI Thinking Indicator */}
      {isAIThinking && currentAgent && (
        <EnhancedAIThinking
          isThinking={isAIThinking}
          agentName={currentAgent.name}
          personality={currentAgent.personality as any || 'detective'}
        />
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