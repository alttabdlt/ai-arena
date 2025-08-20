import { PrismaClient } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { logger } from '@ai-arena/shared-logger';
import { JackpotService } from '../../services/jackpotService';
import { PubSub } from 'graphql-subscriptions';

const prisma = new PrismaClient();
const pubsub = new PubSub();

// Personality-based idle multipliers
const IDLE_MULTIPLIERS = {
  CRIMINAL: 1.2,  // 20% bonus for being active in crime
  GAMBLER: 1.0,   // Standard rate
  WORKER: 1.5,    // 50% bonus for consistent work
};

// XP per second while idle
const BASE_IDLE_XP_PER_SECOND = 0.1; // 6 XP per minute, 360 per hour

export const idleGameResolvers = {
  Query: {
    getBotActivities: async (_: any, { botId, limit = 10 }: { botId: string; limit?: number }) => {
      try {
        const activities = await prisma.botActivityLog.findMany({
          where: { botId },
          orderBy: { timestamp: 'desc' },
          take: limit,
        });
        return activities;
      } catch (error) {
        logger.error('Failed to fetch bot activities', { error, botId });
        throw new GraphQLError('Failed to fetch activities');
      }
    },

    calculateIdleProgress: async (_: any, { botId }: { botId: string }) => {
      try {
        const bot = await prisma.bot.findUnique({
          where: { id: botId },
          include: {
            experience: true,
            idleProgress: true,
            activityLogs: {
              orderBy: { timestamp: 'desc' },
              take: 5,
            },
          },
        });

        if (!bot) {
          throw new GraphQLError('Bot not found');
        }

        const now = new Date();
        const lastActive = bot.idleProgress?.lastActiveAt || bot.createdAt;
        const timeAwaySeconds = Math.floor((now.getTime() - lastActive.getTime()) / 1000);
        
        // Calculate pending XP based on personality
        const multiplier = IDLE_MULTIPLIERS[bot.personality] || 1.0;
        const pendingXP = Math.floor(timeAwaySeconds * BASE_IDLE_XP_PER_SECOND * multiplier);

        return {
          pendingXP,
          timeAwaySeconds,
          currentLevel: bot.experience?.level || 1,
          currentXP: bot.experience?.currentXP || 0,
          activities: bot.activityLogs,
        };
      } catch (error) {
        logger.error('Failed to calculate idle progress', { error, botId });
        throw new GraphQLError('Failed to calculate idle progress');
      }
    },

    getBotWithExperience: async (_: any, { botId }: { botId: string }) => {
      try {
        const bot = await prisma.bot.findUnique({
          where: { id: botId },
          include: {
            experience: true,
            idleProgress: true,
            activityLogs: {
              orderBy: { timestamp: 'desc' },
              take: 10,
            },
          },
        });
        return bot;
      } catch (error) {
        logger.error('Failed to fetch bot with experience', { error, botId });
        throw new GraphQLError('Failed to fetch bot');
      }
    },
  },

  Mutation: {
    updateBotExperience: async (_: any, { botId, xpGained }: { botId: string; xpGained: number }) => {
      try {
        // Get bot info for personality bonus
        const bot = await prisma.bot.findUnique({
          where: { id: botId },
        });

        if (!bot) {
          throw new GraphQLError('Bot not found');
        }

        // Contribute to jackpot (1% of XP)
        if (xpGained > 0) {
          const jackpotService = JackpotService.getInstance(prisma, pubsub);
          await jackpotService.contributeToJackpot(xpGained);
          
          // Check for jackpot win with personality bonus
          const winResult = await jackpotService.checkForJackpotWinWithBonus(botId, bot.personality);
          if (winResult.won && winResult.amount) {
            // Add jackpot winnings to XP
            xpGained += winResult.amount;
            logger.info('JACKPOT WON!', { botId, botName: bot.name, amount: winResult.amount });
          }
        }

        // Get or create experience record
        let experience = await prisma.botExperience.findUnique({
          where: { botId },
        });

        if (!experience) {
          experience = await prisma.botExperience.create({
            data: {
              botId,
              level: 1,
              currentXP: 0,
              totalXP: 0,
              xpToNextLevel: 100,
            },
          });
        }

        // Calculate new XP and level
        let newCurrentXP = experience.currentXP + xpGained;
        let newTotalXP = experience.totalXP + xpGained;
        let newLevel = experience.level;
        let newXPToNextLevel = experience.xpToNextLevel;

        // Level up logic
        while (newCurrentXP >= newXPToNextLevel) {
          newCurrentXP -= newXPToNextLevel;
          newLevel++;
          newXPToNextLevel = Math.floor(newXPToNextLevel * 1.5); // 50% more XP needed each level
        }

        // Update experience
        const updatedExperience = await prisma.botExperience.update({
          where: { botId },
          data: {
            currentXP: newCurrentXP,
            totalXP: newTotalXP,
            level: newLevel,
            xpToNextLevel: newXPToNextLevel,
            lastXPGain: new Date(),
          },
        });

        // Update activity score
        await prisma.botActivityScore.upsert({
          where: { botId },
          update: {
            activitiesCompleted: { increment: 1 },
            lastActive: new Date(),
          },
          create: {
            botId,
            activitiesCompleted: 1,
            lastActive: new Date(),
          },
        });

        logger.info('Bot experience updated', { botId, xpGained, newLevel });
        return updatedExperience;
      } catch (error) {
        logger.error('Failed to update bot experience', { error, botId });
        throw new GraphQLError('Failed to update experience');
      }
    },

    logBotActivity: async (_: any, args: {
      botId: string;
      activity: string;
      emoji: string;
      personality: string;
      xpGained?: number;
    }) => {
      try {
        const activityLog = await prisma.botActivityLog.create({
          data: {
            botId: args.botId,
            activity: args.activity,
            emoji: args.emoji,
            personality: args.personality as any,
            xpGained: args.xpGained || 0,
          },
        });

        logger.debug('Bot activity logged', { botId: args.botId, activity: args.activity });
        return activityLog;
      } catch (error) {
        logger.error('Failed to log bot activity', { error, args });
        throw new GraphQLError('Failed to log activity');
      }
    },

    claimIdleRewards: async (_: any, { botId }: { botId: string }) => {
      try {
        const bot = await prisma.bot.findUnique({
          where: { id: botId },
          include: {
            experience: true,
            idleProgress: true,
          },
        });

        if (!bot) {
          throw new GraphQLError('Bot not found');
        }

        const now = new Date();
        const lastClaim = bot.idleProgress?.lastXPClaim || bot.createdAt;
        const timeAwaySeconds = Math.floor((now.getTime() - lastClaim.getTime()) / 1000);
        
        // Calculate XP based on personality
        const multiplier = IDLE_MULTIPLIERS[bot.personality] || 1.0;
        const xpGained = Math.floor(timeAwaySeconds * BASE_IDLE_XP_PER_SECOND * multiplier);

        // Contribute to jackpot (1% of XP)
        if (xpGained > 0) {
          const jackpotService = JackpotService.getInstance(prisma, pubsub);
          await jackpotService.contributeToJackpot(xpGained);
        }

        // Update experience
        let experience = bot.experience;
        if (!experience) {
          experience = await prisma.botExperience.create({
            data: {
              botId,
              level: 1,
              currentXP: 0,
              totalXP: 0,
              xpToNextLevel: 100,
            },
          });
        }

        // Calculate new level and XP
        let newCurrentXP = experience.currentXP + xpGained;
        let newTotalXP = experience.totalXP + xpGained;
        let newLevel = experience.level;
        let newXPToNextLevel = experience.xpToNextLevel;

        while (newCurrentXP >= newXPToNextLevel) {
          newCurrentXP -= newXPToNextLevel;
          newLevel++;
          newXPToNextLevel = Math.floor(newXPToNextLevel * 1.5);
        }

        // Update experience
        await prisma.botExperience.update({
          where: { botId },
          data: {
            currentXP: newCurrentXP,
            totalXP: newTotalXP,
            level: newLevel,
            xpToNextLevel: newXPToNextLevel,
            lastXPGain: now,
          },
        });

        // Update or create idle progress
        await prisma.idleProgress.upsert({
          where: { botId },
          update: {
            lastActiveAt: now,
            lastXPClaim: now,
            totalIdleTime: { increment: timeAwaySeconds },
            totalIdleXP: { increment: xpGained },
          },
          create: {
            botId,
            lastActiveAt: now,
            lastXPClaim: now,
            idleMultiplier: multiplier,
            totalIdleTime: timeAwaySeconds,
            totalIdleXP: xpGained,
          },
        });

        // Generate some activity logs for the time away
        const activities = [];
        const activityCount = Math.min(5, Math.floor(timeAwaySeconds / 60)); // 1 activity per minute, max 5
        
        for (let i = 0; i < activityCount; i++) {
          const activity = getRandomActivity(bot.personality);
          const log = await prisma.botActivityLog.create({
            data: {
              botId,
              activity: activity.text,
              emoji: activity.emoji,
              personality: bot.personality,
              xpGained: Math.floor(xpGained / activityCount),
            },
          });
          activities.push(log);
        }

        logger.info('Idle rewards claimed', { botId, xpGained, timeAwaySeconds, newLevel });

        return {
          xpGained,
          newLevel,
          newCurrentXP,
          newTotalXP,
          activities,
          timeAwaySeconds,
        };
      } catch (error) {
        logger.error('Failed to claim idle rewards', { error, botId });
        throw new GraphQLError('Failed to claim rewards');
      }
    },

    resetIdleProgress: async (_: any, { botId }: { botId: string }) => {
      try {
        const now = new Date();
        const idleProgress = await prisma.idleProgress.upsert({
          where: { botId },
          update: {
            lastActiveAt: now,
            lastXPClaim: now,
          },
          create: {
            botId,
            lastActiveAt: now,
            lastXPClaim: now,
            idleMultiplier: 1.0,
          },
        });

        logger.info('Idle progress reset', { botId });
        return idleProgress;
      } catch (error) {
        logger.error('Failed to reset idle progress', { error, botId });
        throw new GraphQLError('Failed to reset progress');
      }
    },
  },

  Bot: {
    experience: async (bot: any) => {
      if (bot.experience) return bot.experience;
      return await prisma.botExperience.findUnique({
        where: { botId: bot.id },
      });
    },
    activityLogs: async (bot: any) => {
      if (bot.activityLogs) return bot.activityLogs;
      return await prisma.botActivityLog.findMany({
        where: { botId: bot.id },
        orderBy: { timestamp: 'desc' },
        take: 10,
      });
    },
    idleProgress: async (bot: any) => {
      if (bot.idleProgress) return bot.idleProgress;
      return await prisma.idleProgress.findUnique({
        where: { botId: bot.id },
      });
    },
  },
};

// Helper function to get random activity based on personality
function getRandomActivity(personality: string) {
  const activities = {
    CRIMINAL: [
      { emoji: '🔪', text: '🔪 Planning a heist' },
      { emoji: '💰', text: '💰 Counting stolen goods' },
      { emoji: '🎭', text: '🎭 Creating fake IDs' },
      { emoji: '🏃', text: '🏃 Running from cops' },
      { emoji: '🔫', text: '🔫 Training combat skills' },
      { emoji: '🕵️', text: '🕵️ Scouting targets' },
    ],
    GAMBLER: [
      { emoji: '🎰', text: '🎰 Playing slots' },
      { emoji: '🃏', text: '🃏 Counting cards' },
      { emoji: '🎲', text: '🎲 Rolling dice' },
      { emoji: '💸', text: '💸 Making risky bets' },
      { emoji: '🍀', text: '🍀 Testing luck' },
      { emoji: '📊', text: '📊 Studying odds' },
    ],
    WORKER: [
      { emoji: '⚒️', text: '⚒️ Working hard' },
      { emoji: '📦', text: '📦 Organizing inventory' },
      { emoji: '🧹', text: '🧹 Cleaning house' },
      { emoji: '💪', text: '💪 Training strength' },
      { emoji: '📚', text: '📚 Studying skills' },
      { emoji: '🛠️', text: '🛠️ Fixing equipment' },
    ],
  };

  const personalityActivities = activities[personality as keyof typeof activities] || activities.WORKER;
  return personalityActivities[Math.floor(Math.random() * personalityActivities.length)];
}