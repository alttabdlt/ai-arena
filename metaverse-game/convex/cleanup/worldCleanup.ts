import { v } from 'convex/values';
import { mutation, MutationCtx } from '../_generated/server';
import { Id } from '../_generated/dataModel';

/**
 * Comprehensive world cleanup - removes all non-Arena players and their data
 */
export const cleanupWorld = mutation({
  args: {
    worldId: v.id('worlds'),
    keepArenaBots: v.optional(v.boolean()), // Default true
  },
  handler: async (ctx, args) => {
    const keepArenaBots = args.keepArenaBots ?? true;
    console.log(`🧹 Starting comprehensive world cleanup for ${args.worldId}`);
    console.log(`Keep Arena bots: ${keepArenaBots}`);
    
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`World ${args.worldId} not found`);
    }
    
    const stats = {
      playersRemoved: 0,
      agentsRemoved: 0,
      descriptionsRemoved: 0,
      messagesRemoved: 0,
      conversationsRemoved: 0,
      relationshipsRemoved: 0,
      activityLogsRemoved: 0,
    };
    
    // Get all Arena bot IDs if we're keeping them
    const arenaBotIds = new Set<string>();
    const arenaPlayerIds = new Set<string>();
    const arenaAgentIds = new Set<string>();
    
    if (keepArenaBots) {
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
    }
    
    // Clean up players
    const updatedPlayers = [];
    for (const player of (world as any).players || []) {
      if (keepArenaBots && arenaPlayerIds.has(player.id)) {
        updatedPlayers.push(player);
        console.log(`✅ Keeping Arena player ${player.id}`);
      } else {
        console.log(`❌ Removing non-Arena player ${player.id}`);
        stats.playersRemoved++;
        
        // Clean up all data for this player
        await cleanupPlayerData(ctx, args.worldId, player.id);
      }
    }
    
    // Clean up agents
    const updatedAgents = [];
    for (const agent of (world as any).agents || []) {
      if (keepArenaBots && arenaAgentIds.has(agent.id)) {
        updatedAgents.push(agent);
        console.log(`✅ Keeping Arena agent ${agent.id}`);
      } else {
        console.log(`❌ Removing non-Arena agent ${agent.id}`);
        stats.agentsRemoved++;
        
        // Delete agent description
        const agentDesc = await ctx.db
          .query('agentDescriptions')
          .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
          .filter((q) => q.eq(q.field('agentId'), agent.id))
          .first();
        
        if (agentDesc) {
          await ctx.db.delete(agentDesc._id);
          stats.descriptionsRemoved++;
        }
      }
    }
    
    // Clean up conversations
    const updatedConversations = [];
    for (const conversation of (world as any).conversations || []) {
      let hasValidParticipant = false;
      
      if (keepArenaBots) {
        // Check if any participant is an Arena player
        for (const participant of conversation.participants || []) {
          const playerId = participant.playerId || participant.id;
          if (arenaPlayerIds.has(playerId)) {
            hasValidParticipant = true;
            break;
          }
        }
      }
      
      if (hasValidParticipant) {
        // Clean up invalid participants but keep the conversation
        const validParticipants = [];
        for (const participant of conversation.participants || []) {
          const playerId = participant.playerId || participant.id;
          if (arenaPlayerIds.has(playerId)) {
            validParticipants.push(participant);
          }
        }
        conversation.participants = validParticipants;
        
        // Only keep if there are still 2+ participants
        if (validParticipants.length >= 2) {
          updatedConversations.push(conversation);
        } else {
          stats.conversationsRemoved++;
        }
      } else {
        console.log(`❌ Removing conversation ${conversation.id}`);
        stats.conversationsRemoved++;
      }
    }
    
    // Update the world
    await ctx.db.patch(args.worldId, {
      players: updatedPlayers,
      agents: updatedAgents,
      conversations: updatedConversations,
    });
    
    // Clean up orphaned player descriptions
    const playerDescriptions = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    
    for (const desc of playerDescriptions) {
      if (!keepArenaBots || !arenaPlayerIds.has(desc.playerId)) {
        await ctx.db.delete(desc._id);
        stats.descriptionsRemoved++;
        console.log(`❌ Removed orphaned player description for ${desc.playerId}`);
      }
    }
    
    // Clean up orphaned messages (limited to avoid document limits)
    const messages = await ctx.db
      .query('messages')
      .withIndex('conversationId', (q) => q.eq('worldId', args.worldId))
      .take(100); // Reduced batch size
    
    for (const message of messages) {
      if (!keepArenaBots || !arenaPlayerIds.has(message.author)) {
        await ctx.db.delete(message._id);
        stats.messagesRemoved++;
      }
    }
    
    // Clean up relationships (limited)
    const relationships = await ctx.db
      .query('relationships')
      .filter((q) => q.eq(q.field('worldId'), args.worldId))
      .take(50); // Limited
    
    for (const rel of relationships) {
      if (!keepArenaBots || 
          !arenaPlayerIds.has(rel.fromPlayer) || 
          !arenaPlayerIds.has(rel.toPlayer)) {
        await ctx.db.delete(rel._id);
        stats.relationshipsRemoved++;
      }
    }
    
    console.log('🧹 World cleanup complete!');
    console.log('Stats:', stats);
    
    return {
      success: true,
      stats,
      remainingPlayers: updatedPlayers.length,
      remainingAgents: updatedAgents.length,
    };
  },
});

/**
 * Helper to clean up all data for a specific player (limited to avoid document limits)
 */
async function cleanupPlayerData(ctx: MutationCtx, worldId: Id<'worlds'>, playerId: string) {
  // Delete player description
  const playerDesc = await ctx.db
    .query('playerDescriptions')
    .withIndex('worldId', (q) => q.eq('worldId', worldId).eq('playerId', playerId))
    .first();
  
  if (playerDesc) {
    await ctx.db.delete(playerDesc._id);
  }
  
  // Delete messages authored by this player (limited batch)
  const messages = await ctx.db
    .query('messages')
    .withIndex('conversationId')
    .filter((q) => q.eq(q.field('author'), playerId))
    .take(50); // Reduced batch size
  
  for (const message of messages) {
    await ctx.db.delete(message._id);
  }
  
  // Delete participatedTogether records (limited)
  const participated1 = await ctx.db
    .query('participatedTogether')
    .withIndex('edge')
    .filter((q) => 
      q.and(
        q.eq(q.field('worldId'), worldId),
        q.eq(q.field('player1'), playerId)
      )
    )
    .take(20); // Limited
  
  const participated2 = await ctx.db
    .query('participatedTogether')
    .withIndex('edge')
    .filter((q) => 
      q.and(
        q.eq(q.field('worldId'), worldId),
        q.eq(q.field('player2'), playerId)
      )
    )
    .take(20); // Limited
  
  for (const record of [...participated1, ...participated2]) {
    await ctx.db.delete(record._id);
  }
  
  // Delete memories (limited)
  const memories = await ctx.db
    .query('memories')
    .withIndex('playerId', (q) => q.eq('playerId', playerId))
    .take(20); // Limited
  
  for (const memory of memories) {
    await ctx.db.delete(memory._id);
  }
}

/**
 * Complete world reset - removes ALL players and agents
 */
export const resetWorld = mutation({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    console.log(`🔄 Resetting world ${args.worldId} completely`);
    
    // Call cleanup with keepArenaBots = false
    return await cleanupWorld(ctx, {
      worldId: args.worldId,
      keepArenaBots: false,
    });
  },
});