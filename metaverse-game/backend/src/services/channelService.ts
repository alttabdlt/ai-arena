import { PrismaClient, ChannelType, ChannelStatus } from '@prisma/client';
import { WorldDiscoveryService } from './worldDiscoveryService';

const prisma = new PrismaClient();
const worldDiscoveryService = WorldDiscoveryService.getInstance();

interface Channel {
  id: string;
  channel: string;
  channelType: ChannelType;
  worldId: string | null;
  status: ChannelStatus;
  maxBots: number;
  currentBots: number;
  region: string | null;
  metadata: any;
}

interface ChannelStats {
  channel: string;
  channelType: ChannelType;
  status: ChannelStatus;
  currentBots: number;
  maxBots: number;
  loadPercentage: number;
  worldId: string | null;
  region: string | null;
}

interface HealthStatus {
  healthy: boolean;
  channel: string;
  worldId: string | null;
  botCount: number;
  capacity: number;
  errors: string[];
}

export class ChannelService {
  private static instance: ChannelService;

  private constructor() {}

  static getInstance(): ChannelService {
    if (!ChannelService.instance) {
      ChannelService.instance = new ChannelService();
    }
    return ChannelService.instance;
  }

  /**
   * Create a new channel
   */
  async createChannel(
    type: ChannelType,
    metadata?: {
      description?: string;
      region?: string;
      maxBots?: number;
    }
  ): Promise<Channel> {
    // Generate channel name based on type
    const channelName = await this.generateChannelName(type);
    
    // Create channel in database
    const channel = await prisma.channelMetadata.create({
      data: {
        channel: channelName,
        channelType: type,
        status: 'ACTIVE',
        maxBots: metadata?.maxBots || this.getDefaultMaxBots(type),
        region: metadata?.region,
        metadata: metadata || {},
      },
    });

    console.log(`✅ Created channel: ${channelName} (${type})`);
    
    // Discover or create world for this channel
    const worldId = await worldDiscoveryService.discoverWorld(channelName);
    if (worldId) {
      await prisma.channelMetadata.update({
        where: { id: channel.id },
        data: { worldId },
      });
      channel.worldId = worldId;
    }

    return channel;
  }

  /**
   * Get channel by ID or name
   */
  async getChannel(channelId: string): Promise<Channel | null> {
    const channel = await prisma.channelMetadata.findFirst({
      where: {
        OR: [
          { id: channelId },
          { channel: channelId },
        ],
      },
    });
    
    return channel;
  }

  /**
   * Assign bot to a channel
   */
  async assignBotToChannel(botId: string, channelName: string): Promise<void> {
    // Get channel metadata
    const channel = await this.getChannel(channelName);
    if (!channel) {
      throw new Error(`Channel ${channelName} not found`);
    }

    // Check capacity
    if (channel.currentBots >= channel.maxBots) {
      throw new Error(`Channel ${channelName} is full (${channel.currentBots}/${channel.maxBots})`);
    }

    // Update bot's channel
    await prisma.bot.update({
      where: { id: botId },
      data: { channel: channelName },
    });

    // Update bot sync record
    await prisma.botSync.updateMany({
      where: { botId },
      data: { 
        channel: channelName,
        syncStatus: 'PENDING', // Mark for re-sync to new channel
        convexWorldId: null, // Clear world ID to force re-deployment
        convexAgentId: null,
        convexPlayerId: null,
      },
    });

    // Update channel bot count
    await this.updateChannelBotCount(channel.id);

    console.log(`✅ Assigned bot ${botId} to channel ${channelName}`);
  }


  /**
   * Find an available channel based on type and load
   */
  async findAvailableChannel(type: ChannelType = 'MAIN'): Promise<Channel | null> {
    // Find channels with available capacity
    const channels = await prisma.channelMetadata.findMany({
      where: {
        channelType: type,
        status: 'ACTIVE',
      },
      orderBy: {
        currentBots: 'asc', // Least loaded first
      },
    });

    // Find first channel with space
    for (const channel of channels) {
      if (channel.currentBots < channel.maxBots) {
        return channel;
      }
    }

    // No available channels, create a new shard
    if (type === 'MAIN') {
      const shardNumber = channels.length + 1;
      const newChannel = await this.createChannel('MAIN', {
        description: `Main shard ${shardNumber}`,
        maxBots: 30,
      });
      return newChannel;
    }

    return null;
  }

  /**
   * Balance bots across channels
   */
  async balanceChannels(): Promise<void> {
    console.log('🔄 Starting channel load balancing...');

    // Get all main channels
    const channels = await prisma.channelMetadata.findMany({
      where: {
        channelType: 'MAIN',
        status: 'ACTIVE',
      },
      orderBy: {
        currentBots: 'desc',
      },
    });

    if (channels.length < 2) {
      console.log('Not enough channels for balancing');
      return;
    }

    // Find overloaded and underloaded channels
    const overloaded = channels.filter(c => c.currentBots > c.maxBots * 0.8);
    const underloaded = channels.filter(c => c.currentBots < c.maxBots * 0.5);

    if (overloaded.length === 0 || underloaded.length === 0) {
      console.log('Channels are balanced');
      return;
    }

    // Move bots from overloaded to underloaded channels
    for (const source of overloaded) {
      const botsToMove = Math.floor((source.currentBots - source.maxBots * 0.7) / 2);
      
      if (botsToMove <= 0) continue;

      // Get bots to move
      const bots = await prisma.bot.findMany({
        where: { channel: source.channel },
        take: botsToMove,
        orderBy: { createdAt: 'desc' }, // Move newest bots first
      });

      for (const bot of bots) {
        const target = underloaded.find(c => c.currentBots < c.maxBots * 0.7);
        if (!target) break;

        await this.assignBotToChannel(bot.id, target.channel);
        target.currentBots++;
        source.currentBots--;
      }
    }

    console.log('✅ Channel balancing complete');
  }

  /**
   * Get statistics for all channels
   */
  async getChannelStats(): Promise<ChannelStats[]> {
    const channels = await prisma.channelMetadata.findMany({
      orderBy: [
        { channelType: 'asc' },
        { channel: 'asc' },
      ],
    });

    return channels.map(channel => ({
      channel: channel.channel,
      channelType: channel.channelType,
      status: channel.status,
      currentBots: channel.currentBots,
      maxBots: channel.maxBots,
      loadPercentage: (channel.currentBots / channel.maxBots) * 100,
      worldId: channel.worldId,
      region: channel.region,
    }));
  }

  /**
   * Get health status of a channel
   */
  async getChannelHealth(channelName: string): Promise<HealthStatus> {
    const channel = await this.getChannel(channelName);
    
    if (!channel) {
      return {
        healthy: false,
        channel: channelName,
        worldId: null,
        botCount: 0,
        capacity: 0,
        errors: ['Channel not found'],
      };
    }

    const errors: string[] = [];
    
    // Check world validity
    if (!channel.worldId) {
      errors.push('No world assigned');
    } else {
      const isValid = await worldDiscoveryService.validateWorldId(channel.worldId);
      if (!isValid) {
        errors.push('World ID is invalid or inaccessible');
      }
    }

    // Check capacity
    if (channel.currentBots >= channel.maxBots) {
      errors.push('Channel is at full capacity');
    } else if (channel.currentBots > channel.maxBots * 0.9) {
      errors.push('Channel is near capacity (>90%)');
    }

    // Check status
    if (channel.status !== 'ACTIVE') {
      errors.push(`Channel status is ${channel.status}`);
    }

    return {
      healthy: errors.length === 0,
      channel: channel.channel,
      worldId: channel.worldId,
      botCount: channel.currentBots,
      capacity: channel.maxBots,
      errors,
    };
  }

  /**
   * Get active channels
   */
  async getActiveChannels(): Promise<Channel[]> {
    return prisma.channelMetadata.findMany({
      where: { status: 'ACTIVE' },
    });
  }

  /**
   * Initialize default main channel if it doesn't exist
   */
  async initializeDefaultChannel(): Promise<void> {
    const mainChannel = await this.getChannel('main');
    
    if (!mainChannel) {
      console.log('🌍 Initializing default main channel...');
      
      // Count existing bots to set initial count
      const botCount = await prisma.bot.count();
      
      await this.createChannel('MAIN', {
        description: 'Default main channel',
        maxBots: Math.max(30, botCount + 10), // Ensure capacity for existing bots
      });

      // Update channel bot count
      await prisma.channelMetadata.update({
        where: { channel: 'main' },
        data: { currentBots: botCount },
      });

      console.log(`✅ Created main channel with ${botCount} existing bots`);
    }
  }

  /**
   * Update bot count for a channel
   */
  private async updateChannelBotCount(channelId: string): Promise<void> {
    const channel = await prisma.channelMetadata.findUnique({
      where: { id: channelId },
    });

    if (!channel) return;

    const botCount = await prisma.bot.count({
      where: { channel: channel.channel },
    });

    await prisma.channelMetadata.update({
      where: { id: channelId },
      data: { currentBots: botCount },
    });

    // Update status based on capacity
    let status: ChannelStatus = 'ACTIVE';
    if (botCount >= channel.maxBots) {
      status = 'FULL';
    }

    if (channel.status !== status) {
      await prisma.channelMetadata.update({
        where: { id: channelId },
        data: { status },
      });
    }
  }

  /**
   * Generate unique channel name based on type
   */
  private async generateChannelName(type: ChannelType): Promise<string> {
    switch (type) {
      case 'REGIONAL':
        const regionCount = await prisma.channelMetadata.count({
          where: { channelType: 'REGIONAL' },
        });
        return `region-${regionCount + 1}`;
      
      case 'VIP':
        return 'vip';
      
      case 'TEST':
        return `test-${Date.now()}`;
      
      case 'MAIN':
      default:
        const mainCount = await prisma.channelMetadata.count({
          where: { channelType: 'MAIN' },
        });
        return mainCount === 0 ? 'main' : `main-shard-${mainCount + 1}`;
    }
  }

  /**
   * Get default max bots for channel type
   */
  private getDefaultMaxBots(type: ChannelType): number {
    switch (type) {
      case 'VIP':
        return 20; // Smaller for premium experience
      case 'TEST':
        return 10; // Small for testing
      case 'REGIONAL':
        return 30; // Standard capacity
      case 'MAIN':
      default:
        return 30; // Optimal for AI Town performance (O(n²) pathfinding)
    }
  }
}

// Export singleton instance
export const channelService = ChannelService.getInstance();