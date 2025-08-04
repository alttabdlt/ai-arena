import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { ZoneType } from '../aiTown/zoneConfig';

// Create initial world instances for each zone
export const createWorldInstances = mutation({
  args: {},
  handler: async (ctx) => {
    console.log('Creating initial world instances...');
    
    // Check if we already have instances
    const existingInstances = await ctx.db.query('worldInstances').collect();
    if (existingInstances.length > 0) {
      console.log('World instances already exist');
      return { message: 'World instances already exist', count: existingInstances.length };
    }
    
    // Get or create a default world
    let world = await ctx.db.query('worlds').first();
    if (!world) {
      // Create a default world
      const worldId = await ctx.db.insert('worlds', {
        agents: [],
        conversations: [],
        players: [],
        nextId: 1,
      });
      world = await ctx.db.get(worldId);
    }
    
    if (!world) {
      throw new Error('Could not create world');
    }
    
    // Create instances for each zone type
    const zoneTypes: ZoneType[] = ['casino', 'darkAlley', 'suburb'];
    const instances = [];
    
    for (const zoneType of zoneTypes) {
      const instanceId = await ctx.db.insert('worldInstances', {
        zoneType,
        worldId: world._id,
        instanceNumber: 1,
        status: 'active',
        currentPlayers: 0,
        currentBots: 0,
        createdAt: Date.now(),
      });
      
      instances.push({
        id: instanceId,
        zoneType,
        worldId: world._id,
      });
      
      console.log(`Created instance for zone: ${zoneType}`);
    }
    
    return {
      message: 'World instances created successfully',
      instances,
      worldId: world._id,
    };
  },
});