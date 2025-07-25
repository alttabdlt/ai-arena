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
    const player = players.find((p: any) => p.id === currentTurn);
    
    if (!player) return gameState;
    
    const newState = { ...gameState };
    
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
        newState.pot += callAmount;
        break;
        
      case 'raise':
      case 'bet':
        const raiseAmount = action.amount;
        player.chips -= raiseAmount;
        player.bet = (player.bet || 0) + raiseAmount;
        newState.currentBet = player.bet;
        newState.pot += raiseAmount;
        break;
        
      case 'all-in':
        const allInAmount = player.chips;
        player.bet = (player.bet || 0) + allInAmount;
        player.chips = 0;
        player.isAllIn = true;
        newState.pot += allInAmount;
        if (player.bet > newState.currentBet) {
          newState.currentBet = player.bet;
        }
        break;
    }
    
    // Move to next player
    newState.currentTurn = this.getNextPlayer(newState);
    
    // Check if betting round is complete
    if (this.isBettingRoundComplete(newState)) {
      newState.phase = this.getNextPhase(newState.phase);
      newState.currentBet = 0;
      players.forEach((p: any) => p.bet = 0);
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
      actions.push({ type: 'check', playerId, timestamp: new Date().toISOString() });
    } else if (player.chips > toCall) {
      actions.push({ type: 'call', amount: toCall, playerId, timestamp: new Date().toISOString() });
    }
    
    actions.push({ type: 'fold', playerId, timestamp: new Date().toISOString() });
    
    if (player.chips > toCall) {
      actions.push({ type: 'raise', amount: toCall + 100, playerId, timestamp: new Date().toISOString() });
    }
    
    if (player.chips > 0) {
      actions.push({ type: 'all-in', amount: player.chips, playerId, timestamp: new Date().toISOString() });
    }
    
    return actions;
  }
  
  isGameComplete(gameState: any): boolean {
    const { players, phase } = gameState;
    const activePlayers = players.filter((p: any) => !p.folded && p.chips > 0);
    
    return activePlayers.length <= 1 || phase === 'complete';
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
    return gameState.currentTurn;
  }
  
  private getNextPlayer(gameState: any): string {
    const { players, currentTurn } = gameState;
    const currentIndex = players.findIndex((p: any) => p.id === currentTurn);
    
    for (let i = 1; i < players.length; i++) {
      const nextIndex = (currentIndex + i) % players.length;
      const nextPlayer = players[nextIndex];
      if (!nextPlayer.folded && nextPlayer.chips > 0) {
        return nextPlayer.id;
      }
    }
    
    return currentTurn; // No valid next player
  }
  
  private isBettingRoundComplete(gameState: any): boolean {
    const { players, currentBet } = gameState;
    const activePlayers = players.filter((p: any) => !p.folded && p.chips > 0);
    
    // All active players have matched the current bet
    return activePlayers.every((p: any) => p.bet === currentBet || p.isAllIn);
  }
  
  private getNextPhase(currentPhase: string): string {
    const phases = ['preflop', 'flop', 'turn', 'river', 'showdown'];
    const currentIndex = phases.indexOf(currentPhase);
    return phases[currentIndex + 1] || 'complete';
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

export class GameEngineAdapterFactory {
  static create(gameType: string): GameEngineAdapter {
    switch (gameType) {
      case 'poker':
        return new PokerEngineAdapter();
      case 'reverse-hangman':
        return new ReverseHangmanEngineAdapter();
      default:
        throw new Error(`Unknown game type: ${gameType}`);
    }
  }
}