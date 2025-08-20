import { PrismaClient, BotPersonality } from '@prisma/client';
import { PubSub } from 'graphql-subscriptions';
import { logger } from '@ai-arena/shared-logger';

export class JackpotService {
  private static instance: JackpotService;
  private prisma: PrismaClient;
  private pubsub: PubSub;
  private jackpotId: string | null = null;

  private constructor(prisma: PrismaClient, pubsub: PubSub) {
    this.prisma = prisma;
    this.pubsub = pubsub;
    this.initializeJackpot();
  }

  static getInstance(prisma: PrismaClient, pubsub: PubSub): JackpotService {
    if (!JackpotService.instance) {
      JackpotService.instance = new JackpotService(prisma, pubsub);
    }
    return JackpotService.instance;
  }

  private async initializeJackpot() {
    try {
      // Get or create the global jackpot
      let jackpot = await this.prisma.globalJackpot.findFirst();
      
      if (!jackpot) {
        jackpot = await this.prisma.globalJackpot.create({
          data: {
            currentAmount: 10000, // Start with 10K $IDLE
            contributionRate: 0.01, // 1% of all XP
            winChance: 0.001, // 0.1% chance
            minAmount: 1000 // Minimum 1K $IDLE
          }
        });
        logger.info('Initialized global jackpot', { id: jackpot.id, amount: jackpot.currentAmount });
      }
      
      this.jackpotId = jackpot.id;
    } catch (error) {
      logger.error('Failed to initialize jackpot', error);
    }
  }

  async contributeToJackpot(xpAmount: number): Promise<number> {
    if (!this.jackpotId) {
      await this.initializeJackpot();
    }

    const contribution = Math.floor(xpAmount * 0.01); // 1% of XP goes to jackpot
    
    if (contribution <= 0) return 0;

    try {
      const jackpot = await this.prisma.globalJackpot.update({
        where: { id: this.jackpotId! },
        data: {
          currentAmount: { increment: contribution },
          contributions: { increment: 1 },
          lastContribution: new Date()
        }
      });

      // Broadcast jackpot update
      this.pubsub.publish('JACKPOT_UPDATE', {
        jackpotUpdate: {
          currentAmount: jackpot.currentAmount,
          contributions: jackpot.contributions,
          lastContribution: jackpot.lastContribution
        }
      });

      return contribution;
    } catch (error) {
      logger.error('Failed to contribute to jackpot', error);
      return 0;
    }
  }

  async checkForJackpotWin(botId: string): Promise<{ won: boolean; amount?: number }> {
    if (!this.jackpotId) {
      await this.initializeJackpot();
    }

    try {
      const jackpot = await this.prisma.globalJackpot.findUnique({
        where: { id: this.jackpotId! }
      });

      if (!jackpot || jackpot.currentAmount < jackpot.minAmount) {
        return { won: false };
      }

      // Roll for jackpot win
      const roll = Math.random();
      if (roll > jackpot.winChance) {
        return { won: false };
      }

      // JACKPOT WIN!
      const bot = await this.prisma.bot.findUnique({
        where: { id: botId },
        include: { experience: true }
      });

      if (!bot) {
        return { won: false };
      }

      const winAmount = jackpot.currentAmount;

      // Record the win in history
      await this.prisma.jackpotHistory.create({
        data: {
          botId: bot.id,
          botName: bot.name,
          personality: bot.personality,
          amount: winAmount,
          winChance: jackpot.winChance,
          contributions: jackpot.contributions,
          jackpotId: jackpot.id
        }
      });

      // Update jackpot stats and reset
      await this.prisma.globalJackpot.update({
        where: { id: jackpot.id },
        data: {
          currentAmount: jackpot.minAmount, // Reset to minimum
          contributions: 0,
          totalWon: { increment: winAmount },
          totalWinners: { increment: 1 },
          biggestWin: winAmount > jackpot.biggestWin ? winAmount : jackpot.biggestWin
        }
      });

      // Award XP to the winner (jackpot amount = XP)
      if (bot.experience) {
        await this.prisma.botExperience.update({
          where: { id: bot.experience.id },
          data: {
            currentXP: { increment: winAmount },
            totalXP: { increment: winAmount }
          }
        });
      }

      // Log activity
      await this.prisma.botActivityLog.create({
        data: {
          botId: bot.id,
          activity: `🎰 WON THE JACKPOT! ${winAmount.toLocaleString()} $IDLE!`,
          emoji: '🎰',
          personality: bot.personality,
          xpGained: winAmount
        }
      });

      // Broadcast jackpot win globally
      this.pubsub.publish('JACKPOT_WON', {
        jackpotWon: {
          botId: bot.id,
          botName: bot.name,
          personality: bot.personality,
          amount: winAmount,
          timestamp: new Date()
        }
      });

      logger.info('JACKPOT WON!', {
        botId: bot.id,
        botName: bot.name,
        amount: winAmount,
        roll,
        chance: jackpot.winChance
      });

      return { won: true, amount: winAmount };
    } catch (error) {
      logger.error('Failed to check jackpot win', error);
      return { won: false };
    }
  }

  async getCurrentJackpot() {
    if (!this.jackpotId) {
      await this.initializeJackpot();
    }

    return this.prisma.globalJackpot.findUnique({
      where: { id: this.jackpotId! }
    });
  }

  async getJackpotHistory(limit: number = 10) {
    return this.prisma.jackpotHistory.findMany({
      orderBy: { wonAt: 'desc' },
      take: limit
    });
  }

  async getTopWinners(limit: number = 10) {
    return this.prisma.jackpotHistory.findMany({
      orderBy: { amount: 'desc' },
      take: limit
    });
  }

  // Calculate dynamic win chance based on jackpot size
  calculateDynamicWinChance(currentAmount: number): number {
    // Base chance: 0.1%
    // Increases slightly as jackpot grows to ensure it pays out
    const baseChance = 0.001;
    const amountFactor = currentAmount / 1000000; // Per million $IDLE
    const dynamicChance = baseChance * (1 + amountFactor * 0.5);
    return Math.min(dynamicChance, 0.01); // Cap at 1%
  }

  // Personality-based jackpot bonuses
  getPersonalityJackpotBonus(personality: BotPersonality): number {
    switch (personality) {
      case 'GAMBLER':
        return 1.5; // 50% better jackpot chances
      case 'CRIMINAL':
        return 1.2; // 20% better chances
      case 'WORKER':
        return 1.0; // Standard chances
      default:
        return 1.0;
    }
  }

  async checkForJackpotWinWithBonus(botId: string, personality: BotPersonality): Promise<{ won: boolean; amount?: number }> {
    if (!this.jackpotId) {
      await this.initializeJackpot();
    }

    try {
      const jackpot = await this.prisma.globalJackpot.findUnique({
        where: { id: this.jackpotId! }
      });

      if (!jackpot || jackpot.currentAmount < jackpot.minAmount) {
        return { won: false };
      }

      // Calculate dynamic chance with personality bonus
      const baseChance = this.calculateDynamicWinChance(jackpot.currentAmount);
      const personalityBonus = this.getPersonalityJackpotBonus(personality);
      const finalChance = baseChance * personalityBonus;

      // Roll for jackpot win
      const roll = Math.random();
      if (roll > finalChance) {
        return { won: false };
      }

      // Win logic continues as before...
      return this.checkForJackpotWin(botId);
    } catch (error) {
      logger.error('Failed to check jackpot win with bonus', error);
      return { won: false };
    }
  }

}

export default JackpotService;