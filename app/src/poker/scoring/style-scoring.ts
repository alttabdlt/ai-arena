import { Card } from '../engine/poker-engine';
import { evaluatePokerHand } from '../engine/hand-evaluator';

// Hand strength rankings (1 = weakest, 169 = strongest)
// Based on standard poker starting hand rankings
const STARTING_HAND_RANKINGS: { [key: string]: number } = {
  'AA': 169, 'KK': 168, 'QQ': 167, 'JJ': 166, 'TT': 165,
  'AKs': 164, 'AQs': 163, 'AJs': 162, 'AKo': 161, 'ATs': 160,
  'AQo': 159, 'AJo': 158, '99': 157, 'KQs': 156, 'ATo': 155,
  'KJs': 154, 'QJs': 153, 'KQo': 152, 'KJo': 151, '88': 150,
  'KTs': 149, 'QJo': 148, 'JTs': 147, 'A9s': 146, 'KTo': 145,
  // ... Add more as needed, for now we'll consider bottom 40% as anything not listed
};

export interface PlayerStats {
  playerId: string;
  handsPlayed: number;
  handsWon: number;
  showdownsWon: number;
  bluffsWon: number; // Won without showdown after aggressive action
  comebackWins: number; // Won when starting hand with <20% of pot
  unconventionalWins: number; // Won with weak starting hands
  aggressiveActions: number; // Raises and re-raises
  totalActions: number;
  biggestPotWon: number;
  totalWinnings: number;
  // AI Evaluation Metrics
  handMisreads: number; // Times AI misidentified their hand
  criticalMisreads: number; // Times AI missed the nuts
  illogicalDecisions: number; // Times AI made illogical plays (e.g., fold when check available)
  correctHandReads: number; // Times AI correctly identified their hand on river
}

export interface StyleBonus {
  type: 'david-goliath' | 'bluff-master' | 'unconventional' | 'comeback' | 'action-player' | 'accurate-reader' | 'logical-player';
  multiplier: number;
  description: string;
}

export interface StylePenalty {
  type: 'hand-misread' | 'illogical-play' | 'critical-misread';
  multiplier: number;
  description: string;
}

export interface HandResult {
  winnerId: string;
  potSize: number;
  showdown: boolean;
  winnerStartingStack: number;
  winnerHoleCards: Card[];
  loserStacks: number[];
  wasAggressor: boolean; // Did winner make the last aggressive action?
  communityCards?: Card[]; // Community cards for hand evaluation
  handRank?: number; // Hand rank from evaluation
}

export class StyleScoringSystem {
  private playerStats: Map<string, PlayerStats> = new Map();
  private recentHands: { playerId: string; participated: boolean }[] = [];
  private readonly RECENT_HANDS_WINDOW = 10;

  constructor() {}

  initializePlayer(playerId: string): void {
    if (!this.playerStats.has(playerId)) {
      this.playerStats.set(playerId, {
        playerId,
        handsPlayed: 0,
        handsWon: 0,
        showdownsWon: 0,
        bluffsWon: 0,
        comebackWins: 0,
        unconventionalWins: 0,
        aggressiveActions: 0,
        totalActions: 0,
        biggestPotWon: 0,
        totalWinnings: 0,
        handMisreads: 0,
        criticalMisreads: 0,
        illogicalDecisions: 0,
        correctHandReads: 0,
      });
    }
  }

  recordHandParticipation(playerId: string, participated: boolean): void {
    this.recentHands.push({ playerId, participated });
    if (this.recentHands.length > this.RECENT_HANDS_WINDOW * 9) { // Max 9 players
      this.recentHands = this.recentHands.slice(-this.RECENT_HANDS_WINDOW * 9);
    }

    const stats = this.playerStats.get(playerId);
    if (stats && participated) {
      stats.handsPlayed++;
    }
  }

  recordAction(playerId: string, action: string): void {
    const stats = this.playerStats.get(playerId);
    if (stats) {
      stats.totalActions++;
      if (action === 'raise' || action === 'bet' || action === 'all-in') {
        stats.aggressiveActions++;
      }
    }
  }

  recordHandResult(result: HandResult): StyleBonus[] {
    const stats = this.playerStats.get(result.winnerId);
    if (!stats) return [];

    stats.handsWon++;
    stats.totalWinnings += result.potSize;
    if (result.potSize > stats.biggestPotWon) {
      stats.biggestPotWon = result.potSize;
    }

    const bonuses: StyleBonus[] = [];

    // Check for showdown win
    if (result.showdown) {
      stats.showdownsWon++;
      
      // Check for unconventional win
      if (this.isUnconventionalHand(result.winnerHoleCards)) {
        stats.unconventionalWins++;
        bonuses.push({
          type: 'unconventional',
          multiplier: 0.25,
          description: 'Won with unconventional starting hand!'
        });
      }
    } else if (result.wasAggressor && !result.showdown) {
      // Check if this was a true bluff (weak hand winning through aggression)
      let isBluff = false;
      
      if (result.communityCards && result.communityCards.length >= 3) {
        // Evaluate the winner's hand
        const evaluation = evaluatePokerHand(result.winnerHoleCards, result.communityCards);
        
        // Consider it a bluff if:
        // - High card (rank 1)
        // - Weak pair (rank 2) - but only if it's not top pair or overpair
        // - Missed draws (would still be high card or weak pair)
        if (evaluation.handRank <= 2) {
          isBluff = true;
          
          // For pairs, check if it's a weak pair (not top pair)
          if (evaluation.handRank === 2 && result.communityCards.length >= 3) {
            // Simple heuristic: if the pair uses both hole cards, it's likely an overpair or pocket pair
            // which is stronger than a weak pair on the board
            const holeRanks = result.winnerHoleCards.map(c => c[0]);
            if (holeRanks[0] === holeRanks[1]) {
              // Pocket pair - check if it's small
              const rankValue = this.getRankValue(holeRanks[0]);
              isBluff = rankValue <= 8; // Only small pocket pairs (8 or lower) count as bluffs
            }
          }
        }
      } else {
        // Pre-flop or early aggression - consider it a bluff if won without showdown
        isBluff = true;
      }
      
      if (isBluff) {
        stats.bluffsWon++;
        bonuses.push({
          type: 'bluff-master',
          multiplier: 0.15,
          description: 'Successfully bluffed opponents!'
        });
      }
    }

    // Check for David vs Goliath
    const biggestLoserStack = Math.max(...result.loserStacks);
    if (biggestLoserStack >= result.winnerStartingStack * 3) {
      bonuses.push({
        type: 'david-goliath',
        multiplier: 0.20,
        description: 'Defeated a much larger stack!'
      });
    }

    // Check for comeback win
    if (result.winnerStartingStack < result.potSize * 0.2) {
      stats.comebackWins++;
      bonuses.push({
        type: 'comeback',
        multiplier: 0.30,
        description: 'Amazing comeback from short stack!'
      });
    }

    return bonuses;
  }

  getPlayerActionBonus(playerId: string): StyleBonus | null {
    const recentParticipation = this.recentHands
      .filter(h => h.playerId === playerId)
      .slice(-this.RECENT_HANDS_WINDOW);
    
    if (recentParticipation.length >= this.RECENT_HANDS_WINDOW) {
      const participationRate = recentParticipation.filter(h => h.participated).length / recentParticipation.length;
      if (participationRate > 0.6) {
        return {
          type: 'action-player',
          multiplier: 0.10,
          description: 'Active player - high participation rate!'
        };
      }
    }
    return null;
  }

  private isUnconventionalHand(cards: Card[]): boolean {
    if (cards.length !== 2) return false;
    
    const [card1, card2] = cards;
    const rank1 = this.getRankValue(card1[0]);
    const rank2 = this.getRankValue(card2[0]);
    const suited = card1[1] === card2[1];
    
    // Create hand notation (e.g., "AKs" or "72o")
    const highRank = rank1 >= rank2 ? card1[0] : card2[0];
    const lowRank = rank1 >= rank2 ? card2[0] : card1[0];
    const handNotation = highRank + lowRank + (suited ? 's' : 'o');
    
    // If it's in our top rankings, it's conventional
    if (STARTING_HAND_RANKINGS[handNotation]) {
      return false;
    }
    
    // Consider it unconventional if it's not a pair and has low cards
    const isPair = rank1 === rank2;
    const hasHighCard = rank1 >= 10 || rank2 >= 10; // Ten or higher
    
    return !isPair && !hasHighCard;
  }

  private getRankValue(rank: string): number {
    const rankValues: { [key: string]: number } = {
      '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
      'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };
    return rankValues[rank] || 0;
  }

  calculateFinalScore(playerId: string, chipCount: number): number {
    const stats = this.playerStats.get(playerId);
    if (!stats) return chipCount;

    let totalMultiplier = 1.0;
    
    // Add persistent bonuses based on overall performance
    if (stats.unconventionalWins > 0) {
      totalMultiplier += 0.05 * Math.min(stats.unconventionalWins, 3); // Max 15%
    }
    
    if (stats.bluffsWon > 0) {
      totalMultiplier += 0.03 * Math.min(stats.bluffsWon, 5); // Max 15%
    }
    
    if (stats.comebackWins > 0) {
      totalMultiplier += 0.1 * Math.min(stats.comebackWins, 2); // Max 20%
    }
    
    // Action player bonus
    const actionBonus = this.getPlayerActionBonus(playerId);
    if (actionBonus) {
      totalMultiplier += actionBonus.multiplier;
    }
    
    // AI Accuracy Bonuses
    if (stats.handsPlayed > 10) {
      const handReadAccuracy = stats.correctHandReads / (stats.correctHandReads + stats.handMisreads);
      if (handReadAccuracy >= 0.9) {
        totalMultiplier += 0.1; // 10% bonus for excellent hand reading
      } else if (handReadAccuracy >= 0.8) {
        totalMultiplier += 0.05; // 5% bonus for good hand reading
      }
    }
    
    // AI Logic Penalties
    if (stats.handMisreads > 0) {
      // Penalty for misreading hands (entertainment value but poor play)
      totalMultiplier -= 0.02 * Math.min(stats.handMisreads, 5); // Max -10%
    }
    
    if (stats.illogicalDecisions > 0) {
      // Penalty for illogical plays
      totalMultiplier -= 0.03 * Math.min(stats.illogicalDecisions, 5); // Max -15%
    }
    
    // Ensure multiplier doesn't go below 0.5 (50% of chips)
    totalMultiplier = Math.max(totalMultiplier, 0.5);

    return Math.floor(chipCount * totalMultiplier);
  }

  recordAIEvaluation(playerId: string, handMisread: boolean, illogicalPlay: boolean, correctHandRead: boolean): void {
    const stats = this.playerStats.get(playerId);
    if (!stats) return;
    
    if (handMisread) stats.handMisreads++;
    if (illogicalPlay) stats.illogicalDecisions++;
    if (correctHandRead) stats.correctHandReads++;
  }

  getPlayerStats(playerId: string): PlayerStats | undefined {
    return this.playerStats.get(playerId);
  }

  getAllStats(): PlayerStats[] {
    return Array.from(this.playerStats.values());
  }

  getLeaderboard(currentChips: Map<string, number>): Array<{
    playerId: string;
    chipCount: number;
    styleScore: number;
    stats: PlayerStats;
  }> {
    const leaderboard = Array.from(currentChips.entries())
      .map(([playerId, chips]) => ({
        playerId,
        chipCount: chips,
        styleScore: this.calculateFinalScore(playerId, chips),
        stats: this.playerStats.get(playerId)!
      }))
      .filter(entry => entry.stats)
      .sort((a, b) => b.styleScore - a.styleScore);
    
    return leaderboard;
  }
}