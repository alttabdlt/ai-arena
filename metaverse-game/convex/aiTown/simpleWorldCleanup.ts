import { v } from 'convex/values';
import { mutation } from '../_generated/server';

/**
 * Simple world cleanup - just removes non-Arena players and agents from the world
 * Does not clean up all associated data to avoid document limits
 */
export const simpleCleanupWorld = mutation({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    console.log(`🧹 Starting simple world cleanup for ${args.worldId}`);
    
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`World ${args.worldId} not found`);
    }
    
    // Get all Arena bot IDs
    const arenaBotIds = new Set<string>();
    const arenaPlayerIds = new Set<string>();
    const arenaAgentIds = new Set<string>();
    
    // Get all agent descriptions with aiArenaBotId
    const agentDescriptions = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    
    for (const desc of agentDescriptions) {
      if (desc.aiArenaBotId) {
        arenaBotIds.add(desc.aiArenaBotId);
        arenaAgentIds.add(desc.agentId);
        
        // Find the corresponding player
        const agent = (world as any).agents?.find((a: any) => a.id === desc.agentId);
        if (agent?.playerId) {
          arenaPlayerIds.add(agent.playerId);
        }
      }
    }
    
    console.log(`Found ${arenaBotIds.size} Arena bots to keep`);
    console.log(`Arena players to keep:`, Array.from(arenaPlayerIds));
    console.log(`Arena agents to keep:`, Array.from(arenaAgentIds));
    
    // Filter players to only keep Arena players
    const originalPlayerCount = (world as any).players?.length || 0;
    const updatedPlayers = ((world as any).players || []).filter((player: any) => {
      const keep = arenaPlayerIds.has(player.id);
      if (!keep) {
        console.log(`❌ Removing non-Arena player ${player.id}`);
      } else {
        console.log(`✅ Keeping Arena player ${player.id}`);
      }
      return keep;
    });
    
    // Filter agents to only keep Arena agents
    const originalAgentCount = (world as any).agents?.length || 0;
    const updatedAgents = ((world as any).agents || []).filter((agent: any) => {
      const keep = arenaAgentIds.has(agent.id);
      if (!keep) {
        console.log(`❌ Removing non-Arena agent ${agent.id}`);
      } else {
        console.log(`✅ Keeping Arena agent ${agent.id}`);
      }
      return keep;
    });
    
    // Filter conversations to only keep those with Arena players
    const updatedConversations = ((world as any).conversations || []).filter((conversation: any) => {
      // Check if all participants are Arena players
      for (const participant of conversation.participants || []) {
        const playerId = participant.playerId || participant.id || participant;
        if (!arenaPlayerIds.has(playerId)) {
          console.log(`❌ Removing conversation ${conversation.id} - has non-Arena participant ${playerId}`);
          return false;
        }
      }
      return true;
    });
    
    // Update the world
    await ctx.db.patch(args.worldId, {
      players: updatedPlayers,
      agents: updatedAgents,
      conversations: updatedConversations,
    });
    
    const stats = {
      playersRemoved: originalPlayerCount - updatedPlayers.length,
      agentsRemoved: originalAgentCount - updatedAgents.length,
      conversationsRemoved: ((world as any).conversations?.length || 0) - updatedConversations.length,
      remainingPlayers: updatedPlayers.length,
      remainingAgents: updatedAgents.length,
      remainingConversations: updatedConversations.length,
    };
    
    console.log('🧹 Simple world cleanup complete!');
    console.log('Stats:', stats);
    
    return {
      success: true,
      stats,
    };
  },
});

/**
 * Clean up orphaned player descriptions for non-Arena players
 */
export const cleanupOrphanedDescriptions = mutation({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    console.log(`🧹 Cleaning up orphaned player descriptions for ${args.worldId}`);
    
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`World ${args.worldId} not found`);
    }
    
    // Get all valid player IDs from the world
    const validPlayerIds = new Set<string>();
    for (const player of (world as any).players || []) {
      validPlayerIds.add(player.id);
    }
    
    console.log(`Valid player IDs:`, Array.from(validPlayerIds));
    
    // Delete orphaned player descriptions
    const playerDescriptions = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    
    let removed = 0;
    for (const desc of playerDescriptions) {
      if (!validPlayerIds.has(desc.playerId)) {
        console.log(`❌ Removing orphaned description for ${desc.playerId} (${desc.name})`);
        await ctx.db.delete(desc._id);
        removed++;
      }
    }
    
    // Delete orphaned agent descriptions
    const validAgentIds = new Set<string>();
    for (const agent of (world as any).agents || []) {
      validAgentIds.add(agent.id);
    }
    
    const agentDescriptions = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    
    let agentsRemoved = 0;
    for (const desc of agentDescriptions) {
      if (!desc.aiArenaBotId && !validAgentIds.has(desc.agentId)) {
        console.log(`❌ Removing orphaned agent description for ${desc.agentId}`);
        await ctx.db.delete(desc._id);
        agentsRemoved++;
      }
    }
    
    console.log(`✅ Removed ${removed} orphaned player descriptions and ${agentsRemoved} orphaned agent descriptions`);
    
    return {
      success: true,
      playerDescriptionsRemoved: removed,
      agentDescriptionsRemoved: agentsRemoved,
    };
  },
});