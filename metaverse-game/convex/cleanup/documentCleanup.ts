import { v } from 'convex/values';
import { mutation, query, internalMutation } from '../_generated/server';
import { Doc } from '../_generated/dataModel';
import { internal } from '../_generated/api';

// Analyze document counts by table
export const analyzeDocumentCounts = query({
  args: {},
  handler: async (ctx) => {
    const tables = [
      'inputs',
      'activityLogs', 
      'messages',
      'pendingBotRegistrations',
      'archivedConversations',
      'playerZoneHistory',
      'relationships',
      'participatedTogether'
    ];

    const counts: Record<string, number> = {};
    const oldestDocs: Record<string, Date | null> = {};
    
    for (const table of tables) {
      try {
        // Get count (limited query to avoid hitting 32k limit)
        const docs = await ctx.db.query(table as any).take(1000);
        counts[table] = docs.length;
        
        // Get oldest document
        if (docs.length > 0) {
          const oldestDoc = docs[0] as any;
          oldestDocs[table] = oldestDoc._creationTime ? new Date(oldestDoc._creationTime) : null;
        } else {
          oldestDocs[table] = null;
        }
      } catch (error) {
        counts[table] = -1; // Error indicator
        oldestDocs[table] = null;
      }
    }
    
    return {
      counts,
      oldestDocs,
      totalDocuments: Object.values(counts).reduce((sum, count) => sum + (count > 0 ? count : 0), 0),
      timestamp: new Date().toISOString()
    };
  },
});

// Clean old engine inputs (major culprit)
export const cleanOldInputs = internalMutation({
  args: {
    daysToKeep: v.optional(v.number()),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const daysToKeep = args.daysToKeep ?? 7; // Default 7 days
    const limit = args.limit ?? 500; // Process in batches
    
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    // Get old inputs
    const oldInputs = await ctx.db
      .query('inputs')
      .filter(q => q.lt(q.field('received'), cutoffTime))
      .take(limit);
    
    let deletedCount = 0;
    for (const input of oldInputs) {
      await ctx.db.delete(input._id);
      deletedCount++;
    }
    
    return {
      deletedCount,
      remainingOldInputs: oldInputs.length === limit,
      cutoffDate: new Date(cutoffTime).toISOString()
    };
  },
});

// Clean old activity logs
export const cleanOldActivityLogs = internalMutation({
  args: {
    daysToKeep: v.optional(v.number()),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const daysToKeep = args.daysToKeep ?? 30; // Default 30 days
    const limit = args.limit ?? 500;
    
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    const oldLogs = await ctx.db
      .query('activityLogs')
      .filter(q => q.lt(q.field('timestamp'), cutoffTime))
      .take(limit);
    
    let deletedCount = 0;
    for (const log of oldLogs) {
      await ctx.db.delete(log._id);
      deletedCount++;
    }
    
    return {
      deletedCount,
      remainingOldLogs: oldLogs.length === limit,
      cutoffDate: new Date(cutoffTime).toISOString()
    };
  },
});


// Clean completed bot registrations
export const cleanCompletedRegistrations = internalMutation({
  args: {
    hoursToKeep: v.optional(v.number()),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const hoursToKeep = args.hoursToKeep ?? 24; // Default 24 hours
    const limit = args.limit ?? 100;
    
    const cutoffTime = Date.now() - (hoursToKeep * 60 * 60 * 1000);
    
    // Get completed registrations older than cutoff
    const oldRegistrations = await ctx.db
      .query('pendingBotRegistrations')
      .filter(q => 
        q.and(
          q.eq(q.field('status'), 'completed'),
          q.lt(q.field('_creationTime'), cutoffTime)
        )
      )
      .take(limit);
    
    let deletedCount = 0;
    for (const registration of oldRegistrations) {
      await ctx.db.delete(registration._id);
      deletedCount++;
    }
    
    // Also clean failed registrations older than 7 days
    const failedCutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const failedRegistrations = await ctx.db
      .query('pendingBotRegistrations')
      .filter(q =>
        q.and(
          q.eq(q.field('status'), 'failed'),
          q.lt(q.field('_creationTime'), failedCutoff)
        )
      )
      .take(50);
    
    let failedDeleted = 0;
    for (const registration of failedRegistrations) {
      await ctx.db.delete(registration._id);
      failedDeleted++;
    }
    
    return {
      completedDeleted: deletedCount,
      failedDeleted,
      totalDeleted: deletedCount + failedDeleted,
      cutoffDate: new Date(cutoffTime).toISOString()
    };
  },
});

// Clean old messages from archived conversations
export const cleanArchivedMessages = internalMutation({
  args: {
    daysToKeep: v.optional(v.number()),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const daysToKeep = args.daysToKeep ?? 30; // Default 30 days
    const limit = args.limit ?? 300;
    
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    // Get old archived conversations
    const oldConversations = await ctx.db
      .query('archivedConversations')
      .filter(q => q.lt(q.field('_creationTime'), cutoffTime))
      .take(limit);
    
    let conversationsDeleted = 0;
    let messagesDeleted = 0;
    
    for (const conversation of oldConversations) {
      // Delete associated messages
      const messages = await ctx.db
        .query('messages')
        .filter(q => q.eq(q.field('conversationId'), conversation.id))
        .collect();
      
      for (const message of messages) {
        await ctx.db.delete(message._id);
        messagesDeleted++;
      }
      
      // Delete conversation
      await ctx.db.delete(conversation._id);
      conversationsDeleted++;
    }
    
    return {
      conversationsDeleted,
      messagesDeleted,
      totalDeleted: conversationsDeleted + messagesDeleted,
      cutoffDate: new Date(cutoffTime).toISOString()
    };
  },
});

// Master cleanup function - runs all cleanups
export const runFullCleanup = internalMutation({
  args: {
    aggressive: v.optional(v.boolean()) // More aggressive cleanup if true
  },
  handler: async (ctx, args) => {
    const aggressive = args.aggressive ?? false;
    
    const results = {
      inputs: { deleted: 0 },
      activityLogs: { deleted: 0 },
      registrations: { deleted: 0 },
      messages: { deleted: 0, conversations: 0 },
      totalDeleted: 0
    };
    
    // Clean inputs (7 days normally, 3 days aggressive)
    const inputsResult = await ctx.runMutation(
      internal.cleanup.documentCleanup.cleanOldInputs,
      { daysToKeep: aggressive ? 3 : 7, limit: 1000 }
    );
    results.inputs.deleted = inputsResult.deletedCount;
    
    // Clean activity logs (30 days normally, 14 days aggressive)
    const logsResult = await ctx.runMutation(
      internal.cleanup.documentCleanup.cleanOldActivityLogs,
      { daysToKeep: aggressive ? 14 : 30, limit: 500 }
    );
    results.activityLogs.deleted = logsResult.deletedCount;
    
    // Clean registrations (24 hours normally, 6 hours aggressive)
    const registrationsResult = await ctx.runMutation(
      internal.cleanup.documentCleanup.cleanCompletedRegistrations,
      { hoursToKeep: aggressive ? 6 : 24, limit: 100 }
    );
    results.registrations.deleted = registrationsResult.totalDeleted;
    
    // Clean archived messages (30 days normally, 14 days aggressive)
    const messagesResult = await ctx.runMutation(
      internal.cleanup.documentCleanup.cleanArchivedMessages,
      { daysToKeep: aggressive ? 14 : 30, limit: 200 }
    );
    results.messages.deleted = messagesResult.messagesDeleted;
    results.messages.conversations = messagesResult.conversationsDeleted;
    
    // Calculate total
    results.totalDeleted = 
      results.inputs.deleted +
      results.activityLogs.deleted +
      results.registrations.deleted +
      results.messages.deleted +
      results.messages.conversations;
    
    return {
      ...results,
      mode: aggressive ? 'aggressive' : 'normal',
      timestamp: new Date().toISOString()
    };
  },
});

// Get cleanup status and recommendations
export const getCleanupStatus = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    // Sample counts from each table
    const recommendations = [];
    
    // Check inputs
    const oldInputs = await ctx.db
      .query('inputs')
      .filter(q => q.lt(q.field('received'), now - 7 * 24 * 60 * 60 * 1000))
      .take(100);
    
    if (oldInputs.length === 100) {
      recommendations.push('🚨 HIGH: Many old inputs detected (>7 days). Run cleanOldInputs.');
    }
    
    // Check activity logs
    const oldLogs = await ctx.db
      .query('activityLogs')
      .filter(q => q.lt(q.field('timestamp'), now - 30 * 24 * 60 * 60 * 1000))
      .take(100);
    
    if (oldLogs.length === 100) {
      recommendations.push('⚠️ MEDIUM: Old activity logs detected (>30 days). Run cleanOldActivityLogs.');
    }
    
    // Check completed registrations
    const completedRegs = await ctx.db
      .query('pendingBotRegistrations')
      .filter(q => q.eq(q.field('status'), 'completed'))
      .take(50);
    
    if (completedRegs.length === 50) {
      recommendations.push('📋 LOW: Completed registrations can be cleaned. Run cleanCompletedRegistrations.');
    }
    
    return {
      recommendations,
      suggestedAction: recommendations.length > 2 ? 'Run full cleanup' : 'Run targeted cleanup',
      estimatedDocumentsToClean: recommendations.length * 500,
      timestamp: new Date().toISOString()
    };
  },
});