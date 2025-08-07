import { v } from 'convex/values';
import { query } from './_generated/server';

/**
 * Get the default world for bot deployment
 * Used by the backend discovery service
 */
export const getDefaultWorld = query({
  args: {},
  handler: async (ctx) => {
    // Find the default world
    const worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    
    if (!worldStatus) {
      return null;
    }
    
    // Get the world to ensure it exists
    const world = await ctx.db.get(worldStatus.worldId);
    if (!world) {
      return null;
    }
    
    return {
      worldId: worldStatus.worldId,
      status: worldStatus.status,
      engineId: worldStatus.engineId,
      agentCount: world.agents.length,
      playerCount: world.players.length,
    };
  },
});

/**
 * Get world by channel (for future multi-world support)
 */
export const getWorldByChannel = query({
  args: {
    channel: v.string(),
  },
  handler: async (ctx, args) => {
    // For now, return default world for any channel
    // In future, this will look up channel-specific worlds
    const worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    
    if (!worldStatus) {
      return null;
    }
    
    const world = await ctx.db.get(worldStatus.worldId);
    if (!world) {
      return null;
    }
    
    return {
      worldId: worldStatus.worldId,
      status: worldStatus.status,
      engineId: worldStatus.engineId,
      agentCount: world.agents.length,
      playerCount: world.players.length,
    };
  },
});

/**
 * Get all active worlds
 */
export const getAllWorlds = query({
  args: {},
  handler: async (ctx) => {
    const worldStatuses = await ctx.db
      .query('worldStatus')
      .collect();
    
    const worlds = await Promise.all(
      worldStatuses.map(async (status) => {
        const world = await ctx.db.get(status.worldId);
        if (!world) return null;
        
        return {
          worldId: status.worldId,
          isDefault: status.isDefault,
          status: status.status,
          engineId: status.engineId,
          agentCount: world.agents.length,
          playerCount: world.players.length,
          createdAt: status.lastViewed,
        };
      })
    );
    
    return worlds.filter(w => w !== null);
  },
});

/**
 * Check if a world exists and is active
 */
export const validateWorld = query({
  args: {
    worldId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Validate format
      if (!args.worldId || args.worldId.length !== 32) {
        return { valid: false, error: 'Invalid world ID format' };
      }
      
      // Try to get the world
      const world = await ctx.db.get(args.worldId as any);
      if (!world) {
        return { valid: false, error: 'World not found' };
      }
      
      // Check if world has the expected structure
      if (!('agents' in world) || !('players' in world)) {
        return { valid: false, error: 'Invalid world structure' };
      }
      
      // Check world status
      const worldStatus = await ctx.db
        .query('worldStatus')
        .withIndex('worldId', (q) => q.eq('worldId', args.worldId as any))
        .first();
      
      if (!worldStatus) {
        return { valid: false, error: 'World status not found' };
      }
      
      return {
        valid: true,
        status: worldStatus.status,
        isDefault: worldStatus.isDefault,
        agentCount: (world as any).agents.length,
        playerCount: (world as any).players.length,
      };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  },
});