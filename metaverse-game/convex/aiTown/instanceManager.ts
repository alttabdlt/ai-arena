import { v } from 'convex/values';
import { mutation, query } from '../_generated/server';
import { ZoneType, zoneConfig } from './zoneConfig';
import { Id } from '../_generated/dataModel';

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

// Create a new world instance for a zone
export const createWorldInstance = mutation({
  args: {
    zoneType: ZoneType,
    serverRegion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get the zone configuration
    const zone = await ctx.db
      .query('zones')
      .withIndex('zoneType', (q) => q.eq('zoneType', args.zoneType))
      .first();
    
    if (!zone) {
      throw new Error(`Zone ${args.zoneType} not found`);
    }
    
    // Get the default world instead of creating a new one
    const defaultWorldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    
    if (!defaultWorldStatus) {
      throw new Error('No default world found. Please ensure the world is initialized.');
    }
    
    const worldId = defaultWorldStatus.worldId;
    
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
      serverRegion: args.serverRegion,
      createdAt: Date.now(),
    });
    
    return {
      instanceId,
      worldId,
      instanceNumber,
    };
  },
});

// Update instance player/bot counts
export const updateInstanceCounts = mutation({
  args: {
    instanceId: v.id('worldInstances'),
    playerDelta: v.optional(v.number()),
    botDelta: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const instance = await ctx.db.get(args.instanceId);
    if (!instance) {
      throw new Error('Instance not found');
    }
    
    const newPlayerCount = instance.currentPlayers + (args.playerDelta || 0);
    const newBotCount = instance.currentBots + (args.botDelta || 0);
    
    const config = zoneConfig[instance.zoneType];
    
    // Check if instance should be marked as full
    const status = newPlayerCount >= config.maxPlayers ? 'full' : 'active';
    
    await ctx.db.patch(args.instanceId, {
      currentPlayers: Math.max(0, newPlayerCount),
      currentBots: Math.max(0, newBotCount),
      status,
    });
  },
});

// Initialize instances for all zones (called during setup)
export const initializeAllZones = mutation({
  handler: async (ctx) => {
    const zoneTypes = ['casino', 'darkAlley', 'suburb', 'downtown', 'underground'] as const;
    const results = [];
    
    for (const zoneType of zoneTypes) {
      // Check if zone exists
      let zone = await ctx.db
        .query('zones')
        .withIndex('zoneType', (q) => q.eq('zoneType', zoneType))
        .first();
      
      // Create zone if it doesn't exist
      if (!zone) {
        // First, we need to create or find a map for this zone
        // For now, use the default map for all zones
        const defaultMap = await ctx.db.query('maps').first();
        if (!defaultMap) {
          throw new Error('No default map found. Please ensure maps are initialized.');
        }
        
        const zoneId = await ctx.db.insert('zones', {
          zoneType,
          name: zoneType.charAt(0).toUpperCase() + zoneType.slice(1).replace(/([A-Z])/g, ' $1'),
          mapId: defaultMap._id,
          maxPlayers: 100,
          maxBots: 50,
          currentPlayers: 0,
          currentBots: 0,
        });
        zone = await ctx.db.get(zoneId);
      }
      
      // Check if there's at least one instance for this zone
      const existingInstances = await ctx.db
        .query('worldInstances')
        .withIndex('status', (q) => q.eq('status', 'active').eq('zoneType', zoneType))
        .first();
      
      if (!existingInstances) {
        // Create a new world for this zone
        const worldId = await ctx.db.insert('worlds', {
          agents: [],
          conversations: [],
          players: [],
          nextId: 1,
        });
        
        // Create the world instance
        const instanceId = await ctx.db.insert('worldInstances', {
          zoneType,
          worldId,
          instanceNumber: 1,
          status: 'active',
          currentPlayers: 0,
          currentBots: 0,
          serverRegion: 'us-west',
          createdAt: Date.now(),
        });
        
        results.push({
          zoneType,
          instanceId,
          worldId,
          created: true,
        });
      } else {
        results.push({
          zoneType,
          instanceId: existingInstances._id,
          worldId: existingInstances.worldId,
          created: false,
        });
      }
    }
    
    return results;
  },
});

// Get instance statistics for monitoring
export const getInstanceStats = query({
  handler: async (ctx) => {
    const instances = await ctx.db.query('worldInstances').collect();
    
    const statsByZone: Record<string, {
      totalInstances: number;
      activeInstances: number;
      totalPlayers: number;
      totalBots: number;
      averageLoad: number;
    }> = {};
    
    for (const instance of instances) {
      if (!statsByZone[instance.zoneType]) {
        statsByZone[instance.zoneType] = {
          totalInstances: 0,
          activeInstances: 0,
          totalPlayers: 0,
          totalBots: 0,
          averageLoad: 0,
        };
      }
      
      const stats = statsByZone[instance.zoneType];
      stats.totalInstances++;
      if (instance.status === 'active') {
        stats.activeInstances++;
      }
      stats.totalPlayers += instance.currentPlayers;
      stats.totalBots += instance.currentBots;
    }
    
    // Calculate average load
    for (const [zoneType, stats] of Object.entries(statsByZone)) {
      const config = zoneConfig[zoneType as ZoneType];
      const maxCapacity = stats.totalInstances * config.maxPlayers;
      stats.averageLoad = maxCapacity > 0 ? stats.totalPlayers / maxCapacity : 0;
    }
    
    return statsByZone;
  },
});

// Distribute bots across instances based on personality
export const distributeBots = mutation({
  args: {
    botPersonality: v.union(v.literal('CRIMINAL'), v.literal('GAMBLER'), v.literal('WORKER')),
    count: v.number(),
  },
  handler: async (ctx, args) => {
    // Zone preferences by personality
    const zonePreferences = {
      CRIMINAL: { darkAlley: 0.6, underground: 0.3, casino: 0.1 },
      GAMBLER: { casino: 0.7, underground: 0.2, downtown: 0.1 },
      WORKER: { suburb: 0.7, downtown: 0.2, casino: 0.1 },
    };
    
    const preferences = zonePreferences[args.botPersonality];
    const zones = Object.entries(preferences) as [ZoneType, number][];
    
    // Distribute bots according to preferences
    let remainingBots = args.count;
    
    for (const [zoneType, weight] of zones) {
      const botsForZone = Math.floor(args.count * weight);
      if (botsForZone === 0) continue;
      
      // Find instances for this zone
      const instances = await ctx.db
        .query('worldInstances')
        .withIndex('status', (q) => q.eq('status', 'active').eq('zoneType', zoneType))
        .collect();
      
      if (instances.length === 0) continue;
      
      // Distribute evenly across instances
      const botsPerInstance = Math.floor(botsForZone / instances.length);
      
      for (const instance of instances) {
        const config = zoneConfig[zoneType];
        const availableSpace = config.maxBots - instance.currentBots;
        const botsToAdd = Math.min(botsPerInstance, availableSpace, remainingBots);
        
        if (botsToAdd > 0) {
          await ctx.db.patch(instance._id, {
            currentBots: instance.currentBots + botsToAdd,
          });
          remainingBots -= botsToAdd;
        }
        
        if (remainingBots <= 0) break;
      }
      
      if (remainingBots <= 0) break;
    }
    
    return { distributed: args.count - remainingBots, remaining: remainingBots };
  },
});