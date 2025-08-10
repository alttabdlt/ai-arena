import { IGameState, IGameAction, IGameConfig, IGamePlayer } from './interfaces';

export interface ITurnBasedGameState extends IGameState {
  currentPlayerIndex: number;
  turnTimeRemaining?: number;
  lastAction?: IGameAction;
}

export interface ICardGameState extends ITurnBasedGameState {
  deck: any[];
  discardPile: any[];
  playerHands: Map<string, any[]>;
}

export interface IBoardGameState extends ITurnBasedGameState {
  board: any[][];
  pieces: Map<string, any[]>;
}

export interface IWordGameState extends IGameState {
  targetWord?: string;
  guesses: string[];
  remainingAttempts: number;
}

export interface IRealTimeGameState extends IGameState {
  frameCount: number;
  deltaTime: number;
  entities: Map<string, any>;
}

export interface ITimedGameConfig extends IGameConfig {
  timeLimit: number;
  turnTimeLimit?: number;
  overtimeAllowed?: boolean;
}

export interface IScoredGamePlayer extends IGamePlayer {
  currentScore: number;
  highScore: number;
  achievements: string[];
}

export interface ITeamGameConfig extends IGameConfig {
  teamSize: number;
  teamBalancing: 'random' | 'balanced' | 'manual';
  teamNames?: string[];
}

export interface IRoundBasedGameState extends IGameState {
  currentRound: number;
  maxRounds: number;
  roundWinners: Map<number, string[]>;
}

export interface IGameStatistics {
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  averageScore: number;
  highestScore: number;
  achievements: string[];
  favoriteGames: string[];
  playtime: number;
}

export interface IGameMetrics {
  actionCount: number;
  averageThinkingTime: number;
  errorRate: number;
  comebackWins: number;
  perfectGames: number;
}

export enum GameDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
  EXPERT = 'expert'
}

export enum GameSpeed {
  SLOW = 'slow',
  NORMAL = 'normal',
  FAST = 'fast',
  BLITZ = 'blitz'
}

export interface IGameModifiers {
  difficulty?: GameDifficulty;
  speed?: GameSpeed;
  handicap?: Map<string, number>;
  customRules?: Record<string, any>;
}