import { v } from 'convex/values';
import { internalMutation, query, mutation, MutationCtx } from '../_generated/server';
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
 * Helper function to clean up all messages authored by a player
 */
async function cleanupPlayerMessages(ctx: MutationCtx, worldId: Id<'worlds'>, playerId: string) {
  let totalDeleted = 0;
  const batchSize = 100; // Process in smaller batches
  
  // Use pagination to avoid reading too many documents
  let hasMore = true;
  while (hasMore) {
    const authoredMessages = await ctx.db
      .query('messages')
      .withIndex('conversationId')
      .filter((q) => q.eq(q.field('author'), playerId))
      .take(batchSize);
    
    if (authoredMessages.length === 0) {
      hasMore = false;
      break;
    }
    
    for (const message of authoredMessages) {
      await ctx.db.delete(message._id);
      totalDeleted++;
    }
    
    // If we got less than batchSize, we're done
    if (authoredMessages.length < batchSize) {
      hasMore = false;
    }
  }
  
  return totalDeleted;
}

/**
 * Helper function to clean up archived conversations involving a player
 */
async function cleanupArchivedConversations(ctx: MutationCtx, worldId: Id<'worlds'>, playerId: string) {
  let deletedCount = 0;
  let updatedCount = 0;
  const batchSize = 50; // Smaller batch for conversations
  
  // Process archived conversations in batches
  let hasMore = true;
  
  while (hasMore) {
    // Get a batch of archived conversations
    const archivedConvos = await ctx.db
      .query('archivedConversations')
      .withIndex('worldId')
      .filter((q) => q.eq(q.field('worldId'), worldId))
      .take(batchSize);
    
    if (archivedConvos.length === 0) {
      hasMore = false;
      break;
    }
    
    for (const convo of archivedConvos) {
      if (convo.participants.includes(playerId)) {
        // If only 2 participants and one is being removed, delete the entire conversation
        if (convo.participants.length <= 2) {
          await ctx.db.delete(convo._id);
          
          // Also delete all messages for this conversation
          const messages = await ctx.db
            .query('messages')
            .withIndex('conversationId')
            .filter((q) => 
              q.and(
                q.eq(q.field('worldId'), worldId),
                q.eq(q.field('conversationId'), convo.id)
              )
            )
            .collect();
          
          for (const msg of messages) {
            await ctx.db.delete(msg._id);
          }
          
          deletedCount++;
        } else {
          // Multiple participants - just remove this player from the list
          const updatedParticipants = convo.participants.filter(p => p !== playerId);
          await ctx.db.patch(convo._id, { participants: updatedParticipants });
          updatedCount++;
        }
      }
    }
  }
  
  return { deletedCount, updatedCount };
}

/**
 * Helper function to clean up active conversations involving a player
 */
async function cleanupActiveConversations(ctx: MutationCtx, worldId: Id<'worlds'>, playerId: string) {
  let cleanedCount = 0;
  
  // Get the world to access active conversations
  const world = await ctx.db.get(worldId);
  if (!world || !world.conversations) {
    return 0;
  }
  
  const updatedConversations = [];
  
  for (const conversation of world.conversations) {
    // Check if this conversation involves the player being cleaned up
    const hasPlayer = conversation.participants.some((p: any) => 
      p.playerId === playerId || p.id === playerId
    );
    
    if (hasPlayer) {
      // If it's a 2-person conversation, remove it entirely
      if (conversation.participants.length <= 2) {
        console.log(`Removing conversation ${conversation.id} - player ${playerId} was a participant`);
        cleanedCount++;
        // Don't add to updatedConversations (effectively deleting it)
      } else {
        // Multi-party conversation - just remove this player
        conversation.participants = conversation.participants.filter((p: any) => 
          p.playerId !== playerId && p.id !== playerId
        );
        updatedConversations.push(conversation);
        cleanedCount++;
      }
    } else {
      // Keep conversations that don't involve this player
      updatedConversations.push(conversation);
    }
  }
  
  // Update the world with cleaned conversations
  if (cleanedCount > 0) {
    await ctx.db.patch(worldId, {
      conversations: updatedConversations
    });
  }
  
  return cleanedCount;
}

/**
 * Helper function to clean up participatedTogether records
 */
async function cleanupParticipatedTogether(ctx: MutationCtx, worldId: Id<'worlds'>, playerId: string) {
  // Find all participatedTogether records involving this player
  const records1 = await ctx.db
    .query('participatedTogether')
    .withIndex('edge')
    .filter((q) => 
      q.and(
        q.eq(q.field('worldId'), worldId),
        q.eq(q.field('player1'), playerId)
      )
    )
    .collect();
  
  const records2 = await ctx.db
    .query('participatedTogether')
    .withIndex('edge')
    .filter((q) => 
      q.and(
        q.eq(q.field('worldId'), worldId),
        q.eq(q.field('player2'), playerId)
      )
    )
    .collect();
  
  // Delete all found records
  for (const record of [...records1, ...records2]) {
    await ctx.db.delete(record._id);
  }
  
  return records1.length + records2.length;
}

/**
 * Helper function to clean up relationships involving a player
 */
async function cleanupRelationships(ctx: MutationCtx, worldId: Id<'worlds'>, playerId: string) {
  // Find all relationships where this player is involved
  const relationships = await ctx.db
    .query('relationships')
    .filter((q) => 
      q.and(
        q.eq(q.field('worldId'), worldId),
        q.or(
          q.eq(q.field('fromPlayer'), playerId),
          q.eq(q.field('toPlayer'), playerId)
        )
      )
    )
    .collect();
  
  // Delete all found relationships
  for (const relationship of relationships) {
    await ctx.db.delete(relationship._id);
  }
  
  return relationships.length;
}

/**
 * Helper function to clean up player descriptions
 */
async function cleanupPlayerDescriptions(ctx: MutationCtx, worldId: Id<'worlds'>, playerId: string) {
  const description = await ctx.db
    .query('playerDescriptions')
    .withIndex('worldId', (q) => q.eq('worldId', worldId).eq('playerId', playerId))
    .first();
  
  if (description) {
    await ctx.db.delete(description._id);
    console.log(`Deleted player description for ${playerId}`);
    return 1;
  }
  return 0;
}

/**
 * Comprehensive cleanup function for removing all traces of a player
 */
export async function comprehensivePlayerCleanupHelper(
  ctx: MutationCtx, 
  worldId: Id<'worlds'>, 
  playerId: string,
  keepActivityLogs: boolean = true
) {
  const cleanupResults = {
    messages: 0,
    playerDescriptions: 0,
    activeConversations: 0,
    archivedConversations: { deleted: 0, updated: 0 },
    participatedTogether: 0,
    relationships: 0,
    activityLogs: 0,
  };
  
  // 1. Clean up messages
  cleanupResults.messages = await cleanupPlayerMessages(ctx, worldId, playerId);
  
  // 2. Clean up player descriptions
  cleanupResults.playerDescriptions = await cleanupPlayerDescriptions(ctx, worldId, playerId);
  
  // 3. Clean up active conversations (NEW)
  cleanupResults.activeConversations = await cleanupActiveConversations(ctx, worldId, playerId);
  
  // 4. Clean up archived conversations
  const convoCleanup = await cleanupArchivedConversations(ctx, worldId, playerId);
  cleanupResults.archivedConversations.deleted = convoCleanup.deletedCount;
  cleanupResults.archivedConversations.updated = convoCleanup.updatedCount;
  
  // 5. Clean up participatedTogether records
  cleanupResults.participatedTogether = await cleanupParticipatedTogether(ctx, worldId, playerId);
  
  // 6. Clean up relationships
  cleanupResults.relationships = await cleanupRelationships(ctx, worldId, playerId);
  
  // 7. Optionally clean up activity logs
  if (!keepActivityLogs) {
    let deletedLogs = 0;
    const batchSize = 100;
    let hasMore = true;
    
    while (hasMore) {
      const activityLogs = await ctx.db
        .query('activityLogs')
        .withIndex('player')
        .filter((q) => 
          q.and(
            q.eq(q.field('worldId'), worldId),
            q.eq(q.field('playerId'), playerId)
          )
        )
        .take(batchSize);
      
      if (activityLogs.length === 0) {
        hasMore = false;
        break;
      }
      
      for (const log of activityLogs) {
        await ctx.db.delete(log._id);
        deletedLogs++;
      }
      
      if (activityLogs.length < batchSize) {
        hasMore = false;
      }
    }
    
    cleanupResults.activityLogs = deletedLogs;
  }
  
  return cleanupResults;
}

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
    
    // First, perform comprehensive cleanup of all related data
    const cleanupResults = await comprehensivePlayerCleanupHelper(
      ctx, 
      args.worldId, 
      args.playerId,
      true // Keep activity logs for audit trail
    );
    
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
    
    // Log the cleanup with details
    await ctx.db.insert('activityLogs', {
      worldId: args.worldId,
      playerId: args.playerId,
      agentId: args.agentId,
      timestamp: Date.now(),
      type: 'message',
      description: `Orphaned agent cleaned up: ${args.reason || 'No longer exists in Arena'}`,
      emoji: '🧹',
      details: {
        message: `Cleaned: ${cleanupResults.messages} messages, ${cleanupResults.archivedConversations.deleted} conversations, ${cleanupResults.participatedTogether} relationships, ${cleanupResults.relationships} bot relationships`,
      },
    });
    
    return {
      success: true,
      agentId: args.agentId,
      playerId: args.playerId,
      cleanupResults,
    };
  },
});

/**
 * Internal mutation to perform comprehensive player cleanup
 * This is called via the scheduler when a player leaves the game
 */
export const comprehensivePlayerCleanup = internalMutation({
  args: {
    worldId: v.id('worlds'),
    playerId: v.string(),
    keepActivityLogs: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await comprehensivePlayerCleanupHelper(
      ctx,
      args.worldId,
      args.playerId,
      args.keepActivityLogs ?? true
    );
  },
});

/**
 * Batch delete multiple orphaned agents (processes one at a time to avoid document limits)
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
    
    // Process agents one at a time to avoid document limit issues
    for (const agent of args.agents) {
      try {
        // Get the world document
        const world = await ctx.db.get(args.worldId);
        if (!world) {
          console.error(`World ${args.worldId} not found for agent ${agent.agentId}`);
          results.push({
            success: false,
            agentId: agent.agentId,
            error: 'World not found',
          });
          continue;
        }
        
        // Skip cleanup of related data for now to avoid document limits
        // Just remove the agent from the world arrays
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
        
        // Simple log without comprehensive cleanup details
        await ctx.db.insert('activityLogs', {
          worldId: args.worldId,
          playerId: agent.playerId,
          agentId: agent.agentId,
          timestamp: Date.now(),
          type: 'message',
          description: args.reason || `Orphaned agent removed - Bot ${agent.aiArenaBotId} no longer in Arena`,
          emoji: '🧹',
          details: {
            message: `Agent and player removed from world`,
          },
        });
        
        results.push({
          success: true,
          agentId: agent.agentId,
          playerId: agent.playerId,
          message: 'Agent removed (cleanup deferred)',
        });
      } catch (error: any) {
        console.error(`Failed to delete orphaned agent ${agent.agentId}:`, error);
        results.push({
          success: false,
          agentId: agent.agentId,
          error: error.message || 'Unknown error',
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