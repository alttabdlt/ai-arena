import { IGameState, IGameEvent, IScoreBreakdown } from '../core/interfaces';

export interface ScoringWeight {
  category: string;
  weight: number;
  description: string;
}

export interface ScoringCategory {
  id: string;
  name: string;
  description: string;
  baseMultiplier: number;
  maxPoints?: number;
}

export interface ScoringConfiguration<TState extends IGameState> {
  categories: ScoringCategory[];
  weights: ScoringWeight[];
  bonusRules: BonusRule<TState>[];
  penaltyRules: PenaltyRule<TState>[];
}

export interface BonusRule<TState extends IGameState> {
  id: string;
  name: string;
  description: string;
  category: string;
  calculate(state: TState, playerId: string, events: IGameEvent[]): number;
}

export interface PenaltyRule<TState extends IGameState> {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  calculate(state: TState, playerId: string, events: IGameEvent[]): number;
}

export class StandardScoringConfiguration<TState extends IGameState> 
  implements ScoringConfiguration<TState> {
  
  categories: ScoringCategory[] = [
    {
      id: 'base',
      name: 'Base Score',
      description: 'Core game performance',
      baseMultiplier: 1.0
    },
    {
      id: 'style',
      name: 'Style Points',
      description: 'Creative and entertaining plays',
      baseMultiplier: 0.5,
      maxPoints: 5000
    },
    {
      id: 'efficiency',
      name: 'Efficiency',
      description: 'Optimal decision making',
      baseMultiplier: 0.3
    }
  ];

  weights: ScoringWeight[] = [
    {
      category: 'base',
      weight: 0.5,
      description: 'Primary scoring component'
    },
    {
      category: 'style',
      weight: 0.3,
      description: 'Bonus for entertaining play'
    },
    {
      category: 'efficiency',
      weight: 0.2,
      description: 'Reward for optimal decisions'
    }
  ];

  bonusRules: BonusRule<TState>[] = [];
  penaltyRules: PenaltyRule<TState>[] = [];
}

export class CompetitiveScoringConfiguration<TState extends IGameState> 
  extends StandardScoringConfiguration<TState> {
  
  constructor() {
    super();
    
    this.weights = [
      {
        category: 'base',
        weight: 0.7,
        description: 'Winning is paramount'
      },
      {
        category: 'efficiency',
        weight: 0.25,
        description: 'Optimal play rewarded'
      },
      {
        category: 'style',
        weight: 0.05,
        description: 'Minor style consideration'
      }
    ];
  }
}

export class EntertainmentScoringConfiguration<TState extends IGameState> 
  extends StandardScoringConfiguration<TState> {
  
  constructor() {
    super();
    
    this.weights = [
      {
        category: 'style',
        weight: 0.6,
        description: 'Entertainment value is key'
      },
      {
        category: 'base',
        weight: 0.3,
        description: 'Still need to play well'
      },
      {
        category: 'efficiency',
        weight: 0.1,
        description: 'Efficiency less important'
      }
    ];
    
    this.categories.push({
      id: 'audience',
      name: 'Audience Appeal',
      description: 'Crowd-pleasing moves',
      baseMultiplier: 2.0,
      maxPoints: 10000
    });
  }
}

export class SimpleBonusRule<TState extends IGameState> implements BonusRule<TState> {
  constructor(
    public id: string,
    public name: string,
    public description: string,
    public category: string,
    private calculateFn: (state: TState, playerId: string, events: IGameEvent[]) => number
  ) {}

  calculate(state: TState, playerId: string, events: IGameEvent[]): number {
    return this.calculateFn(state, playerId, events);
  }
}

export class SimplePenaltyRule<TState extends IGameState> implements PenaltyRule<TState> {
  constructor(
    public id: string,
    public name: string,
    public description: string,
    public severity: 'low' | 'medium' | 'high',
    private calculateFn: (state: TState, playerId: string, events: IGameEvent[]) => number
  ) {}

  calculate(state: TState, playerId: string, events: IGameEvent[]): number {
    return this.calculateFn(state, playerId, events);
  }
}

export class ScoringCalculator<TState extends IGameState> {
  constructor(private config: ScoringConfiguration<TState>) {}

  calculateTotalScore(
    state: TState, 
    playerId: string, 
    events: IGameEvent[],
    baseScore: number
  ): { total: number; breakdown: IScoreBreakdown[] } {
    const breakdown: IScoreBreakdown[] = [];
    let weightedTotal = 0;

    this.config.categories.forEach(category => {
      let categoryScore = 0;
      
      if (category.id === 'base') {
        categoryScore = baseScore * category.baseMultiplier;
      } else {
        const bonuses = this.config.bonusRules
          .filter(rule => rule.category === category.id)
          .reduce((sum, rule) => sum + rule.calculate(state, playerId, events), 0);
        
        categoryScore = bonuses * category.baseMultiplier;
        
        if (category.maxPoints && categoryScore > category.maxPoints) {
          categoryScore = category.maxPoints;
        }
      }

      const weight = this.config.weights.find(w => w.category === category.id)?.weight || 0;
      weightedTotal += categoryScore * weight;

      breakdown.push({
        category: category.name,
        description: category.description,
        points: Math.round(categoryScore)
      });
    });

    const penalties = this.config.penaltyRules.reduce(
      (sum, rule) => sum + rule.calculate(state, playerId, events), 
      0
    );

    if (penalties > 0) {
      breakdown.push({
        category: 'Penalties',
        description: 'Deductions for errors',
        points: -penalties
      });
      weightedTotal -= penalties;
    }

    breakdown.push({
      category: 'Total',
      description: 'Final weighted score',
      points: Math.round(weightedTotal)
    });

    return {
      total: Math.round(weightedTotal),
      breakdown
    };
  }
}