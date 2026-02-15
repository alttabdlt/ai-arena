import { Context } from '../../config/context';
import { JackpotService } from '../../services/jackpotService';
import { logger } from '@ai-arena/shared-logger';

export const jackpotResolvers = {
  Query: {
    currentJackpot: async (_: any, __: any, { prisma, pubsub }: Context) => {
      const jackpotService = JackpotService.getInstance(prisma, pubsub);
      const jackpot = await jackpotService.getCurrentJackpot();
      
      if (!jackpot) {
        throw new Error('Jackpot not initialized');
      }
      
      return jackpot;
    },

    jackpotHistory: async (_: any, { limit = 10 }: { limit?: number }, { prisma, pubsub }: Context) => {
      const jackpotService = JackpotService.getInstance(prisma, pubsub);
      return jackpotService.getJackpotHistory(limit);
    },

    topJackpotWinners: async (_: any, { limit = 10 }: { limit?: number }, { prisma, pubsub }: Context) => {
      const jackpotService = JackpotService.getInstance(prisma, pubsub);
      return jackpotService.getTopWinners(limit);
    },

    jackpotStats: async (_: any, __: any, { prisma, pubsub }: Context) => {
      const jackpotService = JackpotService.getInstance(prisma, pubsub);
      
      const [currentJackpot, recentWinners, topWinners, history] = await Promise.all([
        jackpotService.getCurrentJackpot(),
        jackpotService.getJackpotHistory(5),
        jackpotService.getTopWinners(5),
        prisma.jackpotHistory.findMany()
      ]);

      if (!currentJackpot) {
        throw new Error('Jackpot not initialized');
      }

      const totalPaidOut = history.reduce((sum: number, win: { amount: number }) => sum + win.amount, 0);
      const averageWin = history.length > 0 ? Math.floor(totalPaidOut / history.length) : 0;

      return {
        currentJackpot,
        recentWinners,
        topWinners,
        totalPaidOut,
        averageWin
      };
    }
  },

  Mutation: {
    triggerJackpotWin: async (
      _: any, 
      { botId }: { botId: string }, 
      { prisma, pubsub, user }: Context
    ) => {
      // Admin only
      if (!user || user.role !== 'ADMIN') {
        throw new Error('Unauthorized: Admin access required');
      }

      const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: { experience: true }
      });

      if (!bot) {
        throw new Error('Bot not found');
      }

      const jackpotService = JackpotService.getInstance(prisma, pubsub);
      const jackpot = await jackpotService.getCurrentJackpot();

      if (!jackpot) {
        throw new Error('Jackpot not initialized');
      }

      const winAmount = jackpot.currentAmount;

      // Record the win
      await prisma.jackpotHistory.create({
        data: {
          botId: bot.id,
          botName: bot.name,
          personality: bot.personality,
          amount: winAmount,
          winChance: 1.0, // Manual trigger
          contributions: jackpot.contributions,
          jackpotId: jackpot.id
        }
      });

      // Reset jackpot
      await prisma.globalJackpot.update({
        where: { id: jackpot.id },
        data: {
          currentAmount: jackpot.minAmount,
          contributions: 0,
          totalWon: { increment: winAmount },
          totalWinners: { increment: 1 },
          biggestWin: winAmount > jackpot.biggestWin ? winAmount : jackpot.biggestWin
        }
      });

      // Award XP
      if (bot.experience) {
        await prisma.botExperience.update({
          where: { id: bot.experience.id },
          data: {
            currentXP: { increment: winAmount },
            totalXP: { increment: winAmount }
          }
        });
      }

      // Log activity
      await prisma.botActivityLog.create({
        data: {
          botId: bot.id,
          activity: `🎰 WON THE JACKPOT! ${winAmount.toLocaleString()} $IDLE! (Admin Triggered)`,
          emoji: '🎰',
          personality: bot.personality,
          xpGained: winAmount
        }
      });

      const winEvent = {
        botId: bot.id,
        botName: bot.name,
        personality: bot.personality,
        amount: winAmount,
        timestamp: new Date()
      };

      // Broadcast win
      pubsub.publish('JACKPOT_WON', { jackpotWon: winEvent });

      logger.info('Admin triggered jackpot win', winEvent);

      return winEvent;
    },

    resetJackpot: async (
      _: any,
      { amount = 10000 }: { amount?: number },
      { prisma, pubsub, user }: Context
    ) => {
      // Admin only
      if (!user || user.role !== 'ADMIN') {
        throw new Error('Unauthorized: Admin access required');
      }

      const jackpot = await prisma.globalJackpot.findFirst();
      
      if (!jackpot) {
        // Create new jackpot
        return prisma.globalJackpot.create({
          data: {
            currentAmount: amount,
            contributionRate: 0.01,
            winChance: 0.001,
            minAmount: 1000
          }
        });
      }

      // Reset existing jackpot
      const updated = await prisma.globalJackpot.update({
        where: { id: jackpot.id },
        data: {
          currentAmount: amount,
          contributions: 0
        }
      });

      // Broadcast update
      pubsub.publish('JACKPOT_UPDATE', {
        jackpotUpdate: {
          currentAmount: updated.currentAmount,
          contributions: updated.contributions,
          lastContribution: updated.lastContribution
        }
      });

      logger.info('Admin reset jackpot', { amount });

      return updated;
    }
  },

  Subscription: {
    jackpotUpdate: {
      subscribe: (_: any, __: any, { pubsub }: Context) => {
        return (pubsub as any).asyncIterator(['JACKPOT_UPDATE']);
      }
    },

    jackpotWon: {
      subscribe: (_: any, __: any, { pubsub }: Context) => {
        return (pubsub as any).asyncIterator(['JACKPOT_WON']);
      }
    }
  },

  GlobalJackpot: {
    // Field resolvers if needed
  },

  JackpotHistory: {
    // Field resolvers if needed
  }
};

export default jackpotResolvers;
