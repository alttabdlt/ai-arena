// GameInstance and AIService imports removed - not used in this file

export interface GameEngineAdapter {
  processAction(gameState: any, action: any): any;
  getValidActions(gameState: any, playerId: string): any[];
  isGameComplete(gameState: any): boolean;
  getWinner(gameState: any): string | null;
  getCurrentTurn(gameState: any): string | null;
}

export class PokerEngineAdapter implements GameEngineAdapter {
  processAction(gameState: any, action: any): any {
    // Apply poker action to game state
    const { currentTurn, players, currentBet } = gameState;
    const playerIndex = players.findIndex((p: any) => p.id === currentTurn);
    
    if (playerIndex === -1) return gameState;
    
    // Deep clone the state to avoid mutations
    const newState = {
      ...gameState,
      players: players.map((p: any) => ({ ...p })),
      deck: gameState.deck ? [...gameState.deck] : [],
      burnt: gameState.burnt ? [...gameState.burnt] : [],
      communityCards: gameState.communityCards ? [...gameState.communityCards] : []
    };
    
    const player = newState.players[playerIndex];
    
    // Mark that this player has acted
    player.hasActed = true;
    
    switch (action.action) {
      case 'fold':
        player.folded = true;
        player.isActive = false;
        break;
        
      case 'check':
        // No change to pot
        break;
        
      case 'call':
        const callAmount = currentBet - (player.bet || 0);
        player.chips -= callAmount;
        player.bet = currentBet;
        player.totalBet = (player.totalBet || 0) + callAmount;
        newState.pot += callAmount;
        break;
        
      case 'raise':
      case 'bet':
        const raiseAmount = action.amount;
        player.chips -= raiseAmount;
        player.bet = (player.bet || 0) + raiseAmount;
        player.totalBet = (player.totalBet || 0) + raiseAmount;
        newState.currentBet = player.bet;
        newState.pot += raiseAmount;
        // When someone raises, all other players need to act again
        newState.players.forEach((p: any, idx: number) => {
          if (idx !== playerIndex && !p.folded) {
            p.hasActed = false;
          }
        });
        break;
        
      case 'all-in':
        const allInAmount = player.chips;
        player.bet = (player.bet || 0) + allInAmount;
        player.totalBet = (player.totalBet || 0) + allInAmount;
        player.chips = 0;
        player.isAllIn = true;
        newState.pot += allInAmount;
        if (player.bet > newState.currentBet) {
          newState.currentBet = player.bet;
          // When someone raises via all-in, all other players need to act again
          newState.players.forEach((p: any, idx: number) => {
            if (idx !== playerIndex && !p.folded && !p.isAllIn) {
              p.hasActed = false;
            }
          });
        }
        break;
    }
    
    // Check if only one player remains active (everyone else folded)
    const activePlayers = newState.players.filter((p: any) => !p.folded);
    if (activePlayers.length === 1) {
      // End the hand (not the game)
      newState.phase = 'handComplete';
      newState.winners = [{ playerId: activePlayers[0].id, amount: newState.pot }];
      // Award pot to the last remaining player
      activePlayers[0].chips += newState.pot;
      
      // Prepare for next hand - this will be handled by the game manager
      newState.handComplete = true;
      
      return newState;
    }
    
    // Move to next player
    newState.currentTurn = this.getNextPlayer(newState);
    
    // Check if betting round is complete
    if (this.isBettingRoundComplete(newState)) {
      newState.phase = this.getNextPhase(newState.phase);
      
      // Handle showdown
      if (newState.phase === 'showdown') {
        // For now, award pot to the last active player (proper hand evaluation needed)
        const activePlayers = newState.players.filter((p: any) => !p.folded);
        if (activePlayers.length > 0) {
          // TODO: Implement proper hand evaluation
          // For now, just pick the first active player as winner
          const winner = activePlayers[0];
          newState.winners = [{ playerId: winner.id, amount: newState.pot }];
          winner.chips += newState.pot;
          newState.handComplete = true;
        }
      } else if (newState.phase === 'handComplete') {
        // Hand is complete
        newState.handComplete = true;
      } else {
        // Continue to next betting round
        newState.currentBet = 0;
        newState.players.forEach((p: any) => {
          p.bet = 0;
          p.hasActed = false; // Reset for new betting round
        });
        
        // Deal community cards for next phase
        if (newState.phase === 'flop' && newState.deck) {
          // Burn one card and deal 3
          newState.burnt = newState.burnt || [];
          newState.burnt.push(newState.deck.pop());
          // Ensure communityCards is empty before dealing flop
          newState.communityCards = [];
          newState.communityCards.push(
            newState.deck.pop(),
            newState.deck.pop(),
            newState.deck.pop()
          );
        } else if ((newState.phase === 'turn' || newState.phase === 'river') && newState.deck) {
          // Burn one card and deal 1
          newState.burnt = newState.burnt || [];
          newState.burnt.push(newState.deck.pop());
          newState.communityCards.push(newState.deck.pop());
        }
      }
    }
    
    return newState;
  }
  
  getValidActions(gameState: any, playerId: string): any[] {
    const { players, currentBet } = gameState;
    const player = players.find((p: any) => p.id === playerId);
    
    if (!player || player.folded || player.chips === 0) {
      return [];
    }
    
    const actions = [];
    const toCall = currentBet - (player.bet || 0);
    
    if (toCall === 0) {
      actions.push({ action: 'check', playerId, timestamp: new Date().toISOString() });
    } else if (player.chips > toCall) {
      actions.push({ action: 'call', amount: toCall, playerId, timestamp: new Date().toISOString() });
    }
    
    actions.push({ action: 'fold', playerId, timestamp: new Date().toISOString() });
    
    if (player.chips > toCall) {
      actions.push({ action: 'raise', amount: toCall + 100, playerId, timestamp: new Date().toISOString() });
    }
    
    if (player.chips > 0) {
      actions.push({ action: 'all-in', amount: player.chips, playerId, timestamp: new Date().toISOString() });
    }
    
    return actions;
  }
  
  isGameComplete(gameState: any): boolean {
    const { players, phase, handNumber } = gameState;
    const playersWithChips = players.filter((p: any) => p.chips > 0);
    
    // Game is complete when:
    // 1. Only one player has chips left
    // 2. Maximum number of hands (20) has been reached
    // 3. Phase is explicitly set to 'complete' (for error cases)
    const maxHands = 20;
    return playersWithChips.length <= 1 || (handNumber && handNumber >= maxHands) || phase === 'complete';
  }
  
  getWinner(gameState: any): string | null {
    const { players } = gameState;
    const activePlayers = players.filter((p: any) => !p.folded);
    
    if (activePlayers.length === 1) {
      return activePlayers[0].id;
    }
    
    // TODO: Implement proper hand evaluation
    return null;
  }
  
  getCurrentTurn(gameState: any): string | null {
    // No current turn if hand is complete
    if (gameState.phase === 'handComplete' || gameState.handComplete) {
      return null;
    }
    return gameState.currentTurn;
  }
  
  private getNextPlayer(gameState: any): string {
    const { players, currentTurn, currentBet } = gameState;
    const currentIndex = players.findIndex((p: any) => p.id === currentTurn);
    
    for (let i = 1; i < players.length; i++) {
      const nextIndex = (currentIndex + i) % players.length;
      const nextPlayer = players[nextIndex];
      if (!nextPlayer.folded && !nextPlayer.isAllIn && 
          (!nextPlayer.hasActed || nextPlayer.bet < currentBet)) {
        return nextPlayer.id;
      }
    }
    
    return currentTurn; // No valid next player
  }
  
  private isBettingRoundComplete(gameState: any): boolean {
    const { players, currentBet } = gameState;
    const activePlayers = players.filter((p: any) => !p.folded && !p.isAllIn);
    
    // All active players must have acted AND matched the current bet
    return activePlayers.every((p: any) => p.hasActed && (p.bet === currentBet || p.chips === 0));
  }
  
  private getNextPhase(currentPhase: string): string {
    const phases = ['preflop', 'flop', 'turn', 'river', 'showdown'];
    const currentIndex = phases.indexOf(currentPhase);
    
    // After showdown, move to handComplete (not complete)
    if (currentPhase === 'showdown') {
      return 'handComplete';
    }
    
    return phases[currentIndex + 1] || 'handComplete';
  }
}

export class ReverseHangmanEngineAdapter implements GameEngineAdapter {
  processAction(gameState: any, action: any): any {
    const newState = { ...gameState };
    
    if (action.type === 'guess' && action.guess) {
      // Add guess to attempts
      const attempt = {
        playerId: action.playerId,
        guess: action.guess,
        timestamp: new Date().toISOString(),
        matchType: 'incorrect', // Default
        matchPercentage: 0
      };
      
      // Calculate match percentage (simplified)
      const correctPrompt = gameState.currentPromptPair?.prompt || '';
      const similarity = this.calculateSimilarity(action.guess, correctPrompt);
      
      if (similarity > 90) {
        attempt.matchType = 'exact';
      } else if (similarity > 70) {
        attempt.matchType = 'semantic';
      } else if (similarity > 50) {
        attempt.matchType = 'partial';
      }
      
      attempt.matchPercentage = similarity;
      
      newState.attempts.push(attempt);
      
      // Check if correct
      if (attempt.matchType === 'exact') {
        newState.phase = 'won';
        const winner = newState.players.find((p: any) => p.id === action.playerId);
        if (winner) {
          winner.roundsWon++;
          winner.totalScore += 1000;
        }
      } else if (newState.attempts.length >= newState.maxAttempts) {
        newState.phase = 'lost';
      }
    }
    
    // Move to next player
    const currentIndex = newState.players.findIndex((p: any) => p.id === newState.currentTurn);
    const nextIndex = (currentIndex + 1) % newState.players.length;
    newState.currentTurn = newState.players[nextIndex].id;
    newState.turnCount++;
    
    return newState;
  }
  
  getValidActions(gameState: any, playerId: string): any[] {
    if (gameState.phase !== 'playing' || gameState.currentTurn !== playerId) {
      return [];
    }
    
    return [
      { type: 'guess', playerId, timestamp: new Date().toISOString() },
      { type: 'skip', playerId, timestamp: new Date().toISOString() }
    ];
  }
  
  isGameComplete(gameState: any): boolean {
    return ['won', 'lost', 'complete'].includes(gameState.phase);
  }
  
  getWinner(gameState: any): string | null {
    if (gameState.phase === 'won') {
      // Return the player who made the last correct guess
      const lastAttempt = gameState.attempts[gameState.attempts.length - 1];
      return lastAttempt?.playerId || null;
    }
    return null;
  }
  
  getCurrentTurn(gameState: any): string | null {
    return gameState.currentTurn;
  }
  
  private calculateSimilarity(guess: string, correct: string): number {
    // Simple word-based similarity
    const guessWords = guess.toLowerCase().split(/\s+/);
    const correctWords = correct.toLowerCase().split(/\s+/);
    
    let matches = 0;
    for (const word of guessWords) {
      if (correctWords.includes(word)) {
        matches++;
      }
    }
    
    const similarity = (matches / Math.max(guessWords.length, correctWords.length)) * 100;
    return Math.round(similarity);
  }
}

export class Connect4EngineAdapter implements GameEngineAdapter {
  processAction(gameState: any, action: any): any {
    // Deep clone the state
    const newState = {
      ...gameState,
      players: gameState.players.map((p: any) => ({ ...p })),
      board: gameState.board.map((row: any[]) => [...row])
    };
    
    if (action.type === 'place' && action.column !== undefined) {
      const row = this.getLowestEmptyRow(newState.board, action.column);
      if (row === -1) {
        throw new Error('Column is full');
      }
      
      // Find player index from ID
      const playerIndex = newState.players.findIndex((p: any) => p.id === action.playerId);
      if (playerIndex === -1) {
        throw new Error('Player not found');
      }
      
      // Place piece (1 for player 1, 2 for player 2)
      const playerNumber = playerIndex + 1;
      newState.board[row][action.column] = playerNumber;
      newState.moveCount = (newState.moveCount || 0) + 1;
      
      // Check for win
      if (this.checkWin(newState.board, row, action.column, playerNumber)) {
        newState.winner = action.playerId;
        newState.phase = 'complete';
        newState.gamePhase = 'won';
      } else if (this.isBoardFull(newState.board)) {
        newState.phase = 'draw';
        newState.gamePhase = 'draw';
      } else {
        // Move to next player
        const nextPlayerIndex = (playerIndex + 1) % newState.players.length;
        newState.currentTurn = newState.players[nextPlayerIndex].id;
        newState.currentPlayerIndex = nextPlayerIndex;
      }
    } else if (action.type === 'timeout') {
      // Handle timeout - move to next player
      const playerIndex = newState.players.findIndex((p: any) => p.id === action.playerId);
      if (playerIndex !== -1) {
        const nextPlayerIndex = (playerIndex + 1) % newState.players.length;
        newState.currentTurn = newState.players[nextPlayerIndex].id;
        newState.currentPlayerIndex = nextPlayerIndex;
      }
    }
    
    return newState;
  }
  
  getValidActions(gameState: any, playerId: string): any[] {
    if ((gameState.phase !== 'playing' && gameState.phase !== 'waiting' && gameState.gamePhase !== 'playing') ||
        gameState.phase === 'complete' || gameState.phase === 'draw' ||
        gameState.gamePhase === 'won' || gameState.gamePhase === 'draw') {
      return [];
    }
    
    // Check if it's this player's turn
    const currentPlayerId = this.getCurrentTurn(gameState);
    if (currentPlayerId !== playerId) {
      return [];
    }
    
    const actions = [];
    for (let col = 0; col < gameState.board[0].length; col++) {
      if (this.getLowestEmptyRow(gameState.board, col) !== -1) {
        actions.push({
          type: 'place',
          column: col,
          playerId,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Always allow timeout
    actions.push({
      type: 'timeout',
      playerId,
      timestamp: new Date().toISOString()
    });
    
    return actions;
  }
  
  isGameComplete(gameState: any): boolean {
    return gameState.phase === 'complete' || gameState.phase === 'draw' ||
           gameState.gamePhase === 'won' || gameState.gamePhase === 'draw';
  }
  
  getWinner(gameState: any): string | null {
    return gameState.winner || null;
  }
  
  getCurrentTurn(gameState: any): string | null {
    if (gameState.phase === 'complete' || gameState.phase === 'draw' || 
        gameState.gamePhase === 'won' || gameState.gamePhase === 'draw') {
      return null;
    }
    // Return the currentTurn ID directly if it exists
    if (gameState.currentTurn && typeof gameState.currentTurn === 'string') {
      return gameState.currentTurn;
    }
    // Otherwise try to get from currentPlayerIndex
    if (typeof gameState.currentPlayerIndex === 'number' && gameState.players) {
      return gameState.players[gameState.currentPlayerIndex]?.id || null;
    }
    return null;
  }
  
  private getLowestEmptyRow(board: any[][], column: number): number {
    for (let row = board.length - 1; row >= 0; row--) {
      if (board[row][column] === null || board[row][column] === 0) {
        return row;
      }
    }
    return -1;
  }
  
  private isBoardFull(board: any[][]): boolean {
    for (let col = 0; col < board[0].length; col++) {
      if (this.getLowestEmptyRow(board, col) !== -1) {
        return false;
      }
    }
    return true;
  }
  
  private checkWin(board: any[][], row: number, col: number, player: number): boolean {
    // Check horizontal
    if (this.checkLine(board, row, col, 0, 1, player)) return true;
    // Check vertical
    if (this.checkLine(board, row, col, 1, 0, player)) return true;
    // Check diagonal (top-left to bottom-right)
    if (this.checkLine(board, row, col, 1, 1, player)) return true;
    // Check diagonal (top-right to bottom-left)
    if (this.checkLine(board, row, col, 1, -1, player)) return true;
    
    return false;
  }
  
  private checkLine(board: any[][], row: number, col: number, dRow: number, dCol: number, player: number): boolean {
    let count = 1;
    
    // Check forward direction
    let r = row + dRow;
    let c = col + dCol;
    while (r >= 0 && r < board.length && c >= 0 && c < board[0].length && board[r][c] === player) {
      count++;
      r += dRow;
      c += dCol;
    }
    
    // Check backward direction
    r = row - dRow;
    c = col - dCol;
    while (r >= 0 && r < board.length && c >= 0 && c < board[0].length && board[r][c] === player) {
      count++;
      r -= dRow;
      c -= dCol;
    }
    
    return count >= 4;
  }
}

export class GameEngineAdapterFactory {
  static create(gameType: string): GameEngineAdapter {
    switch (gameType) {
      case 'poker':
        return new PokerEngineAdapter();
      case 'reverse-hangman':
        return new ReverseHangmanEngineAdapter();
      case 'connect4':
        return new Connect4EngineAdapter();
      default:
        throw new Error(`Unknown game type: ${gameType}`);
    }
  }
}