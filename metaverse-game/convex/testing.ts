import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';

// Minimal testing utilities for freeze/unfreeze functionality

export const stopAllowed = query({
  handler: async (ctx) => {
    // Only allow stopping in development
    return process.env.NODE_ENV === 'development';
  },
});

export const stop = mutation({
  handler: async (ctx) => {
    const worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    
    if (worldStatus) {
      await ctx.db.patch(worldStatus._id, { status: 'stoppedByDeveloper' });
    }
    
    return { success: true };
  },
});

export const resume = mutation({
  handler: async (ctx) => {
    const worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    
    if (worldStatus) {
      await ctx.db.patch(worldStatus._id, { status: 'running' });
    }
    
    return { success: true };
  },
});

// Verify that a bot has been completely cleaned from the system
export const verifyBotCleanup = query({
  args: { aiArenaBotId: v.string() },
  handler: async (ctx, args) => {
    const references = {
      pendingRegistrations: 0,
      botExperience: 0,
      lootboxQueue: 0,
      activityLogs: 0,
      agentDescriptions: 0,
      agents: 0,
      players: 0,
    };
    
    // Get all worlds to check
    const worlds = await ctx.db.query('worlds').collect();
    
    // Check pending registrations
    const pendingRegs = await ctx.db
      .query('pendingBotRegistrations')
      .withIndex('aiArenaBotId', (q) => q.eq('aiArenaBotId', args.aiArenaBotId))
      .collect();
    references.pendingRegistrations = pendingRegs.length;
    
    // Check each world for references
    for (const world of worlds) {
      // Check bot experience
      const botExp = await ctx.db
        .query('botExperience')
        .withIndex('aiArenaBotId', (q: any) => 
          q.eq('worldId', world._id).eq('aiArenaBotId', args.aiArenaBotId)
        )
        .collect();
      references.botExperience += botExp.length;
      
      // Check lootbox queue
      const lootboxes = await ctx.db
        .query('lootboxQueue')
        .withIndex('aiArenaBotId', (q: any) => 
          q.eq('worldId', world._id).eq('aiArenaBotId', args.aiArenaBotId)
        )
        .collect();
      references.lootboxQueue += lootboxes.length;
      
      // Check activity logs
      const logs = await ctx.db
        .query('activityLogs')
        .withIndex('aiArenaBotId', (q: any) => 
          q.eq('worldId', world._id).eq('aiArenaBotId', args.aiArenaBotId)
        )
        .take(1); // Just check if any exist
      if (logs.length > 0) {
        references.activityLogs++;
      }
      
      // Check agent descriptions
      const agentDescs = await ctx.db
        .query('agentDescriptions')
        .withIndex('worldId', (q: any) => q.eq('worldId', world._id))
        .collect();
      for (const desc of agentDescs) {
        if (desc.aiArenaBotId === args.aiArenaBotId) {
          references.agentDescriptions++;
        }
      }
      
      // Check agents in world
      const agent = world.agents.find((a: any) => a.aiArenaBotId === args.aiArenaBotId);
      if (agent) {
        references.agents++;
      }
    }
    
    const isClean = Object.values(references).every(count => count === 0);
    
    return {
      isClean,
      references,
      message: isClean 
        ? `Bot ${args.aiArenaBotId} is completely cleaned from the system`
        : `Bot ${args.aiArenaBotId} still has references in the system`
    };
  },
});

// Cleanup for ghost bots (dynamically finds them)
export const cleanupGhostBots = mutation({
  handler: async (ctx) => {
    // Dynamically find ghost bots by checking for orphaned agents
    const worlds = await ctx.db.query('worlds').collect();
    const ghostBotIds: string[] = [];
    
    for (const world of worlds) {
      // Get all agent descriptions for this world
      const agentDescriptions = await ctx.db
        .query('agentDescriptions')
        .withIndex('worldId', (q: any) => q.eq('worldId', world._id))
        .collect();
      
      // Create a set of agent IDs that have descriptions
      const agentsWithDescriptions = new Set(
        agentDescriptions.map(desc => desc.agentId)
      );
      
      // Find orphaned agents (those without descriptions but with aiArenaBotId)
      for (const agent of world.agents) {
        if (agent.aiArenaBotId && !agentsWithDescriptions.has(agent.id)) {
          ghostBotIds.push(agent.aiArenaBotId);
        }
      }
    }
    
    if (ghostBotIds.length === 0) {
      return {
        cleaned: 0,
        failed: 0,
        errors: [],
        message: 'No ghost bots found'
      };
    }
    
    console.log(`Found ${ghostBotIds.length} ghost bots to clean:`, ghostBotIds);
    
    const results = {
      cleaned: 0,
      failed: 0,
      errors: [] as string[]
    };
    
    for (const botId of ghostBotIds) {
      try {
        console.log(`Cleaning ghost bot: ${botId}`);
        
        // Use the internal mutation to delete from all worlds
        const deleteResult = await ctx.runMutation(internal.aiTown.botHttp.deleteBotFromWorlds, {
          aiArenaBotId: botId
        });
        
        if (deleteResult.deletedCount > 0) {
          results.cleaned++;
          console.log(`✅ Cleaned ghost bot ${botId} from ${deleteResult.deletedCount} world(s)`);
        } else {
          console.log(`⚠️ Ghost bot ${botId} not found in any world`);
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Failed to clean ${botId}: ${error.message}`);
        console.error(`❌ Failed to clean ghost bot ${botId}:`, error);
      }
    }
    
    console.log(`Ghost bot cleanup complete: ${results.cleaned} cleaned, ${results.failed} failed`);
    
    return results;
  },
});

// Comprehensive cleanup of orphaned agents (agents without descriptions)
export const cleanupOrphanedAgents = mutation({
  args: { 
    worldId: v.optional(v.id('worlds')),
    dryRun: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    let worldsToCheck = [];
    
    if (args.worldId) {
      const world = await ctx.db.get(args.worldId);
      if (world) {
        worldsToCheck.push(world);
      }
    } else {
      // Check all worlds
      worldsToCheck = await ctx.db.query('worlds').collect();
    }
    
    const results = {
      orphanedAgents: [] as any[],
      cleaned: 0,
      worldsProcessed: worldsToCheck.length
    };
    
    for (const world of worldsToCheck) {
      // Get all agent descriptions for this world
      const agentDescriptions = await ctx.db
        .query('agentDescriptions')
        .withIndex('worldId', (q: any) => q.eq('worldId', world._id))
        .collect();
      
      // Create a set of agent IDs that have descriptions
      const agentsWithDescriptions = new Set(
        agentDescriptions.map(desc => desc.agentId)
      );
      
      // Find orphaned agents (those without descriptions)
      const orphanedAgents = world.agents.filter((agent: any) => {
        // If agent has aiArenaBotId but no description, it's orphaned
        if (agent.aiArenaBotId && !agentsWithDescriptions.has(agent.id)) {
          return true;
        }
        return false;
      });
      
      if (orphanedAgents.length > 0) {
        console.log(`Found ${orphanedAgents.length} orphaned agents in world ${world._id}`);
        
        for (const orphan of orphanedAgents) {
          results.orphanedAgents.push({
            worldId: world._id,
            agentId: orphan.id,
            playerId: orphan.playerId,
            aiArenaBotId: orphan.aiArenaBotId
          });
        }
        
        if (!dryRun) {
          // Remove orphaned agents from the world
          const cleanedAgents = world.agents.filter((agent: any) => 
            !orphanedAgents.includes(agent)
          );
          
          // Also remove their players
          const orphanedPlayerIds = new Set(
            orphanedAgents.map((a: any) => a.playerId)
          );
          const cleanedPlayers = world.players.filter((player: any) => 
            !orphanedPlayerIds.has(player.id)
          );
          
          // Update the world
          await ctx.db.patch(world._id, {
            agents: cleanedAgents,
            players: cleanedPlayers
          });
          
          results.cleaned += orphanedAgents.length;
          console.log(`Cleaned ${orphanedAgents.length} orphaned agents from world ${world._id}`);
        }
      }
    }
    
    return {
      ...results,
      message: dryRun 
        ? `Found ${results.orphanedAgents.length} orphaned agents (dry run - no changes made)`
        : `Cleaned ${results.cleaned} orphaned agents from ${results.worldsProcessed} world(s)`
    };
  },
});

// Emergency cleanup - delete ALL inputs to fix database overload
export const emergencyCleanupAllInputs = mutation({
  args: {
    confirm: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (!args.confirm) {
      return {
        error: 'Must confirm with confirm: true to delete all inputs',
        message: 'This will delete ALL inputs from the database'
      };
    }
    
    let totalDeleted = 0;
    const batchSize = 50; // Very small batch to avoid limits
    
    while (totalDeleted < 50000) { // Safety limit
      // Get a small batch of inputs
      const inputs = await ctx.db.query('inputs').take(batchSize);
      
      if (inputs.length === 0) {
        break;
      }
      
      // Delete the batch
      for (const input of inputs) {
        await ctx.db.delete(input._id);
      }
      
      totalDeleted += inputs.length;
      
      // If we got less than batchSize, we're done
      if (inputs.length < batchSize) {
        break;
      }
    }
    
    return {
      deleted: totalDeleted,
      message: `Emergency cleanup: Deleted ${totalDeleted} inputs`
    };
  },
});

// EMERGENCY: Delete inputs in batches, preserving bot creation inputs
export const emergencyDeleteInputsBatch = mutation({
  args: {
    batchSize: v.optional(v.number()),
    preserveBotCreation: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 30; // Even smaller batch
    const preserveBotCreation = args.preserveBotCreation ?? true;
    let deletedCount = 0;
    let skippedCount = 0;
    
    try {
      // Get a small batch of inputs, newest first (likely junk)
      const inputs = await ctx.db
        .query('inputs')
        .order('desc')
        .take(batchSize);
      
      for (const input of inputs) {
        // Skip bot creation inputs if requested
        if (preserveBotCreation && input.name === 'createAgentFromAIArena') {
          skippedCount++;
          continue;
        }
        
        // Delete the input
        await ctx.db.delete(input._id);
        deletedCount++;
      }
      
      return {
        deletedCount,
        skippedCount,
        hasMore: inputs.length === batchSize,
        message: `Deleted ${deletedCount} inputs, skipped ${skippedCount}`
      };
    } catch (error: any) {
      return {
        deletedCount,
        skippedCount,
        error: error.message || 'Unknown error'
      };
    }
  },
});

// Cleanup old processed inputs to prevent database bloat
export const cleanupOldInputs = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    maxAge: v.optional(v.number()), // Age in hours, default 24
    batchSize: v.optional(v.number()), // How many to delete at once, default 100
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    const maxAgeHours = args.maxAge ?? 24;
    const batchSize = args.batchSize ?? 100;
    
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    const cutoffTime = Date.now() - maxAgeMs;
    
    let totalDeleted = 0;
    let hasMore = true;
    
    while (hasMore && totalDeleted < 10000) { // Safety limit
      // Get a batch of old, processed inputs
      const oldInputs = await ctx.db
        .query('inputs')
        .filter((q) => 
          q.and(
            q.lt(q.field('_creationTime'), cutoffTime),
            q.neq(q.field('returnValue'), undefined) // Only delete processed inputs
          )
        )
        .take(batchSize);
      
      if (oldInputs.length === 0) {
        hasMore = false;
        break;
      }
      
      if (!dryRun) {
        // Delete the batch
        for (const input of oldInputs) {
          await ctx.db.delete(input._id);
        }
      }
      
      totalDeleted += oldInputs.length;
      
      // If we got less than batchSize, we're done
      if (oldInputs.length < batchSize) {
        hasMore = false;
      }
    }
    
    return {
      deleted: dryRun ? 0 : totalDeleted,
      found: totalDeleted,
      dryRun,
      message: dryRun 
        ? `Would delete ${totalDeleted} inputs older than ${maxAgeHours} hours`
        : `Deleted ${totalDeleted} inputs older than ${maxAgeHours} hours`
    };
  },
});

// Debug cleanup for a single ghost bot
export const cleanupSingleGhostBot = mutation({
  args: { aiArenaBotId: v.string() },
  handler: async (ctx, args) => {
    console.log(`Starting cleanup for single bot: ${args.aiArenaBotId}`);
    
    try {
      // Use the internal mutation to delete from all worlds
      const deleteResult: any = await ctx.runMutation(internal.aiTown.botHttp.deleteBotFromWorlds, {
        aiArenaBotId: args.aiArenaBotId
      });
      
      console.log(`Delete result:`, deleteResult);
      
      // After deletion, verify the bot is gone
      const worlds = await ctx.db.query('worlds').collect();
      
      for (const world of worlds) {
        const remainingAgent = world.agents.find((a: any) => a.aiArenaBotId === args.aiArenaBotId);
        if (remainingAgent) {
          console.error(`⚠️ Agent still exists after deletion in world ${world._id}:`, remainingAgent);
        } else {
          console.log(`✅ Agent successfully removed from world ${world._id}`);
        }
      }
      
      return deleteResult;
    } catch (error: any) {
      console.error(`Failed to clean bot ${args.aiArenaBotId}:`, error);
      throw error;
    }
  },
});