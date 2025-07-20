import { Card } from '../engine/poker-engine';
import { PositionType } from './position-evaluator';

export interface HandRange {
  minHandStrength: number;
  playPercentage: number;
  description: string;
}

export class HandRangeEvaluator {
  private static readonly cardRankings: { [key: string]: number } = {
    'A': 14, 'K': 13, 'Q': 12, 'J': 11, 'T': 10,
    '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
  };
  
  // Hand range tables by player count and position
  private static readonly ranges: Record<number, Record<PositionType, HandRange>> = {
    // 2-3 players (heads-up / 3-handed)
    3: {
      'EP': { minHandStrength: 0.4, playPercentage: 40, description: 'No EP in 3-handed' },
      'MP': { minHandStrength: 0.4, playPercentage: 40, description: 'No MP in 3-handed' },
      'LP': { minHandStrength: 0.5, playPercentage: 50, description: 'Button: 22+, A2+, K2s+, K5o+, Q4s+, Q8o+, J6s+, J8o+' },
      'SB': { minHandStrength: 0.4, playPercentage: 40, description: 'SB: 22+, A2+, K4s+, K7o+, Q6s+, Q9o+, J7s+, J9o+' },
      'BB': { minHandStrength: 0.6, playPercentage: 60, description: 'BB defending: Very wide vs button opens' }
    },
    
    // 4-6 players
    6: {
      'EP': { minHandStrength: 0.15, playPercentage: 15, description: 'EP: 66+, AJs+, AQo+, KQs' },
      'MP': { minHandStrength: 0.22, playPercentage: 22, description: 'MP: 44+, A8s+, ATo+, KTs+, KJo+, QTs+, JTs' },
      'LP': { minHandStrength: 0.35, playPercentage: 35, description: 'LP: 22+, A2s+, A5o+, K7s+, K9o+, Q8s+, QTo+, J8s+, JTo+, T8s+, 98s' },
      'SB': { minHandStrength: 0.2, playPercentage: 20, description: 'SB: Similar to MP but slightly tighter' },
      'BB': { minHandStrength: 0.4, playPercentage: 40, description: 'BB: Defending wider due to pot odds' }
    },
    
    // 7-9 players (full ring)
    9: {
      'EP': { minHandStrength: 0.08, playPercentage: 8, description: 'EP: 99+, AQs+, AKo' },
      'MP': { minHandStrength: 0.12, playPercentage: 12, description: 'MP: 77+, ATs+, AJo+, KQs' },
      'LP': { minHandStrength: 0.25, playPercentage: 25, description: 'LP: 44+, A2s+, A8o+, K9s+, KTo+, Q9s+, QJo+, J9s+, JTo+, T9s' },
      'SB': { minHandStrength: 0.15, playPercentage: 15, description: 'SB: Between EP and MP ranges' },
      'BB': { minHandStrength: 0.3, playPercentage: 30, description: 'BB: Defending reasonably wide' }
    }
  };
  
  static getHandRange(position: PositionType, playerCount: number): HandRange {
    // Find the closest player count key
    let rangeKey = 9;
    if (playerCount <= 3) rangeKey = 3;
    else if (playerCount <= 6) rangeKey = 6;
    
    return this.ranges[rangeKey][position];
  }
  
  static evaluateStartingHand(cards: Card[]): {
    strength: number;
    isPair: boolean;
    isSuited: boolean;
    highCard: number;
    kicker: number;
  } {
    if (cards.length !== 2) {
      throw new Error('Starting hand must have exactly 2 cards');
    }
    
    const rank1 = this.cardRankings[cards[0][0]];
    const rank2 = this.cardRankings[cards[1][0]];
    const suit1 = cards[0][1];
    const suit2 = cards[1][1];
    
    const isPair = rank1 === rank2;
    const isSuited = suit1 === suit2;
    const highCard = Math.max(rank1, rank2);
    const kicker = Math.min(rank1, rank2);
    
    // Calculate hand strength (0-1 scale)
    let strength = 0;
    
    if (isPair) {
      // Pocket pairs
      strength = 0.5 + (highCard / 14) * 0.4; // 0.5-0.9 range
      
      // Premium pairs get bonus
      if (highCard >= 11) strength += 0.1; // JJ+
    } else {
      // Unpaired hands
      const gap = highCard - kicker;
      const connectivity = gap <= 4 ? (5 - gap) * 0.02 : 0;
      
      // Base strength from high card
      strength = (highCard / 14) * 0.3;
      
      // Kicker contribution
      strength += (kicker / 14) * 0.15;
      
      // Suited bonus
      if (isSuited) strength += 0.1;
      
      // Connectivity bonus
      strength += connectivity;
      
      // Ace bonus
      if (highCard === 14) strength += 0.1;
      
      // Broadway bonus (both cards 10+)
      if (kicker >= 10) strength += 0.05;
    }
    
    return {
      strength: Math.min(1, strength),
      isPair,
      isSuited,
      highCard,
      kicker
    };
  }
  
  static shouldPlayHand(
    cards: Card[],
    position: PositionType,
    playerCount: number,
    isRaised: boolean = false,
    raisesCount: number = 0
  ): { play: boolean; reason: string } {
    const handEval = this.evaluateStartingHand(cards);
    const range = this.getHandRange(position, playerCount);
    
    // Adjust for action before us
    let requiredStrength = range.minHandStrength;
    if (isRaised) {
      requiredStrength += 0.1; // Tighter vs raises
      requiredStrength += raisesCount * 0.05; // Even tighter vs multiple raises
    }
    
    // Special adjustments
    if (position === 'BB' && !isRaised) {
      // BB can defend wider when just facing limps
      requiredStrength *= 0.8;
    }
    
    if (position === 'SB' && isRaised) {
      // SB needs to be tighter when out of position
      requiredStrength *= 1.2;
    }
    
    const shouldPlay = handEval.strength >= requiredStrength;
    
    let reason = `Hand strength: ${(handEval.strength * 100).toFixed(0)}%, `;
    reason += `Required: ${(requiredStrength * 100).toFixed(0)}%, `;
    reason += `Position: ${position}, `;
    reason += `Table: ${playerCount} players`;
    
    if (isRaised) {
      reason += `, Facing ${raisesCount} raise(s)`;
    }
    
    return { play: shouldPlay, reason };
  }
  
  static getHandDescription(cards: Card[]): string {
    const handEval = this.evaluateStartingHand(cards);
    const rankNames: { [key: number]: string } = {
      14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: 'T',
      9: '9', 8: '8', 7: '7', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2'
    };
    
    if (handEval.isPair) {
      return `Pocket ${rankNames[handEval.highCard]}s`;
    } else {
      const high = rankNames[handEval.highCard];
      const low = rankNames[handEval.kicker];
      const suited = handEval.isSuited ? 's' : 'o';
      return `${high}${low}${suited}`;
    }
  }
}