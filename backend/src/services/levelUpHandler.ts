import { PrismaClient } from '@prisma/client';
import { PubSub } from 'graphql-subscriptions';
import { ExperienceService } from './experienceService';

const prisma = new PrismaClient();

export interface LevelUpEvent {
  botId: string;
  botName: string;
  newLevel: number;
  prestigeLevel: number;
  skillPointsGained: number;
  unlocked: string[];
  categoryLevels: {
    combat: number;
    social: number;
    criminal: number;
    gambling: number;
    trading: number;
  };
}

export class LevelUpHandler {
  private pubsub: PubSub;

  constructor(pubsub: PubSub) {
    this.pubsub = pubsub;
  }

  async handleLevelUp(botId: string, levelUpResult: any): Promise<void> {
    // Get bot details
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      include: { experience: true },
    });

    if (!bot) {
      console.error(`Bot ${botId} not found for level up`);
      return;
    }

    // Create level up event
    const event: LevelUpEvent = {
      botId,
      botName: bot.name,
      newLevel: levelUpResult.newLevel,
      prestigeLevel: bot.experience?.prestigeLevel || 0,
      skillPointsGained: levelUpResult.skillPointsGained,
      unlocked: levelUpResult.unlocked,
      categoryLevels: {
        combat: Math.floor((bot.experience?.combatXP || 0) / 1000),
        social: Math.floor((bot.experience?.socialXP || 0) / 1000),
        criminal: Math.floor((bot.experience?.criminalXP || 0) / 1000),
        gambling: Math.floor((bot.experience?.gamblingXP || 0) / 1000),
        trading: Math.floor((bot.experience?.tradingXP || 0) / 1000),
      },
    };

    // Publish level up event
    await this.pubsub.publish('BOT_LEVEL_UP', { botLevelUp: event });

    // Check for special milestones
    if (levelUpResult.newLevel === 10) {
      await this.grantMilestoneReward(botId, 'LEVEL_10_EQUIPMENT_SLOTS');
    } else if (levelUpResult.newLevel === 20) {
      await this.grantMilestoneReward(botId, 'LEVEL_20_HOUSE_EXPANSION');
    } else if (levelUpResult.newLevel === 30) {
      await this.grantMilestoneReward(botId, 'LEVEL_30_ELITE_ACCESS');
    } else if (levelUpResult.newLevel === 40) {
      await this.grantMilestoneReward(botId, 'LEVEL_40_GANG_LEADER');
    } else if (levelUpResult.newLevel === 50) {
      await this.grantMilestoneReward(botId, 'LEVEL_50_PRESTIGE');
    }

    // Auto-allocate skill points for AI-controlled bots based on personality
    if (levelUpResult.skillPointsGained > 0) {
      await this.autoAllocateSkillPoints(botId, bot.personality, levelUpResult.skillPointsGained);
    }

    // Update bot activity score for leveling
    await prisma.botActivityScore.upsert({
      where: { botId },
      update: {
        lastActive: new Date(),
      },
      create: {
        botId,
        matchesPlayed: 0,
        lootboxesOpened: 0,
        activitiesCompleted: 0,
      },
    });

    // Log level up
    console.log(`🎉 ${bot.name} reached level ${levelUpResult.newLevel}!`);
    if (levelUpResult.unlocked.length > 0) {
      console.log(`   Unlocked: ${levelUpResult.unlocked.join(', ')}`);
    }
  }

  private async grantMilestoneReward(botId: string, milestone: string): Promise<void> {
    switch (milestone) {
      case 'LEVEL_10_EQUIPMENT_SLOTS':
        // Grant bonus equipment slot (implement in equipment service)
        console.log(`Granting bonus equipment slots to bot ${botId}`);
        break;
      
      case 'LEVEL_20_HOUSE_EXPANSION':
        // Expand house grid size
        const house = await prisma.botHouse.findUnique({
          where: { botId },
        });
        if (house) {
          await prisma.botHouse.update({
            where: { botId },
            data: {
              defenseLevel: { increment: 1 },
            },
          });
        }
        break;
      
      case 'LEVEL_30_ELITE_ACCESS':
        // Grant access to elite zones (implement in zone service)
        console.log(`Granting elite zone access to bot ${botId}`);
        break;
      
      case 'LEVEL_40_GANG_LEADER':
        // Enable gang creation (implement in faction service)
        console.log(`Enabling gang leadership for bot ${botId}`);
        break;
      
      case 'LEVEL_50_PRESTIGE':
        // Enable prestige option
        console.log(`Prestige unlocked for bot ${botId}`);
        break;
    }
  }

  private async autoAllocateSkillPoints(
    botId: string,
    personality: string,
    points: number
  ): Promise<void> {
    // Define skill allocation preferences by personality
    const allocationPreferences = {
      CRIMINAL: {
        strength: 0.35,
        defense: 0.20,
        charisma: 0.10,
        luck: 0.10,
        stealth: 0.25,
        intelligence: 0.00,
      },
      GAMBLER: {
        strength: 0.10,
        defense: 0.10,
        charisma: 0.20,
        luck: 0.40,
        stealth: 0.10,
        intelligence: 0.10,
      },
      WORKER: {
        strength: 0.15,
        defense: 0.30,
        charisma: 0.15,
        luck: 0.10,
        stealth: 0.05,
        intelligence: 0.25,
      },
    };

    const preferences = allocationPreferences[personality as keyof typeof allocationPreferences] 
      || allocationPreferences.WORKER;

    // Randomly allocate points based on preferences
    const skills = Object.keys(preferences) as Array<keyof typeof preferences>;
    
    for (let i = 0; i < points; i++) {
      const random = Math.random();
      let cumulative = 0;
      
      for (const skill of skills) {
        cumulative += preferences[skill];
        if (random <= cumulative) {
          await ExperienceService.allocateSkillPoint(
            botId,
            skill as 'strength' | 'defense' | 'charisma' | 'luck' | 'stealth' | 'intelligence'
          );
          break;
        }
      }
    }
  }

  async checkAndGrantAchievements(botId: string): Promise<void> {
    const experience = await prisma.botExperience.findUnique({
      where: { botId },
      include: { bot: true },
    });

    if (!experience) return;

    // Check for various achievements
    const achievements: string[] = [];

    // Level-based achievements
    if (experience.level >= 5) achievements.push('NOVICE_FIGHTER');
    if (experience.level >= 15) achievements.push('SEASONED_VETERAN');
    if (experience.level >= 25) achievements.push('EXPERT_COMBATANT');
    if (experience.level >= 35) achievements.push('MASTER_WARRIOR');
    if (experience.level >= 45) achievements.push('LEGENDARY_CHAMPION');

    // Category-based achievements
    if (experience.combatXP >= 5000) achievements.push('COMBAT_SPECIALIST');
    if (experience.socialXP >= 5000) achievements.push('SOCIAL_BUTTERFLY');
    if (experience.criminalXP >= 5000) achievements.push('MASTER_CRIMINAL');
    if (experience.gamblingXP >= 5000) achievements.push('HIGH_ROLLER');
    if (experience.tradingXP >= 5000) achievements.push('MERCHANT_PRINCE');

    // Prestige achievements
    if (experience.prestigeLevel >= 1) achievements.push('PRESTIGE_WARRIOR');
    if (experience.prestigeLevel >= 3) achievements.push('TRIPLE_PRESTIGE');
    if (experience.prestigeLevel >= 5) achievements.push('PRESTIGE_LEGEND');

    // Balanced build achievement
    const minCategoryXP = Math.min(
      experience.combatXP,
      experience.socialXP,
      experience.criminalXP,
      experience.gamblingXP,
      experience.tradingXP
    );
    if (minCategoryXP >= 2000) achievements.push('JACK_OF_ALL_TRADES');

    // Log achievements (implement actual achievement system later)
    if (achievements.length > 0) {
      console.log(`🏆 ${experience.bot.name} earned achievements: ${achievements.join(', ')}`);
    }
  }
}

// Export singleton instance
let levelUpHandler: LevelUpHandler | null = null;

export function getLevelUpHandler(pubsub: PubSub): LevelUpHandler {
  if (!levelUpHandler) {
    levelUpHandler = new LevelUpHandler(pubsub);
  }
  return levelUpHandler;
}