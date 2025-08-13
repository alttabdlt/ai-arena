import { v } from 'convex/values';
import { query, mutation, internalMutation, internalQuery } from '../_generated/server';
import { MAX_INPUTS_PER_ENGINE, DELETE_BATCH_SIZE } from '../constants';
import { internal } from '../_generated/api';

// Health status levels
export type HealthStatus = 'healthy' | 'degraded' | 'critical' | 'failed';

// System health metrics interface
interface SystemMetrics {
  inputBacklog: {
    total: number;
    unprocessed: number;
    oldestAge: number;
    status: HealthStatus;
  };
  documentCounts: {
    inputs: number;
    activityLogs: number;
    messages: number;
    memories: number;
    total: number;
    percentOfLimit: number;
    status: HealthStatus;
  };
  engineHealth: {
    running: boolean;
    lastStepTime: number;
    timeSinceLastStep: number;
    status: HealthStatus;
  };
  cleanupStatus: {
    lastCleanup: number;
    deletedLastRun: number;
    nextScheduled: number;
    status: HealthStatus;
  };
  overallHealth: HealthStatus;
  alerts: string[];
}

// Shared helper function for system health calculation
async function calculateSystemHealth(ctx: any, worldId?: any): Promise<SystemMetrics | { overallHealth: HealthStatus; alerts: string[]; error: string }> {
  const alerts: string[] = [];
  
  // Get world status
  let worldStatus = null;
  if (worldId) {
    worldStatus = await ctx.db
      .query('worldStatus')
      .withIndex('worldId', (q: any) => q.eq('worldId', worldId))
      .first();
  } else {
    // Get first active world
    worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q: any) => q.eq(q.field('status'), 'running'))
      .first();
  }
  
  if (!worldStatus) {
    return {
      overallHealth: 'failed' as HealthStatus,
      alerts: ['No active world found'],
      error: 'No world instance available'
    };
  }
  
  const engineId = worldStatus.engineId;
  const engine = await ctx.db.get(engineId);
  
  // 1. Check input backlog
  const now = Date.now();
  const inputs = await ctx.db
    .query('inputs')
    .withIndex('byInputNumber', (q: any) => q.eq('engineId', engineId))
    .take(1000);
  
  const unprocessedInputs = inputs.filter((i: any) => !i.returnValue);
  const oldestUnprocessed = unprocessedInputs.length > 0 
    ? Math.min(...unprocessedInputs.map((i: any) => i.received))
    : now;
  
  const inputBacklogAge = now - oldestUnprocessed;
  const inputBacklogStatus: HealthStatus = 
    unprocessedInputs.length < MAX_INPUTS_PER_ENGINE * 0.5 ? 'healthy' :
    unprocessedInputs.length < MAX_INPUTS_PER_ENGINE * 0.8 ? 'degraded' :
    unprocessedInputs.length < MAX_INPUTS_PER_ENGINE ? 'critical' : 'failed';
  
  if (inputBacklogStatus === 'critical' || inputBacklogStatus === 'failed') {
    alerts.push(`🚨 Input backlog critical: ${unprocessedInputs.length}/${MAX_INPUTS_PER_ENGINE}`);
  }
  
  // 2. Check document counts
  const documentCounts = {
    inputs: inputs.length,
    activityLogs: await ctx.db.query('activityLogs').take(1).then((r: any) => r.length * 10000), // Estimate
    messages: await ctx.db.query('messages').take(1).then((r: any) => r.length * 5000), // Estimate
    memories: await ctx.db.query('memories').take(1).then((r: any) => r.length * 1000), // Estimate
  };
  
  const totalDocs = Object.values(documentCounts).reduce((a, b) => a + b, 0);
  const percentOfLimit = (totalDocs / 32000) * 100;
  
  const docCountStatus: HealthStatus = 
    percentOfLimit < 50 ? 'healthy' :
    percentOfLimit < 70 ? 'degraded' :
    percentOfLimit < 90 ? 'critical' : 'failed';
  
  if (docCountStatus === 'critical' || docCountStatus === 'failed') {
    alerts.push(`🚨 Document count critical: ${totalDocs.toLocaleString()} (~${Math.round(percentOfLimit)}% of limit)`);
  }
  
  // 3. Check engine health
  const engineRunning = engine?.running || false;
  const lastStepTime = engine?.currentTime || 0;
  const timeSinceLastStep = now - lastStepTime;
  
  const engineStatus: HealthStatus = 
    engineRunning && timeSinceLastStep < 60000 ? 'healthy' :
    engineRunning && timeSinceLastStep < 300000 ? 'degraded' :
    engineRunning ? 'critical' : 'failed';
  
  if (engineStatus === 'critical' || engineStatus === 'failed') {
    alerts.push(`🚨 Engine ${engineRunning ? 'stalled' : 'stopped'}: ${Math.round(timeSinceLastStep / 1000)}s since last step`);
  }
  
  // 4. Check cleanup status (simplified - would need actual tracking)
  const cleanupStatus = {
    lastCleanup: now - (30 * 60 * 1000), // Assume 30 min ago
    deletedLastRun: 0,
    nextScheduled: now + (30 * 60 * 1000), // Next in 30 min
    status: 'healthy' as HealthStatus
  };
  
  // Determine overall health
  const statuses = [inputBacklogStatus, docCountStatus, engineStatus, cleanupStatus.status];
  const overallHealth: HealthStatus = 
    statuses.includes('failed') ? 'failed' :
    statuses.includes('critical') ? 'critical' :
    statuses.includes('degraded') ? 'degraded' : 'healthy';
  
  // Add warning alerts
  if (inputBacklogAge > 600000) { // 10 minutes
    alerts.push(`⚠️ Oldest unprocessed input is ${Math.round(inputBacklogAge / 60000)} minutes old`);
  }
  
  if (unprocessedInputs.length > 100) {
    alerts.push(`⚠️ High input backlog: ${unprocessedInputs.length} unprocessed inputs`);
  }
  
  const metrics: SystemMetrics = {
    inputBacklog: {
      total: inputs.length,
      unprocessed: unprocessedInputs.length,
      oldestAge: inputBacklogAge,
      status: inputBacklogStatus
    },
    documentCounts: {
      ...documentCounts,
      total: totalDocs,
      percentOfLimit,
      status: docCountStatus
    },
    engineHealth: {
      running: engineRunning,
      lastStepTime,
      timeSinceLastStep,
      status: engineStatus
    },
    cleanupStatus,
    overallHealth,
    alerts
  };
  
  return metrics;
}

// Query to get comprehensive system health metrics
export const getSystemHealth = query({
  args: {
    worldId: v.optional(v.id('worlds')),
  },
  handler: async (ctx, args) => {
    return await calculateSystemHealth(ctx, args.worldId);
  },
});

// Mutation to trigger emergency cleanup
export const triggerEmergencyCleanup = mutation({
  args: {
    confirm: v.boolean(),
    worldId: v.optional(v.id('worlds')),
  },
  handler: async (ctx, args) => {
    if (!args.confirm) {
      return { error: 'Must confirm with confirm: true' };
    }
    
    const cutoff = Date.now() - (2 * 60 * 60 * 1000); // 2 hours
    let totalDeleted = 0;
    
    // Clean old inputs
    const oldInputs = await ctx.db
      .query('inputs')
      .filter(q => q.lt(q.field('received'), cutoff))
      .take(500);
    
    for (const input of oldInputs) {
      await ctx.db.delete(input._id);
      totalDeleted++;
    }
    
    // Clean old activity logs
    const oldLogs = await ctx.db
      .query('activityLogs')
      .filter(q => q.lt(q.field('timestamp'), cutoff))
      .take(500);
    
    for (const log of oldLogs) {
      await ctx.db.delete(log._id);
      totalDeleted++;
    }
    
    // Clean old messages
    const oldMessages = await ctx.db
      .query('messages')
      .take(200);
    
    for (const msg of oldMessages) {
      // Only delete if old (check _creationTime)
      const creationTime = (msg as any)._creationTime;
      if (creationTime && creationTime < cutoff) {
        await ctx.db.delete(msg._id);
        totalDeleted++;
      }
    }
    
    return {
      success: true,
      deleted: totalDeleted,
      message: `Emergency cleanup deleted ${totalDeleted} documents`
    };
  },
});

// Internal query for getting system health from mutations
export const getSystemHealthInternal = internalQuery({
  args: {
    worldId: v.optional(v.id('worlds')),
  },
  handler: async (ctx, args) => {
    // Use the shared helper function
    return await calculateSystemHealth(ctx, args.worldId);
  },
});

// Internal mutation for automated monitoring alerts
export const checkAndAlert = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Directly calculate health instead of calling the internal query
    const health = await calculateSystemHealth(ctx);
    
    // Type guard to check if it's a SystemMetrics object
    if ('overallHealth' in health && (health.overallHealth === 'critical' || health.overallHealth === 'failed')) {
      // Log critical alert to console instead of activity logs
      // Activity logs require a valid worldId which doesn't exist for system-level alerts
      console.error(`🚨 SYSTEM ALERT: Health status is ${health.overallHealth}`, {
        alerts: 'alerts' in health ? health.alerts : [],
        timestamp: Date.now()
      });
      
      // Trigger emergency cleanup if needed
      if ('documentCounts' in health && health.documentCounts.percentOfLimit > 90) {
        console.error('🚨 EMERGENCY: Document limit approaching, triggering cleanup');
        await ctx.scheduler.runAfter(0, internal.monitoring.systemHealth.emergencyCleanupInternal, {});
      }
    }
    
    return health;
  },
});

// Internal emergency cleanup
export const emergencyCleanupInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log('🚨 Running emergency cleanup...');
    
    const cutoff = Date.now() - (60 * 60 * 1000); // 1 hour for emergency
    let totalDeleted = 0;
    const maxToDelete = 5000;
    
    // Aggressively clean inputs
    while (totalDeleted < maxToDelete) {
      const batch = await ctx.db
        .query('inputs')
        .filter(q => q.lt(q.field('received'), cutoff))
        .take(DELETE_BATCH_SIZE);
      
      if (batch.length === 0) break;
      
      for (const doc of batch) {
        await ctx.db.delete(doc._id);
        totalDeleted++;
      }
    }
    
    console.log(`✅ Emergency cleanup deleted ${totalDeleted} documents`);
    return { deleted: totalDeleted };
  },
});

// Query to get alert history
export const getAlertHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    
    const alerts = await ctx.db
      .query('activityLogs')
      .withIndex('player', (q) => q.eq('worldId', '' as any).eq('playerId', 'system' as any))
      .order('desc')
      .take(limit);
    
    return alerts.map(log => ({
      timestamp: log.timestamp,
      message: log.description,
      details: log.details,
    }));
  },
});