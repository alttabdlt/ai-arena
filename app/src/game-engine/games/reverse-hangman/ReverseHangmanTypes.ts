import { IGameState, IGameAction, IGameConfig, IGamePlayer } from '../../core/interfaces';

export interface PromptPair {
  id: string;
  prompt: string;
  output: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  category: string;
  wordCount: number;
}

export interface GuessAttempt {
  guess: string;
  timestamp: Date;
  isCorrect: boolean;
  matchPercentage: number;
  matchType: 'exact' | 'near' | 'partial' | 'semantic' | 'incorrect';
  matchDetails?: {
    wordMatches: number;
    totalWords: number;
    matchedWords: string[];
    missingWords: string[];
    extraWords: string[];
    semanticMatches: Array<{ original: string; matched: string }>;
  };
}

export interface ReverseHangmanPlayer extends IGamePlayer {
  currentGuess?: string;
  guessHistory: GuessAttempt[];
  roundsWon: number;
  totalScore: number;
}

export interface ReverseHangmanAction extends IGameAction {
  type: 'guess' | 'skip' | 'timeout';
  guess?: string;
}

export interface ReverseHangmanGameState extends IGameState {
  phase: 'waiting' | 'selecting' | 'playing' | 'won' | 'lost' | 'round-complete';
  players: ReverseHangmanPlayer[];
  currentPromptPair?: PromptPair;
  attempts: GuessAttempt[];
  maxAttempts: number;
  roundNumber: number;
  maxRounds: number;
  animationPhase?: 'idle' | 'selecting' | 'sending' | 'processing' | 'generating' | 'revealing' | 'complete';
}

export interface ReverseHangmanGameConfig extends IGameConfig {
  maxRounds: number;
  maxAttempts: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'expert' | 'mixed';
  categories?: string[];
  promptDatabaseSize?: number;
  speed?: 'slow' | 'normal' | 'fast';
  animationDuration?: number;
}

export interface ReverseHangmanRound {
  roundNumber: number;
  promptPair: PromptPair;
  attempts: GuessAttempt[];
  winner?: string;
  score: number;
  duration: number;
}

export interface ReverseHangmanTournament {
  id: string;
  config: ReverseHangmanGameConfig;
  rounds: ReverseHangmanRound[];
  totalScore: number;
  status: 'setup' | 'playing' | 'completed';
  startTime: Date;
  endTime?: Date;
}