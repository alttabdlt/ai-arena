import { PrismaClient, Prisma, SyncStatus } from '@prisma/client';
import { ConvexService } from './convexService';
import { MetaverseEventsService } from './metaverseEventsService';
import { WorldDiscoveryService } from './worldDiscoveryService';
import { ChannelService } from './channelService';
import { ArenaClient } from './arenaClient';

const prisma = new PrismaClient();
const convexService = ConvexService.getInstance();
const metaverseEventsService = MetaverseEventsService.getInstance();
const worldDiscoveryService = WorldDiscoveryService.getInstance();
const channelService = ChannelService.getInstance();
const arenaClient = ArenaClient.getInstance();

export class BotSyncService {
  private static instance: BotSyncService;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private deploymentMutex: Set<string> = new Set();

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

    // Ensure default channel exists
    await channelService.initializeDefaultChannel();

    // Get all active channels
    const channels = await channelService.getActiveChannels();
    
    if (channels.length === 0) {
      console.log('⚠️  No active channels found');
      return;
    }

    console.log(`📍 Syncing ${channels.length} channel(s)...`);

    // Sync each channel
    for (const channel of channels) {
      await this.syncChannel(channel.channel);
    }

    // Check for position updates from metaverse
    await this.checkMetaverseUpdates();

    // Clean up orphaned metaverse bots (every 10th run instead of every 3rd)
    // Also check if we're not in the middle of deployments
    if (Math.random() < 0.10) { // Reduced from 33% to 10% chance
      // Check if any bots were deployed in the last 10 minutes
      const recentDeployments = await prisma.botSync.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
          }
        }
      });
      
      if (recentDeployments === 0) {
        console.log('🧹 No recent deployments, safe to run cleanup');
        await this.cleanupOrphanedMetaverseBots();
      } else {
        console.log(`⏳ Skipping cleanup due to ${recentDeployments} recent deployments`);
      }
    }

    // Clean up failed syncs periodically (every 5th run)
    if (Math.random() < 0.2) {
      await this.cleanupFailedSyncs();
    }
  }

  // Sync bots in a specific channel
  private async syncChannel(channelName: string) {
    console.log(`🔄 Syncing channel: ${channelName}`);

    // Discover world for this channel
    let worldId = await worldDiscoveryService.discoverWorld(channelName);
    
    if (!worldId) {
      // Clear cache and retry once
      console.log(`⚠️ No world found for channel "${channelName}", clearing cache and retrying...`);
      worldDiscoveryService.clearCache(channelName);
      worldId = await worldDiscoveryService.discoverWorld(channelName);
      
      if (!worldId) {
        console.error(`❌ Could not discover world for channel "${channelName}" after cache clear`);
        return;
      }
    }

    // Check for undeployed bots in this channel
    // Only deploy bots that don't have a SYNCED status and haven't been marked as disabled (deleted)
    const undeployedBots = await prisma.bot.findMany({
      where: {
        channel: channelName,
        OR: [
          { metaverseAgentId: null },
          { metaverseAgentId: '' }
        ],
        NOT: [
          {
            botSync: {
              syncStatus: SyncStatus.SYNCED
            }
          },
          {
            // Skip bots that have been marked as disabled (deleted bots)
            botSync: {
              syncStatus: SyncStatus.DISABLED
            }
          }
        ]
      },
      include: {
        creator: true,
        botSync: true,
        lootboxRewards: {
          include: {
            match: true
          }
        }
      }
    });

    if (undeployedBots.length > 0) {
      console.log(`🚀 Found ${undeployedBots.length} undeployed bots in channel "${channelName}"`);
      await this.deployUndeployedBots(undeployedBots, channelName);
    }

    // Get all bots that need syncing in this channel
    const botsToSync = await prisma.bot.findMany({
      where: {
        channel: channelName,
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

    if (botsToSync.length > 0) {
      console.log(`Found ${botsToSync.length} bots to sync in channel "${channelName}"`);
      
      // Sync each bot
      for (const bot of botsToSync) {
        try {
          await this.syncBot(bot);
        } catch (error) {
          console.error(`Failed to sync bot ${bot.id}:`, error);
        }
      }
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
        // First check if agent exists
        const agentExists = await convexService.getAgentPosition(
          bot.botSync.convexWorldId,
          bot.botSync.convexAgentId
        );
        
        if (agentExists === null) {
          console.warn(`⚠️ Agent ${bot.botSync.convexAgentId} not found, clearing stale ID for bot ${bot.id}`);
          
          // Clear the stale agent ID from the main Bot table
          await prisma.bot.update({
            where: { id: bot.id },
            data: {
              metaverseAgentId: null,
              currentZone: null,
              metaversePosition: Prisma.JsonNull,
            }
          });
          
          // Reset the sync record to trigger redeployment
          await prisma.botSync.update({
            where: { id: bot.botSync.id },
            data: {
              syncStatus: 'PENDING',
              syncErrors: JSON.stringify(['Agent not found - cleared for redeployment']),
              convexAgentId: null,
              convexPlayerId: null,
              statsSynced: false,
            }
          });
          
          console.log(`✅ Cleared stale agent ID and reset sync for bot ${bot.id} - will redeploy on next sync`);
          return;
        }
        
        const stats = typeof bot.stats === 'string' ? JSON.parse(bot.stats) : bot.stats;
        const totalPower = bot.equipment.reduce((sum: number, item: any) => sum + item.powerBonus, 0);
        const totalDefense = bot.equipment.reduce((sum: number, item: any) => sum + item.defenseBonus, 0);

        const metaverseStats = {
          power: totalPower,
          defense: totalDefense,
          houseScore: bot.house?.houseScore || 0,
          wins: Number(stats?.wins) || 0,
          losses: Number(stats?.losses) || 0,
          earnings: Number(stats?.earnings) || 0,
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
          let agentData = await convexService.getAgentPosition(
            sync.convexWorldId,
            sync.convexAgentId
          );

          // If agent doesn't exist, retry before marking as failed
          if (agentData === null) {
            console.warn(`⚠️ Agent ${sync.convexAgentId} not found for bot ${sync.botId}, retrying...`);
            
            // Retry up to 3 times with exponential backoff
            let retryCount = 0;
            let retryDelay = 1000; // Start with 1 second
            
            while (retryCount < 3 && agentData === null) {
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              
              agentData = await convexService.getAgentPosition(
                sync.convexWorldId,
                sync.convexAgentId
              );
              
              if (agentData === null) {
                retryCount++;
                retryDelay *= 2; // Exponential backoff
                console.log(`🔄 Retry ${retryCount}/3 for agent ${sync.convexAgentId}`);
              }
            }
            
            // If still not found after retries, check if bot was recently deployed
            if (agentData === null) {
              const timeSinceSync = Date.now() - new Date(sync.lastSyncedAt || sync.createdAt).getTime();
              
              // If sync is less than 5 minutes old, skip cleanup (might still be deploying)
              if (timeSinceSync < 5 * 60 * 1000) {
                console.log(`⏳ Skipping cleanup for recently deployed bot ${sync.botId} (${Math.floor(timeSinceSync / 1000)}s old)`);
                continue;
              }
              
              console.error(`❌ Agent ${sync.convexAgentId} definitively not found for bot ${sync.botId} after retries`);
              
              // Clear the stale agent ID from the main Bot table
              await prisma.bot.update({
                where: { id: sync.botId },
                data: {
                  metaverseAgentId: null,
                  currentZone: null,
                  metaversePosition: Prisma.JsonNull,
                }
              });
              
              // Reset sync to PENDING for redeployment
              await prisma.botSync.update({
                where: { id: sync.id },
                data: {
                  syncStatus: 'PENDING',
                  syncErrors: JSON.stringify(['Agent not found after retries - cleared for redeployment']),
                  convexAgentId: null,
                  convexPlayerId: null,
                  statsSynced: false,
                }
              });
              
              console.log(`✅ Cleared stale agent ID for bot ${sync.botId} - will redeploy on next sync`);
              continue;
            }
          }

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

            // Sync experience data
            try {
              const experience = await convexService.getBotExperience(
                sync.convexWorldId,
                sync.botId
              );

              if (experience) {
                const success = await arenaClient.updateBotExperience(sync.botId, {
                  level: experience.level,
                  currentXP: experience.currentXP,
                  totalXP: experience.totalXP,
                  xpToNextLevel: experience.xpToNextLevel,
                  combatXP: experience.combatXP,
                  socialXP: experience.socialXP,
                  criminalXP: experience.criminalXP,
                  gamblingXP: experience.gamblingXP,
                  tradingXP: experience.tradingXP,
                });

                if (success) {
                  console.log(`✅ Synced experience for bot ${sync.bot.name}: Level ${experience.level}`);
                }
              }
            } catch (error) {
              console.error(`Failed to sync experience for bot ${sync.botId}:`, error);
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
            // Clear cache for this channel
            worldDiscoveryService.clearCache(sync.bot.channel || 'main');
            // World was deleted/wiped, clear the reference and mark for re-deployment
            await prisma.botSync.update({
              where: { id: sync.id },
              data: {
                syncStatus: 'PENDING',
                convexWorldId: null,
                convexAgentId: null,
                convexPlayerId: null,
                syncErrors: [`World was wiped/deleted, will re-deploy`],
                lastSyncedAt: new Date()
              }
            });
            
            // Clear bot metaverse fields so it gets re-deployed
            await prisma.bot.update({
              where: { id: sync.botId },
              data: {
                metaverseAgentId: null,
                currentZone: null,
                metaversePosition: Prisma.JsonNull
              }
            });
            
            // Notify discovery service to clear cache
            worldDiscoveryService.handleWorldNotFound('main', sync.convexWorldId);
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

  // Deploy undeployed bots automatically with mutex to prevent duplicates
  private async deployUndeployedBots(bots: any[], channel: string = 'main') {
    let deployed = 0;
    let failed = 0;
    let skipped = 0;

    // Get world ID for deployment
    let worldId = await worldDiscoveryService.discoverWorld(channel);
    
    if (!worldId) {
      // Clear cache and retry once
      console.log(`⚠️ No world found for channel "${channel}", clearing cache and retrying...`);
      worldDiscoveryService.clearCache(channel);
      worldId = await worldDiscoveryService.discoverWorld(channel);
      
      if (!worldId) {
        console.error(`❌ Cannot deploy bots: No world available for channel "${channel}" after cache clear`);
        return;
      }
    }

    // Check and auto-resume world if it's inactive
    try {
      const worldStatus = await convexService.convexClient.query('world:defaultWorldStatus' as any);
      if (worldStatus?.status === 'inactive' || worldStatus?.status === 'stoppedByDeveloper') {
        console.log('🔄 World is inactive, attempting to resume...');
        await convexService.convexClient.mutation('testing:resume' as any);
        console.log('✅ World resumed successfully');
        // Wait a bit for the engine to fully start
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else if (worldStatus?.status === 'running') {
        console.log('✅ World is already running');
      }
    } catch (resumeError) {
      console.warn('⚠️ Could not check/resume world status:', resumeError);
      // Continue anyway - the heartbeat in createBotAgent might help
    }

    for (const bot of bots) {
      // Check if deployment is already in progress for this bot
      if (this.deploymentMutex.has(bot.id)) {
        console.log(`⏭️ Skipping bot ${bot.name} - deployment already in progress`);
        skipped++;
        continue;
      }

      // Check if bot already has a sync record with SYNCED status
      const existingSync = await prisma.botSync.findUnique({
        where: { botId: bot.id }
      });
      
      if (existingSync?.syncStatus === SyncStatus.SYNCED && existingSync.convexAgentId) {
        console.log(`⏭️ Skipping bot ${bot.name} - already synced with agent ${existingSync.convexAgentId}`);
        skipped++;
        continue;
      }

      // Add bot to mutex to prevent concurrent deployments
      this.deploymentMutex.add(bot.id);

      try {
        // Create or update bot sync record
        const botSync = await prisma.botSync.upsert({
          where: { botId: bot.id },
          create: {
            botId: bot.id,
            channel: channel,
            syncStatus: 'SYNCING'
          },
          update: {
            channel: channel,
            syncStatus: 'SYNCING',
            syncErrors: []
          }
        });

        // Map personality to agent description (use existing character if set, pass avatar for exact sprite mapping)
        const { mapPersonalityToAgent, getInitialZone } = require('../utils/personalityMapping');
        const agentDescription = mapPersonalityToAgent(
          bot.name,
          bot.personality,
          bot.prompt,
          bot.metaverseCharacter || undefined,
          bot.avatar || undefined  // Pass avatar data for exact sprite position mapping
        );
        
        // Determine initial zone
        const initialZone = getInitialZone(bot.personality);
        
        // Register bot in metaverse using discovered world
        const result = await convexService.createBotAgent({
          worldId: worldId,
          name: agentDescription.name,
          character: agentDescription.character,
          identity: agentDescription.identity,
          plan: agentDescription.plan,
          aiArenaBotId: bot.id,
          initialZone: initialZone,
          avatar: bot.avatar // Pass the Arena avatar
        });

        if (result && result.agentId) {
          // SAFEGUARD: Verify the agent actually exists before saving the ID
          console.log(`🔍 Verifying agent ${result.agentId} exists before saving...`);
          const agentExists = await convexService.getAgentPosition(worldId, result.agentId);
          
          if (agentExists === null) {
            console.error(`❌ Agent ${result.agentId} was created but doesn't exist! Not saving stale ID.`);
            // Mark as failed and retry later
            await prisma.botSync.update({
              where: { id: botSync.id },
              data: {
                syncStatus: 'FAILED',
                syncErrors: JSON.stringify([`Agent ${result.agentId} created but not found`]),
                convexAgentId: null,
                convexPlayerId: null
              }
            });
            deployed--;
            failed++;
            continue;
          }
          
          console.log(`✅ Agent ${result.agentId} verified to exist`);
          
          // Update bot with metaverse data and character
          await prisma.bot.update({
            where: { id: bot.id },
            data: {
              metaverseAgentId: result.agentId,
              metaverseCharacter: agentDescription.character, // Save the character used
              currentZone: initialZone,
              metaversePosition: Prisma.JsonNull // Position will be synced later
            }
          });

          // Update sync status
          await prisma.botSync.update({
            where: { id: botSync.id },
            data: {
              syncStatus: 'SYNCED',
              convexWorldId: worldId,
              convexAgentId: result.agentId,
              convexPlayerId: result.playerId,
              personalityMapped: true,
              lastSyncedAt: new Date()
            }
          });

          deployed++;
          console.log(`✅ Auto-deployed bot: ${bot.name} (${bot.id})`);
          
          // Sync lootbox rewards if any
          if (bot.lootboxRewards && bot.lootboxRewards.length > 0) {
            try {
              const lootboxData = bot.lootboxRewards.map((reward: any) => ({
                id: reward.id,
                matchId: reward.matchId,
                rarity: reward.rarity,
                itemName: reward.itemName,
                itemType: reward.itemType,
                value: reward.value,
                opened: reward.opened,
                openedAt: reward.openedAt
              }));
              
              await convexService.syncBotLootboxes({
                worldId: worldId,
                aiArenaBotId: bot.id,
                lootboxes: lootboxData
              });
              
              console.log(`📦 Synced ${bot.lootboxRewards.length} lootbox rewards for bot ${bot.name}`);
            } catch (syncError) {
              console.error(`Failed to sync lootboxes for bot ${bot.name}:`, syncError);
              // Don't fail the deployment, just log the error
            }
          }
          
          // Publish deployment event
          await metaverseEventsService.publishBotDeployed(bot.id, result.agentId, worldId);
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
      } finally {
        // Remove bot from mutex
        this.deploymentMutex.delete(bot.id);
      }

      // Rate limiting between deployments
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (deployed > 0 || skipped > 0 || failed > 0) {
      console.log(`🎉 Auto-deployment complete: ${deployed} succeeded, ${failed} failed, ${skipped} skipped`);
    }
  }

  // Clean up failed syncs periodically
  private async cleanupFailedSyncs() {
    try {
      console.log('🧹 Cleaning up failed syncs...');
      
      // Find syncs that failed due to invalid world IDs
      // But exclude recently created syncs that might still be deploying
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      
      const invalidSyncs = await prisma.botSync.findMany({
        where: {
          OR: [
            { 
              syncStatus: 'FAILED',
              createdAt: {
                lt: tenMinutesAgo // Only clean up if older than 10 minutes
              }
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

  // Clean up orphaned metaverse bots that no longer exist in Arena
  private async cleanupOrphanedMetaverseBots() {
    try {
      console.log('🧹 Checking for orphaned metaverse bots...');
      
      // Get all Arena bot IDs
      const arenaBots = await prisma.bot.findMany({
        select: { id: true }
      });
      const arenaBotIds = new Set(arenaBots.map(bot => bot.id));
      
      // Get all metaverse agents with aiArenaBotId
      const metaverseData = await convexService.getAllArenaAgents();
      
      if (!metaverseData || !metaverseData.agents || metaverseData.agents.length === 0) {
        console.log('No Arena-managed agents found in metaverse');
        return;
      }
      
      console.log(`Found ${metaverseData.arenaAgents} Arena-managed agents out of ${metaverseData.totalAgents} total agents`);
      
      // Find orphans (agents in metaverse but not in Arena)
      const orphanedAgents = metaverseData.agents.filter(agent => {
        if (!agent.aiArenaBotId) return false;
        return !arenaBotIds.has(agent.aiArenaBotId);
      });
      
      if (orphanedAgents.length === 0) {
        console.log('✅ No orphaned agents found');
        return;
      }
      
      console.log(`⚠️ Found ${orphanedAgents.length} orphaned agents to clean up:`);
      orphanedAgents.forEach(agent => {
        console.log(`  - Agent ${agent.name} (${agent.agentId}) for deleted bot ${agent.aiArenaBotId}`);
      });
      
      // Delete orphaned agents from metaverse with retry logic
      if (metaverseData.worldId) {
        let retryCount = 0;
        const maxRetries = 3;
        const retryDelay = (attempt: number) => Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff
        
        while (retryCount < maxRetries) {
          try {
            const deleteResult = await convexService.deleteOrphanedAgents(
              orphanedAgents.map(agent => ({
                agentId: agent.agentId,
                playerId: agent.playerId,
                aiArenaBotId: agent.aiArenaBotId || undefined
              })),
              metaverseData.worldId,
              'Bot no longer exists in Arena database'
            );
            
            if (deleteResult && deleteResult.successful > 0) {
              console.log(`✅ Cleaned up ${deleteResult.successful} orphaned agents`);
              if (deleteResult.failed > 0) {
                console.warn(`⚠️ Failed to clean ${deleteResult.failed} agents`);
              }
            }
            break; // Success, exit retry loop
            
          } catch (error: any) {
            retryCount++;
            
            // Check if it's a concurrency error
            if (error.message?.includes('OptimisticConcurrencyControlFailure')) {
              console.warn(`⚠️ Concurrency conflict during orphan cleanup (attempt ${retryCount}/${maxRetries})`);
              
              if (retryCount < maxRetries) {
                const delay = retryDelay(retryCount);
                console.log(`⏳ Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
              } else {
                console.error('❌ Max retries reached for orphan cleanup. Will try again in next sync cycle.');
                // Don't throw - just log and continue
              }
            } else {
              // Non-concurrency error, log but don't fail the whole sync
              console.error('Error during orphan cleanup:', error.message || error);
              break;
            }
          }
        }
      }
      
      // Also clean up any BotSync records for deleted bots
      const orphanedBotIds = orphanedAgents
        .filter(agent => agent.aiArenaBotId)
        .map(agent => agent.aiArenaBotId as string);
      
      if (orphanedBotIds.length > 0) {
        try {
          const deletedSyncs = await prisma.botSync.deleteMany({
            where: {
              botId: { in: orphanedBotIds }
            }
          });
          
          if (deletedSyncs.count > 0) {
            console.log(`✅ Cleaned up ${deletedSyncs.count} orphaned sync records`);
          }
        } catch (error) {
          console.error('Error cleaning up orphaned sync records:', error);
        }
      }
      
    } catch (error: any) {
      // Don't let cleanup errors stop the sync service
      console.error('Error in orphan cleanup process:', error.message || error);
    }
  }

  // Clean up a specific bot from the metaverse when deleted from Arena
  async cleanupDeletedBot(botId: string) {
    try {
      console.log(`🗑️ Cleaning up metaverse data for deleted bot ${botId}`);
      
      // Get bot sync record
      const botSync = await prisma.botSync.findUnique({
        where: { botId }
      });
      
      if (botSync && botSync.convexAgentId) {
        try {
          // Delete the agent from metaverse using the dedicated endpoint
          await convexService.deleteBotAgent({
            aiArenaBotId: botId
          });
          
          console.log(`✅ Deleted agent ${botSync.convexAgentId} from metaverse for bot ${botId}`);
        } catch (error: any) {
          // If agent not found, that's okay - it's already gone
          if (error.message && error.message.includes('not found')) {
            console.log(`Agent already gone from metaverse for bot ${botId}`);
          } else {
            console.error(`Failed to delete agent from metaverse for bot ${botId}:`, error);
          }
        }
      }
      
      // Mark the sync record as DISABLED instead of deleting it
      // This prevents the bot from being recreated on next sync
      if (botSync) {
        await prisma.botSync.update({
          where: { id: botSync.id },
          data: {
            syncStatus: SyncStatus.DISABLED,
            syncErrors: ['Bot deleted from Arena'],
            convexAgentId: null,
            convexPlayerId: null,
            lastSyncedAt: new Date()
          }
        });
        console.log(`✅ Marked bot ${botId} sync as DISABLED to prevent recreation`);
      } else {
        // Create a DISABLED sync record if none exists to prevent future deployment
        await prisma.botSync.create({
          data: {
            botId,
            syncStatus: SyncStatus.DISABLED,
            syncErrors: ['Bot deleted from Arena'],
            channel: 'main'
          }
        });
        console.log(`✅ Created DISABLED sync record for bot ${botId} to prevent deployment`);
      }
      
    } catch (error) {
      console.error('Error cleaning up deleted bot from metaverse:', error);
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