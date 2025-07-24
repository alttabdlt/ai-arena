import { BaseGameDataCollector, NeutralGameData, GameHistoryEntry } from '../../../ai/AIDataCollector';
import { ReverseHangmanGameState, ReverseHangmanPlayer, GuessAttempt } from '../ReverseHangmanTypes';
import { IGamePlayer } from '../../../core/interfaces';

export interface ReverseHangmanNeutralData extends NeutralGameData {
  gameSpecific: {
    phase: 'waiting' | 'selecting' | 'playing' | 'won' | 'lost' | 'round-complete';
    roundNumber: number;
    maxRounds: number;
    attemptsRemaining: number;
    maxAttempts: number;
    animationPhase: string;
    currentOutput: string;
    previousGuesses: Array<{
      guess: string;
      matchType: string;
      matchPercentage: number;
    }>;
    difficulty?: string;
    category?: string;
  };
}

export class ReverseHangmanAIDataCollector extends BaseGameDataCollector<ReverseHangmanGameState> {
  constructor() {
    super();
    this.obfuscateHiddenInfo = false; // No hidden info in reverse hangman
  }

  getGameType(): string {
    return 'reverse-hangman';
  }

  collectGameSpecificData(state: ReverseHangmanGameState, playerId: string): Record<string, any> {
    const player = state.players.find(p => p.id === playerId) as ReverseHangmanPlayer;
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    const attemptsRemaining = state.maxAttempts - state.attempts.length;
    
    return {
      phase: state.phase,
      roundNumber: state.roundNumber,
      maxRounds: state.maxRounds,
      attemptsRemaining,
      maxAttempts: state.maxAttempts,
      animationPhase: state.animationPhase,
      currentOutput: state.currentPromptPair?.output || '',
      previousGuesses: state.attempts.map(attempt => ({
        guess: attempt.guess,
        matchType: attempt.matchType || 'incorrect',
        matchPercentage: attempt.matchPercentage
      })),
      difficulty: state.currentPromptPair?.difficulty,
      category: state.currentPromptPair?.category,
      playerSpecific: {
        guessCount: player.guessHistory.length,
        roundsWon: player.roundsWon,
        totalScore: player.totalScore,
        lastGuess: player.currentGuess
      }
    };
  }

  getPlayerSpecificData(player: IGamePlayer, state: ReverseHangmanGameState): {
    position?: number;
    resources?: Record<string, any>;
  } {
    const rhPlayer = player as ReverseHangmanPlayer;
    
    return {
      resources: {
        roundsWon: rhPlayer.roundsWon,
        totalScore: rhPlayer.totalScore,
        guessCount: rhPlayer.guessHistory.length
      }
    };
  }

  public collectHistory(state: ReverseHangmanGameState, playerId: string): GameHistoryEntry[] {
    const player = state.players.find(p => p.id === playerId) as ReverseHangmanPlayer;
    if (!player) return [];

    return player.guessHistory
      .slice(-this.historyLimit)
      .map((attempt, index) => ({
        turn: state.turnCount - player.guessHistory.length + index + 1,
        playerId: playerId,
        action: {
          type: 'guess',
          guess: attempt.guess
        },
        result: {
          matchType: attempt.matchType,
          matchPercentage: attempt.matchPercentage,
          isCorrect: attempt.isCorrect
        }
      }));
  }

  collectValidActions(state: ReverseHangmanGameState, playerId: string): string[] {
    if (state.phase !== 'playing' || state.currentTurn !== playerId) {
      return [];
    }

    return ['guess', 'skip'];
  }

  obfuscateHiddenInformation(data: Record<string, any>, playerId: string): Record<string, any> {
    // No hidden information in reverse hangman - all players see the same output
    return data;
  }

  obfuscatePlayerResources(resources: Record<string, any>, ownerId: string, viewerId: string): Record<string, any> {
    // All player resources are public in reverse hangman
    return resources;
  }
}