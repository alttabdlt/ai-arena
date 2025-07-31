import {
  IGameState,
  IGameAction,
  IGameConfig,
  IGamePlayer,
  IGameValidationResult,
} from '../../core/interfaces';

export const CONNECT4_ROWS = 8;
export const CONNECT4_COLS = 8;
export const WINNING_LENGTH = 4;

export type Connect4Cell = 0 | 1 | 2 | 3 | 4; // 0 = empty, 1 = player1, 2 = player2, 3 = player3, 4 = player4
export type Connect4Board = Connect4Cell[][];

export interface Connect4GameState extends IGameState {
  board: Connect4Board;
  currentPlayerIndex: number;
  players: Connect4GamePlayer[]; // Override to use Connect4GamePlayer type
  lastMove?: {
    row: number;
    column: number;
    playerId: string;
  };
  winner?: string;
  winningCells?: Array<[number, number]>;
  moveCount: number;
  gamePhase: 'playing' | 'won' | 'draw';
}

export interface Connect4GameAction extends IGameAction {
  type: 'place' | 'timeout';
  column?: number; // 0-6 for place action
}

export interface Connect4GameConfig extends IGameConfig {
  timeLimit: number; // Time limit per move in milliseconds
  enableGravity: boolean; // Always true for standard Connect4
}

export interface Connect4GamePlayer extends IGamePlayer {
  playerNumber: 1 | 2 | 3 | 4; // Which player number they are
  wins: number;
  totalMoves: number;
  timeouts: number;
}

export interface Connect4ValidationResult extends IGameValidationResult {
  valid: boolean;
  reason?: string;
  suggestedAction?: Connect4GameAction;
}

export interface Connect4GameMetrics {
  boardControl: {
    player1: number; // Percentage of advantageous positions
    player2: number;
  };
  threats: {
    player1: Connect4Threat[];
    player2: Connect4Threat[];
  };
  centerControl: {
    player1: number; // Pieces in center column
    player2: number;
  };
}

export interface Connect4Threat {
  cells: Array<[number, number]>;
  type: 'win' | 'block'; // win = can win next move, block = must block
  column: number; // Column to play to execute/block
}

export interface Connect4StylePoints {
  firstMoveCenter: number; // Bonus for playing center column first
  winFromBehind: number; // Win when opponent had more pieces
  diagonalWin: number; // Win with diagonal line
  fastWin: number; // Win in under 10 moves
  perfectGame: number; // Win without opponent getting 3 in a row
}

export interface Connect4GameStats {
  totalMoves: number;
  avgMoveTime: number;
  centerPlays: number;
  threatsCreated: number;
  threatsBlocked: number;
  missedWins: number; // Times AI didn't take winning move
}