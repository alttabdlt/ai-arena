import { mutation } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Clear stuck inputs that are older than the specified age
 * This helps recover from situations where inputs are submitted but never processed
 */
export const clearStuckInputs = mutation({
  args: {
    maxAgeMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxAge = (args.maxAgeMinutes || 30) * 60 * 1000; // Default 30 minutes to allow bot deployment
    const cutoffTime = Date.now() - maxAge;
    
    // Find the default world
    const worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
      
    if (!worldStatus) {
      console.log('No default world found');
      return { cleared: 0 };
    }
    
    // Find stuck inputs (no returnValue and older than cutoff)
    const stuckInputs = await ctx.db
      .query('inputs')
      .filter((q) => 
        q.and(
          q.eq(q.field('engineId'), worldStatus.engineId),
          q.eq(q.field('returnValue'), undefined)
        )
      )
      .collect();
    
    let clearedCount = 0;
    const now = Date.now();
    
    for (const input of stuckInputs) {
      // Check if input is old enough
      if (input.received && input.received < cutoffTime) {
        // Mark as failed instead of deleting to preserve history
        await ctx.db.patch(input._id, {
          returnValue: {
            kind: 'error' as const,
            message: `Cleared as stuck after ${Math.round((now - input.received) / 1000)}s`
          }
        });
        clearedCount++;
        
        console.log(`Cleared stuck input: ${input.name} (age: ${Math.round((now - input.received) / 1000)}s)`);
      }
    }
    
    console.log(`✅ Cleared ${clearedCount} stuck inputs older than ${args.maxAgeMinutes || 30} minutes`);
    return { cleared: clearedCount };
  },
});

/**
 * List all pending inputs to see what's stuck
 */
export const listPendingInputs = mutation({
  handler: async (ctx) => {
    // Find the default world
    const worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
      
    if (!worldStatus) {
      console.log('No default world found');
      return [];
    }
    
    // Find pending inputs (no returnValue)
    const pendingInputs = await ctx.db
      .query('inputs')
      .filter((q) => 
        q.and(
          q.eq(q.field('engineId'), worldStatus.engineId),
          q.eq(q.field('returnValue'), undefined)
        )
      )
      .order('desc')
      .take(20);
    
    const now = Date.now();
    
    return pendingInputs.map(input => ({
      id: input._id,
      name: input.name,
      number: input.number,
      ageSeconds: Math.round((now - (input.received || 0)) / 1000),
      args: input.args,
    }));
  },
});