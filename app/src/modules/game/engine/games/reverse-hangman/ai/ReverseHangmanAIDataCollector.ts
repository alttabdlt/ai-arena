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
    targetWordCount: number;
    currentPositionTemplate: string;
    matchedWordsCount: number;
    warningFlags?: {
      repeatedLastGuess?: boolean;
      noProgressInLastThree?: boolean;
    };
    previousGuesses: Array<{
      guess: string;
      matchType: string;
      matchPercentage: number;
      matchDetails?: {
        wordMatches: number;
        totalWords: number;
        matchedWords: string[];
        matchedWordPositions: Array<{ word: string; position: number }>;
        missingWords: string[];
        extraWords: string[];
        semanticMatches: Array<{ original: string; matched: string; position: number }>;
        positionTemplate: string;
      };
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
    
    console.log('ReverseHangmanAIDataCollector.collectGameSpecificData:', {
      phase: state.phase,
      currentTurn: state.currentTurn,
      playerId: playerId,
      hasPromptPair: !!state.currentPromptPair,
      hasOutput: !!state.currentPromptPair?.output,
      attemptsRemaining
    });
    
    // Calculate current position template and matched words count
    const lastAttempt = state.attempts[state.attempts.length - 1];
    const currentPositionTemplate = lastAttempt?.matchDetails?.positionTemplate || 
      (state.currentPromptPair ? '_'.repeat(state.currentPromptPair.wordCount).split('').join(' ') : '');
    const matchedWordsCount = lastAttempt?.matchDetails?.matchedWords.length || 0;
    const targetWordCount = state.currentPromptPair?.wordCount || 0;

    // Calculate warning flags
    const warningFlags: { repeatedLastGuess?: boolean; noProgressInLastThree?: boolean } = {};
    if (state.attempts.length >= 2) {
      const lastTwo = state.attempts.slice(-2);
      if (lastTwo[0].guess === lastTwo[1].guess) {
        warningFlags.repeatedLastGuess = true;
      }
    }
    if (state.attempts.length >= 3) {
      const lastThree = state.attempts.slice(-3);
      const noProgress = lastThree.every((attempt, idx) => 
        idx === 0 || attempt.matchPercentage <= lastThree[idx - 1].matchPercentage
      );
      if (noProgress) {
        warningFlags.noProgressInLastThree = true;
      }
    }

    return {
      gameType: 'reverse-hangman',  // Explicitly include game type
      phase: state.phase,
      roundNumber: state.roundNumber,
      maxRounds: state.maxRounds,
      attemptsRemaining,
      maxAttempts: state.maxAttempts,
      animationPhase: state.animationPhase,
      currentOutput: state.currentPromptPair?.output || '',
      targetWordCount,
      currentPositionTemplate,
      matchedWordsCount,
      warningFlags: Object.keys(warningFlags).length > 0 ? warningFlags : undefined,
      previousGuesses: state.attempts.map(attempt => ({
        guess: attempt.guess,
        matchType: attempt.matchType || 'incorrect',
        matchPercentage: attempt.matchPercentage,
        matchDetails: attempt.matchDetails
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

  collectValidActions(state: ReverseHangmanGameState, playerId: string): any[] {
    console.log('ReverseHangmanAIDataCollector.collectValidActions:', {
      phase: state.phase,
      currentTurn: state.currentTurn,
      playerId: playerId,
      match: state.currentTurn === playerId
    });
    
    if (state.phase !== 'playing' || state.currentTurn !== playerId) {
      return [];
    }

    // Return full action objects instead of just strings
    return [
      { playerId, type: 'guess', timestamp: new Date().toISOString() },
      { playerId, type: 'skip', timestamp: new Date().toISOString() }
    ];
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