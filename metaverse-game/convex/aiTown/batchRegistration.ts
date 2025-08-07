import { v } from 'convex/values';
import { internalMutation, internalAction, internalQuery, mutation, query } from '../_generated/server';
import { internal } from '../_generated/api';
import { insertInput } from './insertInput';
import { Id } from '../_generated/dataModel';

// Process a batch of pending bot registrations
export const processBatchRegistrations = internalMutation({
  args: {
    worldId: v.id('worlds'),
    maxBatchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxBatch = args.maxBatchSize || 20;
    
    // Get pending registrations for this world
    const pendingRegistrations = await ctx.db
      .query('pendingBotRegistrations')
      .withIndex('worldId', (q) => 
        q.eq('worldId', args.worldId).eq('status', 'pending')
      )
      .take(maxBatch);
    
    if (pendingRegistrations.length === 0) {
      console.log('No pending registrations to process');
      return { processed: 0 };
    }
    
    console.log(`Processing batch of ${pendingRegistrations.length} registrations`);
    
    // Update all registrations to 'processing' status
    const registrationIds = [];
    for (const reg of pendingRegistrations) {
      await ctx.db.patch(reg._id, {
        status: 'processing',
        processedAt: Date.now(),
      });
      registrationIds.push(reg._id);
    }
    
    // Get world status to find the engine
    const worldStatus = await ctx.db
      .query('worldStatus')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .unique();
    
    if (!worldStatus) {
      throw new Error(`World status not found for world ${args.worldId}`);
    }
    
    // Get the current highest input number for this engine
    const lastInput = await ctx.db
      .query('inputs')
      .withIndex('byInputNumber', (q) => q.eq('engineId', worldStatus.engineId))
      .order('desc')
      .first();
    
    let nextNumber = lastInput ? lastInput.number + 1 : 0;
    const batchTimestamp = Date.now();
    const inputIds: Id<'inputs'>[] = [];
    
    // Create inputs for all registrations with sequential numbers and same timestamp
    for (const reg of pendingRegistrations) {
      const inputId = await ctx.db.insert('inputs', {
        engineId: worldStatus.engineId,
        number: nextNumber++,
        name: 'createAgentFromAIArena',
        args: {
          name: reg.name,
          character: reg.character,
          identity: reg.identity,
          plan: reg.plan,
          aiArenaBotId: reg.aiArenaBotId,
          initialZone: reg.initialZone,
        },
        received: batchTimestamp, // Same timestamp ensures they're processed together
      });
      
      inputIds.push(inputId);
      
      // Store the input ID in the registration for tracking
      await ctx.db.patch(reg._id, {
        result: {
          agentId: '', // Will be filled when processed
          playerId: '', // Will be filled when processed
          inputId: inputId,
        },
      });
    }
    
    console.log(`Created ${inputIds.length} inputs for batch processing`);
    
    return {
      processed: pendingRegistrations.length,
      registrationIds,
      inputIds,
    };
  },
});

// Check and update registration statuses based on input processing
export const updateRegistrationStatuses = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Find all registrations that are in 'processing' status
    const processingRegistrations = await ctx.db
      .query('pendingBotRegistrations')
      .withIndex('status', (q) => q.eq('status', 'processing'))
      .collect();
    
    let updatedCount = 0;
    
    for (const reg of processingRegistrations) {
      // Check if the input has been processed
      if (reg.result?.inputId) {
        const input = await ctx.db.get(reg.result.inputId);
        
        if (input && input.returnValue) {
          const returnValue = input.returnValue as any;
          
          if (returnValue.kind === 'ok' && returnValue.value) {
            // Success - update registration with results
            await ctx.db.patch(reg._id, {
              status: 'completed',
              completedAt: Date.now(),
              result: {
                agentId: returnValue.value.agentId,
                playerId: returnValue.value.playerId,
                inputId: reg.result.inputId,
              },
            });
            updatedCount++;
            console.log(`Registration ${reg._id} completed: agent=${returnValue.value.agentId}`);
          } else if (returnValue.kind === 'error') {
            // Error - mark as failed
            await ctx.db.patch(reg._id, {
              status: 'failed',
              completedAt: Date.now(),
              error: returnValue.message,
              retryCount: (reg.retryCount || 0) + 1,
            });
            updatedCount++;
            console.log(`Registration ${reg._id} failed: ${returnValue.message}`);
          }
        }
      }
    }
    
    return { updated: updatedCount };
  },
});

// Scheduled action to process registrations periodically
export const scheduledBatchProcessor = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get all worlds with pending registrations
    // @ts-ignore - TypeScript has issues with deep type instantiation here
    const worlds = await ctx.runQuery(internal.aiTown.batchRegistration.getWorldsWithPendingRegistrations);
    
    for (const worldId of worlds) {
      // Process batch for each world
      // @ts-ignore - TypeScript has issues with deep type instantiation here
      await ctx.runMutation(internal.aiTown.batchRegistration.processBatchRegistrations, {
        worldId: worldId as Id<'worlds'>,
      });
    }
    
    // Update statuses of processing registrations
    // @ts-ignore - TypeScript has issues with deep type instantiation here
    await ctx.runMutation(internal.aiTown.batchRegistration.updateRegistrationStatuses);
  },
});

// Query to get worlds that have pending registrations
export const getWorldsWithPendingRegistrations = internalQuery({
  args: {},
  handler: async (ctx) => {
    const pendingRegs = await ctx.db
      .query('pendingBotRegistrations')
      .withIndex('status', (q) => q.eq('status', 'pending'))
      .collect();
    
    // Get unique world IDs
    const worldIds = new Set<Id<'worlds'>>();
    for (const reg of pendingRegs) {
      worldIds.add(reg.worldId);
    }
    
    return Array.from(worldIds);
  },
});

// Manual trigger for batch processing (for testing)
export const triggerBatchProcessing = mutation({
  args: {
    worldId: v.optional(v.id('worlds')),
  },
  handler: async (ctx, args) => {
    if (args.worldId) {
      // Process specific world
      const result: any = await ctx.runMutation(
        internal.aiTown.batchRegistration.processBatchRegistrations,
        { worldId: args.worldId }
      );
      
      // Update statuses
      await ctx.runMutation(
        internal.aiTown.batchRegistration.updateRegistrationStatuses,
        {}
      );
      
      return result;
    } else {
      // Get the default world and process it
      const worldStatus = await ctx.db
        .query('worldStatus')
        .filter((q) => q.eq(q.field('isDefault'), true))
        .first();
      
      if (worldStatus) {
        const result: any = await ctx.runMutation(
          internal.aiTown.batchRegistration.processBatchRegistrations,
          { worldId: worldStatus.worldId }
        );
        
        await ctx.runMutation(
          internal.aiTown.batchRegistration.updateRegistrationStatuses,
          {}
        );
        
        return result;
      }
      
      return { message: 'No default world found' };
    }
  },
});

// Query to check queue status
export const getQueueStatus = query({
  args: {
    worldId: v.optional(v.id('worlds')),
  },
  handler: async (ctx, args) => {
    let registrations;
    if (args.worldId) {
      const worldId = args.worldId;
      registrations = await ctx.db
        .query('pendingBotRegistrations')
        .withIndex('worldId', (q) => q.eq('worldId', worldId).eq('status', 'pending'))
        .collect();
    } else {
      registrations = await ctx.db
        .query('pendingBotRegistrations')
        .collect();
    }
    
    const statusCounts = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };
    
    for (const reg of registrations) {
      statusCounts[reg.status]++;
    }
    
    return {
      total: registrations.length,
      ...statusCounts,
      oldestPending: registrations
        .filter(r => r.status === 'pending')
        .sort((a, b) => a.createdAt - b.createdAt)[0]?.createdAt,
    };
  },
});

// Cleanup old completed registrations
export const cleanupOldRegistrations = mutation({
  args: {
    olderThanHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hoursAgo = (args.olderThanHours || 24) * 60 * 60 * 1000;
    const cutoffTime = Date.now() - hoursAgo;
    
    const oldRegistrations = await ctx.db
      .query('pendingBotRegistrations')
      .filter((q) => q.eq(q.field('status'), 'completed'))
      .collect();
    
    let deletedCount = 0;
    for (const reg of oldRegistrations) {
      if (reg.completedAt && reg.completedAt < cutoffTime) {
        await ctx.db.delete(reg._id);
        deletedCount++;
      }
    }
    
    return { deleted: deletedCount };
  },
});

// Retry failed registrations
export const retryFailedRegistrations = mutation({
  args: {
    maxRetries: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxRetries = args.maxRetries || 3;
    
    const failedRegistrations = await ctx.db
      .query('pendingBotRegistrations')
      .withIndex('status', (q) => q.eq('status', 'failed'))
      .collect();
    
    let retriedCount = 0;
    for (const reg of failedRegistrations) {
      if ((reg.retryCount || 0) < maxRetries) {
        await ctx.db.patch(reg._id, {
          status: 'pending',
          error: undefined,
          processedAt: undefined,
          completedAt: undefined,
        });
        retriedCount++;
      }
    }
    
    return { retried: retriedCount };
  },
});