import { GraphQLError } from 'graphql';
import { Context } from '../../config/context';
import { energyService } from '../../services/energyService';

export const energyResolvers = {
  Query: {
    botEnergy: async (_: any, { botId }: { botId: string }, context: Context) => {
      // Check if user owns the bot
      const bot = await context.prisma.bot.findUnique({
        where: { id: botId },
      });

      if (!bot) {
        throw new GraphQLError('Bot not found');
      }

      if (bot.creatorId !== context.user?.id) {
        throw new GraphQLError('Unauthorized');
      }

      return energyService.getBotEnergy(botId);
    },

    userBotsEnergy: async (_: any, __: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated');
      }

      return energyService.getUserBotsEnergyStats(context.user.id);
    },

    energyPurchaseHistory: async (_: any, { botId }: { botId: string }, context: Context) => {
      // Check if user owns the bot
      const bot = await context.prisma.bot.findUnique({
        where: { id: botId },
      });

      if (!bot) {
        throw new GraphQLError('Bot not found');
      }

      if (bot.creatorId !== context.user?.id) {
        throw new GraphQLError('Unauthorized');
      }

      return energyService.getPurchaseHistory(botId);
    },
  },

  Mutation: {
    purchaseEnergy: async (
      _: any,
      { 
        botId, 
        packType, 
        txHash 
      }: { 
        botId: string; 
        packType: 'small' | 'medium' | 'large' | 'mega'; 
        txHash: string;
      },
      context: Context
    ) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated');
      }

      // Check if user owns the bot
      const bot = await context.prisma.bot.findUnique({
        where: { id: botId },
      });

      if (!bot) {
        throw new GraphQLError('Bot not found');
      }

      if (bot.creatorId !== context.user.id) {
        throw new GraphQLError('Unauthorized');
      }

      // Energy pack configurations
      const packs = {
        small: { energy: 100, cost: 0.5 },
        medium: { energy: 500, cost: 2.0 },
        large: { energy: 1000, cost: 3.5 },
        mega: { energy: 5000, cost: 15.0 },
      };

      const pack = packs[packType];
      if (!pack) {
        throw new GraphQLError('Invalid pack type');
      }

      await energyService.purchaseEnergy(
        botId,
        pack.energy,
        pack.cost,
        packType,
        txHash
      );

      return {
        success: true,
        message: `Successfully purchased ${pack.energy} energy for ${pack.cost} HYPE`,
      };
    },

    pauseBot: async (
      _: any,
      { botId }: { botId: string },
      context: Context
    ) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated');
      }

      // Check if user owns the bot
      const bot = await context.prisma.bot.findUnique({
        where: { id: botId },
      });

      if (!bot) {
        throw new GraphQLError('Bot not found');
      }

      if (bot.creatorId !== context.user.id) {
        throw new GraphQLError('Unauthorized');
      }

      await energyService.setBotPaused(botId, true);

      return {
        success: true,
        message: 'Bot paused successfully',
      };
    },

    resumeBot: async (
      _: any,
      { botId }: { botId: string },
      context: Context
    ) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated');
      }

      // Check if user owns the bot
      const bot = await context.prisma.bot.findUnique({
        where: { id: botId },
      });

      if (!bot) {
        throw new GraphQLError('Bot not found');
      }

      if (bot.creatorId !== context.user.id) {
        throw new GraphQLError('Unauthorized');
      }

      // Check if bot has energy to resume
      const energy = await energyService.getBotEnergy(botId);
      if (energy.currentEnergy === 0) {
        throw new GraphQLError('Cannot resume bot with 0 energy. Please purchase energy first.');
      }

      await energyService.setBotPaused(botId, false);

      return {
        success: true,
        message: 'Bot resumed successfully',
      };
    },
  },

  Bot: {
    energy: async (parent: any) => {
      try {
        return await energyService.getBotEnergy(parent.id);
      } catch (error) {
        // Return default values if energy record doesn't exist
        return {
          currentEnergy: 0,
          maxEnergy: 100,
          isPaused: false,
          consumptionRate: 1,
          regenerationRate: 1,
          netConsumption: 0,
        };
      }
    },
  },
};