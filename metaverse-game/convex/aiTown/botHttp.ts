import { v } from 'convex/values';
import { httpAction, internalMutation, query } from '../_generated/server';
import { api, internal } from '../_generated/api';
import { insertInput } from './insertInput';
import { Id } from '../_generated/dataModel';

// Query to check input status for polling
export const getInputStatus = query({
  args: {
    inputId: v.id('inputs'),
  },
  handler: async (ctx, args) => {
    const input = await ctx.db.get(args.inputId);
    if (!input) {
      throw new Error('Input not found');
    }
    
    return {
      status: input.returnValue ? 'completed' : 'pending',
      returnValue: input.returnValue,
    };
  },
});

// Handle bot registration from AI Arena
export const handleBotRegistration = httpAction(async (ctx, request) => {
  const body = await request.json();
  
  const {
    worldId,
    name,
    character,
    identity,
    plan,
    aiArenaBotId,
    initialZone
  } = body;

  if (!worldId || !name || !character || !identity || !plan || !aiArenaBotId) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // Validate worldId format
  if (typeof worldId !== 'string' || !worldId.match(/^[a-z0-9]{32}$/)) {
    return new Response(JSON.stringify({ error: 'Invalid worldId format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Create the agent via the input system
    const result = await ctx.runMutation(internal.aiTown.botHttp.createBotAgent, {
      worldId,
      name,
      character,
      identity,
      plan,
      aiArenaBotId,
      initialZone: initialZone || 'suburb',
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Bot registration error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// Handle bot position updates
export const handleBotPositionUpdate = httpAction(async (ctx, request) => {
  const body = await request.json();
  
  const { agentId, worldId, position, zone } = body;

  if (!agentId || !worldId || !position || !zone) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Update bot position in the world
    await ctx.runMutation(internal.aiTown.botHttp.updateBotPosition, {
      agentId,
      worldId,
      position,
      zone,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Bot position update error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// Handle bot stats sync
export const handleBotStatsSync = httpAction(async (ctx, request) => {
  const body = await request.json();
  
  const { agentId, worldId, stats } = body;

  if (!agentId || !worldId || !stats) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Sync bot stats
    await ctx.runMutation(internal.aiTown.botHttp.syncBotStats, {
      agentId,
      worldId,
      stats,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Bot stats sync error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// Internal mutation to create a bot agent
export const createBotAgent = internalMutation({
  args: {
    worldId: v.string(), // Accept as string from HTTP
    name: v.string(),
    character: v.string(),
    identity: v.string(),
    plan: v.string(),
    aiArenaBotId: v.string(),
    initialZone: v.string(),
  },
  handler: async (ctx, args) => {
    const { worldId: worldIdStr, name, character, identity, plan, aiArenaBotId, initialZone } = args;
    
    // Validate worldId format and convert to Convex ID type
    // Convex IDs are 32 character strings
    if (!worldIdStr || worldIdStr.length !== 32) {
      throw new Error('Invalid worldId format');
    }
    
    // Cast the string to Convex ID type
    const worldId = worldIdStr as any;
    
    // Get the world to ensure it exists
    const world = await ctx.db.get(worldId);
    if (!world) {
      throw new Error('World not found');
    }

    // Create player and agent via the input system
    const inputId = await insertInput(ctx, worldId, 'createAgentFromAIArena', {
      name,
      character,
      identity,
      plan,
      aiArenaBotId,
      initialZone,
    });
    
    // The input system should process this synchronously
    // Check if the input has been processed
    const processedInput = await ctx.db.get(inputId);
    if (processedInput && processedInput.returnValue) {
      const { agentId, playerId } = processedInput.returnValue as any;
      return { agentId, playerId };
    }
    
    // If not processed immediately, return the inputId so the client can poll
    return { 
      inputId,
      status: 'pending',
      message: 'Agent creation initiated, poll for completion'
    };
  },
});

// Internal mutation to update bot position
export const updateBotPosition = internalMutation({
  args: {
    agentId: v.string(),
    worldId: v.string(), // Accept as string from HTTP
    position: v.object({
      x: v.number(),
      y: v.number(),
    }),
    zone: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate worldId format
    if (!args.worldId || args.worldId.length !== 32) {
      throw new Error('Invalid worldId format');
    }
    const worldId = args.worldId as any;
    // This would update the agent's position in the world
    // For now, we'll just log it
    console.log('Updating bot position:', args);
    
    // TODO: Implement actual position update logic
    // This would involve updating the player's position in the world
    // and possibly triggering zone transition logic
  },
});

// Internal mutation to sync bot stats
export const syncBotStats = internalMutation({
  args: {
    agentId: v.string(),
    worldId: v.string(), // Accept as string from HTTP
    stats: v.object({
      power: v.number(),
      defense: v.number(),
      houseScore: v.number(),
      wins: v.number(),
      losses: v.number(),
      earnings: v.number(),
      activityLevel: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    // Validate worldId format
    if (!args.worldId || args.worldId.length !== 32) {
      throw new Error('Invalid worldId format');
    }
    const worldId = args.worldId as any;
    // Store bot stats in a separate table or as part of agent data
    console.log('Syncing bot stats:', args);
    
    // TODO: Create a botStats table to store these stats
    // For now, we could store them in the agent description
    const agentDesc = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q: any) => q.eq('worldId', args.worldId).eq('agentId', args.agentId))
      .first();
      
    if (agentDesc) {
      // Update the agent description with stats
      await ctx.db.patch(agentDesc._id, {
        // Add stats as custom fields (would need to update schema)
      });
    }
  },
});

// Handle getting bot position
// Handle lootbox sync from AI Arena
export const handleLootboxSync = httpAction(async (ctx, request) => {
  const body = await request.json();
  
  const { aiArenaBotId, lootboxes } = body;

  if (!aiArenaBotId || !lootboxes || !Array.isArray(lootboxes)) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Sync lootboxes for the bot
    const result = await ctx.runMutation(internal.aiTown.botHttp.syncBotLootboxes, {
      aiArenaBotId,
      lootboxes,
    });

    return new Response(JSON.stringify({ 
      success: true, 
      synced: result.count,
      message: 'Lootboxes synced successfully' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Lootbox sync error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

export const handleGetBotPosition = httpAction(async (ctx, request) => {
  try {
    const { worldId, agentId } = await request.json();
    
    if (!worldId || !agentId) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: worldId, agentId' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate worldId format
    if (typeof worldId !== 'string' || !worldId.match(/^[a-z0-9]{32}$/)) {
      return new Response(JSON.stringify({ error: 'Invalid worldId format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get bot position from the world using the query defined below
    const position = await ctx.runQuery(api.aiTown.botHttp.getBotPosition, {
      worldId,
      agentId,
    });

    return new Response(JSON.stringify({ 
      success: true,
      position,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Get bot position error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// Query to get bot position
export const getBotPosition = query({
  args: {
    worldId: v.string(),
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate worldId format
    if (!args.worldId || typeof args.worldId !== 'string') {
      throw new Error('Invalid worldId provided');
    }
    
    // Validate it matches the expected format (32 character alphanumeric)
    if (!args.worldId.match(/^[a-z0-9]{32}$/)) {
      console.error(`Invalid worldId format: ${args.worldId}`);
      throw new Error(`Invalid worldId format: ${args.worldId}`);
    }
    
    const worldId = args.worldId as Id<'worlds'>;
    const world = await ctx.db.get(worldId);
    if (!world) {
      console.error(`World not found with id: ${args.worldId}`);
      throw new Error(`World not found with id: ${args.worldId}`);
    }
    
    // Find the agent in the world
    const agent = world.agents.find((a: any) => a.id === args.agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }
    
    // Get the player associated with this agent
    const player = world.players.find((p: any) => p.id === agent.playerId);
    if (!player) {
      throw new Error('Player not found');
    }
    
    return {
      x: player.position?.x || 0,
      y: player.position?.y || 0,
      zone: player.currentZone || 'suburb',
      worldInstanceId: worldId,
    };
  },
});

// Internal mutation to sync bot lootboxes
export const syncBotLootboxes = internalMutation({
  args: {
    aiArenaBotId: v.string(),
    lootboxes: v.array(v.object({
      id: v.string(),
      rarity: v.string(),
      items: v.array(v.object({
        type: v.string(),
        name: v.string(),
        quantity: v.number(),
        value: v.optional(v.number()),
      })),
      openedAt: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    console.log('Syncing lootboxes for bot:', args.aiArenaBotId);
    
    // Find all worlds and check for this bot
    const worlds = await ctx.db.query('worlds').collect();
    
    for (const world of worlds) {
      // Find agents with this aiArenaBotId in this world
      const agent = world.agents.find((a: any) => a.aiArenaBotId === args.aiArenaBotId);
      
      if (agent) {
        // Found the agent, now sync lootboxes
        for (const lootbox of args.lootboxes) {
          // Check if this lootbox already exists
          const existingItem = await ctx.db
            .query('items')
            .withIndex('owner', (q: any) => q.eq('worldId', world._id).eq('ownerId', agent.playerId))
            .filter(q => q.eq(q.field('itemId'), lootbox.id))
            .first();
            
          if (!existingItem) {
            // Create inventory items for each item in the lootbox
            for (const item of lootbox.items) {
              await ctx.db.insert('items', {
                worldId: world._id,
                ownerId: agent.playerId,
                itemId: `${lootbox.id}_${item.name}`,
                name: item.name,
                type: item.type as any,
                rarity: lootbox.rarity as any,
                powerBonus: 0,
                defenseBonus: 0,
                equipped: false,
                metadata: {
                  description: `From ${lootbox.rarity} lootbox`,
                  tradeable: true,
                },
                createdAt: Date.now(),
              });
            }
          }
        }
        
        return { count: args.lootboxes.length };
      }
    }
    
    throw new Error('Bot not found in any world');
  },
});

// Handle bot deletion from AI Arena
export const handleBotDeletion = httpAction(async (ctx, request) => {
  const body = await request.json();
  
  const { aiArenaBotId } = body;

  if (!aiArenaBotId) {
    return new Response(JSON.stringify({ error: 'Missing required field: aiArenaBotId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Delete the bot from all worlds
    const result = await ctx.runMutation(internal.aiTown.botHttp.deleteBotFromWorlds, {
      aiArenaBotId,
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Bot deleted from metaverse',
      deletedCount: result.deletedCount,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Bot deletion error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// Internal mutation to delete bot from all worlds
export const deleteBotFromWorlds = internalMutation({
  args: {
    aiArenaBotId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log('Deleting bot from all worlds:', args.aiArenaBotId);
    
    let deletedCount = 0;
    
    // Find all worlds
    const worlds = await ctx.db.query('worlds').collect();
    
    for (const world of worlds) {
      // Find agents with this aiArenaBotId in this world
      const agent = world.agents.find((a: any) => a.aiArenaBotId === args.aiArenaBotId);
      
      if (agent) {
        // Remove the agent from the world
        const updatedAgents = world.agents.filter((a: any) => a.id !== agent.id);
        const updatedPlayers = world.players.filter((p: any) => p.id !== agent.playerId);
        
        await ctx.db.patch(world._id, {
          agents: updatedAgents,
          players: updatedPlayers,
        });
        
        // Delete agent description if it exists
        const agentDesc = await ctx.db
          .query('agentDescriptions')
          .withIndex('worldId', (q: any) => q.eq('worldId', world._id).eq('agentId', agent.id))
          .first();
          
        if (agentDesc) {
          await ctx.db.delete(agentDesc._id);
        }
        
        // Delete any inventory items
        const inventoryItems = await ctx.db
          .query('items')
          .withIndex('owner', (q: any) => q.eq('worldId', world._id).eq('ownerId', agent.playerId))
          .collect();
          
        for (const item of inventoryItems) {
          await ctx.db.delete(item._id);
        }
        
        deletedCount++;
      }
    }
    
    return { deletedCount };
  },
});