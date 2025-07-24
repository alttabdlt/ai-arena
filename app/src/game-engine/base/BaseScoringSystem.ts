import { 
  IGameScoringSystem, 
  IGameState, 
  IScoreResult, 
  ILeaderboardEntry,
  IGameEvent,
  IScoreBreakdown
} from '../core/interfaces';
import { IGameContext } from '../core/context';

export interface ScoringRule<TState extends IGameState> {
  id: string;
  name: string;
  category: string;
  evaluate(state: TState, event?: IGameEvent): number;
  description: string;
}

export abstract class BaseScoringSystem<TState extends IGameState> 
  implements IGameScoringSystem<TState> {
  
  protected context: IGameContext;
  protected scores: Map<string, number> = new Map();
  protected events: IGameEvent[] = [];
  protected rules: ScoringRule<TState>[] = [];
  protected bonusTrackers: Map<string, any> = new Map();

  constructor(context: IGameContext) {
    this.context = context;
    this.initializeRules();
  }

  calculateScore(state: TState): IScoreResult {
    const results: IScoreResult[] = [];

    for (const player of state.players) {
      const basePoints = this.calculateBasePoints(state, player.id);
      const bonusPoints = this.calculateBonusPoints(state, player.id);
      const penaltyPoints = this.calculatePenaltyPoints(state, player.id);
      const breakdown = this.getScoreBreakdown(state, player.id);

      const totalScore = basePoints + bonusPoints - penaltyPoints;
      this.scores.set(player.id, totalScore);

      results.push({
        playerId: player.id,
        basePoints,
        bonusPoints,
        penaltyPoints,
        totalScore,
        breakdown
      });
    }

    this.emitScoreUpdate(results);
    
    return results[0];
  }

  trackEvent(event: IGameEvent): void {
    this.events.push(event);
    
    this.updateBonusTrackers(event);
    
    if (this.isScorableEvent(event)) {
      this.processScorableEvent(event);
    }

    this.checkAchievements(event);
  }

  getLeaderboard(): ILeaderboardEntry[] {
    const entries: ILeaderboardEntry[] = [];
    const sortedScores = Array.from(this.scores.entries())
      .sort((a, b) => b[1] - a[1]);

    sortedScores.forEach(([playerId, score], index) => {
      const player = this.getPlayerName(playerId);
      entries.push({
        playerId,
        playerName: player,
        score,
        rank: index + 1
      });
    });

    return entries;
  }

  reset(): void {
    this.scores.clear();
    this.events = [];
    this.bonusTrackers.clear();
    this.initializeRules();
  }

  protected getScoreBreakdown(state: TState, playerId: string): IScoreBreakdown[] {
    const breakdown: IScoreBreakdown[] = [];
    
    breakdown.push({
      category: 'base',
      description: 'Base score',
      points: this.calculateBasePoints(state, playerId)
    });

    for (const rule of this.rules) {
      const points = rule.evaluate(state);
      if (points !== 0) {
        breakdown.push({
          category: rule.category,
          description: rule.description,
          points
        });
      }
    }

    const penalties = this.getPenaltyBreakdown(state, playerId);
    breakdown.push(...penalties);

    return breakdown;
  }

  protected calculateBonusPoints(state: TState, playerId: string): number {
    let totalBonus = 0;
    
    for (const rule of this.rules) {
      if (rule.category === 'bonus') {
        totalBonus += rule.evaluate(state);
      }
    }

    const eventBonuses = this.calculateEventBonuses(playerId);
    totalBonus += eventBonuses;

    return totalBonus;
  }

  protected calculateEventBonuses(playerId: string): number {
    let bonus = 0;
    
    const playerEvents = this.events.filter(e => e.playerId === playerId);
    for (const event of playerEvents) {
      bonus += this.getEventBonus(event);
    }

    return bonus;
  }

  protected updateBonusTrackers(event: IGameEvent): void {
    if (!event.playerId) return;

    const tracker = this.bonusTrackers.get(event.playerId) || this.createBonusTracker();
    this.updateTrackerWithEvent(tracker, event);
    this.bonusTrackers.set(event.playerId, tracker);
  }

  protected checkAchievements(event: IGameEvent): void {
    const achievements = this.detectAchievements(event);
    
    if (achievements.length > 0) {
      this.context.eventBus.emit({
        type: 'achievements:unlocked',
        timestamp: new Date(),
        playerId: event.playerId,
        data: { achievements }
      });
    }
  }

  protected emitScoreUpdate(scores: IScoreResult[]): void {
    this.context.eventBus.emit({
      type: 'scores:updated',
      timestamp: new Date(),
      data: { scores, leaderboard: this.getLeaderboard() }
    });
  }

  protected getPlayerName(playerId: string): string {
    return playerId;
  }

  protected createBonusTracker(): any {
    return {
      actions: 0,
      successes: 0,
      failures: 0,
      streaks: {
        current: 0,
        best: 0
      }
    };
  }

  protected abstract initializeRules(): void;
  protected abstract calculateBasePoints(state: TState, playerId: string): number;
  protected abstract calculatePenaltyPoints(state: TState, playerId: string): number;
  protected abstract getPenaltyBreakdown(state: TState, playerId: string): IScoreBreakdown[];
  protected abstract isScorableEvent(event: IGameEvent): boolean;
  protected abstract processScorableEvent(event: IGameEvent): void;
  protected abstract getEventBonus(event: IGameEvent): number;
  protected abstract updateTrackerWithEvent(tracker: any, event: IGameEvent): void;
  protected abstract detectAchievements(event: IGameEvent): string[];
}