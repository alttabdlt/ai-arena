import { PrismaClient, Prisma } from '@prisma/client';
import { worldInitializationService } from '../../services/worldInitializationService';
import { convexService } from '../../services/convexService';
import { mapPersonalityToAgent, getInitialZone } from '../../utils/personalityMapping';

export const deploymentResolvers = {
  Query: {
    getDeploymentStatus: async (_: any, __: any, { prisma }: { prisma: PrismaClient }) => {
      try {
        const totalBots = await prisma.bot.count();
        const deployedBots = await prisma.bot.count({
          where: {
            metaverseAgentId: { not: null }
          }
        });
        const pendingBots = await prisma.bot.count({
          where: {
            OR: [
              { metaverseAgentId: null },
              { metaverseAgentId: '' }
            ]
          }
        });
        const failedBots = await prisma.botSync.count({
          where: { syncStatus: 'FAILED' }
        });

        const lastDeployment = await prisma.botSync.findFirst({
          where: { syncStatus: 'SYNCED' },
          orderBy: { updatedAt: 'desc' }
        });

        const errors = await prisma.botSync.findMany({
          where: { 
            syncStatus: 'FAILED',
            syncErrors: { not: [] }
          },
          select: { syncErrors: true },
          take: 10
        });

        return {
          worldsReady: worldInitializationService.isInitialized(),
          totalBots,
          deployedBots,
          pendingBots,
          failedBots,
          lastDeploymentAt: lastDeployment?.updatedAt,
          errors: errors.map(e => e.syncErrors).filter(Boolean)
        };
      } catch (error) {
        console.error('Error getting deployment status:', error);
        throw error;
      }
    },

    getWorldsStatus: async () => {
      try {
        const worlds = await worldInitializationService.getAvailableWorlds();
        return worlds.map((world: any) => ({
          zone: world.zone || 'unknown',
          worldId: world._id,
          active: true,
          botCount: world.botCount || 0,
          createdAt: world._creationTime ? new Date(world._creationTime) : new Date()
        }));
      } catch (error) {
        console.error('Error getting worlds status:', error);
        return [];
      }
    },

    isBotDeployed: async (_: any, { botId }: { botId: string }, { prisma }: { prisma: PrismaClient }) => {
      const bot = await prisma.bot.findUnique({
        where: { id: botId },
        select: { metaverseAgentId: true }
      });
      return !!(bot?.metaverseAgentId);
    },

    getFailedDeployments: async (_: any, __: any, { prisma }: { prisma: PrismaClient }) => {
      const failed = await prisma.botSync.findMany({
        where: { syncStatus: 'FAILED' },
        include: { bot: true },
        orderBy: { updatedAt: 'desc' },
        take: 20
      });

      return failed.map(sync => ({
        botId: sync.botId,
        botName: sync.bot.name,
        error: (sync.syncErrors as any[])?.[0] || 'Unknown error',
        timestamp: sync.updatedAt
      }));
    }
  },

  Mutation: {
    deployAllBots: async (_: any, { force }: { force?: boolean }, { prisma }: { prisma: PrismaClient }) => {
      try {
        // Ensure worlds exist
        await worldInitializationService.ensureWorldsExist();

        // Clean up failed syncs if force is true
        if (force) {
          await prisma.botSync.updateMany({
            where: { syncStatus: 'FAILED' },
            data: { 
              syncStatus: 'PENDING',
              syncErrors: []
            }
          });
        }

        // Get all undeployed bots
        const undeployedBots = await prisma.bot.findMany({
          where: {
            OR: [
              { metaverseAgentId: null },
              { metaverseAgentId: '' }
            ]
          },
          include: { creator: true }
        });

        let deployed = 0;
        let failed = 0;
        const errors: any[] = [];

        for (const bot of undeployedBots) {
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

            // Map personality to agent description (use existing character if set)
            const agentDescription = mapPersonalityToAgent(
              bot.name,
              bot.personality,
              bot.prompt,
              bot.metaverseCharacter || undefined
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
                  convexWorldId: worldInstance.worldId,
                  convexAgentId: result.agentId,
                  convexPlayerId: result.playerId,
                  lastSyncedAt: new Date()
                }
              });

              deployed++;
            } else {
              throw new Error('Failed to register bot');
            }
          } catch (error: any) {
            failed++;
            errors.push({
              botId: bot.id,
              botName: bot.name,
              error: error.message,
              timestamp: new Date()
            });

            // Update sync status to failed
            await prisma.botSync.update({
              where: { botId: bot.id },
              data: {
                syncStatus: 'FAILED',
                syncErrors: [error.message]
              }
            });
          }
        }

        return {
          success: failed === 0,
          message: `Deployed ${deployed} bots, ${failed} failed`,
          deployed,
          failed,
          errors
        };
      } catch (error: any) {
        console.error('Error deploying all bots:', error);
        throw error;
      }
    },

    deployBotToMetaverse: async (_: any, { botId, retryIfFailed }: { botId: string; retryIfFailed?: boolean }, { prisma }: { prisma: PrismaClient }) => {
      try {
        const bot = await prisma.bot.findUnique({
          where: { id: botId },
          include: { creator: true, botSync: true }
        });

        if (!bot) {
          return {
            success: false,
            message: 'Bot not found',
            botSync: null,
            metaverseInfo: null
          };
        }

        // Check if already deployed
        if (bot.metaverseAgentId && !retryIfFailed) {
          return {
            success: true,
            message: 'Bot already deployed',
            botSync: bot.botSync,
            metaverseInfo: {
              agentId: bot.metaverseAgentId,
              zone: bot.currentZone,
              metaversePosition: bot.metaversePosition as any
            }
          };
        }

        // Ensure worlds exist
        await worldInitializationService.ensureWorldsExist();

        // Create or update sync record
        const botSync = await prisma.botSync.upsert({
          where: { botId },
          create: {
            botId,
            syncStatus: 'SYNCING'
          },
          update: {
            syncStatus: 'SYNCING',
            syncErrors: []
          }
        });

        // Map personality to agent description (use existing character if set)
        const agentDescription = mapPersonalityToAgent(
          bot.name,
          bot.personality,
          bot.prompt,
          bot.metaverseCharacter || undefined
        );
        
        // Determine initial zone
        const initialZone = getInitialZone(bot.personality);
        
        // Find available world instance
        const worldInstance = await convexService.findAvailableInstance(initialZone, bot.id);
        
        if (!worldInstance) {
          throw new Error(`No available instance for zone ${initialZone}`);
        }
        
        // Register in metaverse
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
          // Update bot with metaverse data and character
          await prisma.bot.update({
            where: { id: botId },
            data: {
              metaverseAgentId: result.agentId,
              metaverseCharacter: agentDescription.character, // Save the character used
              currentZone: initialZone,
              metaversePosition: Prisma.JsonNull // Position will be synced later
            }
          });

          // Update sync
          const updatedSync = await prisma.botSync.update({
            where: { id: botSync.id },
            data: {
              syncStatus: 'SYNCED',
              convexWorldId: worldInstance.worldId,
              convexAgentId: result.agentId,
              convexPlayerId: result.playerId,
              lastSyncedAt: new Date()
            },
            include: { bot: true }
          });

          return {
            success: true,
            message: 'Bot deployed successfully',
            botSync: updatedSync,
            metaverseInfo: {
              agentId: result.agentId,
              worldId: worldInstance.worldId,
              zone: initialZone,
              metaversePosition: Prisma.JsonNull,
              syncStatus: 'SYNCED',
              lastSyncedAt: new Date()
            }
          };
        } else {
          // Update sync as failed
          await prisma.botSync.update({
            where: { id: botSync.id },
            data: {
              syncStatus: 'FAILED',
              syncErrors: ['Failed to deploy bot']
            }
          });

          return {
            success: false,
            message: 'Failed to deploy bot',
            botSync,
            metaverseInfo: null
          };
        }
      } catch (error: any) {
        console.error('Error deploying bot:', error);
        throw error;
      }
    },

    cleanupInvalidSyncs: async (_: any, __: any, { prisma }: { prisma: PrismaClient }) => {
      try {
        // Find invalid syncs
        const invalidSyncs = await prisma.botSync.findMany({
          where: {
            OR: [
              { syncStatus: 'FAILED' },
              { 
                AND: [
                  { convexWorldId: { not: null } },
                  { convexWorldId: 'm17dkz0psv5e7b812sjjxwpwgd7n374s' }
                ]
              }
            ]
          }
        });

        let cleared = 0;
        let botsReset = 0;

        for (const sync of invalidSyncs) {
          // Reset sync
          await prisma.botSync.update({
            where: { id: sync.id },
            data: {
              syncStatus: 'PENDING',
              convexWorldId: null,
              convexAgentId: null,
              syncErrors: []
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

          cleared++;
          botsReset++;
        }

        return {
          success: true,
          message: `Cleared ${cleared} invalid syncs`,
          invalidSyncsCleared: cleared,
          botsReset
        };
      } catch (error: any) {
        console.error('Error cleaning up invalid syncs:', error);
        throw error;
      }
    },

    initializeWorlds: async () => {
      try {
        await worldInitializationService.initialize();
        const worlds = await worldInitializationService.getAvailableWorlds();
        
        return {
          success: true,
          message: `Initialized ${worlds.length} world instances`,
          deployed: worlds.length,
          failed: 0,
          errors: []
        };
      } catch (error: any) {
        console.error('Error initializing worlds:', error);
        return {
          success: false,
          message: error.message,
          deployed: 0,
          failed: 1,
          errors: [{
            botId: '',
            botName: '',
            error: error.message,
            timestamp: new Date()
          }]
        };
      }
    },

    retryFailedDeployments: async (_: any, __: any, { prisma }: { prisma: PrismaClient }) => {
      // Reset failed syncs to pending
      await prisma.botSync.updateMany({
        where: { syncStatus: 'FAILED' },
        data: { 
          syncStatus: 'PENDING',
          syncErrors: []
        }
      });

      // Call deployAllBots
      return deploymentResolvers.Mutation.deployAllBots(_, { force: false }, { prisma });
    },

    resetBotDeployment: async (_: any, { botId }: { botId: string }, { prisma }: { prisma: PrismaClient }) => {
      try {
        // Clear bot metaverse data
        await prisma.bot.update({
          where: { id: botId },
          data: {
            metaverseAgentId: null,
            currentZone: null,
            metaversePosition: Prisma.JsonNull
          }
        });

        // Reset sync record
        await prisma.botSync.upsert({
          where: { botId },
          create: {
            botId,
            syncStatus: 'PENDING'
          },
          update: {
            syncStatus: 'PENDING',
            convexWorldId: null,
            convexAgentId: null,
            syncErrors: []
          }
        });

        // Try to redeploy
        return deploymentResolvers.Mutation.deployBotToMetaverse(_, { botId, retryIfFailed: true }, { prisma });
      } catch (error: any) {
        console.error('Error resetting bot deployment:', error);
        throw error;
      }
    }
  }
};