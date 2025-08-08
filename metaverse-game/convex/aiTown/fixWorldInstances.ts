import { mutation, query } from '../_generated/server';

// Query to check world instances
export const checkWorldInstances = query({
  handler: async (ctx) => {
    // Get default world
    const defaultWorldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    
    if (!defaultWorldStatus) {
      return {
        error: 'No default world found',
        defaultWorldId: null,
        instances: [],
      };
    }
    
    const defaultWorldId = defaultWorldStatus.worldId;
    
    // Get all world instances
    const instances = await ctx.db.query('worldInstances').collect();
    
    const results = instances.map(inst => ({
      id: inst._id,
      zoneType: inst.zoneType,
      worldId: inst.worldId,
      isValid: inst.worldId === defaultWorldId,
      status: inst.status,
      currentPlayers: inst.currentPlayers,
      currentBots: inst.currentBots,
    }));
    
    const invalidCount = results.filter(r => !r.isValid).length;
    
    return {
      defaultWorldId,
      instances: results,
      totalCount: instances.length,
      invalidCount,
      validCount: instances.length - invalidCount,
    };
  },
});

// Mutation to fix all invalid world instances
export const fixInvalidWorldInstances = mutation({
  handler: async (ctx) => {
    // Get default world
    const defaultWorldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    
    if (!defaultWorldStatus) {
      throw new Error('No default world found. Please ensure the world is initialized.');
    }
    
    const defaultWorldId = defaultWorldStatus.worldId;
    
    // Get all world instances
    const instances = await ctx.db.query('worldInstances').collect();
    
    let fixedCount = 0;
    let deletedCount = 0;
    const results = [];
    
    for (const instance of instances) {
      if (instance.worldId !== defaultWorldId) {
        // Check if this instance has any players or bots
        if (instance.currentPlayers > 0 || instance.currentBots > 0) {
          // Update the world ID to the correct one
          await ctx.db.patch(instance._id, {
            worldId: defaultWorldId,
          });
          fixedCount++;
          results.push({
            action: 'updated',
            instanceId: instance._id,
            zoneType: instance.zoneType,
            oldWorldId: instance.worldId,
            newWorldId: defaultWorldId,
          });
          console.log(`Updated instance ${instance._id} (${instance.zoneType}) to use correct world ID`);
        } else {
          // Delete empty instances with wrong world ID
          await ctx.db.delete(instance._id);
          deletedCount++;
          results.push({
            action: 'deleted',
            instanceId: instance._id,
            zoneType: instance.zoneType,
            oldWorldId: instance.worldId,
          });
          console.log(`Deleted empty instance ${instance._id} (${instance.zoneType}) with invalid world ID`);
        }
      }
    }
    
    return {
      success: true,
      fixedCount,
      deletedCount,
      totalProcessed: fixedCount + deletedCount,
      results,
      message: `Fixed ${fixedCount} instances and deleted ${deletedCount} empty instances`,
    };
  },
});

// Mutation to delete all world instances (nuclear option)
export const deleteAllWorldInstances = mutation({
  handler: async (ctx) => {
    const instances = await ctx.db.query('worldInstances').collect();
    
    let deletedCount = 0;
    for (const instance of instances) {
      await ctx.db.delete(instance._id);
      deletedCount++;
      console.log(`Deleted instance ${instance._id} (${instance.zoneType})`);
    }
    
    return {
      success: true,
      deletedCount,
      message: `Deleted all ${deletedCount} world instances. They will be recreated with correct world IDs as needed.`,
    };
  },
});

// Mutation to clear stuck registrations related to invalid worlds
export const clearInvalidWorldRegistrations = mutation({
  handler: async (ctx) => {
    // Get default world
    const defaultWorldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    
    if (!defaultWorldStatus) {
      throw new Error('No default world found');
    }
    
    const defaultWorldId = defaultWorldStatus.worldId;
    
    // Get all pending bot registrations
    const registrations = await ctx.db
      .query('pendingBotRegistrations')
      .collect();
    
    let clearedCount = 0;
    for (const reg of registrations) {
      // If the registration has an invalid world ID, delete it
      if (reg.worldId !== defaultWorldId) {
        await ctx.db.delete(reg._id);
        clearedCount++;
        console.log(`Cleared registration ${reg._id} for bot ${reg.aiArenaBotId} with invalid world ID`);
      }
    }
    
    return {
      success: true,
      clearedCount,
      message: `Cleared ${clearedCount} registrations with invalid world IDs`,
    };
  },
});