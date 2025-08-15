import { cronJobs } from 'convex/server';
import { DELETE_BATCH_SIZE, IDLE_WORLD_TIMEOUT, VACUUM_MAX_AGE } from './constants';
import { internal } from './_generated/api';
import { internalMutation } from './_generated/server';
import { TableNames } from './_generated/dataModel';
import { v } from 'convex/values';
import { startEngine, kickEngine } from './aiTown/main';

const crons = cronJobs();

crons.interval(
  'stop inactive worlds',
  { seconds: IDLE_WORLD_TIMEOUT / 1000 },
  // @ts-ignore - TypeScript depth issue
  internal.world.stopInactiveWorlds,
);

crons.interval('restart dead worlds', { seconds: 60 }, 
  // @ts-ignore - TypeScript depth issue
  internal.world.restartDeadWorlds);

crons.daily('vacuum old entries', { hourUTC: 4, minuteUTC: 20 }, 
  // @ts-ignore - TypeScript depth issue
  internal.crons.vacuumOldEntries);

// Process bot registrations every 3 seconds
crons.interval(
  'process bot registrations',
  { seconds: 3 },
  // @ts-ignore - TypeScript depth issue
  internal.migrations.batchRegistration.scheduledBatchProcessor,
);

// Engine health check - ensure engine is running when there are pending registrations
crons.interval(
  'engine health check',
  { seconds: 30 },
  // @ts-ignore - TypeScript depth issue
  internal.crons.ensureEngineRunning,
);

// Process idle XP for all active worlds every 60 seconds
// Reduced frequency to avoid concurrency conflicts with agent operations
crons.interval(
  'tick idle experience',
  { seconds: 60 },
  // @ts-ignore - TypeScript depth issue
  internal.crons.tickIdleExperienceForAllWorlds,
);

// Clean up ghost bots daily at 3 AM UTC
crons.daily(
  'cleanup ghost bots',
  { hourUTC: 3, minuteUTC: 0 },
  // @ts-ignore - TypeScript depth issue
  internal.crons.cleanupGhostBotsDaily,
);

// Clean up stuck inputs every hour
crons.interval(
  'clear stuck inputs',
  { seconds: 3600 }, // Every hour
  // @ts-ignore - TypeScript depth issue
  internal.cleanup.clearStuckInputs.clearStuckInputs,
);

// CRITICAL: Aggressive input cleanup every 30 minutes to prevent accumulation
crons.interval(
  'aggressive input cleanup',
  { minutes: 30 },
  // @ts-ignore - TypeScript depth issue
  internal.cleanup.inputCleanup.aggressiveInputCleanup,
  {} // Empty args object since all args are optional
);

// Clean activity logs every 2 hours (they accumulate fast)
crons.interval(
  'cleanup activity logs',
  { hours: 2 },
  // @ts-ignore - TypeScript depth issue
  internal.crons.cleanupActivityLogs,
);

// Clean up old bot registrations daily at 4 AM UTC
crons.daily(
  'cleanup old registrations',
  { hourUTC: 4, minuteUTC: 0 },
  // @ts-ignore - TypeScript depth issue
  internal.migrations.batchRegistration.cleanupOldRegistrations,
);

// Comprehensive document cleanup - runs every 6 hours
crons.interval(
  'comprehensive document cleanup',
  { hours: 6 },
  // @ts-ignore - TypeScript depth issue
  internal.cleanup.documentCleanup.runFullCleanup,
  {} // Empty args object
);

// System health monitoring - runs every 5 minutes
crons.interval(
  'system health check',
  { minutes: 5 },
  // @ts-ignore - TypeScript depth issue
  internal.monitoring.systemHealth.checkAndAlert,
);

export default crons;

const TablesToVacuum: TableNames[] = [
  // Un-comment this to also clean out old conversations.
  // 'conversationMembers', 'conversations', 'messages',

  // Inputs aren't useful unless you're trying to replay history.
  // If you want to support that, you should add a snapshot table, so you can
  // replay from a certain time period. Or stop vacuuming inputs and replay from
  // the beginning of time
  'inputs',
];

export const vacuumOldEntries = internalMutation({
  args: {},
  handler: async (ctx, args) => {
    const before = Date.now() - VACUUM_MAX_AGE;
    for (const tableName of TablesToVacuum) {
      console.log(`Checking ${tableName}...`);
      const exists = await ctx.db
        .query(tableName)
        .withIndex('by_creation_time', (q) => q.lt('_creationTime', before))
        .first();
      if (exists) {
        console.log(`Vacuuming ${tableName}...`);
        await ctx.scheduler.runAfter(0, internal.crons.vacuumTable, {
          tableName,
          before,
          cursor: null,
          soFar: 0,
        });
      }
    }
  },
});

// Tick idle experience for all active worlds
export const tickIdleExperienceForAllWorlds = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all active worlds
    const worldStatuses = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('status'), 'running'))
      .collect();
    
    console.log(`Processing idle XP for ${worldStatuses.length} active worlds`);
    
    for (const worldStatus of worldStatuses) {
      try {
        // Run the idle XP tick for this world
        await ctx.scheduler.runAfter(0, internal.aiTown.idleLoot.tickIdleExperience, {
          worldId: worldStatus.worldId,
        });
      } catch (error) {
        console.error(`Failed to tick idle XP for world ${worldStatus.worldId}:`, error);
      }
    }
    
    return { worldsProcessed: worldStatuses.length };
  },
});

// Daily cleanup of ghost bots
export const cleanupGhostBotsDaily = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all active worlds
    const worldStatuses = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('status'), 'running'))
      .collect();
    
    console.log(`Running daily ghost bot cleanup for ${worldStatuses.length} active worlds`);
    
    for (const worldStatus of worldStatuses) {
      try {
        // Run the cleanup for this world
        await ctx.scheduler.runAfter(0, internal.migrations.migration.cleanupAllGhostBotsInternal, {
          worldId: worldStatus.worldId,
          dryRun: false,
        });
        console.log(`Scheduled ghost bot cleanup for world ${worldStatus.worldId}`);
      } catch (error) {
        console.error(`Failed to schedule ghost bot cleanup for world ${worldStatus.worldId}:`, error);
      }
    }
    
    return { worldsProcessed: worldStatuses.length };
  },
});

export const vacuumTable = internalMutation({
  args: {
    tableName: v.string(),
    before: v.number(),
    cursor: v.union(v.string(), v.null()),
    soFar: v.number(),
  },
  handler: async (ctx, { tableName, before, cursor, soFar }) => {
    const results = await ctx.db
      .query(tableName as TableNames)
      .withIndex('by_creation_time', (q) => q.lt('_creationTime', before))
      .paginate({ cursor, numItems: DELETE_BATCH_SIZE });
    for (const row of results.page) {
      await ctx.db.delete(row._id);
    }
    if (!results.isDone) {
      await ctx.scheduler.runAfter(0, internal.crons.vacuumTable, {
        tableName,
        before,
        soFar: results.page.length + soFar,
        cursor: results.continueCursor,
      });
    } else {
      console.log(`Vacuumed ${soFar + results.page.length} entries from ${tableName}`);
    }
  },
});

// Clean up old activity logs (they accumulate VERY fast)
export const cleanupActivityLogs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - (4 * 60 * 60 * 1000); // Keep only last 4 hours
    const batchSize = 500;
    let totalDeleted = 0;
    let hasMore = true;
    
    console.log('🧹 Starting activity log cleanup...');
    
    while (hasMore && totalDeleted < 10000) { // Cap at 10k per run
      const oldLogs = await ctx.db
        .query('activityLogs')
        .filter(q => q.lt(q.field('timestamp'), cutoff))
        .take(batchSize);
      
      for (const log of oldLogs) {
        await ctx.db.delete(log._id);
        totalDeleted++;
      }
      
      hasMore = oldLogs.length === batchSize;
    }
    
    console.log(`✅ Deleted ${totalDeleted} old activity logs`);
    return { deleted: totalDeleted };
  },
});

// Ensure engine is running when there are pending registrations
export const ensureEngineRunning = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if there are any pending registrations
    const pendingRegs = await ctx.db
      .query('pendingBotRegistrations')
      .withIndex('status', (q) => q.eq('status', 'pending'))
      .first();
    
    if (!pendingRegs) {
      return { message: 'No pending registrations' };
    }
    
    // Get all world statuses
    const worldStatuses = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .collect();
    
    let enginesProcessed = 0;
    const now = Date.now();
    
    for (const worldStatus of worldStatuses) {
      // Check if world is running
      if (worldStatus.status !== 'running') {
        console.log(`Activating world ${worldStatus.worldId} due to pending registrations`);
        await ctx.db.patch(worldStatus._id, { 
          status: 'running',
          lastViewed: now,
        });
      }
      
      // Check if engine needs to be started or kicked
      const engine = await ctx.db.get(worldStatus.engineId);
      if (engine) {
        if (!engine.running) {
          console.log(`Starting engine ${worldStatus.engineId} due to pending registrations`);
          await startEngine(ctx, worldStatus.worldId);
          enginesProcessed++;
        } else {
          // Check if engine is stalled (no activity for 2 minutes)
          const engineTimeout = now - 120000;
          if (engine.currentTime && engine.currentTime < engineTimeout) {
            console.log(`Kicking stalled engine ${worldStatus.engineId}`);
            await kickEngine(ctx, worldStatus.worldId);
            enginesProcessed++;
          }
        }
      }
    }
    
    return { enginesProcessed };
  },
});
