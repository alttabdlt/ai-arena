import { prisma } from '../config/database';
import { convexService } from './convexService';
import { metaverseEventsService } from './metaverseEventsService';
import { SyncStatus } from '@prisma/client';

export class BotSyncService {
  private static instance: BotSyncService;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  private constructor() {}

  static getInstance(): BotSyncService {
    if (!BotSyncService.instance) {
      BotSyncService.instance = new BotSyncService();
    }
    return BotSyncService.instance;
  }

  // Start the sync service
  async start() {
    if (this.isRunning) {
      console.log('🔄 Bot sync service already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting bot sync service');

    // Sync every 30 seconds
    this.syncInterval = setInterval(() => {
      this.performSync().catch(error => {
        console.error('Error in bot sync:', error);
      });
    }, 30000);

    // Perform initial sync
    await this.performSync();
  }

  // Stop the sync service
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Bot sync service stopped');
  }

  // Perform sync for all bots
  private async performSync() {
    console.log('🔄 Performing bot sync...');

    // Get all bots that need syncing
    const botsToSync = await prisma.bot.findMany({
      where: {
        OR: [
          { botSync: null },
          { botSync: { syncStatus: { not: SyncStatus.SYNCED } } },
          { botSync: { lastSyncedAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } } }, // Older than 1 hour
        ],
      },
      include: {
        botSync: true,
        house: true,
        equipment: { where: { equipped: true } },
        activityScore: true,
      },
    });

    console.log(`Found ${botsToSync.length} bots to sync`);

    // Sync each bot
    for (const bot of botsToSync) {
      try {
        await this.syncBot(bot);
      } catch (error) {
        console.error(`Failed to sync bot ${bot.id}:`, error);
      }
    }

    // Check for position updates from metaverse
    await this.checkMetaverseUpdates();
  }

  // Sync a single bot
  private async syncBot(bot: any) {
    // If bot has no sync record, it needs to be registered first
    if (!bot.botSync) {
      console.log(`Bot ${bot.id} needs registration in metaverse`);
      return; // Let the register mutation handle this
    }

    // If bot is already synced and recent, skip
    if (
      bot.botSync.syncStatus === SyncStatus.SYNCED &&
      bot.botSync.lastSyncedAt &&
      bot.botSync.lastSyncedAt > new Date(Date.now() - 60 * 60 * 1000) // Less than 1 hour old
    ) {
      return;
    }

    // Sync stats if needed
    if (!bot.botSync.statsSynced && bot.botSync.convexAgentId && bot.botSync.convexWorldId) {
      try {
        const stats = typeof bot.stats === 'string' ? JSON.parse(bot.stats) : bot.stats;
        const totalPower = bot.equipment.reduce((sum: number, item: any) => sum + item.powerBonus, 0);
        const totalDefense = bot.equipment.reduce((sum: number, item: any) => sum + item.defenseBonus, 0);

        const metaverseStats = {
          power: totalPower,
          defense: totalDefense,
          houseScore: bot.house?.houseScore || 0,
          wins: stats?.wins || 0,
          losses: stats?.losses || 0,
          earnings: stats?.earnings || 0,
          activityLevel: bot.activityScore?.matchesPlayed || 0,
        };

        await convexService.syncBotStats({
          agentId: bot.botSync.convexAgentId,
          worldId: bot.botSync.convexWorldId,
          stats: metaverseStats,
        });

        await prisma.botSync.update({
          where: { id: bot.botSync.id },
          data: {
            statsSynced: true,
            lastSyncedAt: new Date(),
          },
        });

        await metaverseEventsService.publishBotStatsSync(bot.id, metaverseStats);
        console.log(`✅ Synced stats for bot ${bot.id}`);
      } catch (error) {
        console.error(`Failed to sync stats for bot ${bot.id}:`, error);
      }
    }
  }

  // Check for updates from the metaverse
  private async checkMetaverseUpdates() {
    try {
      // Get all synced bots
      const syncedBots = await prisma.botSync.findMany({
        where: {
          syncStatus: SyncStatus.SYNCED,
          convexWorldId: { not: null },
          convexAgentId: { not: null },
        },
        include: {
          bot: true,
        },
      });

      console.log(`📡 Checking position updates for ${syncedBots.length} synced bots`);

      // Batch fetch positions from Convex
      for (const sync of syncedBots) {
        if (!sync.convexWorldId || !sync.convexAgentId) continue;

        try {
          // Get agent data from Convex
          const agentData = await convexService.getAgentPosition(
            sync.convexWorldId,
            sync.convexAgentId
          );

          if (agentData && agentData.position) {
            const currentPosition = sync.bot.metaversePosition as any || {};
            
            // Check if position changed
            if (
              currentPosition.x !== agentData.position.x ||
              currentPosition.y !== agentData.position.y ||
              sync.bot.currentZone !== agentData.zone
            ) {
              // Update position in database
              await prisma.bot.update({
                where: { id: sync.botId },
                data: {
                  metaversePosition: {
                    x: agentData.position.x,
                    y: agentData.position.y,
                    worldInstanceId: sync.convexWorldId,
                  },
                  currentZone: agentData.zone,
                  lastZoneChange: agentData.zone !== sync.bot.currentZone ? new Date() : undefined,
                },
              });

              // Update sync record
              await prisma.botSync.update({
                where: { id: sync.id },
                data: {
                  positionSynced: true,
                  lastSyncedAt: new Date(),
                },
              });

              // Publish position update event
              await metaverseEventsService.publishBotPositionUpdate(
                sync.botId,
                agentData.position,
                agentData.zone,
                sync.convexWorldId
              );

              console.log(`📍 Updated position for bot ${sync.bot.name}: Zone ${agentData.zone} (${agentData.position.x}, ${agentData.position.y})`);
            }
          }
        } catch (error) {
          console.error(`Failed to fetch position for bot ${sync.botId}:`, error);
        }
      }
    } catch (error) {
      console.error('Error checking metaverse updates:', error);
    }
  }

  // Handle incoming position update from metaverse
  async handlePositionUpdate(agentId: string, position: { x: number; y: number }, zone: string) {
    try {
      // Find bot by agent ID
      const bot = await prisma.bot.findFirst({
        where: { metaverseAgentId: agentId },
      });

      if (!bot) {
        console.error(`Bot not found for agent ${agentId}`);
        return;
      }

      // Update bot position
      const currentPosition = bot.metaversePosition as { x?: number; y?: number; worldInstanceId?: string } | null;
      
      await prisma.bot.update({
        where: { id: bot.id },
        data: {
          metaversePosition: {
            ...position,
            worldInstanceId: currentPosition?.worldInstanceId || '',
          },
          currentZone: zone,
        },
      });

      // Publish position update event
      await metaverseEventsService.publishBotPositionUpdate(
        bot.id,
        position,
        zone,
        currentPosition?.worldInstanceId || ''
      );

      console.log(`📍 Updated position for bot ${bot.id}`);
    } catch (error) {
      console.error('Error handling position update:', error);
    }
  }

  // Handle incoming activity from metaverse
  async handleActivityUpdate(agentId: string, activityType: string, data: any) {
    try {
      // Find bot by agent ID
      const bot = await prisma.bot.findFirst({
        where: { metaverseAgentId: agentId },
      });

      if (!bot) {
        console.error(`Bot not found for agent ${agentId}`);
        return;
      }

      // Update activity score based on activity type
      if (activityType === 'conversation') {
        await prisma.botActivityScore.update({
          where: { botId: bot.id },
          data: {
            socialInteractions: { increment: 1 },
            lastActive: new Date(),
          },
        });
      }

      // Publish activity event
      await metaverseEventsService.publishBotActivity(activityType, {
        botId: bot.id,
        ...data,
      });

      console.log(`🎭 Recorded ${activityType} activity for bot ${bot.id}`);
    } catch (error) {
      console.error('Error handling activity update:', error);
    }
  }
}

// Export singleton instance
export const botSyncService = BotSyncService.getInstance();