import { PrismaClient } from '@prisma/client';
import { PubSub } from 'graphql-subscriptions';
import GraphQLJSON from 'graphql-type-json';
import { GraphQLDateTime } from 'graphql-scalars';
import { channelResolvers } from './resolvers/channel';
import { deploymentResolvers } from './resolvers/deployment';

const prisma = new PrismaClient();
const pubsub = new PubSub() as any; // Type assertion for asyncIterator

const resolvers = {
  JSON: GraphQLJSON,
  DateTime: GraphQLDateTime,

  Query: {
    // Include channel and deployment queries
    ...channelResolvers.Query,
    ...deploymentResolvers.Query,
    // Bot queries
    getBot: async (_: any, { id }: { id: string }) => {
      return await prisma.bot.findUnique({
        where: { id },
        include: {
          house: true,
          equipment: true,
        }
      });
    },

    getBotByTokenId: async (_: any, { tokenId }: { tokenId: number }) => {
      return await prisma.bot.findUnique({
        where: { tokenId },
        include: {
          house: true,
          equipment: true,
        }
      });
    },

    getDeployedBots: async () => {
      return await prisma.bot.findMany({
        where: { metaverseAgentId: { not: null } },
        include: {
          house: true,
          equipment: true,
        }
      });
    },

    // World queries
    getWorlds: async (_: any, __: any, context: any) => {
      // TODO: Implement world fetching from Convex
      return [];
    },

    getWorld: async (_: any, { id }: { id: string }, context: any) => {
      // TODO: Implement single world fetching from Convex
      return null;
    },

    getAvailableWorlds: async (_: any, __: any, context: any) => {
      // TODO: Implement available worlds fetching
      return [];
    },

    // Activity queries
    getActivityLogs: async (_: any, { botId, limit = 50 }: { botId?: string; limit?: number }) => {
      // TODO: Implement activity log fetching from Convex
      return [];
    },

    getBotActivities: async (_: any, { botId, limit = 50 }: { botId: string; limit?: number }) => {
      // TODO: Implement bot-specific activity fetching
      return [];
    },
  },

  Mutation: {
    // Include channel and deployment mutations
    ...channelResolvers.Mutation,
    ...deploymentResolvers.Mutation,
    
    // Bot operations
    deployBot: async (_: any, args: any, context: any) => {
      const { botId, worldId, personality, modelType } = args;
      
      try {
        // Use BotSyncService from context
        const result = await context.botSyncService.deployBotToMetaverse(
          botId,
          worldId,
          personality,
          modelType
        );
        
        // Publish event
        pubsub.publish('BOT_DEPLOYED', { botDeployed: result });
        
        return result;
      } catch (error) {
        console.error('Deploy bot error:', error);
        throw error;
      }
    },

    updateBotPosition: async (_: any, args: any, context: any) => {
      const { botId, position, zone } = args;
      
      try {
        // TODO: Implement position update logic
        const bot = await prisma.bot.findUnique({ where: { id: botId } });
        
        // Publish event
        pubsub.publish('BOT_POSITION_UPDATED', { 
          botPositionUpdated: { ...bot, position, currentZone: zone }
        });
        
        return bot;
      } catch (error) {
        console.error('Update position error:', error);
        throw error;
      }
    },

    syncBotStats: async (_: any, args: any, context: any) => {
      const { botId, stats } = args;
      
      try {
        // First fetch the bot to get current stats
        const existingBot = await prisma.bot.findUnique({
          where: { id: botId }
        });
        
        if (!existingBot) {
          throw new Error('Bot not found');
        }
        
        // Update bot stats in database
        const bot = await prisma.bot.update({
          where: { id: botId },
          data: {
            stats: {
              ...(existingBot.stats as any),
              level: stats.level ?? (existingBot.stats as any).level,
              experience: stats.experience ?? (existingBot.stats as any).experience,
              power: stats.power ?? (existingBot.stats as any).power,
              defense: stats.defense ?? (existingBot.stats as any).defense,
              bloodTokens: stats.bloodTokens ?? (existingBot.stats as any).bloodTokens,
              energy: stats.energy ?? (existingBot.stats as any).energy,
            }
          }
        });
        
        return bot;
      } catch (error) {
        console.error('Sync stats error:', error);
        throw error;
      }
    },

    // World operations
    createWorld: async (_: any, { name }: { name: string }, context: any) => {
      try {
        // Use WorldInitializationService from context
        const world = await context.worldInitService.createWorld(name);
        
        // Publish event
        pubsub.publish('WORLD_STATUS_CHANGED', { worldStatusChanged: world });
        
        return world;
      } catch (error) {
        console.error('Create world error:', error);
        throw error;
      }
    },

    heartbeatWorld: async (_: any, { worldId }: { worldId: string }, context: any) => {
      try {
        // TODO: Implement world heartbeat logic
        return { id: worldId, status: 'active' };
      } catch (error) {
        console.error('World heartbeat error:', error);
        throw error;
      }
    },
  },

  Subscription: {
    // Real-time bot updates
    botPositionUpdated: {
      subscribe: (_: any, { botId }: { botId?: string }) => {
        if (botId) {
          return pubsub.asyncIterator([`BOT_POSITION_UPDATED_${botId}`]);
        }
        return pubsub.asyncIterator(['BOT_POSITION_UPDATED']);
      },
    },

    botDeployed: {
      subscribe: () => pubsub.asyncIterator(['BOT_DEPLOYED']),
    },

    // Activity stream
    activityLogAdded: {
      subscribe: (_: any, { botId }: { botId?: string }) => {
        if (botId) {
          return pubsub.asyncIterator([`ACTIVITY_LOG_${botId}`]);
        }
        return pubsub.asyncIterator(['ACTIVITY_LOG']);
      },
    },

    // World updates
    worldStatusChanged: {
      subscribe: () => pubsub.asyncIterator(['WORLD_STATUS_CHANGED']),
    },
  },

  // Type resolvers
  Bot: {
    stats: (parent: any) => ({
      level: parent.level || 1,
      experience: parent.experience || 0,
      power: parent.power || 10,
      defense: parent.defense || 10,
      speed: parent.speed || 10,
      bloodTokens: parent.bloodTokens || 0,
      energy: parent.energy || 100,
    }),
  },
};

export default resolvers;