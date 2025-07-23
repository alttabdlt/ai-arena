export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'skill' | 'style' | 'milestone' | 'special';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points: number;
  progress?: {
    current: number;
    target: number;
  };
}

export interface PlayerAchievement {
  achievementId: string;
  unlockedAt: number;
  handNumber?: number;
}

export interface AchievementEvent {
  playerId: string;
  achievement: Achievement;
  timestamp: number;
}

type AchievementCheck = (playerId: string, context: AchievementContext) => boolean | { progress: number; target: number };

interface AchievementContext {
  // Hand-specific data
  handNumber?: number;
  isWinner?: boolean;
  winAmount?: number;
  holeCards?: string[];
  finalHand?: string;
  
  // Action data
  actionType?: string;
  bluffCount?: number;
  foldCount?: number;
  raiseCount?: number;
  allInCount?: number;
  
  // Game state data
  totalHands?: number;
  totalWins?: number;
  totalPoints?: number;
  biggestPot?: number;
  eliminationCount?: number;
  comebackCount?: number;
  
  // Style data
  unconventionalWins?: number;
  perfectReads?: number;
  successfulBluffs?: number;
  davidVsGoliathWins?: number;
}

export class AchievementSystem {
  private playerAchievements: Map<string, PlayerAchievement[]> = new Map();
  private achievementDefinitions: Map<string, Achievement & { check: AchievementCheck }> = new Map();
  private playerStats: Map<string, AchievementContext> = new Map();
  private eventHandlers: ((event: AchievementEvent) => void)[] = [];
  
  constructor() {
    this.initializeAchievements();
  }
  
  private initializeAchievements() {
    // Skill Achievements
    this.addAchievement({
      id: 'first_blood',
      name: 'First Blood',
      description: 'Win your first hand',
      icon: '🩸',
      category: 'skill',
      rarity: 'common',
      points: 50,
      check: (playerId, ctx) => (ctx.totalWins || 0) >= 1
    });
    
    this.addAchievement({
      id: 'winning_streak_5',
      name: 'Hot Streak',
      description: 'Win 5 hands in a row',
      icon: '🔥',
      category: 'skill',
      rarity: 'rare',
      points: 200,
      check: (playerId, ctx) => false // TODO: Track consecutive wins
    });
    
    this.addAchievement({
      id: 'perfect_read',
      name: 'Mind Reader',
      description: 'Make 3 perfect hand reads',
      icon: '🔮',
      category: 'skill',
      rarity: 'epic',
      points: 500,
      check: (playerId, ctx) => ({
        progress: ctx.perfectReads || 0,
        target: 3
      })
    });
    
    // Style Achievements
    this.addAchievement({
      id: 'trash_master',
      name: 'Trash Master',
      description: 'Win 2 hands with trash-tier starting cards',
      icon: '🗑️',
      category: 'style',
      rarity: 'epic',
      points: 400,
      check: (playerId, ctx) => ({
        progress: ctx.unconventionalWins || 0,
        target: 2
      })
    });
    
    this.addAchievement({
      id: 'bluff_artist',
      name: 'Bluff Artist',
      description: 'Successfully bluff 3 times',
      icon: '🎭',
      category: 'style',
      rarity: 'rare',
      points: 300,
      check: (playerId, ctx) => ({
        progress: ctx.successfulBluffs || 0,
        target: 3
      })
    });
    
    this.addAchievement({
      id: 'david_champion',
      name: 'Giant Slayer',
      description: 'Win a David vs Goliath situation',
      icon: '🗿',
      category: 'style',
      rarity: 'epic',
      points: 450,
      check: (playerId, ctx) => ({
        progress: ctx.davidVsGoliathWins || 0,
        target: 1
      })
    });
    
    this.addAchievement({
      id: 'comeback_king',
      name: 'Comeback King',
      description: 'Win 2 hands when down to less than 10% stack',
      icon: '👑',
      category: 'style',
      rarity: 'legendary',
      points: 1000,
      check: (playerId, ctx) => ({
        progress: ctx.comebackCount || 0,
        target: 2
      })
    });
    
    // Milestone Achievements
    this.addAchievement({
      id: 'centurion',
      name: 'Centurion',
      description: 'Play 20 hands',
      icon: '💯',
      category: 'milestone',
      rarity: 'common',
      points: 100,
      check: (playerId, ctx) => ({
        progress: ctx.totalHands || 0,
        target: 20
      })
    });
    
    this.addAchievement({
      id: 'millionaire',
      name: 'Millionaire',
      description: 'Win a pot worth over 50,000 chips',
      icon: '💰',
      category: 'milestone',
      rarity: 'legendary',
      points: 1500,
      check: (playerId, ctx) => (ctx.biggestPot || 0) >= 50000
    });
    
    this.addAchievement({
      id: 'terminator',
      name: 'Terminator',
      description: 'Eliminate 2 opponents',
      icon: '🤖',
      category: 'milestone',
      rarity: 'rare',
      points: 350,
      check: (playerId, ctx) => ({
        progress: ctx.eliminationCount || 0,
        target: 2
      })
    });
    
    this.addAchievement({
      id: 'point_master',
      name: 'Point Master',
      description: 'Accumulate 5,000 total points',
      icon: '🏆',
      category: 'milestone',
      rarity: 'epic',
      points: 750,
      check: (playerId, ctx) => ({
        progress: ctx.totalPoints || 0,
        target: 5000
      })
    });
    
    // Special Achievements
    this.addAchievement({
      id: 'all_in_survivor',
      name: 'Living Dangerously',
      description: 'Survive 3 all-ins',
      icon: '😱',
      category: 'special',
      rarity: 'rare',
      points: 400,
      check: (playerId, ctx) => ({
        progress: ctx.allInCount || 0,
        target: 3
      })
    });
    
    this.addAchievement({
      id: 'royal_flush',
      name: 'Royal Treatment',
      description: 'Win with a royal flush',
      icon: '👸',
      category: 'special',
      rarity: 'legendary',
      points: 2000,
      check: (playerId, ctx) => ctx.finalHand === 'Royal Flush'
    });
    
    this.addAchievement({
      id: 'perfect_game',
      name: 'Flawless Victory',
      description: 'Win a game without any misreads or penalties',
      icon: '✨',
      category: 'special',
      rarity: 'legendary',
      points: 2500,
      check: (playerId, ctx) => false // TODO: Implement perfect game tracking
    });
    
    // Additional per-game achievements
    this.addAchievement({
      id: 'early_dominator',
      name: 'Early Dominator',
      description: 'Win 5 of the first 10 hands',
      icon: '🚀',
      category: 'skill',
      rarity: 'rare',
      points: 300,
      check: (playerId, ctx) => false // TODO: Track early game wins
    });
    
    this.addAchievement({
      id: 'fold_discipline',
      name: 'Disciplined Folder',
      description: 'Fold 10 hands in a row and then win',
      icon: '🧘',
      category: 'style',
      rarity: 'rare',
      points: 350,
      check: (playerId, ctx) => false // TODO: Track consecutive folds
    });
    
    this.addAchievement({
      id: 'chip_leader',
      name: 'Chip Leader',
      description: 'Hold the chip lead for 10+ consecutive hands',
      icon: '👑',
      category: 'milestone',
      rarity: 'epic',
      points: 500,
      check: (playerId, ctx) => false // TODO: Track chip lead duration
    });
    
    this.addAchievement({
      id: 'pocket_rocket',
      name: 'Pocket Rocket',
      description: 'Win with pocket aces',
      icon: '🚀',
      category: 'special',
      rarity: 'common',
      points: 100,
      check: (playerId, ctx) => false // TODO: Check for AA wins
    });
    
    this.addAchievement({
      id: 'straight_flush_hero',
      name: 'Straight Flush Hero',
      description: 'Win with a straight flush',
      icon: '🌟',
      category: 'special',
      rarity: 'epic',
      points: 1000,
      check: (playerId, ctx) => ctx.finalHand === 'Straight Flush'
    });
  }
  
  private addAchievement(definition: Achievement & { check: AchievementCheck }) {
    this.achievementDefinitions.set(definition.id, definition);
  }
  
  initializePlayer(playerId: string): void {
    if (!this.playerAchievements.has(playerId)) {
      this.playerAchievements.set(playerId, []);
    }
    if (!this.playerStats.has(playerId)) {
      this.playerStats.set(playerId, {});
    }
  }
  
  updatePlayerStats(playerId: string, updates: Partial<AchievementContext>): void {
    const currentStats = this.playerStats.get(playerId) || {};
    this.playerStats.set(playerId, {
      ...currentStats,
      ...updates,
      // Increment counters if provided
      totalHands: (currentStats.totalHands || 0) + (updates.totalHands || 0),
      totalWins: (currentStats.totalWins || 0) + (updates.totalWins || 0),
      eliminationCount: (currentStats.eliminationCount || 0) + (updates.eliminationCount || 0),
      unconventionalWins: (currentStats.unconventionalWins || 0) + (updates.unconventionalWins || 0),
      successfulBluffs: (currentStats.successfulBluffs || 0) + (updates.successfulBluffs || 0),
      davidVsGoliathWins: (currentStats.davidVsGoliathWins || 0) + (updates.davidVsGoliathWins || 0),
      comebackCount: (currentStats.comebackCount || 0) + (updates.comebackCount || 0),
      perfectReads: (currentStats.perfectReads || 0) + (updates.perfectReads || 0),
      allInCount: (currentStats.allInCount || 0) + (updates.allInCount || 0),
      // Keep max values
      biggestPot: Math.max(currentStats.biggestPot || 0, updates.biggestPot || 0),
      totalPoints: updates.totalPoints !== undefined ? updates.totalPoints : currentStats.totalPoints
    });
    
    // Check for new achievements
    this.checkAchievements(playerId);
  }
  
  private checkAchievements(playerId: string): void {
    const playerAchievements = this.playerAchievements.get(playerId) || [];
    const playerStats = this.playerStats.get(playerId) || {};
    const unlockedIds = new Set(playerAchievements.map(a => a.achievementId));
    
    this.achievementDefinitions.forEach((definition, achievementId) => {
      if (unlockedIds.has(achievementId)) return;
      
      const result = definition.check(playerId, playerStats);
      const isUnlocked = typeof result === 'boolean' ? result : result.progress >= result.target;
      
      if (isUnlocked) {
        const newAchievement: PlayerAchievement = {
          achievementId,
          unlockedAt: Date.now(),
          handNumber: playerStats.handNumber
        };
        
        playerAchievements.push(newAchievement);
        this.playerAchievements.set(playerId, playerAchievements);
        
        // Emit achievement event
        this.emitEvent({
          playerId,
          achievement: definition,
          timestamp: Date.now()
        });
      }
    });
  }
  
  getPlayerAchievements(playerId: string): (Achievement & PlayerAchievement)[] {
    const playerAchievements = this.playerAchievements.get(playerId) || [];
    return playerAchievements.map(pa => {
      const definition = this.achievementDefinitions.get(pa.achievementId)!;
      return {
        ...definition,
        ...pa
      };
    });
  }
  
  getAchievementProgress(playerId: string): Map<string, { progress: number; target: number }> {
    const progress = new Map<string, { progress: number; target: number }>();
    const playerStats = this.playerStats.get(playerId) || {};
    const unlockedIds = new Set((this.playerAchievements.get(playerId) || []).map(a => a.achievementId));
    
    this.achievementDefinitions.forEach((definition, achievementId) => {
      if (unlockedIds.has(achievementId)) return;
      
      const result = definition.check(playerId, playerStats);
      if (typeof result === 'object') {
        progress.set(achievementId, result);
      }
    });
    
    return progress;
  }
  
  getAllAchievements(): Achievement[] {
    return Array.from(this.achievementDefinitions.values()).map(({ check, ...achievement }) => achievement);
  }
  
  getTotalAchievementPoints(playerId: string): number {
    const achievements = this.getPlayerAchievements(playerId);
    return achievements.reduce((total, achievement) => total + achievement.points, 0);
  }
  
  onAchievementUnlocked(handler: (event: AchievementEvent) => void): void {
    this.eventHandlers.push(handler);
  }
  
  private emitEvent(event: AchievementEvent): void {
    this.eventHandlers.forEach(handler => handler(event));
  }
  
  // Integration helpers
  recordHandWin(playerId: string, holeCards: string[], winAmount: number, finalHand?: string): void {
    this.updatePlayerStats(playerId, {
      totalWins: 1,
      winAmount,
      holeCards,
      finalHand,
      isWinner: true
    });
  }
  
  recordUnconventionalWin(playerId: string): void {
    this.updatePlayerStats(playerId, {
      unconventionalWins: 1
    });
  }
  
  recordSuccessfulBluff(playerId: string): void {
    this.updatePlayerStats(playerId, {
      successfulBluffs: 1
    });
  }
  
  recordDavidVsGoliath(playerId: string): void {
    this.updatePlayerStats(playerId, {
      davidVsGoliathWins: 1
    });
  }
  
  recordComeback(playerId: string): void {
    this.updatePlayerStats(playerId, {
      comebackCount: 1
    });
  }
  
  recordElimination(playerId: string): void {
    this.updatePlayerStats(playerId, {
      eliminationCount: 1
    });
  }
  
  recordAllIn(playerId: string): void {
    this.updatePlayerStats(playerId, {
      allInCount: 1
    });
  }
  
  recordHandPlayed(playerId: string, handNumber: number): void {
    this.updatePlayerStats(playerId, {
      totalHands: 1,
      handNumber
    });
  }
  
  updateTotalPoints(playerId: string, totalPoints: number): void {
    this.updatePlayerStats(playerId, {
      totalPoints
    });
  }
  
  updateBiggestPot(playerId: string, potSize: number): void {
    const currentStats = this.playerStats.get(playerId) || {};
    if (potSize > (currentStats.biggestPot || 0)) {
      this.updatePlayerStats(playerId, {
        biggestPot: potSize
      });
    }
  }
}

export const achievementSystem = new AchievementSystem();