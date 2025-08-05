import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';
import { convexService } from './convexService';
import { metaverseEventsService } from './metaverseEventsService';
import { worldInitializationService } from './worldInitializationService';
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

    // First, ensure worlds are initialized
    await worldInitializationService.ensureWorldsExist();

    // Check for undeployed bots (bots without metaverseAgentId)
    const undeployedBots = await prisma.bot.findMany({
      where: {
        OR: [
          { metaverseAgentId: null },
          { metaverseAgentId: '' }
        ]
      },
      include: {
        creator: true,
        botSync: true
      }
    });

    if (undeployedBots.length > 0) {
      console.log(`🚀 Found ${undeployedBots.length} undeployed bots - deploying automatically...`);
      await this.deployUndeployedBots(undeployedBots);
    }

    // Get all bots that need syncing
    const botsToSync = await prisma.bot.findMany({
      where: {
        AND: [
          { metaverseAgentId: { not: null } },
          { metaverseAgentId: { not: '' } },
          {
            OR: [
              { botSync: null },
              { botSync: { syncStatus: { not: SyncStatus.SYNCED } } },
              { botSync: { lastSyncedAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } } }, // Older than 1 hour
            ],
          }
        ]
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

    // Clean up failed syncs periodically (every 5th run)
    if (Math.random() < 0.2) {
      await this.cleanupFailedSyncs();
    }
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
        } catch (error: any) {
          // Handle specific error cases
          if (error.message && error.message.includes('Invalid worldId format')) {
            console.error(`Invalid worldId for bot ${sync.bot.name}: ${sync.convexWorldId}`);
            // Mark sync as failed due to invalid worldId
            await prisma.botSync.update({
              where: { id: sync.id },
              data: {
                syncStatus: 'FAILED',
                syncErrors: [`Invalid worldId: ${sync.convexWorldId}`],
                lastSyncedAt: new Date()
              }
            });
          } else if (error.message && error.message.includes('World not found')) {
            console.error(`World not found for bot ${sync.bot.name}: ${sync.convexWorldId}`);
            // The world might have been deleted, mark as failed
            await prisma.botSync.update({
              where: { id: sync.id },
              data: {
                syncStatus: 'FAILED',
                syncErrors: [`World not found: ${sync.convexWorldId}`],
                lastSyncedAt: new Date()
              }
            });
          } else {
            console.error(`Failed to fetch position for bot ${sync.bot.name}:`, error.message || error);
          }
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

  // Deploy undeployed bots automatically
  private async deployUndeployedBots(bots: any[]) {
    let deployed = 0;
    let failed = 0;

    for (const bot of bots) {
      try {
        // Create or update bot sync record
        const botSync = await prisma.botSync.upsert({
          where: { botId: bot.id },
          create: {
            botId: bot.id,
            syncStatus: 'SYNCING'
          },
          update: {
            syncStatus: 'SYNCING',
            syncErrors: []
          }
        });

        // Map personality to agent description
        const { mapPersonalityToAgent, getInitialZone } = require('../utils/personalityMapping');
        const agentDescription = mapPersonalityToAgent(
          bot.name,
          bot.personality,
          bot.prompt
        );
        
        // Determine initial zone
        const initialZone = getInitialZone(bot.personality);
        
        // Find available world instance
        const worldInstance = await convexService.findAvailableInstance(initialZone, bot.id);
        
        if (!worldInstance) {
          throw new Error(`No available instance for zone ${initialZone}`);
        }
        
        // Register bot in metaverse
        const result = await convexService.createBotAgent({
          worldId: worldInstance.worldId,
          name: agentDescription.name,
          character: agentDescription.character,
          identity: agentDescription.identity,
          plan: agentDescription.plan,
          aiArenaBotId: bot.id,
          initialZone: initialZone
        });

        if (result && result.agentId) {
          // Update bot with metaverse data
          await prisma.bot.update({
            where: { id: bot.id },
            data: {
              metaverseAgentId: result.agentId,
              currentZone: initialZone,
              metaversePosition: Prisma.JsonNull // Position will be synced later
            }
          });

          // Update sync status
          await prisma.botSync.update({
            where: { id: botSync.id },
            data: {
              syncStatus: 'SYNCED',
              convexWorldId: worldInstance.worldId,
              convexAgentId: result.agentId,
              convexPlayerId: result.playerId,
              personalityMapped: true,
              lastSyncedAt: new Date()
            }
          });

          deployed++;
          console.log(`✅ Auto-deployed bot: ${bot.name} (${bot.id})`);
          
          // Publish deployment event
          await metaverseEventsService.publishBotDeployed(bot.id, result.agentId, worldInstance.worldId);
        } else {
          throw new Error('Failed to register bot');
        }
      } catch (error: any) {
        failed++;
        console.error(`❌ Failed to auto-deploy bot ${bot.name}:`, error.message);
        
        // Update sync status to failed
        await prisma.botSync.upsert({
          where: { botId: bot.id },
          create: {
            botId: bot.id,
            syncStatus: 'FAILED',
            syncErrors: [error.message]
          },
          update: {
            syncStatus: 'FAILED',
            syncErrors: [error.message]
          }
        });
      }

      // Rate limiting between deployments
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (deployed > 0) {
      console.log(`🎉 Auto-deployment complete: ${deployed} succeeded, ${failed} failed`);
    }
  }

  // Clean up failed syncs periodically
  private async cleanupFailedSyncs() {
    try {
      console.log('🧹 Cleaning up failed syncs...');
      
      // Find syncs that failed due to invalid world IDs
      const invalidSyncs = await prisma.botSync.findMany({
        where: {
          OR: [
            { 
              syncStatus: 'FAILED'
            },
            {
              convexWorldId: 'm17dkz0psv5e7b812sjjxwpwgd7n374s' // Known invalid ID
            }
          ]
        }
      });

      if (invalidSyncs.length > 0) {
        console.log(`Found ${invalidSyncs.length} invalid syncs to clean`);
        
        for (const sync of invalidSyncs) {
          // Reset sync status
          await prisma.botSync.update({
            where: { id: sync.id },
            data: {
              syncStatus: 'PENDING',
              convexWorldId: null,
              convexAgentId: null,
              convexPlayerId: null,
              syncErrors: [],
              personalityMapped: false,
              positionSynced: false,
              statsSynced: false
            }
          });

          // Clear bot metaverse fields
          await prisma.bot.update({
            where: { id: sync.botId },
            data: {
              metaverseAgentId: null,
              currentZone: null,
              metaversePosition: Prisma.JsonNull
            }
          });
        }

        console.log(`✅ Cleaned ${invalidSyncs.length} invalid syncs`);
      }

      // Retry failed syncs that are older than 5 minutes
      const oldFailedSyncs = await prisma.botSync.findMany({
        where: {
          syncStatus: 'FAILED',
          lastSyncedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) }
        },
        take: 5 // Limit retries per cycle
      });

      if (oldFailedSyncs.length > 0) {
        console.log(`Retrying ${oldFailedSyncs.length} failed syncs...`);
        
        for (const sync of oldFailedSyncs) {
          await prisma.botSync.update({
            where: { id: sync.id },
            data: {
              syncStatus: 'PENDING',
              syncErrors: []
            }
          });
        }
      }
    } catch (error) {
      console.error('Error cleaning up failed syncs:', error);
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