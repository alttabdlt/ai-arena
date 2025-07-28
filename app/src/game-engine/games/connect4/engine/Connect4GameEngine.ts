import { BaseGameEngine } from '../../../base/BaseGameEngine';
import { IGamePlayer, IGameValidationResult } from '../../../core/interfaces';
import {
  Connect4GameState,
  Connect4GameAction,
  Connect4Board,
  Connect4Cell,
  CONNECT4_ROWS,
  CONNECT4_COLS,
  WINNING_LENGTH,
  Connect4GamePlayer,
} from '../Connect4Types';

export class Connect4GameEngine extends BaseGameEngine<Connect4GameState, Connect4GameAction> {
  protected createInitialState(players: IGamePlayer[]): Connect4GameState {
    console.log('Connect4GameEngine.createInitialState called with players:', players);
    
    if (players.length !== 2) {
      throw new Error('Connect4 requires exactly 2 players');
    }

    // Create empty board
    const board: Connect4Board = Array(CONNECT4_ROWS).fill(null).map(() => 
      Array(CONNECT4_COLS).fill(0)
    );
    
    console.log('Created Connect4 board:', {
      rows: board.length,
      cols: board[0]?.length,
      firstRow: board[0],
      sample: board[0]?.[0]
    });

    const initialState: Connect4GameState = {
      gameId: this.context.gameId,
      phase: 'playing',
      players: players.map((p, index) => ({
        ...p,
        playerNumber: (index + 1) as 1 | 2,
        wins: 0,
        totalMoves: 0,
        timeouts: 0,
      } as Connect4GamePlayer)),
      board,
      currentPlayerIndex: 0,
      currentTurn: players[0].id,
      moveCount: 0,
      gamePhase: 'playing',
      startTime: new Date(),
      turnCount: 0
    };
    
    console.log('Connect4 initial state created:', {
      hasBoard: !!initialState.board,
      boardLength: initialState.board.length,
      players: initialState.players.map(p => ({ id: p.id, name: p.name }))
    });
    
    return initialState;
  }

  protected applyAction(action: Connect4GameAction): void {
    if (!this.state) {
      throw new Error('Game state not initialized');
    }

    // Ensure currentPlayerIndex is in sync with currentTurn
    this.updateCurrentPlayerIndex();
    
    const player = this.state.players[this.state.currentPlayerIndex] as Connect4GamePlayer;

    if (action.type === 'timeout') {
      player.timeouts++;
      // Turn switching is handled by BaseGameEngine
      return;
    }

    if (action.type === 'place' && action.column !== undefined) {
      // Find the lowest empty row in the column
      const row = this.getLowestEmptyRow(action.column);
      if (row === -1) {
        throw new Error('Column is full');
      }

      // Place the piece
      this.state.board[row][action.column] = player.playerNumber;
      player.totalMoves++;
      this.state.moveCount++;

      // Update last move
      this.state.lastMove = {
        row,
        column: action.column,
        playerId: player.id,
      };

      // Check for win
      const winningCells = this.checkWin(row, action.column, player.playerNumber);
      if (winningCells.length > 0) {
        this.state.winner = player.id;
        this.state.winningCells = winningCells;
        this.state.gamePhase = 'won';
        player.wins++;
      } else if (this.state.moveCount === CONNECT4_ROWS * CONNECT4_COLS) {
        // Check for draw
        this.state.gamePhase = 'draw';
      }
      // Turn switching is handled by BaseGameEngine
    }

    // State is updated in BaseGameEngine
  }

  protected validateGameSpecificAction(action: Connect4GameAction): IGameValidationResult {
    if (!this.state) {
      return { isValid: false, errors: ['Game not initialized'] };
    }

    if (this.state.gamePhase !== 'playing') {
      return { isValid: false, errors: ['Game is over'] };
    }

    if (action.type === 'timeout') {
      return { isValid: true };
    }

    if (action.type === 'place') {
      if (action.column === undefined || action.column < 0 || action.column >= CONNECT4_COLS) {
        return { isValid: false, errors: ['Invalid column'] };
      }

      if (this.getLowestEmptyRow(action.column) === -1) {
        return { isValid: false, errors: ['Column is full'] };
      }

      return { isValid: true };
    }

    return { isValid: false, errors: ['Invalid action type'] };
  }

  getValidActions(playerId: string): Connect4GameAction[] {
    if (!this.state || this.state.gamePhase !== 'playing') {
      return [];
    }

    // Ensure currentPlayerIndex is in sync with currentTurn
    this.updateCurrentPlayerIndex();
    
    const currentPlayer = this.state.players[this.state.currentPlayerIndex];
    if (currentPlayer.id !== playerId) {
      return [];
    }

    const validActions: Connect4GameAction[] = [];

    // Add all columns that aren't full
    for (let col = 0; col < CONNECT4_COLS; col++) {
      if (this.getLowestEmptyRow(col) !== -1) {
        validActions.push({
          type: 'place',
          column: col,
          playerId,
          timestamp: new Date(),
        });
      }
    }

    // Always allow timeout as a fallback
    validActions.push({
      type: 'timeout',
      playerId,
      timestamp: new Date(),
    });

    return validActions;
  }

  isGameOver(): boolean {
    return !this.state || this.state.gamePhase !== 'playing';
  }

  getWinners(): string[] {
    if (!this.state || this.state.gamePhase !== 'won') {
      return [];
    }
    return this.state.winner ? [this.state.winner] : [];
  }

  // Helper methods
  private updateCurrentPlayerIndex(): void {
    if (!this.state || !this.state.currentTurn) return;
    
    // Find the index of the player whose turn it is
    const playerIndex = this.state.players.findIndex(p => p.id === this.state.currentTurn);
    if (playerIndex !== -1) {
      this.state.currentPlayerIndex = playerIndex;
    }
  }

  private getLowestEmptyRow(column: number): number {
    if (!this.state) return -1;
    
    for (let row = CONNECT4_ROWS - 1; row >= 0; row--) {
      if (this.state.board[row][column] === 0) {
        return row;
      }
    }
    return -1; // Column is full
  }

  private checkWin(row: number, col: number, playerNumber: 1 | 2): Array<[number, number]> {
    if (!this.state) return [];

    const directions = [
      { dr: 0, dc: 1 },  // Horizontal
      { dr: 1, dc: 0 },  // Vertical
      { dr: 1, dc: 1 },  // Diagonal down-right
      { dr: 1, dc: -1 }, // Diagonal down-left
    ];

    for (const { dr, dc } of directions) {
      const cells = this.getLine(row, col, dr, dc, playerNumber);
      if (cells.length >= WINNING_LENGTH) {
        return cells;
      }
    }

    return [];
  }

  private getLine(row: number, col: number, dr: number, dc: number, playerNumber: 1 | 2): Array<[number, number]> {
    if (!this.state) return [];

    const cells: Array<[number, number]> = [[row, col]];

    // Check in positive direction
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < CONNECT4_ROWS && c >= 0 && c < CONNECT4_COLS && this.state.board[r][c] === playerNumber) {
      cells.push([r, c]);
      r += dr;
      c += dc;
    }

    // Check in negative direction
    r = row - dr;
    c = col - dc;
    while (r >= 0 && r < CONNECT4_ROWS && c >= 0 && c < CONNECT4_COLS && this.state.board[r][c] === playerNumber) {
      cells.unshift([r, c]);
      r -= dr;
      c -= dc;
    }

    return cells;
  }

  // Public helper methods for AI data collection
  public getBoard(): Connect4Board | null {
    return this.state?.board ?? null;
  }

  public checkForThreats(playerNumber: 1 | 2): Array<{ row: number; col: number; type: 'win' | 'block' }> {
    if (!this.state || this.state.gamePhase !== 'playing') return [];

    const threats: Array<{ row: number; col: number; type: 'win' | 'block' }> = [];
    const opponentNumber = playerNumber === 1 ? 2 : 1;

    // Check each column
    for (let col = 0; col < CONNECT4_COLS; col++) {
      const row = this.getLowestEmptyRow(col);
      if (row === -1) continue;

      // Temporarily place piece and check for win
      this.state.board[row][col] = playerNumber;
      const winCells = this.checkWin(row, col, playerNumber);
      if (winCells.length > 0) {
        threats.push({ row, col, type: 'win' });
      }
      this.state.board[row][col] = 0; // Remove temporary piece

      // Check if opponent can win
      this.state.board[row][col] = opponentNumber;
      const opponentWinCells = this.checkWin(row, col, opponentNumber);
      if (opponentWinCells.length > 0) {
        threats.push({ row, col, type: 'block' });
      }
      this.state.board[row][col] = 0; // Remove temporary piece
    }

    return threats;
  }

  protected cloneState(state: Connect4GameState): Connect4GameState {
    return {
      ...state,
      players: [...state.players],
      board: state.board.map(row => [...row]),
      lastMove: state.lastMove ? { ...state.lastMove } : undefined,
      winningCells: state.winningCells ? [...state.winningCells] : undefined,
      startTime: new Date(state.startTime),
    };
  }

  protected getGameDefinition(): { minPlayers: number; maxPlayers: number } {
    return {
      minPlayers: 2,
      maxPlayers: 2
    };
  }
}