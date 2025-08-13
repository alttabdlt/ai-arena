import { v } from 'convex/values';
import { internalMutation, internalAction, internalQuery, mutation, query } from '../_generated/server';
import { internal } from '../_generated/api';
import { insertInput } from '../aiTown/insertInput';
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
    
    // Ensure world is running
    if (worldStatus.status !== 'running') {
      console.log(`Activating world ${args.worldId} for batch processing`);
      await ctx.db.patch(worldStatus._id, { 
        status: 'running',
        lastViewed: Date.now(),
      });
    }
    
    // Get the engine to check its state and get the next input number
    const engine = await ctx.db.get(worldStatus.engineId);
    if (!engine) {
      throw new Error(`Engine ${worldStatus.engineId} not found`);
    }
    
    // CRITICAL: Ensure nextNumber is higher than processedInputNumber
    // The engine only loads inputs where number > processedInputNumber
    const lastInput = await ctx.db
      .query('inputs')
      .withIndex('byInputNumber', (q) => q.eq('engineId', worldStatus.engineId))
      .order('desc')
      .first();
    
    // Calculate the next number as the maximum of:
    // 1. processedInputNumber + 1 (ensures input will be loaded)
    // 2. nextInputNumber (maintains sequence)
    // 3. last input number + 1 (fallback)
    const processedNum = engine.processedInputNumber ?? -1;
    const nextFromEngine = engine.nextInputNumber ?? 0;
    const nextFromLastInput = lastInput ? lastInput.number + 1 : 0;
    
    let nextNumber = Math.max(
      processedNum + 1,
      nextFromEngine,
      nextFromLastInput
    );
    
    console.log(`Starting batch registration:`, {
      processedInputNumber: processedNum,
      engineNextInputNumber: nextFromEngine,
      lastInputNumber: lastInput?.number ?? -1,
      calculatedNextNumber: nextNumber
    });
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
    
    console.log(`Created ${inputIds.length} inputs for batch processing with numbers ${nextNumber - inputIds.length} to ${nextNumber - 1}`);
    
    // CRITICAL: Update the engine's nextInputNumber to maintain synchronization
    await ctx.db.patch(worldStatus.engineId, { 
      nextInputNumber: nextNumber 
    });
    console.log(`Updated engine nextInputNumber to ${nextNumber}`);
    
    // Now start or kick the engine AFTER inputs are created
    const updatedEngine = await ctx.db.get(worldStatus.engineId);
    if (updatedEngine) {
      if (!updatedEngine.running) {
        console.log(`Starting engine ${worldStatus.engineId} after creating inputs`);
        await ctx.db.patch(worldStatus.engineId, { running: true });
        
        // Schedule the engine to run
        await ctx.scheduler.runAfter(0, internal.aiTown.main.runStep, {
          worldId: args.worldId,
          generationNumber: updatedEngine.generationNumber,
          maxDuration: 60000,
        });
      } else {
        // Engine is already running, check if it's active
        const now = Date.now();
        const engineAge = updatedEngine.currentTime ? now - updatedEngine.currentTime : Infinity;
        
        // Only kick if engine seems stalled (no activity for > 5 seconds)
        if (engineAge > 5000) {
          console.log(`Engine ${worldStatus.engineId} seems stalled (${Math.round(engineAge / 1000)}s old), kicking to process new inputs`);
          await ctx.scheduler.runAfter(0, internal.aiTown.main.runStep, {
            worldId: args.worldId,
            generationNumber: updatedEngine.generationNumber,
            maxDuration: 10000, // Short duration just to process the new inputs
          });
        } else {
          console.log(`Engine ${worldStatus.engineId} is already running actively (${Math.round(engineAge / 1000)}s old), inputs will be processed`);
        }
      }
    }
    
    return {
      processed: pendingRegistrations.length,
      registrationIds,
      inputIds,
      engineState: {
        nextInputNumber: nextNumber,
        processedInputNumber: updatedEngine?.processedInputNumber,
        running: updatedEngine?.running,
      }
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
    const now = Date.now();
    const STUCK_TIMEOUT = 10 * 60 * 1000; // 10 minutes
    
    for (const reg of processingRegistrations) {
      // Check if registration is stuck (processing for more than 10 minutes)
      if (reg.processedAt && (now - reg.processedAt) > STUCK_TIMEOUT) {
        console.log(`Registration ${reg._id} stuck for ${Math.round((now - reg.processedAt) / 1000)}s, clearing...`);
        await ctx.db.patch(reg._id, {
          status: 'failed',
          completedAt: now,
          error: `Cleared as stuck after ${Math.round((now - reg.processedAt) / 1000)}s`,
        });
        updatedCount++;
        continue;
      }
      // Check if the input has been processed
      if (reg.result?.inputId) {
        const input = await ctx.db.get(reg.result.inputId);
        
        if (!input) {
          console.error(`Input ${reg.result.inputId} not found for registration ${reg._id}`);
          continue;
        }
        
        // Log input status for debugging
        console.log(`Checking input ${reg.result.inputId} for registration ${reg._id}: number=${input.number}, has returnValue=${!!input.returnValue}`);
        
        if (input.returnValue) {
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
            
            // Initialize bot experience at level 1
            if (reg.aiArenaBotId && returnValue.value.playerId) {
              // @ts-ignore - TypeScript depth issue
              await ctx.runMutation(internal.aiTown.idleGains.initializeBotExperience, {
                worldId: reg.worldId,
                playerId: returnValue.value.playerId,
                aiArenaBotId: reg.aiArenaBotId,
              });
            }
            
            updatedCount++;
            console.log(`✅ Registration ${reg._id} completed: agent=${returnValue.value.agentId}, player=${returnValue.value.playerId}`);
          } else if (returnValue.kind === 'error') {
            // Error - mark as failed
            await ctx.db.patch(reg._id, {
              status: 'failed',
              completedAt: Date.now(),
              error: returnValue.message,
              retryCount: (reg.retryCount || 0) + 1,
            });
            updatedCount++;
            console.log(`❌ Registration ${reg._id} failed: ${returnValue.message}`);
          }
        } else {
          // Input exists but hasn't been processed yet
          const timeSinceProcessing = now - (reg.processedAt || 0);
          console.log(`⏳ Input ${reg.result.inputId} for registration ${reg._id} still processing (${Math.round(timeSinceProcessing / 1000)}s)`);
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
    const worlds = await ctx.runQuery(internal.migrations.batchRegistration.getWorldsWithPendingRegistrations);
    
    for (const worldId of worlds) {
      // Process batch for each world
      // @ts-ignore - TypeScript has issues with deep type instantiation here
      await ctx.runMutation(internal.migrations.batchRegistration.processBatchRegistrations, {
        worldId: worldId as Id<'worlds'>,
      });
    }
    
    // Update statuses of processing registrations
    // @ts-ignore - TypeScript has issues with deep type instantiation here
    await ctx.runMutation(internal.migrations.batchRegistration.updateRegistrationStatuses);
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
        internal.migrations.batchRegistration.processBatchRegistrations,
        { worldId: args.worldId }
      );
      
      // Update statuses
      await ctx.runMutation(
        internal.migrations.batchRegistration.updateRegistrationStatuses,
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
          internal.migrations.batchRegistration.processBatchRegistrations,
          { worldId: worldStatus.worldId }
        );
        
        await ctx.runMutation(
          internal.migrations.batchRegistration.updateRegistrationStatuses,
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

// Clear all stuck registrations
export const clearStuckRegistrations = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all pending and processing registrations
    const stuckRegistrations = await ctx.db
      .query('pendingBotRegistrations')
      .collect();
    
    let clearedCount = 0;
    for (const reg of stuckRegistrations) {
      if (reg.status === 'pending' || reg.status === 'processing') {
        await ctx.db.delete(reg._id);
        clearedCount++;
        console.log(`Cleared stuck registration for bot: ${reg.aiArenaBotId}`);
      }
    }
    
    return { cleared: clearedCount };
  },
});