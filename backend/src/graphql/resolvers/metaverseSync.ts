import { prisma } from "../../config/database";
import { mapPersonalityToAgent, getInitialZone } from "../../utils/personalityMapping";
import { SyncStatus } from "@prisma/client";
import { convexService } from "../../services/convexService";
import { metaverseEventsService } from "../../services/metaverseEventsService";

// Deployment mutex to prevent concurrent registrations
const deploymentMutex = new Set<string>();
const deploymentPromises = new Map<string, Promise<any>>();

export const metaverseSyncResolvers = {
  Mutation: {
    // Register an AI Arena bot in AI Town metaverse
    registerBotInMetaverse: async (_: any, { botId }: { botId: string }) => {
      // Check if deployment is already in progress for this bot
      if (deploymentMutex.has(botId)) {
        console.log(`⏭️ Registration already in progress for bot ${botId}`);
        // If there's an existing promise, wait for it
        const existingPromise = deploymentPromises.get(botId);
        if (existingPromise) {
          return await existingPromise;
        }
        throw new Error("Registration already in progress");
      }

      // Get bot details
      const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: { 
          botSync: true,
          house: true,
          equipment: true,
          activityScore: true,
        },
      });

      if (!bot) {
        throw new Error("Bot not found");
      }

      // Check if already synced with an agent ID
      if (bot.botSync?.syncStatus === SyncStatus.SYNCED && bot.botSync?.convexAgentId) {
        console.log(`✅ Bot ${botId} already synced with agent ${bot.botSync.convexAgentId}`);
        return {
          success: true,
          message: "Bot already synced",
          botSync: bot.botSync,
        };
      }

      // Add to mutex to prevent concurrent registrations
      deploymentMutex.add(botId);

      // Create a promise for this deployment
      const deploymentPromise = (async () => {
        try {
          // Create or update BotSync record
          const botSync = await prisma.botSync.upsert({
          where: { botId },
          create: {
            botId,
            syncStatus: SyncStatus.SYNCING,
          },
          update: {
            syncStatus: SyncStatus.SYNCING,
            syncErrors: [],
          },
        });

        // Determine initial zone
        const initialZone = getInitialZone(bot.personality);
        
        // Map personality to AI Town agent description
        // Use the bot's metaverseCharacter if it exists for sprite consistency
        const agentDescription = mapPersonalityToAgent(
          bot.name,
          bot.personality,
          bot.prompt,
          bot.metaverseCharacter || undefined,
        );

        // Find available world instance for the zone
        console.log('Finding available instance for zone:', initialZone, 'botId:', botId);
        const worldInstance = await convexService.findAvailableInstance(initialZone, botId);
        console.log('World instance result:', worldInstance);

        if (!worldInstance) {
          throw new Error(`No available instance for zone ${initialZone}`);
        }

        // Create agent in AI Town
        console.log('Creating AI Town agent for bot:', {
          botId,
          name: agentDescription.name,
          character: agentDescription.character,
          zone: initialZone
        });

        try {
          const agentResult = await convexService.createBotAgent({
            worldId: worldInstance.worldId,
            name: agentDescription.name,
            character: agentDescription.character,
            identity: agentDescription.identity,
            plan: agentDescription.plan,
            aiArenaBotId: botId,
            initialZone,
          });

          const { agentId, playerId } = agentResult;

          // Generate initial position
          const position = {
            x: Math.floor(Math.random() * 30),
            y: Math.floor(Math.random() * 30),
          };

          // Update bot with metaverse info
          await prisma.bot.update({
            where: { id: botId },
            data: {
              metaverseAgentId: agentId,
              currentZone: initialZone,
              metaversePosition: {
                ...position,
                worldInstanceId: worldInstance.instanceId,
              },
              lastZoneChange: new Date(),
            },
          });

          // Update BotSync record
          const updatedBotSync = await prisma.botSync.update({
            where: { id: botSync.id },
            data: {
              syncStatus: SyncStatus.SYNCED,
              lastSyncedAt: new Date(),
              convexWorldId: worldInstance.worldId,
              convexAgentId: agentId,
              convexPlayerId: playerId,
              personalityMapped: true,
              positionSynced: true,
              statsSynced: false, // Stats sync to be implemented
            },
          });

          // Publish bot registration event
          await metaverseEventsService.publishBotRegistration(botId, agentId, initialZone);
          await metaverseEventsService.publishBotPositionUpdate(
            botId, 
            position, 
            initialZone, 
            worldInstance.instanceId
          );

          return {
            success: true,
            message: "Bot successfully registered in metaverse",
            botSync: updatedBotSync,
            metaverseInfo: {
              agentId,
              playerId,
              worldId: worldInstance.worldId,
              zone: initialZone,
              position: {
                x: Math.floor(Math.random() * 30),
                y: Math.floor(Math.random() * 30),
                worldInstanceId: worldInstance.instanceId,
              },
            },
          };
        } catch (error: any) {
          console.error('Failed to create agent in metaverse:', error);
          throw new Error(`Failed to create agent: ${error.message}`);
        }
      } catch (error: any) {
        // Update sync status to failed
        await prisma.botSync.update({
          where: { botId },
          data: {
            syncStatus: SyncStatus.FAILED,
            syncErrors: [error.message],
          },
        });

          throw error;
        } finally {
          // Remove from mutex and promises map
          deploymentMutex.delete(botId);
          deploymentPromises.delete(botId);
        }
      })();

      // Store the promise for potential waiting
      deploymentPromises.set(botId, deploymentPromise);

      return await deploymentPromise;
    },

    // Sync bot stats from AI Arena to AI Town
    syncBotStats: async (_: any, { botId }: { botId: string }) => {
      const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: {
          botSync: true,
          house: true,
          equipment: { where: { equipped: true } },
          activityScore: true,
        },
      });

      if (!bot || !bot.botSync || bot.botSync.syncStatus !== SyncStatus.SYNCED) {
        throw new Error("Bot not found or not synced");
      }

      // Calculate total power and defense
      const totalPower = bot.equipment.reduce((sum: number, item: any) => sum + item.powerBonus, 0);
      const totalDefense = bot.equipment.reduce((sum: number, item: any) => sum + item.defenseBonus, 0);

      // Parse stats JSON if needed
      const stats = typeof bot.stats === 'string' ? JSON.parse(bot.stats) : bot.stats;
      
      // Prepare stats for AI Town
      const metaverseStats = {
        power: totalPower,
        defense: totalDefense,
        houseScore: bot.house?.houseScore || 0,
        wins: stats?.wins || 0,
        losses: stats?.losses || 0,
        earnings: stats?.earnings || 0,
        activityLevel: bot.activityScore?.matchesPlayed || 0,
      };

      // Update agent stats in AI Town via Convex
      if (bot.botSync.convexAgentId && bot.botSync.convexWorldId) {
        try {
          await convexService.syncBotStats({
            agentId: bot.botSync.convexAgentId,
            worldId: bot.botSync.convexWorldId as any,
            stats: metaverseStats,
          });

          // Update sync status
          await prisma.botSync.update({
            where: { id: bot.botSync.id },
            data: {
              statsSynced: true,
              lastSyncedAt: new Date(),
            },
          });

          // Publish stats sync event
          await metaverseEventsService.publishBotStatsSync(botId, metaverseStats);
        } catch (error) {
          console.error('Failed to sync stats to metaverse:', error);
          throw new Error('Failed to sync bot stats');
        }
      } else {
        throw new Error('Bot not properly linked to metaverse');
      }

      return {
        success: true,
        message: "Stats synced successfully",
        stats: metaverseStats,
      };
    },

    // Update bot position when moving between zones
    updateBotZone: async (_: any, { botId, newZone, position }: {
      botId: string;
      newZone: string;
      position: { x: number; y: number };
    }) => {
      const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: { botSync: true },
      });

      if (!bot || !bot.botSync) {
        throw new Error("Bot not found or not synced");
      }

      // Find instance for new zone
      const worldInstance = await convexService.findAvailableInstance(newZone, botId);

      if (!worldInstance) {
        throw new Error(`No available instance for zone ${newZone}`);
      }

      // Update bot position in database
      await prisma.bot.update({
        where: { id: botId },
        data: {
          currentZone: newZone,
          metaversePosition: {
            x: position.x,
            y: position.y,
            worldInstanceId: worldInstance.instanceId,
          },
          lastZoneChange: new Date(),
        },
      });

      // Update position in the metaverse
      if (bot.metaverseAgentId && bot.botSync) {
        try {
          await convexService.updateBotPosition({
            agentId: bot.metaverseAgentId,
            worldId: worldInstance.worldId,
            position,
            zone: newZone,
          });

          // Publish zone transition event
          if (bot.currentZone && bot.currentZone !== newZone) {
            await metaverseEventsService.publishZoneTransition(botId, bot.currentZone, newZone);
          }
          
          // Publish position update
          await metaverseEventsService.publishBotPositionUpdate(
            botId,
            position,
            newZone,
            worldInstance.instanceId
          );
        } catch (error) {
          console.error('Failed to update position in metaverse:', error);
          // Continue even if metaverse update fails
        }
      }

      // Track zone transition
      await prisma.botSync.update({
        where: { id: bot.botSync.id },
        data: {
          positionSynced: true,
          lastSyncedAt: new Date(),
        },
      });

      return {
        success: true,
        message: `Bot moved to ${newZone}`,
        zone: newZone,
        position,
        worldInstanceId: worldInstance.instanceId,
      };
    },
  },

  Query: {
    // Get bot sync status
    getBotSyncStatus: async (_: any, { botId }: { botId: string }) => {
      const botSync = await prisma.botSync.findUnique({
        where: { botId },
        include: { bot: true },
      });

      return botSync;
    },

    // Get all bots in a specific zone
    getBotsInZone: async (_: any, { zone }: { zone: string }) => {
      const bots = await prisma.bot.findMany({
        where: { currentZone: zone },
        include: {
          botSync: true,
          house: true,
          equipment: { where: { equipped: true } },
        },
      });

      return bots;
    },

    // Get bot metaverse info
    getBotMetaverseInfo: async (_: any, { botId }: { botId: string }) => {
      const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: {
          botSync: true,
          house: true,
          equipment: { where: { equipped: true } },
          activityScore: true,
        },
      });

      if (!bot) {
        return null;
      }

      return {
        bot,
        metaverse: {
          agentId: bot.metaverseAgentId,
          zone: bot.currentZone,
          position: bot.metaversePosition,
          lastZoneChange: bot.lastZoneChange,
          syncStatus: bot.botSync?.syncStatus,
          lastSyncedAt: bot.botSync?.lastSyncedAt,
        },
      };
    },
  },
};