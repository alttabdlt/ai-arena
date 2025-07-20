export type PositionType = 'EP' | 'MP' | 'LP' | 'SB' | 'BB';

export interface PositionInfo {
  type: PositionType;
  relativePosition: number; // 0-1 (0 = earliest, 1 = latest)
  isBlind: boolean;
}

export class PositionEvaluator {
  static getPositionType(
    playerPosition: number,
    dealerPosition: number,
    playerCount: number
  ): PositionInfo {
    // Calculate positions relative to dealer
    const sbPosition = (dealerPosition + 1) % playerCount;
    const bbPosition = (dealerPosition + 2) % playerCount;
    
    // Check if player is in blinds
    if (playerPosition === sbPosition) {
      return { type: 'SB', relativePosition: 0, isBlind: true };
    }
    if (playerPosition === bbPosition) {
      return { type: 'BB', relativePosition: 0.1, isBlind: true };
    }
    
    // Calculate distance from BB (first to act post-flop)
    const distanceFromBB = (playerPosition - bbPosition + playerCount) % playerCount;
    const nonBlindPlayers = playerCount - 2;
    
    // Position classification based on player count
    if (playerCount <= 3) {
      // 2-3 players: Only LP (button/cutoff)
      return { type: 'LP', relativePosition: 1, isBlind: false };
    } else if (playerCount <= 6) {
      // 4-6 players: EP and LP only
      if (distanceFromBB <= Math.floor(nonBlindPlayers / 2)) {
        return { 
          type: 'EP', 
          relativePosition: 0.3 + (distanceFromBB / nonBlindPlayers) * 0.2,
          isBlind: false 
        };
      } else {
        return { 
          type: 'LP', 
          relativePosition: 0.7 + (distanceFromBB / nonBlindPlayers) * 0.3,
          isBlind: false 
        };
      }
    } else {
      // 7-9 players: EP, MP, and LP
      const epCutoff = Math.floor(nonBlindPlayers * 0.33);
      const mpCutoff = Math.floor(nonBlindPlayers * 0.67);
      
      if (distanceFromBB <= epCutoff) {
        return { 
          type: 'EP', 
          relativePosition: 0.2 + (distanceFromBB / nonBlindPlayers) * 0.2,
          isBlind: false 
        };
      } else if (distanceFromBB <= mpCutoff) {
        return { 
          type: 'MP', 
          relativePosition: 0.4 + (distanceFromBB / nonBlindPlayers) * 0.2,
          isBlind: false 
        };
      } else {
        return { 
          type: 'LP', 
          relativePosition: 0.7 + (distanceFromBB / nonBlindPlayers) * 0.3,
          isBlind: false 
        };
      }
    }
  }
  
  static getPositionMultiplier(position: PositionType, playerCount: number): number {
    // Multiplier for hand strength evaluation based on position
    const multipliers: Record<PositionType, number> = {
      'EP': 0.7,  // Tightest
      'MP': 0.85,
      'LP': 1.2,  // Most aggressive
      'SB': 0.9,  // Slightly tighter due to poor post-flop position
      'BB': 1.0   // Normal, gets to close action
    };
    
    // Adjust multipliers based on player count
    const countAdjustment = 1 + (6 - playerCount) * 0.05; // Looser with fewer players
    
    return multipliers[position] * Math.max(0.8, Math.min(1.3, countAdjustment));
  }
  
  static getStealOpportunity(
    playerPosition: number,
    dealerPosition: number,
    playerCount: number,
    foldedPlayers: number[]
  ): boolean {
    const positionInfo = this.getPositionType(playerPosition, dealerPosition, playerCount);
    
    // Can only steal from late position
    if (positionInfo.type !== 'LP') return false;
    
    // Check if all players between us and blinds have folded
    const sbPosition = (dealerPosition + 1) % playerCount;
    const bbPosition = (dealerPosition + 2) % playerCount;
    
    let pos = (playerPosition + 1) % playerCount;
    while (pos !== sbPosition) {
      if (!foldedPlayers.includes(pos)) return false;
      pos = (pos + 1) % playerCount;
    }
    
    return true;
  }
}