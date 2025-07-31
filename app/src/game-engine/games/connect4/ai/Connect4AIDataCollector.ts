import { BaseGameDataCollector, GameHistoryEntry } from '../../../ai/AIDataCollector';
import { IGamePlayer } from '../../../core/interfaces';
import { Connect4GameState, Connect4GamePlayer, CONNECT4_ROWS, CONNECT4_COLS } from '../Connect4Types';

export class Connect4AIDataCollector extends BaseGameDataCollector<Connect4GameState> {
  getGameType(): string {
    return 'connect4';
  }

  collectGameSpecificData(state: Connect4GameState, playerId: string): Record<string, any> {
    const player = state.players.find(p => p.id === playerId) as Connect4GamePlayer;
    const validColumns = this.getValidColumns(state);
    // Connect4 should only have 2 players, so we cast to ensure type safety
    const boardMetrics = this.calculateBoardMetrics(state, player.playerNumber as 1 | 2);

    return {
      board: state.board, // Keep original board format, not formatted
      validColumns,
      boardMetrics,
      lastMove: state.lastMove,
      moveCount: state.moveCount
    };
  }

  getPlayerSpecificData(player: IGamePlayer, state: Connect4GameState): { position?: number; resources?: Record<string, any> } {
    const c4Player = player as Connect4GamePlayer;
    return {
      position: c4Player.playerNumber,
      resources: {
        wins: c4Player.wins || 0,
        totalMoves: c4Player.totalMoves || 0,
        timeouts: c4Player.timeouts || 0
      }
    };
  }

  obfuscateHiddenInformation(data: Record<string, any>, playerId: string): Record<string, any> {
    // Connect4 has no hidden information - all players see the entire board
    return data;
  }

  obfuscatePlayerResources(resources: Record<string, any>, resourceOwnerId: string, viewerId: string): Record<string, any> {
    // In Connect4, all player resources are public
    return resources;
  }

  collectHistory(state: Connect4GameState, playerId: string): GameHistoryEntry[] {
    // Return last few moves as history
    const history: GameHistoryEntry[] = [];
    if (state.lastMove) {
      history.push({
        turn: state.turnCount,
        playerId: state.lastMove.playerId,
        action: {
          type: 'place',
          column: state.lastMove.column,
          playerId: state.lastMove.playerId,
          timestamp: new Date()
        },
        result: {
          valid: true,
          changes: [`Player placed disc in column ${state.lastMove.column}`]
        }
      });
    }
    return history;
  }

  collectNeutralData(state: Connect4GameState, playerId: string): any {
    const player = state.players.find(p => p.id === playerId) as Connect4GamePlayer;
    const opponent = state.players.find(p => p.id !== playerId) as Connect4GamePlayer;
    
    if (!player || !opponent) {
      throw new Error('Player not found');
    }

    // Get valid columns
    const validColumns = this.getValidColumns(state);

    // Calculate board metrics
    // Connect4 should only have 2 players, so we cast to ensure type safety
    const boardMetrics = this.calculateBoardMetrics(state, player.playerNumber as 1 | 2);

    return {
      gameType: 'connect4',
      board: this.formatBoard(state.board),
      playerNumber: player.playerNumber,
      opponentNumber: opponent.playerNumber,
      moveCount: state.moveCount,
      lastMove: state.lastMove,
      validColumns,
      boardMetrics,
      gamePhase: state.gamePhase,
      calculations: {
        movesPlayed: state.moveCount,
        emptyCells: CONNECT4_ROWS * CONNECT4_COLS - state.moveCount,
        centerColumnAvailable: validColumns.includes(3),
        threatsToWin: boardMetrics.immediateWinOpportunities,
        threatsToBlock: boardMetrics.opponentWinThreats
      }
    };
  }

  private formatBoard(board: number[][]): string[] {
    // Format board as array of strings for easier visualization
    return board.map(row => 
      row.map(cell => cell === 0 ? '.' : cell.toString()).join('')
    );
  }

  private getValidColumns(state: Connect4GameState): number[] {
    const validColumns: number[] = [];
    
    for (let col = 0; col < CONNECT4_COLS; col++) {
      if (state.board[0][col] === 0) {
        validColumns.push(col);
      }
    }
    
    return validColumns;
  }

  private calculateBoardMetrics(state: Connect4GameState, playerNumber: 1 | 2) {
    const opponentNumber = playerNumber === 1 ? 2 : 1;
    
    return {
      immediateWinOpportunities: this.countWinOpportunities(state, playerNumber),
      opponentWinThreats: this.countWinOpportunities(state, opponentNumber),
      centerControl: this.calculateCenterControl(state, playerNumber),
      connectedPieces: this.countConnectedPieces(state, playerNumber)
    };
  }

  private countWinOpportunities(state: Connect4GameState, playerNumber: 1 | 2): number {
    let opportunities = 0;
    
    // Check each valid column
    for (let col = 0; col < CONNECT4_COLS; col++) {
      const row = this.getLowestEmptyRow(state.board, col);
      if (row === -1) continue;
      
      // Temporarily place piece
      state.board[row][col] = playerNumber;
      
      // Check if this creates a win
      if (this.checkWinAt(state.board, row, col, playerNumber)) {
        opportunities++;
      }
      
      // Remove temporary piece
      state.board[row][col] = 0;
    }
    
    return opportunities;
  }

  private getLowestEmptyRow(board: number[][], col: number): number {
    for (let row = CONNECT4_ROWS - 1; row >= 0; row--) {
      if (board[row][col] === 0) {
        return row;
      }
    }
    return -1;
  }

  private checkWinAt(board: number[][], row: number, col: number, playerNumber: number): boolean {
    // Check all four directions
    const directions = [
      { dr: 0, dc: 1 },  // Horizontal
      { dr: 1, dc: 0 },  // Vertical
      { dr: 1, dc: 1 },  // Diagonal down-right
      { dr: 1, dc: -1 }  // Diagonal down-left
    ];
    
    for (const { dr, dc } of directions) {
      let count = 1;
      
      // Check positive direction
      let r = row + dr;
      let c = col + dc;
      while (r >= 0 && r < CONNECT4_ROWS && c >= 0 && c < CONNECT4_COLS && board[r][c] === playerNumber) {
        count++;
        r += dr;
        c += dc;
      }
      
      // Check negative direction
      r = row - dr;
      c = col - dc;
      while (r >= 0 && r < CONNECT4_ROWS && c >= 0 && c < CONNECT4_COLS && board[r][c] === playerNumber) {
        count++;
        r -= dr;
        c -= dc;
      }
      
      if (count >= 4) {
        return true;
      }
    }
    
    return false;
  }

  private calculateCenterControl(state: Connect4GameState, playerNumber: number): number {
    let centerPieces = 0;
    const centerCol = 3;
    
    for (let row = 0; row < CONNECT4_ROWS; row++) {
      if (state.board[row][centerCol] === playerNumber) {
        centerPieces++;
      }
    }
    
    return centerPieces;
  }

  private countConnectedPieces(state: Connect4GameState, playerNumber: number): number {
    let maxConnected = 0;
    
    // Check all positions
    for (let row = 0; row < CONNECT4_ROWS; row++) {
      for (let col = 0; col < CONNECT4_COLS; col++) {
        if (state.board[row][col] === playerNumber) {
          // Check all directions from this position
          const directions = [
            { dr: 0, dc: 1 },  // Horizontal
            { dr: 1, dc: 0 },  // Vertical
            { dr: 1, dc: 1 },  // Diagonal down-right
            { dr: 1, dc: -1 }  // Diagonal down-left
          ];
          
          for (const { dr, dc } of directions) {
            let count = 1;
            let r = row + dr;
            let c = col + dc;
            
            while (r >= 0 && r < CONNECT4_ROWS && c >= 0 && c < CONNECT4_COLS && state.board[r][c] === playerNumber) {
              count++;
              r += dr;
              c += dc;
            }
            
            maxConnected = Math.max(maxConnected, count);
          }
        }
      }
    }
    
    return maxConnected;
  }
}