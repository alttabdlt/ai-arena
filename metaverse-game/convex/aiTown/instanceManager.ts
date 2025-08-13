// TEMPORARILY DISABLED: instanceManager uses zones table which has been removed
// This file manages zone-based instances which aren't implemented yet
// Will be re-enabled when zones are properly implemented

import { v } from 'convex/values';
import { mutation, query } from '../_generated/server';
import { ZoneType, zoneConfig } from './zoneConfig';
// import { Id } from '../_generated/dataModel';

// Stub exports to prevent import errors
export const findAvailableInstance = mutation({
  args: {
    zoneType: ZoneType,
    playerId: v.optional(v.string()),
    preferredRegion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Zones not implemented - return a default response
    const defaultWorldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    
    if (!defaultWorldStatus) {
      throw new Error('No default world found. Please ensure the world is initialized.');
    }
    
    return {
      instanceId: defaultWorldStatus._id,
      worldId: defaultWorldStatus.worldId,
      currentPlayers: 0,
      currentBots: 0,
    };
  },
});

export const createWorldInstance = mutation({
  args: {
    zoneType: ZoneType,
    serverRegion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Zones not implemented - return error
    throw new Error('Zone-based instances not yet implemented');
  },
});

export const updateInstanceCounts = mutation({
  args: {
    instanceId: v.id('worldInstances'),
    playerDelta: v.optional(v.number()),
    botDelta: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Stub implementation
    return {};
  },
});

export const initializeAllZones = mutation({
  handler: async (ctx) => {
    // Zones not implemented - return empty array
    return [];
  },
});

export const getInstanceStats = query({
  handler: async (ctx) => {
    // Return empty stats
    return {};
  },
});

export const distributeBots = mutation({
  args: {
    botPersonality: v.union(v.literal('CRIMINAL'), v.literal('GAMBLER'), v.literal('WORKER')),
    count: v.number(),
  },
  handler: async (ctx, args) => {
    // Zones not implemented - return default
    return { distributed: 0, remaining: args.count };
  },
});

/* ORIGINAL CODE - DISABLED UNTIL ZONES TABLE IS RESTORED

// Find or create an instance for a player to join
export const findAvailableInstance = mutation({
  args: {
    zoneType: ZoneType,
    playerId: v.optional(v.string()),
    preferredRegion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // First try to find an active instance with space
    const activeInstances = await ctx.db
      .query('worldInstances')
      .withIndex('status', (q) => q.eq('status', 'active').eq('zoneType', args.zoneType))
      .collect();
    
    const config = zoneConfig[args.zoneType];
    
    // Find instances with available space
    const availableInstances = activeInstances.filter(
      instance => instance.currentPlayers < config.maxPlayers
    );
    
    if (availableInstances.length === 0) {
      // No available instances, create a new one using the default world
      console.log(`No available instances for zone ${args.zoneType}, creating new instance...`);
      
      // Get the default world instead of creating a new one
      const defaultWorldStatus = await ctx.db
        .query('worldStatus')
        .filter((q) => q.eq(q.field('isDefault'), true))
        .first();
      
      if (!defaultWorldStatus) {
        throw new Error('No default world found. Please ensure the world is initialized.');
      }
      
      const worldId = defaultWorldStatus.worldId;
      
      // Check if zone exists
      let zone = await ctx.db
        .query('zones')
        .withIndex('zoneType', (q) => q.eq('zoneType', args.zoneType))
        .first();
      
      // Create zone if it doesn't exist
      if (!zone) {
        const defaultMap = await ctx.db.query('maps').first();
        if (!defaultMap) {
          throw new Error('No default map found. Please ensure maps are initialized.');
        }
        
        const zoneId = await ctx.db.insert('zones', {
          zoneType: args.zoneType,
          name: args.zoneType.charAt(0).toUpperCase() + args.zoneType.slice(1).replace(/([A-Z])/g, ' $1'),
          mapId: defaultMap._id,
          maxPlayers: 100,
          maxBots: 50,
          currentPlayers: 0,
          currentBots: 0,
        });
        zone = await ctx.db.get(zoneId);
      }
      
      // Count existing instances for this zone
      const existingInstances = await ctx.db
        .query('worldInstances')
        .withIndex('zoneWorld', (q) => q.eq('zoneType', args.zoneType))
        .collect();
      
      const instanceNumber = existingInstances.length + 1;
      
      // Create the world instance using the default world
      const instanceId = await ctx.db.insert('worldInstances', {
        zoneType: args.zoneType,
        worldId, // Use the default world ID
        instanceNumber,
        status: 'active',
        currentPlayers: 0,
        currentBots: 0,
        serverRegion: args.preferredRegion || 'us-west',
        createdAt: Date.now(),
      });
      
      console.log(`Created new instance ${instanceId} for zone ${args.zoneType}`);
      
      return {
        instanceId,
        worldId,
        currentPlayers: 0,
        currentBots: 0,
      };
    }
    
    // Prefer instances with friends or in the same region
    let bestInstance = availableInstances[0];
    
    if (args.preferredRegion) {
      const regionalInstance = availableInstances.find(
        i => i.serverRegion === args.preferredRegion
      );
      if (regionalInstance) {
        bestInstance = regionalInstance;
      }
    }
    
    return {
      instanceId: bestInstance._id,
      worldId: bestInstance.worldId,
      currentPlayers: bestInstance.currentPlayers,
      currentBots: bestInstance.currentBots,
    };
  },
});

// ... rest of original code ...
*/