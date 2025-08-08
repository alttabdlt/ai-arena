import { v } from 'convex/values';
import { internalMutation, query, mutation } from '../_generated/server';
import { Id } from '../_generated/dataModel';

/**
 * Query to get all Arena-managed agents in the metaverse
 * These are agents that have an aiArenaBotId field
 */
export const getAllArenaAgents = query({
  args: {},
  handler: async (ctx) => {
    // Get the default world
    const defaultWorld = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    
    if (!defaultWorld) {
      return { agents: [], worldId: null };
    }
    
    const worldId = defaultWorld.worldId;
    
    // Get the world document
    const world = await ctx.db.get(worldId);
    if (!world) {
      return { agents: [], worldId };
    }
    
    // Get all agent descriptions for this world
    const agentDescriptions = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect();
    
    // Get all player descriptions for this world
    const playerDescriptions = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect();
    
    // Create a map of player names by playerId
    const playerNames = new Map();
    playerDescriptions.forEach((pd: any) => {
      playerNames.set(pd.playerId, pd.name);
    });
    
    // Filter for Arena-managed agents (those with aiArenaBotId)
    const arenaAgents = [];
    
    for (const desc of agentDescriptions) {
      // Check if this agent has an Arena bot ID
      const agent = world.agents.find((a: any) => a.id === desc.agentId);
      if (agent) {
        // Look for aiArenaBotId in the agent data
        const playerName = playerNames.get(agent.playerId) || 'Unknown';
        arenaAgents.push({
          agentId: desc.agentId,
          playerId: agent.playerId,
          name: playerName,
          identity: desc.identity,
          aiArenaBotId: desc.aiArenaBotId || agent.aiArenaBotId || null,
          worldId: worldId,
        });
      }
    }
    
    return {
      agents: arenaAgents,
      worldId: worldId,
      totalAgents: agentDescriptions.length,
      arenaAgents: arenaAgents.filter(a => a.aiArenaBotId).length
    };
  },
});

/**
 * Delete an orphaned agent from the metaverse
 */
export const deleteOrphanedAgent = internalMutation({
  args: {
    worldId: v.id('worlds'),
    agentId: v.string(),
    playerId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`World ${args.worldId} not found`);
    }
    
    // Remove the agent from the world
    const updatedAgents = world.agents.filter((a: any) => a.id !== args.agentId);
    const updatedPlayers = world.players.filter((p: any) => p.id !== args.playerId);
    
    await ctx.db.patch(args.worldId, {
      agents: updatedAgents,
      players: updatedPlayers,
    });
    
    // Delete agent description
    const agentDesc = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .filter((q) => q.eq(q.field('agentId'), args.agentId))
      .first();
      
    if (agentDesc) {
      await ctx.db.delete(agentDesc._id);
    }
    
    // Delete player description
    const playerDesc = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .filter((q) => q.eq(q.field('playerId'), args.playerId))
      .first();
      
    if (playerDesc) {
      await ctx.db.delete(playerDesc._id);
    }
    
    // Log the cleanup
    await ctx.db.insert('activityLogs', {
      worldId: args.worldId,
      playerId: args.playerId,
      agentId: args.agentId,
      timestamp: Date.now(),
      type: 'message',
      description: `Orphaned agent cleaned up: ${args.reason || 'No longer exists in Arena'}`,
      emoji: '🧹',
    });
    
    return {
      success: true,
      agentId: args.agentId,
      playerId: args.playerId,
    };
  },
});

/**
 * Batch delete multiple orphaned agents
 */
export const batchDeleteOrphanedAgents = mutation({
  args: {
    worldId: v.id('worlds'),
    agents: v.array(v.object({
      agentId: v.string(),
      playerId: v.string(),
      aiArenaBotId: v.optional(v.string()),
    })),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const results = [];
    
    for (const agent of args.agents) {
      try {
        // Directly perform the deletion instead of calling the internal mutation
        const world = await ctx.db.get(args.worldId);
        if (!world) {
          throw new Error(`World ${args.worldId} not found`);
        }
        
        // Remove the agent from the world
        const updatedAgents = world.agents.filter((a: any) => a.id !== agent.agentId);
        const updatedPlayers = world.players.filter((p: any) => p.id !== agent.playerId);
        
        await ctx.db.patch(args.worldId, {
          agents: updatedAgents,
          players: updatedPlayers,
        });
        
        // Delete agent description
        const agentDesc = await ctx.db
          .query('agentDescriptions')
          .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
          .filter((q) => q.eq(q.field('agentId'), agent.agentId))
          .first();
          
        if (agentDesc) {
          await ctx.db.delete(agentDesc._id);
        }
        
        // Delete player description
        const playerDesc = await ctx.db
          .query('playerDescriptions')
          .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
          .filter((q) => q.eq(q.field('playerId'), agent.playerId))
          .first();
          
        if (playerDesc) {
          await ctx.db.delete(playerDesc._id);
        }
        
        // Log the cleanup
        await ctx.db.insert('activityLogs', {
          worldId: args.worldId,
          playerId: agent.playerId,
          agentId: agent.agentId,
          timestamp: Date.now(),
          type: 'message',
          description: args.reason || `Batch cleanup - Bot ${agent.aiArenaBotId} no longer in Arena`,
          emoji: '🧹',
        });
        
        results.push({
          success: true,
          agentId: agent.agentId,
          playerId: agent.playerId,
        });
      } catch (error: any) {
        console.error(`Failed to delete orphaned agent ${agent.agentId}:`, error);
        results.push({
          success: false,
          agentId: agent.agentId,
          error: error.message,
        });
      }
    }
    
    return {
      totalProcessed: args.agents.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  },
});