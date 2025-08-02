import { BaseScoringSystem } from '../../../base/BaseScoringSystem';
import { IGameEvent, IScoreBreakdown } from '../../../core/interfaces';
import { IGameContext } from '../../../core/context';
import { PokerGameState, PokerPlayer, Card } from '../PokerTypes';
import { SimpleBonusRule, SimplePenaltyRule } from '../../../scoring/ScoringConfiguration';

export interface PokerStyleBonus {
  type: 'david-goliath' | 'bluff-master' | 'unconventional' | 'comeback' | 
        'action-player' | 'accurate-reader' | 'logical-player' | 'trash-hand-win';
  points: number;
  description: string;
}

export interface PokerHandResult {
  winnerId: string;
  potSize: number;
  showdown: boolean;
  winnerStartingStack: number;
  winnerHoleCards: Card[];
  loserStacks: number[];
  wasAggressor: boolean;
  communityCards?: Card[];
  handRank?: number;
}

const TRASH_HANDS: string[] = ['72', '83', '73', '93', '82', '74', '94', '84', '62', '92'];

export class PokerScoringSystem extends BaseScoringSystem<PokerGameState> {
  private playerStats: Map<string, {
    handsPlayed: number;
    handsWon: number;
    showdownsWon: number;
    bluffsWon: number;
    comebackWins: number;
    unconventionalWins: number;
    aggressiveActions: number;
    totalActions: number;
    biggestPotWon: number;
    totalWinnings: number;
    handMisreads: number;
    criticalMisreads: number;
    illogicalDecisions: number;
    correctHandReads: number;
  }> = new Map();

  private currentHandStats: Map<string, {
    startingStack: number;
    invested: number;
    wasAggressor: boolean;
    holeCards: Card[];
  }> = new Map();

  protected bonusRules: SimpleBonusRule<PokerGameState>[] = [];
  protected penaltyRules: SimplePenaltyRule<PokerGameState>[] = [];

  constructor(context: IGameContext) {
    super(context);
  }

  protected initializeRules(): void {
    this.rules = [
      {
        id: 'david-goliath',
        name: 'David vs Goliath',
        category: 'style',
        evaluate: (state: PokerGameState) => {
          const lastWinner = this.getLastHandWinner(state);
          if (!lastWinner) return 0;
          
          const winnerStats = this.currentHandStats.get(lastWinner);
          if (!winnerStats) return 0;

          const largestOpponentStack = Math.max(
            ...state.players
              .filter(p => p.id !== lastWinner)
              .map(p => this.currentHandStats.get(p.id)?.startingStack || 0)
          );

          if (winnerStats.startingStack < largestOpponentStack * 0.33) {
            return 300;
          }
          return 0;
        },
        description: 'Defeated opponent with 3x larger stack'
      },
      {
        id: 'bluff-master',
        name: 'Bluff Master',
        category: 'style',
        evaluate: (state: PokerGameState, event?: IGameEvent) => {
          if (event?.type !== 'hand:completed') return 0;
          
          const winners = event.data?.winners || [];
          if (winners.length === 0 || event.data?.showdown) return 0;

          const winnerId = winners[0].playerId;
          const winnerStats = this.currentHandStats.get(winnerId);
          
          if (winnerStats?.wasAggressor) {
            const potSize = state.pot;
            if (potSize > state.bigBlind * 20) return 500;
            if (potSize > state.bigBlind * 10) return 300;
            return 200;
          }
          return 0;
        },
        description: 'Won pot without showdown after aggressive action'
      },
      {
        id: 'trash-hand-win',
        name: 'Trash Hand Victory',
        category: 'style',
        evaluate: (state: PokerGameState, event?: IGameEvent) => {
          if (event?.type !== 'hand:completed' || !event.data?.showdown) return 0;
          
          const winnerId = event.data?.winners?.[0]?.playerId;
          if (!winnerId) return 0;

          const winnerStats = this.currentHandStats.get(winnerId);
          if (!winnerStats) return 0;

          const holeCards = winnerStats.holeCards;
          if (holeCards.length === 2) {
            const hand = this.getHandRanking(holeCards);
            if (TRASH_HANDS.includes(hand)) {
              return 500;
            }
          }
          return 0;
        },
        description: 'Won with trash starting hand'
      },
      {
        id: 'comeback-king',
        name: 'Comeback King',
        category: 'style',
        evaluate: (state: PokerGameState) => {
          const lastWinner = this.getLastHandWinner(state);
          if (!lastWinner) return 0;
          
          const winnerStats = this.currentHandStats.get(lastWinner);
          if (!winnerStats) return 0;

          const avgStack = state.players.reduce((sum, p) => sum + p.chips, 0) / state.players.length;
          if (winnerStats.startingStack < avgStack * 0.1) {
            return 400;
          }
          return 0;
        },
        description: 'Won with less than 10% of average stack'
      }
    ];

    this.bonusRules = this.rules
      .filter(r => r.category === 'style')
      .map(r => new SimpleBonusRule(
        r.id,
        r.name,
        r.description,
        r.category,
        (state, playerId, events) => r.evaluate(state, events[events.length - 1])
      ));

    this.penaltyRules = [
      new SimplePenaltyRule(
        'hand-misread',
        'Hand Misread',
        'Misidentified hand strength',
        'medium',
        (state, playerId, events) => {
          const misreadEvents = events.filter(
            e => e.type === 'hand:misread' && e.playerId === playerId
          );
          return misreadEvents.length * 100;
        }
      ),
      new SimplePenaltyRule(
        'critical-misread',
        'Critical Misread',
        'Folded the nuts or missed obvious hand',
        'high',
        (state, playerId, events) => {
          const criticalEvents = events.filter(
            e => e.type === 'hand:misread' && 
                 e.playerId === playerId && 
                 e.data?.severity === 'CRITICAL'
          );
          return criticalEvents.length * 500;
        }
      ),
      new SimplePenaltyRule(
        'illogical-play',
        'Illogical Play',
        'Made decision that violates basic poker logic',
        'low',
        (state, playerId, events) => {
          const illogicalEvents = events.filter(
            e => e.type === 'action:illogical' && e.playerId === playerId
          );
          return illogicalEvents.length * 50;
        }
      )
    ];
  }

  protected calculateBasePoints(state: PokerGameState, playerId: string): number {
    const player = state.players.find(p => p.id === playerId) as PokerPlayer;
    if (!player) return 0;
    
    return player.chips;
  }

  protected calculatePenaltyPoints(state: PokerGameState, playerId: string): number {
    let totalPenalty = 0;
    
    for (const rule of this.penaltyRules) {
      totalPenalty += rule.calculate(state, playerId, this.events);
    }
    
    return totalPenalty;
  }

  protected getPenaltyBreakdown(state: PokerGameState, playerId: string): IScoreBreakdown[] {
    return this.penaltyRules.map(rule => ({
      category: 'Penalty',
      description: rule.description,
      points: -rule.calculate(state, playerId, this.events)
    })).filter(b => b.points !== 0);
  }

  protected isScorableEvent(event: IGameEvent): boolean {
    return ['action:executed', 'hand:completed', 'hand:misread', 'action:illogical'].includes(event.type);
  }

  protected processScorableEvent(event: IGameEvent): void {
    if (!event.playerId) return;

    const stats = this.getOrCreatePlayerStats(event.playerId);

    switch (event.type) {
      case 'action:executed':
        stats.totalActions++;
        const action = event.data?.action;
        if (action && ['bet', 'raise', 'all-in'].includes(action.type)) {
          stats.aggressiveActions++;
          const handStats = this.currentHandStats.get(event.playerId);
          if (handStats) {
            handStats.wasAggressor = true;
          }
        }
        break;

      case 'hand:completed':
        const winners = event.data?.winners || [];
        winners.forEach((winner: any) => {
          const winnerStats = this.getOrCreatePlayerStats(winner.playerId);
          winnerStats.handsWon++;
          winnerStats.totalWinnings += winner.amount;
          if (winner.amount > winnerStats.biggestPotWon) {
            winnerStats.biggestPotWon = winner.amount;
          }
          if (event.data?.showdown) {
            winnerStats.showdownsWon++;
          } else {
            const handStats = this.currentHandStats.get(winner.playerId);
            if (handStats?.wasAggressor) {
              winnerStats.bluffsWon++;
            }
          }
        });
        break;

      case 'hand:misread':
        stats.handMisreads++;
        if (event.data?.severity === 'CRITICAL') {
          stats.criticalMisreads++;
        }
        break;

      case 'action:illogical':
        stats.illogicalDecisions++;
        break;
    }
  }

  protected getEventBonus(event: IGameEvent): number {
    if (event.type === 'hand:completed' && event.data?.styleBonuses) {
      return event.data.styleBonuses.reduce((sum: number, bonus: any) => sum + bonus.points, 0);
    }
    return 0;
  }

  protected updateTrackerWithEvent(tracker: any, event: IGameEvent): void {
    if (event.type === 'action:executed') {
      tracker.actions++;
      if (event.data?.action?.type === 'win') {
        tracker.successes++;
        tracker.streaks.current++;
        if (tracker.streaks.current > tracker.streaks.best) {
          tracker.streaks.best = tracker.streaks.current;
        }
      } else if (event.data?.action?.type === 'fold') {
        tracker.streaks.current = 0;
      }
    }
  }

  protected detectAchievements(event: IGameEvent): string[] {
    const achievements: string[] = [];
    
    if (event.type === 'hand:completed' && event.playerId) {
      const stats = this.getOrCreatePlayerStats(event.playerId);
      
      if (stats.handsWon === 1) {
        achievements.push('first-blood');
      }
      
      if (stats.bluffsWon === 5) {
        achievements.push('master-bluffer');
      }
      
      if (stats.unconventionalWins === 3) {
        achievements.push('unconventional-genius');
      }
      
      if (stats.comebackWins === 2) {
        achievements.push('never-give-up');
      }
    }
    
    return achievements;
  }

  recordHandStart(players: PokerPlayer[]): void {
    this.currentHandStats.clear();
    players.forEach(player => {
      if (!player.folded) {
        this.currentHandStats.set(player.id, {
          startingStack: player.chips + player.bet,
          invested: 0,
          wasAggressor: false,
          holeCards: [...player.cards]
        });
        
        const stats = this.getOrCreatePlayerStats(player.id);
        stats.handsPlayed++;
      }
    });
  }

  private getOrCreatePlayerStats(playerId: string) {
    if (!this.playerStats.has(playerId)) {
      this.playerStats.set(playerId, {
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
        correctHandReads: 0
      });
    }
    return this.playerStats.get(playerId)!;
  }

  private getLastHandWinner(state: PokerGameState): string | null {
    if (state.winners.length > 0) {
      return state.winners[0].playerId;
    }
    return null;
  }

  private getHandRanking(cards: Card[]): string {
    if (cards.length !== 2) return '';
    
    const [card1, card2] = cards;
    const rank1 = card1[0];
    const rank2 = card2[0];
    const suit1 = card1[1];
    const suit2 = card2[1];
    
    const suited = suit1 === suit2 ? 's' : 'o';
    
    if (rank1 === rank2) {
      return rank1 + rank2;
    }
    
    const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
    const index1 = ranks.indexOf(rank1);
    const index2 = ranks.indexOf(rank2);
    
    if (index1 < index2) {
      return rank1 + rank2 + suited;
    } else {
      return rank2 + rank1 + suited;
    }
  }

  getPlayerStats(playerId: string) {
    return this.playerStats.get(playerId) || this.getOrCreatePlayerStats(playerId);
  }
}