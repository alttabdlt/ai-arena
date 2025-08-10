import { v } from 'convex/values';
import { internalMutation, internalQuery } from '../_generated/server';
import { Id } from '../_generated/dataModel';
import { GameId } from './ids';

// Log an activity
export const logActivity = internalMutation({
  args: {
    worldId: v.id('worlds'),
    playerId: v.string(),
    agentId: v.optional(v.string()),
    aiArenaBotId: v.optional(v.string()),
    type: v.union(
      v.literal('zone_change'),
      v.literal('conversation_start'),
      v.literal('conversation_end'),
      v.literal('robbery_attempt'),
      v.literal('combat'),
      v.literal('knocked_out'),
      v.literal('hospital_recovery'),
      v.literal('activity_start'),
      v.literal('activity_end'),
      v.literal('item_collected'),
      v.literal('trade'),
      v.literal('message'),
      v.literal('relationship_milestone'),
      v.literal('marriage'),
      v.literal('friendship_formed'),
      v.literal('rivalry_formed')
    ),
    description: v.string(),
    emoji: v.optional(v.string()),
    details: v.optional(v.object({
      zone: v.optional(v.string()),
      targetPlayer: v.optional(v.string()),
      success: v.optional(v.boolean()),
      amount: v.optional(v.number()),
      item: v.optional(v.string()),
      message: v.optional(v.string()),
      oldStage: v.optional(v.string()),
      newStage: v.optional(v.string()),
      reward: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const logEntry: any = {
      worldId: args.worldId,
      playerId: args.playerId as GameId<'players'>,
      agentId: args.agentId,
      aiArenaBotId: args.aiArenaBotId,
      type: args.type,
      description: args.description,
      emoji: args.emoji,
      timestamp: Date.now(),
    };

    if (args.details) {
      logEntry.details = {
        ...args.details,
        targetPlayer: args.details.targetPlayer as GameId<'players'> | undefined,
      };
    }

    await ctx.db.insert('activityLogs', logEntry);
  },
});

// Query activity logs for a player
export const getActivityLogs = internalQuery({
  args: {
    worldId: v.id('worlds'),
    playerId: v.optional(v.string()),
    agentId: v.optional(v.string()),
    aiArenaBotId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { worldId, playerId, agentId, aiArenaBotId, limit = 50 } = args;

    let query;
    if (aiArenaBotId) {
      query = ctx.db
        .query('activityLogs')
        .withIndex('aiArenaBotId', (q) => 
          q.eq('worldId', worldId).eq('aiArenaBotId', aiArenaBotId)
        );
    } else if (agentId) {
      query = ctx.db
        .query('activityLogs')
        .withIndex('agent', (q) => 
          q.eq('worldId', worldId).eq('agentId', agentId)
        );
    } else if (playerId) {
      query = ctx.db
        .query('activityLogs')
        .withIndex('player', (q) => 
          q.eq('worldId', worldId).eq('playerId', playerId as GameId<'players'>)
        );
    } else {
      // Return all logs for the world
      query = ctx.db
        .query('activityLogs')
        .withIndex('player', (q) => q.eq('worldId', worldId));
    }

    const logs = await query
      .order('desc')
      .take(limit);

    return logs;
  },
});

// Helper to format activity log messages
export function formatActivityLog(log: any): string {
  const emoji = log.emoji || '📝';
  const time = new Date(log.timestamp).toLocaleTimeString();
  
  let message = `${emoji} [${time}] ${log.description}`;
  
  if (log.details) {
    if (log.type === 'robbery_attempt' && log.details.success !== undefined) {
      message += log.details.success ? ' ✅' : ' ❌';
    }
    if (log.details.amount !== undefined) {
      message += ` (${log.details.amount} HYPE)`;
    }
  }
  
  return message;
}