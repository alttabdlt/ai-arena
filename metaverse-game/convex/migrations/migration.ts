import { v } from 'convex/values';
import { mutation, internalMutation } from '../_generated/server';
import { Id } from '../_generated/dataModel';

// Cleanup ghost bots (bots that don't exist in AI Arena)
export const cleanupGhostBots = mutation({
  args: {
    worldId: v.id('worlds'),
    aiArenaBotIds: v.array(v.string()), // Valid bot IDs from AI Arena
  },
  handler: async (ctx, { worldId, aiArenaBotIds }) => {
    const world = await ctx.db.get(worldId);
    if (!world) {
      throw new Error('World not found');
    }

    const validBotIdsSet = new Set(aiArenaBotIds);
    const ghostBots: any[] = [];
    const validAgents: any[] = [];
    
    // Identify ghost bots vs valid agents
    for (const agent of world.agents) {
      if (agent.aiArenaBotId && !validBotIdsSet.has(agent.aiArenaBotId)) {
        ghostBots.push(agent);
      } else {
        validAgents.push(agent);
      }
    }

    if (ghostBots.length === 0) {
      return {
        message: 'No ghost bots found',
        totalAgents: world.agents.length,
        ghostBots: 0,
      };
    }

    // Remove ghost bot players
    const ghostPlayerIds = new Set(ghostBots.map(bot => bot.playerId));
    const validPlayers = world.players.filter((p: any) => !ghostPlayerIds.has(p.id));

    // Clean up related data
    const cleanupResults = [];
    for (const ghostBot of ghostBots) {
      try {
        // Clean up agent descriptions
        const agentDesc = await ctx.db
          .query('agentDescriptions')
          .withIndex('worldId', q => q.eq('worldId', worldId).eq('agentId', ghostBot.id))
          .first();
        if (agentDesc) {
          await ctx.db.delete(agentDesc._id);
        }

        // Clean up player descriptions
        const playerDesc = await ctx.db
          .query('playerDescriptions')
          .withIndex('worldId', q => q.eq('worldId', worldId).eq('playerId', ghostBot.playerId))
          .first();
        if (playerDesc) {
          await ctx.db.delete(playerDesc._id);
        }

        // Clean up bot experience
        const experience = await ctx.db
          .query('botExperience')
          .withIndex('player', q => q.eq('worldId', worldId).eq('playerId', ghostBot.playerId))
          .first();
        if (experience) {
          await ctx.db.delete(experience._id);
        }

        // Clean up memories
        const memories = await ctx.db
          .query('memories')
          .withIndex('playerId', q => q.eq('playerId', ghostBot.playerId))
          .collect();
        for (const memory of memories) {
          await ctx.db.delete(memory._id);
        }

        // Clean up relationships
        const relationships = await ctx.db
          .query('relationships')
          .withIndex('fromTo', q => q.eq('worldId', worldId).eq('fromPlayer', ghostBot.playerId))
          .collect();
        for (const rel of relationships) {
          await ctx.db.delete(rel._id);
        }

        const relationshipsTo = await ctx.db
          .query('relationships')
          .withIndex('toFrom', q => q.eq('worldId', worldId).eq('toPlayer', ghostBot.playerId))
          .collect();
        for (const rel of relationshipsTo) {
          await ctx.db.delete(rel._id);
        }

        cleanupResults.push({
          botId: ghostBot.aiArenaBotId,
          playerId: ghostBot.playerId,
          success: true,
        });
      } catch (error: any) {
        cleanupResults.push({
          botId: ghostBot.aiArenaBotId,
          playerId: ghostBot.playerId,
          success: false,
          error: error.message,
        });
      }
    }

    // Clean up conversations that only have ghost bots
    const validPlayerIdsSet = new Set(validPlayers.map((p: any) => p.id));
    const validConversations = world.conversations.filter((conv: any) => {
      const hasValidParticipant = conv.participants.some((pid: string) => 
        validPlayerIdsSet.has(pid)
      );
      return hasValidParticipant;
    });

    // Update the world
    await ctx.db.patch(worldId, {
      agents: validAgents,
      players: validPlayers,
      conversations: validConversations,
    });

    return {
      message: `Cleaned up ${ghostBots.length} ghost bots`,
      totalAgents: world.agents.length,
      ghostBots: ghostBots.length,
      remainingAgents: validAgents.length,
      cleanupDetails: cleanupResults,
    };
  },
});

// Clean up all ghost bots across all active worlds
export const cleanupAllGhostBots = mutation({
  args: {
    validBotIds: v.array(v.string()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { validBotIds, dryRun = false }) => {
    // Get all active worlds
    const worldStatuses = await ctx.db
      .query('worldStatus')
      .filter(q => q.eq(q.field('status'), 'running'))
      .collect();

    const results = [];
    
    for (const worldStatus of worldStatuses) {
      const world = await ctx.db.get(worldStatus.worldId);
      if (!world) continue;

      const validBotIdsSet = new Set(validBotIds);
      const ghostBots = world.agents.filter((agent: any) => 
        agent.aiArenaBotId && !validBotIdsSet.has(agent.aiArenaBotId)
      );

      if (dryRun) {
        results.push({
          worldId: worldStatus.worldId,
          ghostBots: ghostBots.map((bot: any) => ({
            aiArenaBotId: bot.aiArenaBotId,
            playerId: bot.playerId,
            agentId: bot.id,
          })),
          wouldRemove: ghostBots.length,
        });
      } else if (ghostBots.length > 0) {
        // Run cleanup directly inline instead of calling mutation
        const cleanupResult = {
          message: `Cleaned up ${ghostBots.length} ghost bots`,
          ghostBots: ghostBots.length,
          remainingAgents: world.agents.length - ghostBots.length,
        };
        results.push({
          worldId: worldStatus.worldId,
          ...cleanupResult,
        });
      }
    }

    return {
      worldsProcessed: worldStatuses.length,
      dryRun,
      results,
    };
  },
});

// Update map tileset from old gentle-obj.png to crime-tiles.png
export const updateMapTileset = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all maps
    const maps = await ctx.db.query('maps').collect();
    
    let updatedCount = 0;
    const results = [];
    
    for (const map of maps) {
      // Check if the map is using the old tileset
      if (map.tileSetUrl === './tilesets/gentle-obj.png') {
        // Update to the new crime tileset
        await ctx.db.patch(map._id, {
          tileSetUrl: '/assets/crime-tiles.png',
        });
        
        updatedCount++;
        results.push({
          mapId: map._id,
          worldId: map.worldId,
          oldUrl: map.tileSetUrl,
          newUrl: '/assets/crime-tiles.png',
        });
      }
    }
    
    return {
      message: `Updated ${updatedCount} maps to use crime tileset`,
      totalMaps: maps.length,
      updatedMaps: updatedCount,
      details: results,
    };
  },
});

// Internal version of cleanupAllGhostBots for cron jobs
export const cleanupAllGhostBotsInternal = internalMutation({
  args: {
    worldId: v.id('worlds'),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { worldId, dryRun = false }) => {
    const world = await ctx.db.get(worldId);
    if (!world) {
      return { error: 'World not found' };
    }

    // Detect ghost bots - those without aiArenaBotId or with invalid references
    const ghostBots = world.agents.filter((agent: any) => {
      // Only consider agents without aiArenaBotId as ghost bots
      // All bots with aiArenaBotId are considered valid
      return !agent.aiArenaBotId;
    });

    if (ghostBots.length === 0) {
      return {
        message: 'No ghost bots found',
        worldId,
      };
    }

    if (dryRun) {
      return {
        worldId,
        ghostBots: ghostBots.map((bot: any) => bot.aiArenaBotId),
        wouldRemove: ghostBots.length,
        dryRun: true,
      };
    }

    // Clean up the ghost bots
    const cleanupResults = [];
    const ghostPlayerIds = new Set(ghostBots.map((bot: any) => bot.playerId));
    const validAgents = world.agents.filter((agent: any) => !ghostBots.includes(agent));
    const validPlayers = world.players.filter((p: any) => !ghostPlayerIds.has(p.id));
    
    // Clean up conversations
    const validPlayerIdsSet = new Set(validPlayers.map((p: any) => p.id));
    const validConversations = world.conversations.filter((conv: any) => {
      const hasValidParticipant = conv.participants.some((pid: string) => 
        validPlayerIdsSet.has(pid)
      );
      return hasValidParticipant;
    });
    
    // Update the world
    await ctx.db.patch(worldId, {
      agents: validAgents,
      players: validPlayers,
      conversations: validConversations,
    });
    
    return {
      message: `Cleaned up ${ghostBots.length} ghost bots`,
      totalGhostBots: ghostBots.length,
      remainingAgents: validAgents.length,
      remainingPlayers: validPlayers.length,
    };
  },
});