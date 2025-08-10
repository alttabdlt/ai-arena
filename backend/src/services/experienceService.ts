import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface XPConfig {
  BASE_XP_PER_LEVEL: number;
  LEVEL_SCALING_FACTOR: number;
  MAX_LEVEL: number;
  PRESTIGE_UNLOCK_LEVEL: number;
  SKILL_POINTS_PER_LEVEL: number;
  XP_MULTIPLIER_PRESTIGE: number;
}

const XP_CONFIG: XPConfig = {
  BASE_XP_PER_LEVEL: 100,
  LEVEL_SCALING_FACTOR: 1.5,
  MAX_LEVEL: 50,
  PRESTIGE_UNLOCK_LEVEL: 50,
  SKILL_POINTS_PER_LEVEL: 3,
  XP_MULTIPLIER_PRESTIGE: 1.2,
};

export interface XPGain {
  category: 'combat' | 'social' | 'criminal' | 'gambling' | 'trading';
  amount: number;
  source: string;
  metadata?: any;
}

export interface LevelUpResult {
  newLevel: number;
  skillPointsGained: number;
  unlocked: string[];
  prestigeEligible: boolean;
}

export class ExperienceService {
  static calculateXPToNextLevel(level: number): number {
    return Math.floor(
      XP_CONFIG.BASE_XP_PER_LEVEL * Math.pow(XP_CONFIG.LEVEL_SCALING_FACTOR, level - 1)
    );
  }

  static async grantXP(botId: string, xpGain: XPGain): Promise<LevelUpResult | null> {
    const experience = await prisma.botExperience.findUnique({
      where: { botId },
    });

    if (!experience) {
      await prisma.botExperience.create({
        data: {
          botId,
          level: 1,
          currentXP: xpGain.amount,
          totalXP: xpGain.amount,
          xpToNextLevel: this.calculateXPToNextLevel(1),
          combatXP: xpGain.category === 'combat' ? xpGain.amount : 0,
          socialXP: xpGain.category === 'social' ? xpGain.amount : 0,
          criminalXP: xpGain.category === 'criminal' ? xpGain.amount : 0,
          gamblingXP: xpGain.category === 'gambling' ? xpGain.amount : 0,
          tradingXP: xpGain.category === 'trading' ? xpGain.amount : 0,
        },
      });
      return null;
    }

    const prestigeMultiplier = 1 + (experience.prestigeLevel * (XP_CONFIG.XP_MULTIPLIER_PRESTIGE - 1));
    const adjustedXP = Math.floor(xpGain.amount * prestigeMultiplier);

    const categoryUpdate: any = {};
    categoryUpdate[`${xpGain.category}XP`] = {
      increment: adjustedXP,
    };

    let newCurrentXP = experience.currentXP + adjustedXP;
    let newTotalXP = experience.totalXP + adjustedXP;
    let newLevel = experience.level;
    let skillPointsGained = 0;
    const unlocked: string[] = [];
    let leveledUp = false;

    while (newCurrentXP >= experience.xpToNextLevel && newLevel < XP_CONFIG.MAX_LEVEL) {
      newCurrentXP -= experience.xpToNextLevel;
      newLevel++;
      skillPointsGained += XP_CONFIG.SKILL_POINTS_PER_LEVEL;
      leveledUp = true;

      if (newLevel === 10) unlocked.push('Advanced Equipment Slots');
      if (newLevel === 20) unlocked.push('House Expansion');
      if (newLevel === 30) unlocked.push('Elite Zone Access');
      if (newLevel === 40) unlocked.push('Gang Leadership');
      if (newLevel === 50) unlocked.push('Prestige System');
    }

    const updateData: any = {
      currentXP: newCurrentXP,
      totalXP: newTotalXP,
      lastXPGain: new Date(),
      ...categoryUpdate,
    };

    if (leveledUp) {
      updateData.level = newLevel;
      updateData.xpToNextLevel = this.calculateXPToNextLevel(newLevel);
      updateData.skillPoints = {
        increment: skillPointsGained,
      };
    }

    await prisma.botExperience.update({
      where: { botId },
      data: updateData,
    });

    if (leveledUp) {
      return {
        newLevel,
        skillPointsGained,
        unlocked,
        prestigeEligible: newLevel >= XP_CONFIG.PRESTIGE_UNLOCK_LEVEL,
      };
    }

    return null;
  }

  static async prestige(botId: string): Promise<boolean> {
    const experience = await prisma.botExperience.findUnique({
      where: { botId },
    });

    if (!experience || experience.level < XP_CONFIG.PRESTIGE_UNLOCK_LEVEL) {
      return false;
    }

    const prestigeTokensGained = Math.floor(experience.totalXP / 10000);

    await prisma.botExperience.update({
      where: { botId },
      data: {
        level: 1,
        currentXP: 0,
        totalXP: 0,
        xpToNextLevel: this.calculateXPToNextLevel(1),
        prestigeLevel: {
          increment: 1,
        },
        prestigeTokens: {
          increment: prestigeTokensGained,
        },
        skillPoints: 0,
        allocatedSkills: {},
        combatXP: 0,
        socialXP: 0,
        criminalXP: 0,
        gamblingXP: 0,
        tradingXP: 0,
      },
    });

    return true;
  }

  static async allocateSkillPoint(
    botId: string,
    skill: 'strength' | 'defense' | 'charisma' | 'luck' | 'stealth' | 'intelligence'
  ): Promise<boolean> {
    const experience = await prisma.botExperience.findUnique({
      where: { botId },
    });

    if (!experience || experience.skillPoints <= 0) {
      return false;
    }

    const currentSkills = experience.allocatedSkills as any || {};
    currentSkills[skill] = (currentSkills[skill] || 0) + 1;

    await prisma.botExperience.update({
      where: { botId },
      data: {
        skillPoints: {
          decrement: 1,
        },
        allocatedSkills: currentSkills,
      },
    });

    return true;
  }

  static async getLeaderboard(
    category: 'level' | 'totalXP' | 'combat' | 'social' | 'criminal' | 'gambling' | 'trading' | 'prestige',
    limit: number = 10
  ) {
    const orderBy: any = {};
    
    switch (category) {
      case 'level':
        orderBy.level = 'desc';
        break;
      case 'totalXP':
        orderBy.totalXP = 'desc';
        break;
      case 'combat':
        orderBy.combatXP = 'desc';
        break;
      case 'social':
        orderBy.socialXP = 'desc';
        break;
      case 'criminal':
        orderBy.criminalXP = 'desc';
        break;
      case 'gambling':
        orderBy.gamblingXP = 'desc';
        break;
      case 'trading':
        orderBy.tradingXP = 'desc';
        break;
      case 'prestige':
        orderBy.prestigeLevel = 'desc';
        break;
    }

    return await prisma.botExperience.findMany({
      take: limit,
      orderBy,
      include: {
        bot: {
          select: {
            id: true,
            name: true,
            avatar: true,
            personality: true,
          },
        },
      },
    });
  }

  static calculateSkillBonus(skills: any, skill: string): number {
    const skillLevel = skills?.[skill] || 0;
    return skillLevel * 0.05;
  }

  static calculateCombatPower(experience: any): number {
    const skills = experience?.allocatedSkills || {};
    const baseMultiplier = 1 + (experience?.prestigeLevel || 0) * 0.1;
    const strengthBonus = this.calculateSkillBonus(skills, 'strength');
    const defenseBonus = this.calculateSkillBonus(skills, 'defense');
    
    return Math.floor(100 * baseMultiplier * (1 + strengthBonus + defenseBonus / 2));
  }

  static calculateRobberySuccess(experience: any): number {
    const skills = experience?.allocatedSkills || {};
    const baseChance = 0.3 + (experience?.level || 1) * 0.01;
    const stealthBonus = this.calculateSkillBonus(skills, 'stealth');
    const luckBonus = this.calculateSkillBonus(skills, 'luck');
    const criminalExperience = Math.min((experience?.criminalXP || 0) / 10000, 0.2);
    
    return Math.min(baseChance + stealthBonus + luckBonus / 2 + criminalExperience, 0.9);
  }

  static calculateSocialInfluence(experience: any): number {
    const skills = experience?.allocatedSkills || {};
    const baseInfluence = (experience?.level || 1) * 10;
    const charismaBonus = this.calculateSkillBonus(skills, 'charisma');
    const socialExperience = Math.min((experience?.socialXP || 0) / 5000, 50);
    
    return Math.floor(baseInfluence * (1 + charismaBonus) + socialExperience);
  }

  static getXPForActivity(activity: string): XPGain | null {
    const XP_REWARDS: Record<string, XPGain> = {
      'tournament_win': { category: 'gambling', amount: 100, source: 'Tournament Victory' },
      'tournament_participation': { category: 'gambling', amount: 25, source: 'Tournament Participation' },
      'match_win': { category: 'gambling', amount: 50, source: 'Match Victory' },
      'match_loss': { category: 'gambling', amount: 10, source: 'Match Participation' },
      'robbery_success': { category: 'criminal', amount: 75, source: 'Successful Robbery' },
      'robbery_fail': { category: 'criminal', amount: 15, source: 'Failed Robbery Attempt' },
      'defense_success': { category: 'combat', amount: 60, source: 'Defended Against Robbery' },
      'combat_win': { category: 'combat', amount: 80, source: 'Combat Victory' },
      'combat_loss': { category: 'combat', amount: 20, source: 'Combat Participation' },
      'trade_complete': { category: 'trading', amount: 30, source: 'Trade Completed' },
      'conversation': { category: 'social', amount: 15, source: 'Social Interaction' },
      'friendship_formed': { category: 'social', amount: 100, source: 'New Friendship' },
      'rivalry_formed': { category: 'social', amount: 100, source: 'New Rivalry' },
      'marriage': { category: 'social', amount: 500, source: 'Marriage' },
      'zone_activity': { category: 'criminal', amount: 20, source: 'Zone Activity' },
      'lootbox_opened': { category: 'gambling', amount: 35, source: 'Lootbox Opened' },
      'house_upgrade': { category: 'trading', amount: 50, source: 'House Upgraded' },
    };

    return XP_REWARDS[activity] || null;
  }
}