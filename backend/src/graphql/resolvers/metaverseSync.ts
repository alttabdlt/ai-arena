import { prisma } from "../../config/database";
// personalityMapping moved to metaverse backend
import { SyncStatus } from "@prisma/client";
import axios from 'axios';

// Metaverse backend URL
const METAVERSE_BACKEND_URL = process.env.METAVERSE_BACKEND_URL || 'http://localhost:5001';

// Helper function to call metaverse backend
async function callMetaverseBackend(endpoint: string, method: string = 'POST', data?: any) {
  try {
    const response = await axios({
      method,
      url: `${METAVERSE_BACKEND_URL}/api/metaverse${endpoint}`,
      data,
      timeout: 10000,
    });
    return response.data;
  } catch (error: any) {
    console.error(`Metaverse backend call failed: ${endpoint}`, error.message);
    throw new Error(`Metaverse backend unavailable: ${error.message}`);
  }
}

// Helper function to check if bot sync is needed (for optimization)
async function isBotSyncNeeded(botId: string): Promise<boolean> {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: { 
      botSync: true,
      energy: true,
    },
  });

  if (!bot || !bot.botSync) return true;

  // Don't sync if bot has no energy (inactive)
  if (bot.energy?.currentEnergy === 0) {
    console.log(`⏭️ Skipping sync for bot ${botId} - no energy`);
    return false;
  }

  const lastSync = bot.botSync.lastSyncedAt;
  if (!lastSync) return true;

  const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
  
  // Only sync if:
  // - Never synced before
  // - Failed status
  // - Last sync was over 6 hours ago (for active bots)
  // - Bot is about to enter a tournament (checked elsewhere)
  
  if (bot.botSync.syncStatus === SyncStatus.FAILED) return true;
  if (hoursSinceSync > 6) return true;
  
  console.log(`⏭️ Skipping sync for bot ${botId} - synced ${hoursSinceSync.toFixed(1)} hours ago`);
  return false;
}

// Helper function to clean up inactive bot syncs (for scale)
async function cleanupInactiveBotSyncs(daysInactive: number = 7): Promise<number> {
  const cutoffDate = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000);
  
  // Find bots that haven't been active in X days
  const inactiveBots = await prisma.bot.findMany({
    where: {
      updatedAt: {
        lt: cutoffDate
      },
      botSync: {
        syncStatus: SyncStatus.SYNCED
      }
    },
    select: {
      id: true,
      name: true,
      botSync: {
        select: {
          convexAgentId: true
        }
      }
    }
  });

  console.log(`🧹 Found ${inactiveBots.length} inactive bots to clean up`);
  
  let cleanedCount = 0;
  for (const bot of inactiveBots) {
    try {
      // Call metaverse to remove bot
      if (bot.botSync?.convexAgentId) {
        await callMetaverseBackend('/bots/remove', 'DELETE', {
          botId: bot.id,
          agentId: bot.botSync.convexAgentId
        });
      }
      
      // Update sync status to pending (can be re-deployed if needed)
      await prisma.botSync.update({
        where: { botId: bot.id },
        data: {
          syncStatus: SyncStatus.PENDING,
          convexAgentId: null,
          convexWorldId: null,
          convexPlayerId: null,
        }
      });
      
      cleanedCount++;
    } catch (error) {
      console.error(`Failed to cleanup bot ${bot.id}:`, error);
    }
  }
  
  console.log(`✅ Cleaned up ${cleanedCount} inactive bot syncs`);
  return cleanedCount;
}

export const metaverseSyncResolvers = {
  Mutation: {
    // Register an AI Arena bot in AI Town metaverse
    registerBotInMetaverse: async (_: any, { botId }: { botId: string }) => {
      // Get bot details with all necessary relations
      const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: { 
          botSync: true,
          house: true,
          equipment: true,
          activityScore: true,
          experience: true,
          energy: true,
        },
      });

      if (!bot) {
        throw new Error("Bot not found");
      }

      // Check if already synced
      if (bot.botSync?.syncStatus === SyncStatus.SYNCED && bot.botSync?.convexAgentId) {
        console.log(`✅ Bot ${botId} already synced with agent ${bot.botSync.convexAgentId}`);
        return {
          success: true,
          message: "Bot already synced",
          botSync: bot.botSync,
        };
      }

      try {
        // Calculate power and defense from equipment
        const power = bot.equipment.reduce((sum, item) => sum + (item.equipped ? item.powerBonus : 0), 0);
        const defense = bot.equipment.reduce((sum, item) => sum + (item.equipped ? item.defenseBonus : 0), 0);
        
        // Call metaverse backend to register bot
        const result = await callMetaverseBackend('/bots/register', 'POST', {
          aiArenaBotId: bot.id,
          // worldId intentionally omitted to let backend discover
          personality: bot.personality,
          modelType: bot.modelType,
          name: bot.name,
          avatar: bot.avatar,
          level: bot.experience?.level || 1,
          experience: bot.experience?.currentXP || 0,
          power,
          defense,
          energy: bot.energy?.currentEnergy || 100,
        });

        // Update bot sync status
        const botSync = await prisma.botSync.upsert({
          where: { botId: bot.id },
          create: {
            botId: bot.id,
            syncStatus: SyncStatus.SYNCED,
            convexAgentId: result.agentId,
            convexWorldId: result.worldId,
            convexPlayerId: result.playerId,
            lastSyncedAt: new Date(),
          },
          update: {
            syncStatus: SyncStatus.SYNCED,
            convexAgentId: result.agentId,
            convexWorldId: result.worldId,
            convexPlayerId: result.playerId,
            lastSyncedAt: new Date(),
          },
        });

        // Update bot deployment status
        await prisma.bot.update({
          where: { id: botId },
          data: { 
            metaverseAgentId: result.agentId,
            // metaversePlayerId doesn't exist in schema, using metaversePosition
            metaversePosition: { playerId: result.playerId, worldId: result.worldId },
          },
        });

        return {
          success: true,
          message: "Bot successfully registered in metaverse",
          botSync,
        };
      } catch (error: any) {
        console.error(`Failed to register bot ${botId}:`, error);
        
        // Update sync status to failed
        await prisma.botSync.upsert({
          where: { botId: bot.id },
          create: {
            botId: bot.id,
            syncStatus: SyncStatus.FAILED,
            syncErrors: [error.message],
            lastSyncedAt: new Date(),
          },
          update: {
            syncStatus: SyncStatus.FAILED,
            syncErrors: [error.message],
            lastSyncedAt: new Date(),
          },
        });

        throw error;
      }
    },

    // Sync bot stats with metaverse
    syncBotWithMetaverse: async (_: any, { botId }: { botId: string }) => {
      const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: { 
          botSync: true,
          equipment: true,
          experience: true,
          energy: true,
        },
      });

      if (!bot) {
        throw new Error("Bot not found");
      }

      if (!bot.botSync?.convexAgentId) {
        throw new Error("Bot not deployed to metaverse");
      }

      try {
        // Calculate power and defense from equipment
        const power = bot.equipment.reduce((sum, item) => sum + (item.equipped ? item.powerBonus : 0), 0);
        const defense = bot.equipment.reduce((sum, item) => sum + (item.equipped ? item.defenseBonus : 0), 0);
        
        // Call metaverse backend to sync stats
        await callMetaverseBackend('/bots/sync-stats', 'POST', {
          botId: bot.id,
          stats: {
            level: bot.experience?.level || 1,
            experience: bot.experience?.currentXP || 0,
            power,
            defense,
            energy: bot.energy?.currentEnergy || 100,
          },
        });

        // Update sync timestamp
        await prisma.botSync.update({
          where: { botId: bot.id },
          data: { lastSyncedAt: new Date() },
        });

        return {
          success: true,
          message: "Bot stats synced with metaverse",
        };
      } catch (error: any) {
        console.error(`Failed to sync bot ${botId}:`, error);
        throw error;
      }
    },

    // Batch register multiple bots in metaverse
    batchRegisterBotsInMetaverse: async (_: any, { 
      botIds, 
      batchSize = 50 
    }: { 
      botIds: string[]; 
      batchSize: number;
    }) => {
      console.log(`🚀 Starting batch registration for ${botIds.length} bots`);
      
      const results: any[] = [];
      const failedBotIds: string[] = [];
      let successCount = 0;
      let failedCount = 0;

      // Process in batches to avoid overloading
      for (let i = 0; i < botIds.length; i += batchSize) {
        const batch = botIds.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.length} bots`);
        
        // Process batch in parallel but with controlled concurrency
        const batchPromises = batch.map(async (botId) => {
          try {
            // Check if sync is actually needed (optimization for scale)
            const needsSync = await isBotSyncNeeded(botId);
            if (!needsSync) {
              console.log(`⏭️ Skipping bot ${botId} - sync not needed`);
              successCount++;
              return {
                botId,
                success: true,
                message: "Bot sync not needed at this time",
                syncStatus: SyncStatus.SYNCED,
                errorMessage: null
              };
            }
            // Get bot details
            const bot = await prisma.bot.findUnique({
              where: { id: botId },
              include: { 
                botSync: true,
                equipment: true,
                experience: true,
                energy: true,
              },
            });

            if (!bot) {
              failedCount++;
              failedBotIds.push(botId);
              return {
                botId,
                success: false,
                message: "Bot not found",
                syncStatus: SyncStatus.FAILED,
                errorMessage: "Bot not found in database"
              };
            }

            // Skip if already synced
            if (bot.botSync?.syncStatus === SyncStatus.SYNCED && bot.botSync?.convexAgentId) {
              successCount++;
              return {
                botId,
                success: true,
                message: "Bot already synced",
                syncStatus: SyncStatus.SYNCED,
                errorMessage: null
              };
            }

            // Calculate power and defense
            const power = bot.equipment.reduce((sum, item) => sum + (item.equipped ? item.powerBonus : 0), 0);
            const defense = bot.equipment.reduce((sum, item) => sum + (item.equipped ? item.defenseBonus : 0), 0);
            
            // Register with metaverse
            const result = await callMetaverseBackend('/bots/register', 'POST', {
              aiArenaBotId: bot.id,
              personality: bot.personality,
              modelType: bot.modelType,
              name: bot.name,
              avatar: bot.avatar,
              level: bot.experience?.level || 1,
              experience: bot.experience?.currentXP || 0,
              power,
              defense,
              energy: bot.energy?.currentEnergy || 100,
            });

            // Update sync status
            await prisma.botSync.upsert({
              where: { botId: bot.id },
              create: {
                botId: bot.id,
                syncStatus: SyncStatus.SYNCED,
                convexAgentId: result.agentId,
                convexWorldId: result.worldId,
                convexPlayerId: result.playerId,
                lastSyncedAt: new Date(),
              },
              update: {
                syncStatus: SyncStatus.SYNCED,
                convexAgentId: result.agentId,
                convexWorldId: result.worldId,
                convexPlayerId: result.playerId,
                lastSyncedAt: new Date(),
              },
            });

            successCount++;
            return {
              botId,
              success: true,
              message: "Bot registered successfully",
              syncStatus: SyncStatus.SYNCED,
              errorMessage: null
            };
          } catch (error: any) {
            console.error(`Failed to register bot ${botId}:`, error.message);
            failedCount++;
            failedBotIds.push(botId);
            
            // Update sync status to failed
            await prisma.botSync.upsert({
              where: { botId },
              create: {
                botId,
                syncStatus: SyncStatus.FAILED,
                syncErrors: [error.message],
                lastSyncedAt: new Date(),
              },
              update: {
                syncStatus: SyncStatus.FAILED,
                syncErrors: [error.message],
                lastSyncedAt: new Date(),
              },
            });

            return {
              botId,
              success: false,
              message: error.message,
              syncStatus: SyncStatus.FAILED,
              errorMessage: error.message
            };
          }
        });

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Add delay between batches to prevent overload
        if (i + batchSize < botIds.length) {
          console.log(`Waiting 2 seconds before next batch...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      return {
        success: failedCount === 0,
        message: `Processed ${botIds.length} bots: ${successCount} succeeded, ${failedCount} failed`,
        totalProcessed: botIds.length,
        successCount,
        failedCount,
        failedBotIds,
        results,
      };
    },

    // Batch sync multiple bot stats
    batchSyncBotsWithMetaverse: async (_: any, { 
      botIds, 
      batchSize = 50 
    }: { 
      botIds: string[]; 
      batchSize: number;
    }) => {
      console.log(`🔄 Starting batch sync for ${botIds.length} bots`);
      
      const results: any[] = [];
      const failedBotIds: string[] = [];
      let successCount = 0;
      let failedCount = 0;

      // Process in batches
      for (let i = 0; i < botIds.length; i += batchSize) {
        const batch = botIds.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (botId) => {
          try {
            const bot = await prisma.bot.findUnique({
              where: { id: botId },
              include: { 
                botSync: true,
                equipment: true,
                experience: true,
                energy: true,
              },
            });

            if (!bot || !bot.botSync?.convexAgentId) {
              failedCount++;
              failedBotIds.push(botId);
              return {
                botId,
                success: false,
                message: "Bot not found or not deployed",
                syncStatus: SyncStatus.FAILED,
                errorMessage: "Bot not deployed to metaverse"
              };
            }

            // Calculate stats
            const power = bot.equipment.reduce((sum, item) => sum + (item.equipped ? item.powerBonus : 0), 0);
            const defense = bot.equipment.reduce((sum, item) => sum + (item.equipped ? item.defenseBonus : 0), 0);
            
            // Sync with metaverse
            await callMetaverseBackend('/bots/sync-stats', 'POST', {
              botId: bot.id,
              stats: {
                level: bot.experience?.level || 1,
                experience: bot.experience?.currentXP || 0,
                power,
                defense,
                energy: bot.energy?.currentEnergy || 100,
              },
            });

            // Update sync timestamp
            await prisma.botSync.update({
              where: { botId: bot.id },
              data: { lastSyncedAt: new Date() },
            });

            successCount++;
            return {
              botId,
              success: true,
              message: "Stats synced successfully",
              syncStatus: SyncStatus.SYNCED,
              errorMessage: null
            };
          } catch (error: any) {
            console.error(`Failed to sync bot ${botId}:`, error.message);
            failedCount++;
            failedBotIds.push(botId);
            
            return {
              botId,
              success: false,
              message: error.message,
              syncStatus: SyncStatus.FAILED,
              errorMessage: error.message
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Delay between batches
        if (i + batchSize < botIds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return {
        success: failedCount === 0,
        message: `Synced ${botIds.length} bots: ${successCount} succeeded, ${failedCount} failed`,
        totalProcessed: botIds.length,
        successCount,
        failedCount,
        failedBotIds,
        results,
      };
    },

    // Update bot position in metaverse
    updateBotMetaversePosition: async (_: any, { 
      botId, 
      zone,
      position 
    }: { 
      botId: string; 
      zone: string;
      position?: { x: number; y: number };
    }) => {
      const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: { botSync: true },
      });

      if (!bot) {
        throw new Error("Bot not found");
      }

      if (!bot.botSync?.convexAgentId) {
        throw new Error("Bot not deployed to metaverse");
      }

      try {
        // Call metaverse backend to update position
        await callMetaverseBackend('/bots/update-position', 'POST', {
          botId: bot.id,
          position: position || { x: 0, y: 0 },
          zone,
        });

        return {
          success: true,
          message: "Bot position updated in metaverse",
        };
      } catch (error: any) {
        console.error(`Failed to update bot position ${botId}:`, error);
        throw error;
      }
    },

    // Clean up inactive bot syncs
    cleanupInactiveBotSyncs: async (_: any, { daysInactive = 7 }: { daysInactive: number }) => {
      return await cleanupInactiveBotSyncs(daysInactive);
    },
  },

  Query: {
    // Get bot metaverse status
    getBotMetaverseStatus: async (_: any, { botId }: { botId: string }) => {
      const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: { botSync: true },
      });

      if (!bot) {
        throw new Error("Bot not found");
      }

      return {
        hasMetaverseAgent: !!bot.metaverseAgentId || bot.botSync?.syncStatus === SyncStatus.SYNCED || false,
        syncStatus: bot.botSync?.syncStatus || SyncStatus.PENDING,
        lastSyncedAt: bot.botSync?.lastSyncedAt,
        agentId: bot.metaverseAgentId || bot.botSync?.convexAgentId,
        worldId: bot.botSync?.convexWorldId,
        playerId: bot.botSync?.convexPlayerId,
      };
    },

    // Get all deployed bots
    getDeployedBots: async () => {
      const bots = await prisma.bot.findMany({
        where: { 
          botSync: {
            syncStatus: SyncStatus.SYNCED
          }
        },
        include: { botSync: true },
      });

      return bots.map(bot => ({
        id: bot.id,
        name: bot.name,
        personality: bot.personality,
        agentId: bot.botSync?.convexAgentId,
        worldId: bot.botSync?.convexWorldId,
        syncStatus: bot.botSync?.syncStatus,
        lastSyncedAt: bot.botSync?.lastSyncedAt,
      }));
    },

    // Check if bot needs sync
    isBotSyncNeeded: async (_: any, { botId }: { botId: string }) => {
      return await isBotSyncNeeded(botId);
    },

    // Get bots needing sync
    getBotsNeedingSync: async (_: any, { limit = 100 }: { limit: number }) => {
      // Find bots that need syncing based on criteria
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      
      const botsNeedingSync = await prisma.bot.findMany({
        where: {
          OR: [
            // Never synced
            {
              botSync: null
            },
            // Failed sync
            {
              botSync: {
                syncStatus: SyncStatus.FAILED
              }
            },
            // Not synced recently and has energy
            {
              AND: [
                {
                  botSync: {
                    lastSyncedAt: {
                      lt: sixHoursAgo
                    }
                  }
                },
                {
                  energy: {
                    currentEnergy: {
                      gt: 0
                    }
                  }
                }
              ]
            }
          ]
        },
        select: {
          id: true
        },
        take: limit
      });

      return botsNeedingSync.map(bot => bot.id);
    },
  },
};