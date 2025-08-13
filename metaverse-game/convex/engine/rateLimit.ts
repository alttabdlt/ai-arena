import { v } from 'convex/values';
import { internalMutation, mutation } from '../_generated/server';
import { Id } from '../_generated/dataModel';
import { MAX_INPUTS_PER_ENGINE } from '../constants';

// Rate limiting for input creation to prevent explosions
export const checkInputRateLimit = internalMutation({
  args: {
    engineId: v.id('engines'),
  },
  handler: async (ctx, args) => {
    // Count current unprocessed inputs
    const unprocessedInputs = await ctx.db
      .query('inputs')
      .withIndex('byInputNumber', (q) => q.eq('engineId', args.engineId))
      .filter(q => q.eq(q.field('returnValue'), undefined))
      .take(MAX_INPUTS_PER_ENGINE + 1);
    
    const count = unprocessedInputs.length;
    
    if (count >= MAX_INPUTS_PER_ENGINE) {
      console.error(`⚠️ RATE LIMIT: Engine ${args.engineId} has ${count} unprocessed inputs (limit: ${MAX_INPUTS_PER_ENGINE})`);
      
      // Log this event for monitoring
      await ctx.db.insert('activityLogs', {
        worldId: args.engineId as any, // Using engineId as a proxy for worldId
        playerId: 'system' as any,
        timestamp: Date.now(),
        type: 'message' as const,
        description: `Rate limit triggered: ${count} unprocessed inputs`,
        emoji: '⚠️',
        details: {
          message: `Engine has too many unprocessed inputs. Blocking new inputs until processed.`,
        },
      });
      
      return {
        allowed: false,
        count,
        limit: MAX_INPUTS_PER_ENGINE,
        message: 'Too many unprocessed inputs. Please wait for the engine to catch up.',
      };
    }
    
    return {
      allowed: true,
      count,
      limit: MAX_INPUTS_PER_ENGINE,
    };
  },
});

// Monitor input processing rate
export const getInputProcessingStats = mutation({
  args: {
    engineId: v.id('engines'),
  },
  handler: async (ctx, args) => {
    const engine = await ctx.db.get(args.engineId);
    if (!engine) {
      throw new Error('Engine not found');
    }
    
    // Get recent inputs
    const recentCutoff = Date.now() - (5 * 60 * 1000); // Last 5 minutes
    const recentInputs = await ctx.db
      .query('inputs')
      .withIndex('byInputNumber', (q) => q.eq('engineId', args.engineId))
      .filter(q => q.gt(q.field('received'), recentCutoff))
      .collect();
    
    const processed = recentInputs.filter(i => i.returnValue !== undefined).length;
    const unprocessed = recentInputs.filter(i => i.returnValue === undefined).length;
    const total = recentInputs.length;
    
    // Calculate processing rate
    const processingRate = total > 0 ? (processed / total) * 100 : 100;
    
    // Get oldest unprocessed input
    const oldestUnprocessed = await ctx.db
      .query('inputs')
      .withIndex('byInputNumber', (q) => q.eq('engineId', args.engineId))
      .filter(q => q.eq(q.field('returnValue'), undefined))
      .first();
    
    const backlogAge = oldestUnprocessed 
      ? Date.now() - oldestUnprocessed.received 
      : 0;
    
    return {
      engineId: args.engineId,
      stats: {
        recentInputs: {
          total,
          processed,
          unprocessed,
          processingRate: Math.round(processingRate),
        },
        backlog: {
          age: backlogAge,
          ageSeconds: Math.round(backlogAge / 1000),
          oldestTimestamp: oldestUnprocessed?.received,
        },
        engine: {
          running: engine.running,
          currentTime: engine.currentTime,
          processedInputNumber: engine.processedInputNumber,
          nextInputNumber: engine.nextInputNumber,
        },
      },
      health: processingRate > 80 ? 'healthy' : 
              processingRate > 50 ? 'degraded' : 'critical',
    };
  },
});

// Emergency flush of stuck inputs
export const emergencyFlushInputs = internalMutation({
  args: {
    engineId: v.id('engines'),
    maxAge: v.optional(v.number()), // Max age in ms, default 1 hour
  },
  handler: async (ctx, args) => {
    const maxAge = args.maxAge ?? (60 * 60 * 1000); // 1 hour default
    const cutoff = Date.now() - maxAge;
    
    console.log(`🚨 EMERGENCY FLUSH: Clearing inputs older than ${maxAge / 1000}s for engine ${args.engineId}`);
    
    let deleted = 0;
    const batchSize = 200;
    let hasMore = true;
    
    while (hasMore && deleted < 5000) { // Cap at 5000 per flush
      const oldInputs = await ctx.db
        .query('inputs')
        .withIndex('byInputNumber', (q) => q.eq('engineId', args.engineId))
        .filter(q => q.and(
          q.lt(q.field('received'), cutoff),
          q.eq(q.field('returnValue'), undefined)
        ))
        .take(batchSize);
      
      for (const input of oldInputs) {
        // Mark as failed rather than delete
        await ctx.db.patch(input._id, {
          returnValue: {
            kind: 'error' as const,
            message: 'Emergency flush: Input too old',
          },
        });
        deleted++;
      }
      
      hasMore = oldInputs.length === batchSize;
    }
    
    console.log(`✅ Emergency flush complete: marked ${deleted} inputs as failed`);
    
    return {
      flushed: deleted,
      engineId: args.engineId,
    };
  },
});