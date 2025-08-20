import { PrismaClient } from '@prisma/client';
import { simpleLogger as logger } from '@ai-arena/shared-logger';

const prisma = new PrismaClient();

// Energy constants (matching frontend)
const ENERGY_RATES: Record<string, number> = {
  // Basic tier - 1 energy/hour
  GPT_4O_MINI: 1,
  DEEPSEEK_CHAT: 1,
  CLAUDE_3_5_HAIKU: 1,
  LLAMA_3_1_70B: 1,
  LLAMA_3_2_90B: 1,
  QWEN_2_5_72B: 1,
  DEEPSEEK_V3: 1,
  
  // Standard tier - 2 energy/hour
  GPT_4O: 2,
  CLAUDE_3_5_SONNET: 2,
  GEMINI_2_5_PRO: 2,
  LLAMA_3_1_405B: 2,
  KIMI_K2: 2,
  MIXTRAL_8X22B: 2,
  
  // Advanced tier - 3 energy/hour
  CLAUDE_4_SONNET: 3,
  O3_MINI: 3,
  DEEPSEEK_R1: 3,
  QWQ_32B: 3,
  CLAUDE_3_OPUS: 3,
  QWEN_2_5_MAX: 3,
  QVQ_72B_PREVIEW: 3,
  GROK_3: 3,
  
  // Premium tier - 5 energy/hour
  O3: 5,
  O3_PRO: 5,
  CLAUDE_4_OPUS: 5,
  GEMINI_2_5_PRO_DEEP_THINK: 5,
};

const ENERGY_REGEN_RATE = 1; // 1 energy per hour
const MAX_ENERGY = 100;
const STARTING_ENERGY = 100;
const TOURNAMENT_ENERGY_COST = 10;

export class EnergyService {
  /**
   * Initialize energy for a new bot
   * @param botId - The bot ID
   * @param tx - Optional Prisma transaction client
   */
  async initializeBotEnergy(botId: string, tx?: any): Promise<void> {
    const client = tx || prisma;
    try {
      await client.botEnergy.create({
        data: {
          botId,
          currentEnergy: STARTING_ENERGY,
          maxEnergy: MAX_ENERGY,
          lastRegenTime: new Date(),
          isPaused: false,
        },
      });
      logger.info(`Initialized energy for bot ${botId}`);
    } catch (error) {
      logger.error('Failed to initialize bot energy:', error);
      throw error;
    }
  }

  /**
   * Get current energy status for a bot
   */
  async getBotEnergy(botId: string) {
    try {
      let energyRecord = await prisma.botEnergy.findUnique({
        where: { botId },
        include: { bot: true },
      });

      // Create energy record if it doesn't exist (for existing bots)
      if (!energyRecord) {
        await this.initializeBotEnergy(botId);
        energyRecord = await prisma.botEnergy.findUnique({
          where: { botId },
          include: { bot: true },
        });
      }

      if (!energyRecord) {
        throw new Error('Failed to create energy record');
      }

      // Apply regeneration
      const updatedEnergy = await this.applyRegeneration(energyRecord);
      
      return {
        currentEnergy: updatedEnergy.currentEnergy,
        maxEnergy: updatedEnergy.maxEnergy,
        isPaused: updatedEnergy.isPaused,
        consumptionRate: this.getEnergyRate(energyRecord.bot.modelType),
        regenerationRate: ENERGY_REGEN_RATE,
        netConsumption: Math.max(0, this.getEnergyRate(energyRecord.bot.modelType) - ENERGY_REGEN_RATE),
      };
    } catch (error) {
      logger.error('Failed to get bot energy:', error);
      throw error;
    }
  }

  /**
   * Consume energy for bot activity (called periodically by scheduler)
   */
  async consumeEnergy(botId: string, hours: number = 1): Promise<void> {
    try {
      const energyRecord = await prisma.botEnergy.findUnique({
        where: { botId },
        include: { bot: true },
      });

      if (!energyRecord) {
        throw new Error('Energy record not found');
      }

      // Skip if bot is paused
      if (energyRecord.isPaused) {
        return;
      }

      // Apply regeneration first
      const updatedRecord = await this.applyRegeneration(energyRecord);

      // Calculate consumption
      const consumptionRate = this.getEnergyRate(energyRecord.bot.modelType);
      const totalConsumption = consumptionRate * hours;
      
      const newEnergy = Math.max(0, updatedRecord.currentEnergy - totalConsumption);

      // Update energy and pause if depleted
      await prisma.botEnergy.update({
        where: { id: updatedRecord.id },
        data: {
          currentEnergy: newEnergy,
          isPaused: newEnergy === 0,
        },
      });

      if (newEnergy === 0) {
        logger.info(`Bot ${botId} has run out of energy and was paused`);
      }
    } catch (error) {
      logger.error('Failed to consume energy:', error);
      throw error;
    }
  }

  /**
   * Consume energy for tournament participation
   */
  async consumeTournamentEnergy(botId: string): Promise<boolean> {
    try {
      const energyRecord = await prisma.botEnergy.findUnique({
        where: { botId },
      });

      if (!energyRecord) {
        throw new Error('Energy record not found');
      }

      // Apply regeneration first
      const updatedRecord = await this.applyRegeneration(energyRecord);

      if (updatedRecord.currentEnergy < TOURNAMENT_ENERGY_COST) {
        return false; // Not enough energy
      }

      await prisma.botEnergy.update({
        where: { id: updatedRecord.id },
        data: {
          currentEnergy: updatedRecord.currentEnergy - TOURNAMENT_ENERGY_COST,
        },
      });

      return true;
    } catch (error) {
      logger.error('Failed to consume tournament energy:', error);
      throw error;
    }
  }

  /**
   * Purchase energy for a bot
   */
  async purchaseEnergy(
    botId: string,
    energyAmount: number,
    hypeSpent: number,
    packType: string,
    txHash?: string
  ): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        // Record the purchase
        await tx.energyPurchase.create({
          data: {
            botId,
            energyAmount,
            hypeSpent,
            packType,
            txHash,
          },
        });

        // Update bot energy
        const energyRecord = await tx.botEnergy.findUnique({
          where: { botId },
        });

        if (!energyRecord) {
          throw new Error('Energy record not found');
        }

        const newEnergy = Math.min(
          energyRecord.currentEnergy + energyAmount,
          energyRecord.maxEnergy
        );

        await tx.botEnergy.update({
          where: { botId },
          data: {
            currentEnergy: newEnergy,
            isPaused: false, // Resume bot if it was paused
          },
        });
      });

      logger.info(`Bot ${botId} purchased ${energyAmount} energy for ${hypeSpent} HYPE`);
    } catch (error) {
      logger.error('Failed to purchase energy:', error);
      throw error;
    }
  }

  /**
   * Pause or resume a bot
   */
  async setBotPaused(botId: string, isPaused: boolean): Promise<void> {
    try {
      await prisma.botEnergy.update({
        where: { botId },
        data: { isPaused },
      });
      logger.info(`Bot ${botId} ${isPaused ? 'paused' : 'resumed'}`);
    } catch (error) {
      logger.error('Failed to update bot pause state:', error);
      throw error;
    }
  }

  /**
   * Get energy purchase history for a bot
   */
  async getPurchaseHistory(botId: string) {
    try {
      return await prisma.energyPurchase.findMany({
        where: { botId },
        orderBy: { purchasedAt: 'desc' },
        take: 10,
      });
    } catch (error) {
      logger.error('Failed to get purchase history:', error);
      throw error;
    }
  }

  /**
   * Process energy consumption for all active bots (called by scheduler)
   */
  async processAllBotsEnergyConsumption(): Promise<void> {
    try {
      const activeBots = await prisma.botEnergy.findMany({
        where: {
          isPaused: false,
          currentEnergy: { gt: 0 },
        },
        include: { bot: true },
      });

      for (const botEnergy of activeBots) {
        await this.consumeEnergy(botEnergy.botId, 1);
      }

      logger.info(`Processed energy consumption for ${activeBots.length} active bots`);
    } catch (error) {
      logger.error('Failed to process energy consumption:', error);
      throw error;
    }
  }

  /**
   * Apply energy regeneration based on time passed
   */
  private async applyRegeneration(energyRecord: any) {
    const now = new Date();
    const hoursPassed = (now.getTime() - energyRecord.lastRegenTime.getTime()) / (1000 * 60 * 60);
    
    if (hoursPassed >= 1) {
      const regenAmount = Math.floor(hoursPassed) * ENERGY_REGEN_RATE;
      const newEnergy = Math.min(energyRecord.currentEnergy + regenAmount, energyRecord.maxEnergy);
      
      return await prisma.botEnergy.update({
        where: { id: energyRecord.id },
        data: {
          currentEnergy: newEnergy,
          lastRegenTime: now,
        },
      });
    }
    
    return energyRecord;
  }

  /**
   * Get energy consumption rate for a model
   */
  private getEnergyRate(modelType: string | null): number {
    if (!modelType) return 1; // Default rate for companions without AI models
    return ENERGY_RATES[modelType] || 1;
  }

  /**
   * Get energy stats for all bots of a user
   */
  async getUserBotsEnergyStats(userId: string) {
    try {
      const bots = await prisma.bot.findMany({
        where: { creatorId: userId },
        include: { energy: true },
      });

      return bots.map(bot => ({
        botId: bot.id,
        botName: bot.name,
        modelType: bot.modelType,
        currentEnergy: bot.energy?.currentEnergy || 0,
        maxEnergy: bot.energy?.maxEnergy || MAX_ENERGY,
        isPaused: bot.energy?.isPaused || false,
        consumptionRate: this.getEnergyRate(bot.modelType),
      }));
    } catch (error) {
      logger.error('Failed to get user bots energy stats:', error);
      throw error;
    }
  }
}

export const energyService = new EnergyService();