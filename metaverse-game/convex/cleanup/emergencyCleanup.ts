import { v } from 'convex/values';
import { mutation, query } from '../_generated/server';
import { Doc, Id } from '../_generated/dataModel';

// Emergency cleanup - deletes inputs in small batches without reading all
export const emergencyDeleteInputs = mutation({
  args: {
    batchSize: v.optional(v.number()),
    preserveProcessed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100; // Small batch to avoid limits
    const preserveProcessed = args.preserveProcessed ?? true;
    
    let deletedCount = 0;
    let skippedCount = 0;
    
    try {
      // Get a small batch of inputs
      const inputs = await ctx.db
        .query('inputs')
        .order('desc') // Start with newest (most likely to be junk)
        .take(batchSize);
      
      for (const input of inputs) {
        // Skip processed inputs if requested
        if (preserveProcessed && input.returnValue) {
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
        message: `Deleted ${deletedCount} inputs, skipped ${skippedCount} processed inputs`
      };
    } catch (error: any) {
      return {
        deletedCount,
        skippedCount,
        hasMore: true,
        error: error.message || 'Unknown error during cleanup'
      };
    }
  },
});

// Delete ALL inputs except the 4 processed bot creations
export const purgeAllInputsExceptBots = mutation({
  args: {
    confirm: v.boolean(),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!args.confirm) {
      throw new Error('Must confirm with confirm: true');
    }
    
    const batchSize = args.batchSize ?? 50; // Very small batch
    let totalDeleted = 0;
    let totalSkipped = 0;
    
    try {
      // Get the 4 bot creation input IDs to preserve
      const botCreationInputs = await ctx.db
        .query('inputs')
        .filter(q => q.eq(q.field('name'), 'createAgentFromAIArena'))
        .take(10); // Should only be 4
      
      const preserveIds = new Set(botCreationInputs.map(i => i._id));
      
      // Delete inputs in small batches
      const inputs = await ctx.db
        .query('inputs')
        .take(batchSize);
      
      for (const input of inputs) {
        if (preserveIds.has(input._id)) {
          totalSkipped++;
          continue;
        }
        
        await ctx.db.delete(input._id);
        totalDeleted++;
      }
      
      return {
        totalDeleted,
        totalSkipped,
        preservedBotInputs: botCreationInputs.length,
        hasMore: inputs.length === batchSize,
        message: `Deleted ${totalDeleted} inputs, preserved ${totalSkipped} bot creation inputs`
      };
    } catch (error: any) {
      return {
        totalDeleted,
        totalSkipped,
        error: error.message || 'Unknown error'
      };
    }
  },
});

// Clear all pending bot registrations
export const clearAllPendingRegistrations = mutation({
  args: {
    confirm: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (!args.confirm) {
      throw new Error('Must confirm with confirm: true');
    }
    
    let deletedCount = 0;
    
    try {
      // Delete in small batches
      const registrations = await ctx.db
        .query('pendingBotRegistrations')
        .take(100);
      
      for (const reg of registrations) {
        await ctx.db.delete(reg._id);
        deletedCount++;
      }
      
      return {
        deletedCount,
        hasMore: registrations.length === 100,
        message: `Deleted ${deletedCount} pending registrations`
      };
    } catch (error: any) {
      return {
        deletedCount,
        error: error.message || 'Unknown error'
      };
    }
  },
});

// Nuclear option - delete ALL documents from a table in batches
export const purgeTable = mutation({
  args: {
    tableName: v.string(),
    confirm: v.boolean(),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!args.confirm) {
      throw new Error('Must confirm with confirm: true');
    }
    
    const batchSize = args.batchSize ?? 50;
    let deletedCount = 0;
    
    try {
      // Get documents from the specified table
      const docs = await ctx.db
        .query(args.tableName as any)
        .take(batchSize);
      
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
        deletedCount++;
      }
      
      return {
        tableName: args.tableName,
        deletedCount,
        hasMore: docs.length === batchSize,
        message: `Deleted ${deletedCount} documents from ${args.tableName}`
      };
    } catch (error: any) {
      return {
        tableName: args.tableName,
        deletedCount,
        error: error.message || 'Unknown error'
      };
    }
  },
});

// Get quick stats without hitting limits
export const getQuickStats = query({
  args: {},
  handler: async (ctx) => {
    try {
      // Sample small amounts from each table
      const inputsSample = await ctx.db.query('inputs').take(10);
      const memoriesSample = await ctx.db.query('memories').take(10);
      const registrationsSample = await ctx.db.query('pendingBotRegistrations').take(10);
      const activityLogsSample = await ctx.db.query('activityLogs').take(10);
      
      // Get engine info
      const engines = await ctx.db.query('engines').take(1);
      const engine = engines[0];
      
      return {
        samples: {
          inputs: inputsSample.length,
          memories: memoriesSample.length,
          registrations: registrationsSample.length,
          activityLogs: activityLogsSample.length,
        },
        engineStatus: engine ? {
          running: engine.running,
          nextInputNumber: engine.nextInputNumber || 0,
          processedInputNumber: engine.processedInputNumber || 0,
          unprocessed: (engine.nextInputNumber || 0) - (engine.processedInputNumber || 0)
        } : null,
        message: 'Sampled 10 documents from each table. Actual counts are much higher.',
      };
    } catch (error: any) {
      return {
        error: error.message || 'Could not get stats'
      };
    }
  },
});

// Resume the engine after cleanup
export const resumeEngineAfterCleanup = mutation({
  args: {
    confirm: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (!args.confirm) {
      throw new Error('Must confirm with confirm: true');
    }
    
    try {
      // Get the engine
      const engines = await ctx.db.query('engines').collect();
      
      if (engines.length === 0) {
        return { error: 'No engine found' };
      }
      
      const engine = engines[0];
      
      // Update engine to running state
      await ctx.db.patch(engine._id, {
        running: true,
      });
      
      return {
        success: true,
        engineId: engine._id,
        message: 'Engine resumed successfully'
      };
    } catch (error: any) {
      return {
        error: error.message || 'Failed to resume engine'
      };
    }
  },
});