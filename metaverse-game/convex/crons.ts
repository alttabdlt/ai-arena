import { cronJobs } from 'convex/server';
import { DELETE_BATCH_SIZE, IDLE_WORLD_TIMEOUT, VACUUM_MAX_AGE } from './constants';
import { internal } from './_generated/api';
import { internalMutation } from './_generated/server';
import { TableNames } from './_generated/dataModel';
import { v } from 'convex/values';

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

export default crons;

const TablesToVacuum: TableNames[] = [
  // Un-comment this to also clean out old conversations.
  // 'conversationMembers', 'conversations', 'messages',

  // Inputs aren't useful unless you're trying to replay history.
  // If you want to support that, you should add a snapshot table, so you can
  // replay from a certain time period. Or stop vacuuming inputs and replay from
  // the beginning of time
  'inputs',

  // We can keep memories without their embeddings for inspection, but we won't
  // retrieve them when searching memories via vector search.
  'memories',
  // We can vacuum fewer tables without serious consequences, but the only
  // one that will cause issues over time is having >>100k vectors.
  'memoryEmbeddings',
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
