import { IGameState, IGameEvent } from '../core/interfaces';
import { 
  SimpleAchievement, 
  CounterAchievement, 
  StreakAchievement,
  ConditionalAchievement 
} from './AchievementDefinition';

export class FirstWinAchievement extends SimpleAchievement {
  constructor() {
    super(
      {
        id: 'first-win',
        name: 'First Victory',
        description: 'Win your first game',
        category: 'milestone',
        rarity: 'common',
        points: 100,
        icon: '🏆'
      },
      (state: IGameState, event?: IGameEvent) => {
        if (!event || event.type !== 'game:ended') return false;
        const winners = (event.data?.winners || []) as string[];
        return event.playerId ? winners.includes(event.playerId) : false;
      }
    );
  }
}

export class WinStreakAchievement extends StreakAchievement {
  constructor(streak: number = 3) {
    super(
      {
        id: `win-streak-${streak}`,
        name: `${streak} Win Streak`,
        description: `Win ${streak} games in a row`,
        category: 'skill',
        rarity: streak >= 5 ? 'legendary' : streak >= 3 ? 'epic' : 'rare',
        points: 100 * streak,
        icon: '🔥'
      },
      streak
    );
  }

  protected continuesStreak(state: IGameState, event: IGameEvent): boolean {
    if (event.type !== 'game:ended') return false;
    const winners = (event.data?.winners || []) as string[];
    return winners.includes(event.playerId!);
  }

  protected breaksStreak(state: IGameState, event: IGameEvent): boolean {
    if (event.type !== 'game:ended') return false;
    const winners = (event.data?.winners || []) as string[];
    return !winners.includes(event.playerId!);
  }
}

export class PerfectGameAchievement extends SimpleAchievement {
  constructor() {
    super(
      {
        id: 'perfect-game',
        name: 'Flawless Victory',
        description: 'Win a game without making any errors',
        category: 'skill',
        rarity: 'epic',
        points: 500,
        icon: '✨'
      },
      (state: IGameState, event?: IGameEvent) => {
        if (!event || event.type !== 'game:ended') return false;
        const winners = (event.data?.winners || []) as string[];
        const errors = (event.data?.playerErrors?.[event.playerId!] || 0) as number;
        return event.playerId ? winners.includes(event.playerId) && errors === 0 : false;
      }
    );
  }
}

export class QuickWinAchievement extends SimpleAchievement {
  constructor(maxTurns: number = 10) {
    super(
      {
        id: `quick-win-${maxTurns}`,
        name: 'Lightning Fast',
        description: `Win a game in ${maxTurns} turns or less`,
        category: 'skill',
        rarity: 'rare',
        points: 300,
        icon: '⚡'
      },
      (state: IGameState, event?: IGameEvent) => {
        if (!event || event.type !== 'game:ended') return false;
        const winners = (event.data?.winners || []) as string[];
        return event.playerId ? winners.includes(event.playerId) && state.turnCount <= maxTurns : false;
      }
    );
  }
}

export class ComebackAchievement extends SimpleAchievement {
  constructor() {
    super(
      {
        id: 'comeback-king',
        name: 'Comeback King',
        description: 'Win after being in last place',
        category: 'style',
        rarity: 'epic',
        points: 400,
        icon: '👑'
      },
      (state: IGameState, event?: IGameEvent) => {
        if (!event || event.type !== 'game:ended') return false;
        const winners = (event.data?.winners || []) as string[];
        const wasLastPlace = (event.data?.wasLastPlace?.[event.playerId!] || false) as boolean;
        return event.playerId ? winners.includes(event.playerId) && wasLastPlace : false;
      }
    );
  }
}

export class MarathonAchievement extends SimpleAchievement {
  constructor(minTurns: number = 50) {
    super(
      {
        id: `marathon-${minTurns}`,
        name: 'Marathon Runner',
        description: `Complete a game lasting ${minTurns}+ turns`,
        category: 'milestone',
        rarity: 'common',
        points: 200,
        icon: '🏃'
      },
      (state: IGameState, event?: IGameEvent) => {
        if (!event || event.type !== 'game:ended') return false;
        return state.turnCount >= minTurns;
      }
    );
  }
}

export class RiskTakerAchievement extends CounterAchievement {
  constructor() {
    super(
      {
        id: 'risk-taker',
        name: 'Risk Taker',
        description: 'Make 10 high-risk moves',
        category: 'style',
        rarity: 'rare',
        points: 250,
        icon: '🎲'
      },
      10,
      false
    );
  }

  protected shouldIncrement(state: IGameState, event: IGameEvent): boolean {
    return event.type === 'action:executed' && 
           (event.data?.riskLevel === 'high' || event.data?.confidence < 0.3);
  }
}

export class ConsistentPlayerAchievement extends CounterAchievement {
  constructor() {
    super(
      {
        id: 'consistent-player',
        name: 'Consistency is Key',
        description: 'Finish in top 3 in 5 games',
        category: 'skill',
        rarity: 'rare',
        points: 300,
        icon: '📊'
      },
      5,
      false
    );
  }

  protected shouldIncrement(state: IGameState, event: IGameEvent): boolean {
    if (event.type !== 'game:ended') return false;
    const rank = (event.data?.playerRanks?.[event.playerId!] || 999) as number;
    return rank <= 3;
  }
}

export class SocialButterflyAchievement extends CounterAchievement {
  constructor() {
    super(
      {
        id: 'social-butterfly',
        name: 'Social Butterfly',
        description: 'Play against 10 different opponents',
        category: 'special',
        rarity: 'common',
        points: 150,
        icon: '🦋'
      },
      10,
      false
    );
  }

  private opponentsSeen: Map<string, Set<string>> = new Map();

  protected shouldIncrement(state: IGameState, event: IGameEvent): boolean {
    if (event.type !== 'game:started' || !event.playerId) return false;
    
    if (!this.opponentsSeen.has(event.playerId)) {
      this.opponentsSeen.set(event.playerId, new Set());
    }
    
    const playerOpponents = this.opponentsSeen.get(event.playerId)!;
    const previousSize = playerOpponents.size;
    
    state.players
      .filter(p => p.id !== event.playerId)
      .forEach(p => playerOpponents.add(p.id));
    
    return playerOpponents.size > previousSize;
  }
}

export class VersatilePlayerAchievement extends ConditionalAchievement {
  constructor() {
    const conditions = [
      (state: IGameState, event?: IGameEvent) => {
        if (!event || event.type !== 'achievement:unlocked') return false;
        const category = event.data?.achievement?.category;
        return category === 'skill';
      },
      (state: IGameState, event?: IGameEvent) => {
        if (!event || event.type !== 'achievement:unlocked') return false;
        const category = event.data?.achievement?.category;
        return category === 'style';
      },
      (state: IGameState, event?: IGameEvent) => {
        if (!event || event.type !== 'achievement:unlocked') return false;
        const category = event.data?.achievement?.category;
        return category === 'milestone';
      }
    ];

    super(
      {
        id: 'versatile-player',
        name: 'Jack of All Trades',
        description: 'Unlock achievements in skill, style, and milestone categories',
        category: 'special',
        rarity: 'legendary',
        points: 500,
        icon: '🎭'
      },
      conditions,
      true
    );
  }
}

export function getCommonAchievements() {
  return [
    new FirstWinAchievement(),
    new WinStreakAchievement(3),
    new WinStreakAchievement(5),
    new PerfectGameAchievement(),
    new QuickWinAchievement(10),
    new ComebackAchievement(),
    new MarathonAchievement(50),
    new RiskTakerAchievement(),
    new ConsistentPlayerAchievement(),
    new SocialButterflyAchievement(),
    new VersatilePlayerAchievement()
  ];
}