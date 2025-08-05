import { mutation } from './_generated/server';
import { v } from 'convex/values';
import { Id } from './_generated/dataModel';
import { Descriptions } from '../data/characters';

export const initDefaultWorld = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if a world already exists
    const existingWorld = await ctx.db.query('worlds').first();
    const existingEngine = await ctx.db.query('engines').first();
    
    if (existingWorld && existingEngine) {
      // Check if worldStatus exists
      const worldStatus = await ctx.db.query('worldStatus')
        .filter(q => q.eq(q.field('worldId'), existingWorld._id))
        .first();
      
      if (!worldStatus) {
        // Create worldStatus for existing world
        const statusId = await ctx.db.insert('worldStatus', {
          worldId: existingWorld._id,
          isDefault: true,
          engineId: existingEngine._id,
          status: 'running',
          lastViewed: Date.now(),
        });
        return { worldId: existingWorld._id, statusId, message: 'Added worldStatus to existing world' };
      }
      
      return { worldId: existingWorld._id, message: 'World already exists' };
    }
    
    // Create a new world
    const worldId = await ctx.db.insert('worlds', {
      agents: [],
      conversations: [],
      players: [],
      nextId: 1,
    });
    
    // Create an engine
    const engineId = await ctx.db.insert('engines', {
      currentTime: Date.now(),
      lastStepTs: Date.now(),
      generationNumber: 0,
      running: true,
    });
    
    // Create worldStatus
    const statusId = await ctx.db.insert('worldStatus', {
      worldId,
      isDefault: true,
      engineId,
      status: 'running',
      lastViewed: Date.now(),
    });
    
    // Create world instances for zones
    const zoneTypes = ['casino', 'darkAlley', 'suburb', 'downtown', 'underground'] as const;
    const instances = [];
    
    for (const zoneType of zoneTypes) {
      const instanceId = await ctx.db.insert('worldInstances', {
        zoneType,
        worldId,
        instanceNumber: 1,
        status: 'active',
        currentPlayers: 0,
        currentBots: 0,
        createdAt: Date.now(),
      });
      instances.push({ zoneType, instanceId });
    }
    
    return { 
      worldId, 
      statusId,
      instances,
      message: 'Default world created successfully' 
    };
  },
});

// Helper mutation to create initial agents
export const createInitialAgents = mutation({
  args: {
    numAgents: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const numAgents = args.numAgents || 10;
    
    // Get default world
    const worldStatus = await ctx.db.query('worldStatus')
      .filter(q => q.eq(q.field('isDefault'), true))
      .first();
      
    if (!worldStatus) {
      throw new Error('No default world found. Run initDefaultWorld first.');
    }
    
    const world = await ctx.db.get(worldStatus.worldId);
    if (!world) {
      throw new Error('World not found');
    }
    
    // Create initial agents
    const agentIds = [];
    for (let i = 0; i < numAgents; i++) {
      const description = Descriptions[i % Descriptions.length];
      
      // Simplified agent creation - just add to agentDescriptions
      const agentId = `a:${world.nextId}` as any;
      await ctx.db.insert('agentDescriptions', {
        worldId: worldStatus.worldId,
        agentId,
        identity: description.identity,
        plan: description.plan,
      });
      
      // Update world's nextId
      await ctx.db.patch(world._id, { nextId: world.nextId + 1 });
      
      agentIds.push(agentId);
    }
    
    return {
      message: `Created ${numAgents} agents`,
      agentIds,
      worldId: worldStatus.worldId,
    };
  },
});

// Create initial bot inventories
export const createInitialInventories = mutation({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error('World not found');
    }
    
    // Get all players in the world
    const playerIds = world.players.map(p => p.id);
    const inventoriesCreated = [];
    
    for (const playerId of playerIds) {
      // Check if inventory already exists
      const existing = await ctx.db.query('inventories')
        .withIndex('player', q => q.eq('worldId', args.worldId).eq('playerId', playerId))
        .first();
        
      if (!existing) {
        const inventoryId = await ctx.db.insert('inventories', {
          worldId: args.worldId,
          playerId,
          maxSlots: 50,
          usedSlots: 0,
          totalValue: 0,
          lastUpdated: Date.now(),
        });
        inventoriesCreated.push({ playerId, inventoryId });
      }
    }
    
    return {
      message: `Created ${inventoriesCreated.length} inventories`,
      inventories: inventoriesCreated,
    };
  },
});