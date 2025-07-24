import { IGameAchievement, IGameState, IGameEvent, IGameError } from '../core/interfaces';
import { IGameContext } from '../core/context';

export interface AchievementProgress {
  achievementId: string;
  playerId: string;
  unlocked: boolean;
  unlockedAt?: Date;
  progress?: number;
  progressMax?: number;
}

export interface AchievementUnlockEvent {
  achievement: IGameAchievement;
  playerId: string;
  timestamp: Date;
  gameState: IGameState;
  triggerEvent?: IGameEvent;
}

export class AchievementTracker {
  private achievements: Map<string, IGameAchievement> = new Map();
  private progress: Map<string, Map<string, AchievementProgress>> = new Map();
  private context: IGameContext;
  private unlockHandlers: ((event: AchievementUnlockEvent) => void)[] = [];

  constructor(context: IGameContext) {
    this.context = context;
  }

  registerAchievement(achievement: IGameAchievement): void {
    this.achievements.set(achievement.id, achievement);
    this.context.logger.debug(`Registered achievement: ${achievement.name}`);
  }

  registerAchievements(achievements: IGameAchievement[]): void {
    achievements.forEach(a => this.registerAchievement(a));
  }

  trackEvent(state: IGameState, event: IGameEvent): void {
    if (!event.playerId) return;

    const playerProgress = this.getOrCreatePlayerProgress(event.playerId);
    const newUnlocks: AchievementUnlockEvent[] = [];

    this.achievements.forEach((achievement, id) => {
      const progress = playerProgress.get(id);
      
      if (!progress?.unlocked) {
        try {
          if (achievement.checkCondition(state, event)) {
            const achievementProgress: AchievementProgress = {
              achievementId: id,
              playerId: event.playerId,
              unlocked: true,
              unlockedAt: new Date()
            };
            
            playerProgress.set(id, achievementProgress);
            
            newUnlocks.push({
              achievement,
              playerId: event.playerId,
              timestamp: new Date(),
              gameState: state,
              triggerEvent: event
            });
          }
        } catch (error) {
          const gameError: IGameError = Object.assign(
            new Error(`Error checking achievement ${id}`),
            {
              name: 'AchievementCheckError',
              code: 'ACHIEVEMENT_CHECK_ERROR',
              severity: 'low' as const,
              recoverable: true,
              context: { achievementId: id, error }
            }
          );
          this.context.logger.error(`Error checking achievement ${id}:`, gameError);
        }
      }
    });

    if (newUnlocks.length > 0) {
      this.handleUnlocks(newUnlocks);
    }
  }

  trackGameEnd(state: IGameState): void {
    state.players.forEach(player => {
      const event: IGameEvent = {
        type: 'game:ended',
        timestamp: new Date(),
        playerId: player.id,
        data: { finalState: state }
      };
      
      this.trackEvent(state, event);
    });
  }

  getPlayerAchievements(playerId: string): AchievementProgress[] {
    const playerProgress = this.progress.get(playerId);
    if (!playerProgress) return [];
    
    return Array.from(playerProgress.values());
  }

  getUnlockedAchievements(playerId: string): IGameAchievement[] {
    const playerProgress = this.progress.get(playerId);
    if (!playerProgress) return [];
    
    return Array.from(playerProgress.entries())
      .filter(([_, progress]) => progress.unlocked)
      .map(([id, _]) => this.achievements.get(id)!)
      .filter(a => a !== undefined);
  }

  getTotalPoints(playerId: string): number {
    return this.getUnlockedAchievements(playerId)
      .reduce((sum, achievement) => sum + achievement.points, 0);
  }

  getAchievementsByCategory(category: 'skill' | 'style' | 'milestone' | 'special'): IGameAchievement[] {
    return Array.from(this.achievements.values())
      .filter(a => a.category === category);
  }

  onUnlock(handler: (event: AchievementUnlockEvent) => void): void {
    this.unlockHandlers.push(handler);
  }

  offUnlock(handler: (event: AchievementUnlockEvent) => void): void {
    const index = this.unlockHandlers.indexOf(handler);
    if (index >= 0) {
      this.unlockHandlers.splice(index, 1);
    }
  }

  reset(playerId?: string): void {
    if (playerId) {
      this.progress.delete(playerId);
    } else {
      this.progress.clear();
    }
  }

  getStats(): {
    totalAchievements: number;
    byCategory: Record<string, number>;
    totalPoints: number;
    averageUnlockRate: number;
  } {
    const byCategory: Record<string, number> = {
      skill: 0,
      style: 0,
      milestone: 0,
      special: 0
    };
    
    let totalPoints = 0;
    let totalUnlocks = 0;
    let totalPossibleUnlocks = 0;

    this.achievements.forEach(achievement => {
      byCategory[achievement.category]++;
      totalPoints += achievement.points;
    });

    this.progress.forEach(playerProgress => {
      totalPossibleUnlocks += this.achievements.size;
      playerProgress.forEach(progress => {
        if (progress.unlocked) totalUnlocks++;
      });
    });

    return {
      totalAchievements: this.achievements.size,
      byCategory,
      totalPoints,
      averageUnlockRate: totalPossibleUnlocks > 0 ? totalUnlocks / totalPossibleUnlocks : 0
    };
  }

  private getOrCreatePlayerProgress(playerId: string): Map<string, AchievementProgress> {
    if (!this.progress.has(playerId)) {
      this.progress.set(playerId, new Map());
    }
    return this.progress.get(playerId)!;
  }

  private handleUnlocks(unlocks: AchievementUnlockEvent[]): void {
    unlocks.forEach(unlock => {
      this.context.logger.info(`Achievement unlocked: ${unlock.achievement.name} by ${unlock.playerId}`);
      
      this.context.eventBus.emit({
        type: 'achievement:unlocked',
        timestamp: unlock.timestamp,
        playerId: unlock.playerId,
        data: {
          achievement: {
            id: unlock.achievement.id,
            name: unlock.achievement.name,
            description: unlock.achievement.description,
            category: unlock.achievement.category,
            points: unlock.achievement.points
          }
        }
      });

      this.unlockHandlers.forEach(handler => {
        try {
          handler(unlock);
        } catch (error) {
          const gameError: IGameError = Object.assign(
            new Error('Error in achievement unlock handler'),
            {
              name: 'AchievementUnlockHandlerError',
              code: 'ACHIEVEMENT_HANDLER_ERROR',
              severity: 'low' as const,
              recoverable: true,
              context: error
            }
          );
          this.context.logger.error('Error in achievement unlock handler', gameError);
        }
      });
    });
  }
}