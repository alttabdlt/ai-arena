import { Card } from '../engine/poker-engine';

// Hand tier classifications for unconventional hand bonuses
export const HAND_TIERS = {
  TRASH: {
    hands: ['27o', '28o', '38o', '48o', '23o', '24o', '34o', '25o', '35o', '26o'],
    points: 500,
    name: 'Trash Tier'
  },
  GARBAGE: {
    hands: ['29o', '39o', '49o', '59o', '36o', '46o', '56o', '37o', '47o', '57o'],
    points: 400,
    name: 'Garbage Tier'
  },
  WEAK: {
    hands: ['T2o', 'T3o', 'T4o', 'T5o', 'T6o', 'J2o', 'J3o', 'J4o', 'J5o', 'J6o'],
    points: 300,
    name: 'Weak Tier'
  },
  BELOW_AVERAGE: {
    hands: ['K2o', 'K3o', 'K4o', 'K5o', 'K6o', 'Q2o', 'Q3o', 'Q4o', 'Q5o', 'Q6o', 'Q7o'],
    points: 200,
    name: 'Below Average'
  },
  MARGINAL: {
    hands: ['65s', '54s', '64s', '53s', '63s', '52s', '43s', '32s', '76s', '75s', '74s', '73s', '72s'],
    points: 100,
    name: 'Marginal'
  }
};

export interface PointEvent {
  playerId: string;
  points: number;
  type: 'base' | 'style' | 'penalty';
  category: string;
  description: string;
  timestamp: number;
}

export interface PlayerPoints {
  playerId: string;
  basePoints: number;
  stylePoints: number;
  penaltyPoints: number;
  totalPoints: number;
  pointHistory: PointEvent[];
  // Tracking for achievements
  trashTierWins: number;
  successfulBluffs: number;
  perfectReads: number;
  comebackWins: number;
  eliminations: number;
}

export interface BluffInfo {
  potSize: number;
  opponentCount: number;
  isRiver: boolean;
}

export interface TournamentMode {
  name: string;
  baseWeight: number;
  styleWeight: number;
  penaltyWeight: number;
}

export const TOURNAMENT_MODES: { [key: string]: TournamentMode } = {
  STYLE_MASTER: {
    name: 'Style Master',
    baseWeight: 0.3,
    styleWeight: 0.7,
    penaltyWeight: 1.0
  },
  BALANCED: {
    name: 'Balanced',
    baseWeight: 0.5,
    styleWeight: 0.5,
    penaltyWeight: 1.0
  },
  CLASSIC: {
    name: 'Classic',
    baseWeight: 0.7,
    styleWeight: 0.3,
    penaltyWeight: 1.0
  }
};

export class PointScoringSystem {
  private playerPoints: Map<string, PlayerPoints> = new Map();
  private currentMode: TournamentMode = TOURNAMENT_MODES.BALANCED;
  private pointEventCallbacks: ((event: PointEvent) => void)[] = [];
  private handsPlayed: number = 0;

  constructor(mode: keyof typeof TOURNAMENT_MODES = 'BALANCED') {
    this.currentMode = TOURNAMENT_MODES[mode];
  }

  initializePlayer(playerId: string): void {
    if (!this.playerPoints.has(playerId)) {
      this.playerPoints.set(playerId, {
        playerId,
        basePoints: 0,
        stylePoints: 0,
        penaltyPoints: 0,
        totalPoints: 0,
        pointHistory: [],
        trashTierWins: 0,
        successfulBluffs: 0,
        perfectReads: 0,
        comebackWins: 0,
        eliminations: 0
      });
    }
  }

  // Subscribe to point events
  onPointEvent(callback: (event: PointEvent) => void): void {
    this.pointEventCallbacks.push(callback);
  }

  private emitPointEvent(event: PointEvent): void {
    const player = this.playerPoints.get(event.playerId);
    if (!player) return;

    player.pointHistory.push(event);
    
    // Update point totals
    if (event.type === 'base') {
      player.basePoints += event.points;
    } else if (event.type === 'style') {
      player.stylePoints += event.points;
    } else if (event.type === 'penalty') {
      player.penaltyPoints += Math.abs(event.points); // Store as positive
    }

    // Recalculate total with weights
    player.totalPoints = Math.floor(
      (player.basePoints * this.currentMode.baseWeight) +
      (player.stylePoints * this.currentMode.styleWeight) -
      (player.penaltyPoints * this.currentMode.penaltyWeight)
    );

    // Emit to subscribers
    this.pointEventCallbacks.forEach(cb => cb(event));
  }

  // Base Points Methods
  awardChipPoints(playerId: string, chips: number): void {
    const points = Math.floor(chips / 100);
    this.emitPointEvent({
      playerId,
      points,
      type: 'base',
      category: 'chips',
      description: `${points} points for ${chips} chips`,
      timestamp: Date.now()
    });
  }

  awardSurvivalBonus(playerId: string): void {
    const points = 500;
    this.emitPointEvent({
      playerId,
      points,
      type: 'base',
      category: 'survival',
      description: 'Survived 10 hands',
      timestamp: Date.now()
    });
  }

  awardPositionPoints(playerId: string, position: number, totalPlayers: number): void {
    const positionPoints = [2000, 1000, 500, 250, 100];
    const points = positionPoints[position - 1] || 50;
    
    this.emitPointEvent({
      playerId,
      points,
      type: 'base',
      category: 'position',
      description: `Finished in position ${position} of ${totalPlayers}`,
      timestamp: Date.now()
    });
  }

  // Style Points Methods
  recordHandWin(playerId: string, holeCards: Card[], potSize: number, showdown: boolean): void {
    // Check for unconventional hand bonus
    const handNotation = this.getHandNotation(holeCards);
    let unconventionalPoints = 0;
    let tierName = '';

    for (const [tier, config] of Object.entries(HAND_TIERS)) {
      if (config.hands.includes(handNotation)) {
        unconventionalPoints = config.points;
        tierName = config.name;
        if (tier === 'TRASH') {
          const player = this.playerPoints.get(playerId);
          if (player) player.trashTierWins++;
        }
        break;
      }
    }

    if (unconventionalPoints > 0) {
      this.emitPointEvent({
        playerId,
        points: unconventionalPoints,
        type: 'style',
        category: 'unconventional',
        description: `Won with ${tierName} hand (${handNotation})`,
        timestamp: Date.now()
      });
    }

    // Pot size bonus
    const potPoints = Math.floor(potSize / 50);
    if (potPoints > 0) {
      this.emitPointEvent({
        playerId,
        points: potPoints,
        type: 'style',
        category: 'pot_size',
        description: `Won pot of ${potSize} chips`,
        timestamp: Date.now()
      });
    }
  }

  recordBluff(playerId: string, bluffInfo: BluffInfo): void {
    let points = 250; // Base bluff points
    let description = 'Successful bluff';

    // Big bluff bonus
    if (bluffInfo.potSize > 2000) {
      points = 500;
      description = 'Big bluff success';
    }

    // Hero bluff bonus
    if (bluffInfo.opponentCount >= 2) {
      points = 750;
      description = 'Hero bluff vs multiple opponents';
    }

    // Perfect timing bonus
    if (bluffInfo.isRiver) {
      points += 100; // Add to existing
      description += ' on river';
    }

    const player = this.playerPoints.get(playerId);
    if (player) player.successfulBluffs++;

    this.emitPointEvent({
      playerId,
      points,
      type: 'style',
      category: 'bluff',
      description,
      timestamp: Date.now()
    });
  }

  recordDavidVsGoliath(playerId: string, stackRatio: number): void {
    if (stackRatio >= 3) {
      this.emitPointEvent({
        playerId,
        points: 400,
        type: 'style',
        category: 'david_goliath',
        description: `Defeated opponent with ${stackRatio.toFixed(1)}x larger stack`,
        timestamp: Date.now()
      });
    }
  }

  recordComeback(playerId: string, startingStackPercent: number): void {
    if (startingStackPercent < 20) {
      const player = this.playerPoints.get(playerId);
      if (player) player.comebackWins++;

      this.emitPointEvent({
        playerId,
        points: 600,
        type: 'style',
        category: 'comeback',
        description: `Won with only ${startingStackPercent.toFixed(0)}% of pot`,
        timestamp: Date.now()
      });
    }
  }

  recordElimination(playerId: string, eliminatedPlayer: string): void {
    const player = this.playerPoints.get(playerId);
    if (player) player.eliminations++;

    this.emitPointEvent({
      playerId,
      points: 300,
      type: 'style',
      category: 'elimination',
      description: `Eliminated ${eliminatedPlayer}`,
      timestamp: Date.now()
    });
  }

  recordAggressiveAction(playerId: string, action: string): void {
    if (action === 'raise' || action === 're-raise' || action === 'all-in') {
      this.emitPointEvent({
        playerId,
        points: 50,
        type: 'style',
        category: 'aggressive',
        description: `Aggressive ${action}`,
        timestamp: Date.now()
      });
    }
  }

  // Penalty Methods
  recordHandMisread(playerId: string, severity: 'MINOR' | 'MAJOR' | 'CRITICAL', details: string): void {
    const penaltyMap = {
      MINOR: 100,
      MAJOR: 250,
      CRITICAL: 500
    };

    this.emitPointEvent({
      playerId,
      points: -penaltyMap[severity],
      type: 'penalty',
      category: 'misread',
      description: `${severity} misread: ${details}`,
      timestamp: Date.now()
    });
  }

  recordIllogicalDecision(playerId: string, details: string): void {
    this.emitPointEvent({
      playerId,
      points: -300,
      type: 'penalty',
      category: 'illogical',
      description: `Illogical play: ${details}`,
      timestamp: Date.now()
    });
  }

  recordPassivePlay(playerId: string, vpip: number): void {
    if (vpip < 30) {
      this.emitPointEvent({
        playerId,
        points: -200,
        type: 'penalty',
        category: 'passive',
        description: `Passive play (${vpip}% VPIP)`,
        timestamp: Date.now()
      });
    }
  }

  recordPredictablePlay(playerId: string): void {
    this.emitPointEvent({
      playerId,
      points: -300,
      type: 'penalty',
      category: 'predictable',
      description: 'No bluffs in 20 hands',
      timestamp: Date.now()
    });
  }

  // Helper Methods
  private getHandNotation(cards: Card[]): string {
    if (cards.length !== 2) return '';
    
    const [card1, card2] = cards;
    const rank1 = this.getRankValue(card1[0]);
    const rank2 = this.getRankValue(card2[0]);
    const suited = card1[1] === card2[1];
    
    const highRank = rank1 >= rank2 ? card1[0] : card2[0];
    const lowRank = rank1 >= rank2 ? card2[0] : card1[0];
    
    return highRank + lowRank + (suited ? 's' : 'o');
  }

  private getRankValue(rank: string): number {
    const rankValues: { [key: string]: number } = {
      '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
      'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };
    return rankValues[rank] || 0;
  }

  // Getters
  getPlayerPoints(playerId: string): PlayerPoints | undefined {
    return this.playerPoints.get(playerId);
  }

  getAllPlayerPoints(): PlayerPoints[] {
    return Array.from(this.playerPoints.values());
  }

  getLeaderboard(): Array<{
    playerId: string;
    totalPoints: number;
    basePoints: number;
    stylePoints: number;
    penaltyPoints: number;
  }> {
    return this.getAllPlayerPoints()
      .map(player => ({
        playerId: player.playerId,
        totalPoints: player.totalPoints,
        basePoints: player.basePoints,
        stylePoints: player.stylePoints,
        penaltyPoints: player.penaltyPoints
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints);
  }

  setTournamentMode(mode: keyof typeof TOURNAMENT_MODES): void {
    this.currentMode = TOURNAMENT_MODES[mode];
    // Recalculate all totals with new weights
    this.playerPoints.forEach(player => {
      player.totalPoints = Math.floor(
        (player.basePoints * this.currentMode.baseWeight) +
        (player.stylePoints * this.currentMode.styleWeight) -
        (player.penaltyPoints * this.currentMode.penaltyWeight)
      );
    });
  }

  incrementHandCount(): void {
    this.handsPlayed++;
    // Check for survival bonuses every 10 hands
    if (this.handsPlayed % 10 === 0) {
      this.playerPoints.forEach(player => {
        this.awardSurvivalBonus(player.playerId);
      });
    }
  }
}