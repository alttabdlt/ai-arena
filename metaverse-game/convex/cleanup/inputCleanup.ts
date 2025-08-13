import { v } from 'convex/values';
import { mutation, internalMutation } from '../_generated/server';
import { internal } from '../_generated/api';

// Aggressively clean inputs keeping only recent unprocessed
export const aggressiveInputCleanup = internalMutation({
  args: {
    keepHours: v.optional(v.number()), // Default 1 hour
    batchSize: v.optional(v.number()), // Default 200
  },
  handler: async (ctx, args) => {
    const keepHours = args.keepHours ?? 1;
    const batchSize = args.batchSize ?? 200;
    const cutoff = Date.now() - (keepHours * 60 * 60 * 1000);
    
    let totalDeleted = 0;
    
    // Delete old processed inputs
    const oldProcessed = await ctx.db
      .query('inputs')
      .filter(q => q.and(
        q.lt(q.field('received'), cutoff),
        q.neq(q.field('returnValue'), undefined)
      ))
      .take(batchSize);
    
    for (const input of oldProcessed) {
      await ctx.db.delete(input._id);
      totalDeleted++;
    }
    
    // Delete stuck unprocessed inputs older than 6 hours
    const stuckCutoff = Date.now() - (6 * 60 * 60 * 1000);
    const stuckInputs = await ctx.db
      .query('inputs')
      .filter(q => q.and(
        q.lt(q.field('received'), stuckCutoff),
        q.eq(q.field('returnValue'), undefined)
      ))
      .take(50); // Smaller batch for unprocessed
    
    for (const input of stuckInputs) {
      // Skip bot creation inputs
      if (input.name === 'createAgentFromAIArena') {
        continue;
      }
      await ctx.db.delete(input._id);
      totalDeleted++;
    }
    
    return {
      deleted: totalDeleted,
      hasMore: oldProcessed.length === batchSize || stuckInputs.length === 50
    };
  },
});

// Public mutation for manual cleanup
export const manualInputCleanup = mutation({
  args: {
    confirm: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (!args.confirm) {
      return { error: 'Must confirm with confirm: true' };
    }
    
    let totalDeleted = 0;
    let iterations = 0;
    const maxIterations = 10;
    
    while (iterations < maxIterations) {
      const result = await ctx.runMutation(
        internal.cleanup.inputCleanup.aggressiveInputCleanup,
        { keepHours: 1, batchSize: 200 }
      );
      
      totalDeleted += result.deleted;
      iterations++;
      
      if (!result.hasMore || result.deleted === 0) {
        break;
      }
    }
    
    return {
      success: true,
      totalDeleted,
      iterations,
      message: `Cleaned ${totalDeleted} inputs in ${iterations} batches`
    };
  },
});