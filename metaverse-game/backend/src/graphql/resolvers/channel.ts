import { ChannelService } from '../../services/channelService';
import { PrismaClient } from '@prisma/client';
import { GraphQLError } from 'graphql';

const channelService = ChannelService.getInstance();
const prisma = new PrismaClient();

export const channelResolvers = {
  Query: {
    channels: async (_: any, args: { type?: string; status?: string }) => {
      try {
        const where: any = {};
        if (args.type) where.channelType = args.type;
        if (args.status) where.status = args.status;

        const channels = await prisma.channelMetadata.findMany({
          where,
          orderBy: [
            { channelType: 'asc' },
            { channel: 'asc' }
          ]
        });

        return channels.map(channel => ({
          id: channel.id,
          name: channel.channel,
          type: channel.channelType,
          status: channel.status,
          currentBots: channel.currentBots,
          maxBots: channel.maxBots,
          loadPercentage: (channel.currentBots / channel.maxBots) * 100,
          worldId: channel.worldId,
          region: channel.region,
          description: (channel.metadata as any)?.description || null
        }));
      } catch (error: any) {
        console.error('Error fetching channels:', error);
        throw new GraphQLError('Failed to fetch channels');
      }
    },

    channel: async (_: any, args: { id: string }) => {
      try {
        const channel = await prisma.channelMetadata.findUnique({
          where: { id: args.id }
        });

        if (!channel) {
          return null;
        }

        return {
          id: channel.id,
          name: channel.channel,
          type: channel.channelType,
          status: channel.status,
          currentBots: channel.currentBots,
          maxBots: channel.maxBots,
          loadPercentage: (channel.currentBots / channel.maxBots) * 100,
          worldId: channel.worldId,
          region: channel.region,
          description: (channel.metadata as any)?.description || null
        };
      } catch (error: any) {
        console.error('Error fetching channel:', error);
        throw new GraphQLError('Failed to fetch channel');
      }
    },

    channelByName: async (_: any, args: { name: string }) => {
      try {
        const channel = await prisma.channelMetadata.findFirst({
          where: { channel: args.name }
        });

        if (!channel) {
          return null;
        }

        return {
          id: channel.id,
          name: channel.channel,
          type: channel.channelType,
          status: channel.status,
          currentBots: channel.currentBots,
          maxBots: channel.maxBots,
          loadPercentage: (channel.currentBots / channel.maxBots) * 100,
          worldId: channel.worldId,
          region: channel.region,
          description: (channel.metadata as any)?.description || null
        };
      } catch (error: any) {
        console.error('Error fetching channelByName:', error);
        throw new GraphQLError('Failed to fetch channel by name');
      }
    },

    myBotChannels: async (_: any, __: any, context: any) => {
      try {
        if (!context.user) {
          throw new GraphQLError('Authentication required');
        }

        // Get all unique channels for user's bots
        const userBots = await prisma.bot.findMany({
          where: { creatorId: context.user.id },
          select: { channel: true },
          distinct: ['channel']
        });

        const channelNames = userBots.map(bot => bot.channel);
        
        const channels = await prisma.channelMetadata.findMany({
          where: {
            channel: { in: channelNames }
          }
        });

        return channels.map(channel => ({
          id: channel.id,
          name: channel.channel,
          type: channel.channelType,
          status: channel.status,
          currentBots: channel.currentBots,
          maxBots: channel.maxBots,
          loadPercentage: (channel.currentBots / channel.maxBots) * 100,
          worldId: channel.worldId,
          region: channel.region,
          description: (channel.metadata as any)?.description || null
        }));
      } catch (error: any) {
        console.error('Error fetching user channels:', error);
        throw new GraphQLError('Failed to fetch user channels');
      }
    }
  },

  Mutation: {
    switchChannel: async (_: any, args: { botId: string; channelName: string }, context: any) => {
      try {
        if (!context.user) {
          throw new GraphQLError('Authentication required');
        }

        // Verify bot ownership
        const bot = await prisma.bot.findUnique({
          where: { id: args.botId },
          include: {
            creator: true,
            equipment: true,
            house: {
              include: {
                furniture: true
              }
            },
            activityScore: true
          }
        });

        if (!bot) {
          throw new GraphQLError('Bot not found');
        }

        if (bot.creatorId !== context.user.id) {
          throw new GraphQLError('You do not own this bot');
        }

        // Check if channel exists
        const targetChannel = await prisma.channelMetadata.findFirst({
          where: { channel: args.channelName }
        });

        if (!targetChannel) {
          throw new GraphQLError(`Channel ${args.channelName} does not exist`);
        }

        if (targetChannel.status !== 'ACTIVE') {
          throw new GraphQLError(`Channel ${args.channelName} is not active (status: ${targetChannel.status})`);
        }

        if (targetChannel.currentBots >= targetChannel.maxBots) {
          throw new GraphQLError(`Channel ${args.channelName} is full (${targetChannel.currentBots}/${targetChannel.maxBots})`);
        }

        // Use channel service to handle the switch
        await channelService.assignBotToChannel(args.botId, args.channelName);

        // Return updated bot
        const updatedBot = await prisma.bot.findUnique({
          where: { id: args.botId },
          include: {
            creator: true,
            equipment: true,
            house: {
              include: {
                furniture: true
              }
            },
            activityScore: true
          }
        });

        return updatedBot;
      } catch (error: any) {
        console.error('Error switching channel:', error);
        throw error instanceof GraphQLError ? error : new GraphQLError('Failed to switch channel');
      }
    }
  },

  Bot: {
    channel: (parent: any) => {
      // The channel field is already on the bot from Prisma
      return parent.channel || 'main';
    }
  }
};