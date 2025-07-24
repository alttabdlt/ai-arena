import { IGameAchievement, IGameState, IGameEvent } from '../core/interfaces';

export abstract class BaseAchievement implements IGameAchievement {
  public readonly id: string;
  public readonly name: string;
  public readonly description: string;
  public readonly category: 'skill' | 'style' | 'milestone' | 'special';
  public readonly rarity: 'common' | 'rare' | 'epic' | 'legendary';
  public readonly points: number;
  public readonly icon?: string;

  constructor(config: {
    id: string;
    name: string;
    description: string;
    category: 'skill' | 'style' | 'milestone' | 'special';
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    points: number;
    icon?: string;
  }) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.category = config.category;
    this.rarity = config.rarity;
    this.points = config.points;
    this.icon = config.icon;
  }

  abstract checkCondition(state: IGameState, event?: IGameEvent): boolean;
}

export class SimpleAchievement extends BaseAchievement {
  private condition: (state: IGameState, event?: IGameEvent) => boolean;

  constructor(
    config: {
      id: string;
      name: string;
      description: string;
      category: 'skill' | 'style' | 'milestone' | 'special';
      rarity: 'common' | 'rare' | 'epic' | 'legendary';
      points: number;
      icon?: string;
    },
    condition: (state: IGameState, event?: IGameEvent) => boolean
  ) {
    super(config);
    this.condition = condition;
  }

  checkCondition(state: IGameState, event?: IGameEvent): boolean {
    return this.condition(state, event);
  }
}

export class CounterAchievement extends BaseAchievement {
  protected counter: Map<string, number> = new Map();
  protected threshold: number;
  protected resetOnGame: boolean;

  constructor(
    config: {
      id: string;
      name: string;
      description: string;
      category: 'skill' | 'style' | 'milestone' | 'special';
      rarity: 'common' | 'rare' | 'epic' | 'legendary';
      points: number;
      icon?: string;
    },
    threshold: number,
    resetOnGame: boolean = true
  ) {
    super(config);
    this.threshold = threshold;
    this.resetOnGame = resetOnGame;
  }

  checkCondition(state: IGameState, event?: IGameEvent): boolean {
    if (!event || !event.playerId) return false;

    const count = this.counter.get(event.playerId) || 0;
    
    if (this.shouldIncrement(state, event)) {
      this.counter.set(event.playerId, count + 1);
    }

    return (this.counter.get(event.playerId) || 0) >= this.threshold;
  }

  reset(playerId?: string): void {
    if (playerId) {
      this.counter.delete(playerId);
    } else {
      this.counter.clear();
    }
  }

  protected shouldIncrement(state: IGameState, event: IGameEvent): boolean {
    return true;
  }
}

export class StreakAchievement extends BaseAchievement {
  protected streaks: Map<string, number> = new Map();
  protected maxStreaks: Map<string, number> = new Map();
  protected requiredStreak: number;

  constructor(
    config: {
      id: string;
      name: string;
      description: string;
      category: 'skill' | 'style' | 'milestone' | 'special';
      rarity: 'common' | 'rare' | 'epic' | 'legendary';
      points: number;
      icon?: string;
    },
    requiredStreak: number
  ) {
    super(config);
    this.requiredStreak = requiredStreak;
  }

  checkCondition(state: IGameState, event?: IGameEvent): boolean {
    if (!event || !event.playerId) return false;

    const currentStreak = this.streaks.get(event.playerId) || 0;
    
    if (this.continuesStreak(state, event)) {
      const newStreak = currentStreak + 1;
      this.streaks.set(event.playerId, newStreak);
      
      const maxStreak = this.maxStreaks.get(event.playerId) || 0;
      if (newStreak > maxStreak) {
        this.maxStreaks.set(event.playerId, newStreak);
      }
    } else if (this.breaksStreak(state, event)) {
      this.streaks.set(event.playerId, 0);
    }

    return (this.maxStreaks.get(event.playerId) || 0) >= this.requiredStreak;
  }

  protected continuesStreak(state: IGameState, event: IGameEvent): boolean {
    return false;
  }

  protected breaksStreak(state: IGameState, event: IGameEvent): boolean {
    return false;
  }
}

export class ConditionalAchievement extends BaseAchievement {
  private conditions: Array<(state: IGameState, event?: IGameEvent) => boolean>;
  private requireAll: boolean;

  constructor(
    config: {
      id: string;
      name: string;
      description: string;
      category: 'skill' | 'style' | 'milestone' | 'special';
      rarity: 'common' | 'rare' | 'epic' | 'legendary';
      points: number;
      icon?: string;
    },
    conditions: Array<(state: IGameState, event?: IGameEvent) => boolean>,
    requireAll: boolean = true
  ) {
    super(config);
    this.conditions = conditions;
    this.requireAll = requireAll;
  }

  checkCondition(state: IGameState, event?: IGameEvent): boolean {
    if (this.requireAll) {
      return this.conditions.every(condition => condition(state, event));
    } else {
      return this.conditions.some(condition => condition(state, event));
    }
  }
}