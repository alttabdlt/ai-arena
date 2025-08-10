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

// Query to check registration status
export const getRegistrationStatus = query({
  args: {
    registrationId: v.id('pendingBotRegistrations'),
  },
  handler: async (ctx, args) => {
    const registration = await ctx.db.get(args.registrationId);
    if (!registration) {
      throw new Error('Registration not found');
    }
    
    return {
      status: registration.status,
      result: registration.result,
      error: registration.error,
      createdAt: registration.createdAt,
      processedAt: registration.processedAt,
      completedAt: registration.completedAt,
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
    initialZone,
    avatar
  } = body;

  if (!worldId || !name || !character || !identity || !plan || !aiArenaBotId) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // Validate worldId format (Convex IDs are prefixed and 33 chars)
  if (typeof worldId !== 'string' || !worldId.match(/^[a-z0-9]{32,34}$/)) {
    return new Response(JSON.stringify({ error: 'Invalid worldId format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Create the agent via the input system
    // @ts-ignore - TypeScript depth issue with Convex generated types
    const result = await ctx.runMutation(internal.aiTown.botHttp.createBotAgent, {
      worldId,
      name,
      character,
      identity,
      plan,
      aiArenaBotId,
      initialZone: initialZone || 'suburb',
      avatar
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

// Internal mutation to queue a bot agent registration
export const createBotAgent = internalMutation({
  args: {
    worldId: v.string(), // Accept as string from HTTP
    name: v.string(),
    character: v.string(),
    identity: v.string(),
    plan: v.string(),
    aiArenaBotId: v.string(),
    initialZone: v.string(),
    avatar: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { worldId: worldIdStr, name, character, identity, plan, aiArenaBotId, initialZone, avatar } = args;
    
    console.log('createBotAgent called with:', { worldIdStr, name, aiArenaBotId, initialZone });
    
    // Validate worldId format and convert to Convex ID type
    // Convex IDs are 32-34 character strings (with prefixes)
    if (!worldIdStr || worldIdStr.length < 32 || worldIdStr.length > 34) {
      throw new Error(`Invalid worldId format: expected 32-34 chars, got ${worldIdStr.length}`);
    }
    
    // Cast the string to Convex ID type
    const worldId = worldIdStr as any;
    
    // Get the world to ensure it exists
    const world = await ctx.db.get(worldId);
    if (!world) {
      throw new Error('World not found');
    }

    // Check if an agent for this AI Arena bot already exists
    const worldData = world as any;
    if (worldData.agents && Array.isArray(worldData.agents)) {
      const existingAgent = worldData.agents.find(
        (agent: any) => agent.aiArenaBotId === aiArenaBotId
      );
      
      if (existingAgent) {
        console.log(`Agent already exists for AI Arena bot ${aiArenaBotId}: ${existingAgent.id}`);
        const existingPlayer = worldData.players?.find(
          (player: any) => player.id === existingAgent.playerId
        );
        
        if (existingPlayer) {
          console.log(`Returning existing agent ${existingAgent.id} for bot ${aiArenaBotId}`);
          return { 
            agentId: existingAgent.id, 
            playerId: existingPlayer.id,
            message: 'Agent already exists, returning existing IDs'
          };
        }
      }
    }
    
    // Check if there's already a pending registration for this bot
    const existingRegistration = await ctx.db
      .query('pendingBotRegistrations')
      .withIndex('aiArenaBotId', (q) => q.eq('aiArenaBotId', aiArenaBotId))
      .first();
    
    if (existingRegistration) {
      console.log(`Registration already exists for bot ${aiArenaBotId}: ${existingRegistration._id}`);
      
      // If it's completed, return the result
      if (existingRegistration.status === 'completed' && existingRegistration.result) {
        return {
          agentId: existingRegistration.result.agentId,
          playerId: existingRegistration.result.playerId,
          message: 'Registration completed, returning result'
        };
      }
      
      // Otherwise return pending status
      return {
        registrationId: existingRegistration._id,
        status: existingRegistration.status,
        message: `Registration is ${existingRegistration.status}`
      };
    }
    
    // Queue the registration for batch processing
    const registrationId = await ctx.db.insert('pendingBotRegistrations', {
      worldId,
      name,
      character,
      identity,
      plan,
      aiArenaBotId,
      initialZone,
      avatar,
      status: 'pending',
      createdAt: Date.now(),
    });
    
    console.log(`Queued registration for bot ${aiArenaBotId}: ${registrationId}`);
    
    // Return the registration ID for tracking
    return {
      registrationId,
      status: 'pending',
      message: 'Registration queued for batch processing'
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

    // First check if the world exists
    try {
      // @ts-ignore - TypeScript has issues with deep type instantiation here
      const worldCheck = await ctx.runQuery(api.world.worldExists, {
        worldId,
      });
      
      if (!worldCheck) {
        return new Response(JSON.stringify({ 
          error: 'World not found' 
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (worldError) {
      // World doesn't exist
      return new Response(JSON.stringify({ 
        error: 'World not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Get bot position from the world using the query defined below
    // @ts-ignore - TypeScript has issues with deep type instantiation here
    const position = await ctx.runQuery(api.aiTown.botHttp.getBotPosition, {
      worldId,
      agentId,
    });

    if (!position) {
      return new Response(JSON.stringify({ 
        error: 'Agent not found in world' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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
      console.error('Invalid worldId provided:', args.worldId);
      return null; // Return null instead of throwing
    }
    
    // Validate it matches the expected format (32 character alphanumeric)
    if (!args.worldId.match(/^[a-z0-9]{32}$/)) {
      console.error(`Invalid worldId format: ${args.worldId}`);
      return null; // Return null instead of throwing
    }
    
    const worldId = args.worldId as Id<'worlds'>;
    const world = await ctx.db.get(worldId);
    if (!world) {
      console.error(`World not found with id: ${args.worldId}`);
      return null; // Return null instead of throwing
    }
    
    // Find the agent in the world - first by direct ID, then by aiArenaBotId
    let agent = world.agents.find((a: any) => a.id === args.agentId);
    
    // If not found by agent ID, try searching by aiArenaBotId
    if (!agent) {
      agent = world.agents.find((a: any) => a.aiArenaBotId === args.agentId);
    }
    
    if (!agent) {
      console.log(`Agent not found: ${args.agentId} in world ${args.worldId}`);
      return null; // Return null instead of throwing
    }
    
    // Get the player associated with this agent
    const player = world.players.find((p: any) => p.id === agent!.playerId);
    if (!player) {
      console.error(`Player not found for agent: ${agent.id}`);
      return null; // Return null instead of throwing
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
    const cleanupResults: any[] = [];
    
    // Find all worlds
    const worlds = await ctx.db.query('worlds').collect();
    
    for (const world of worlds) {
      // Find agents with this aiArenaBotId in this world
      const agent = world.agents.find((a: any) => a.aiArenaBotId === args.aiArenaBotId);
      
      if (agent) {
        console.log(`Found bot ${args.aiArenaBotId} in world ${world._id}, cleaning up...`);
        
        // First, perform comprehensive cleanup of all related data
        // This handles messages, conversations, relationships, activity logs, etc.
        try {
          // Import the cleanup helper function
          const { comprehensivePlayerCleanupHelper } = await import('../cleanup/orphanCleanup');
          
          const cleanupResult = await comprehensivePlayerCleanupHelper(
            ctx,
            world._id,
            agent.playerId,
            false // Don't keep activity logs for deleted bots
          );
          
          cleanupResults.push({
            worldId: world._id,
            playerId: agent.playerId,
            cleanup: cleanupResult
          });
          
          console.log(`Cleanup results for ${agent.playerId}:`, cleanupResult);
        } catch (cleanupError) {
          console.error(`Failed to cleanup player data for ${agent.playerId}:`, cleanupError);
        }
        
        // Delete agent description if it exists
        const agentDesc = await ctx.db
          .query('agentDescriptions')
          .withIndex('worldId', (q: any) => q.eq('worldId', world._id).eq('agentId', agent.id))
          .first();
          
        if (agentDesc) {
          await ctx.db.delete(agentDesc._id);
        }
        
        // Delete bot experience records
        const botExperience = await ctx.db
          .query('botExperience')
          .withIndex('aiArenaBotId', (q: any) => 
            q.eq('worldId', world._id).eq('aiArenaBotId', args.aiArenaBotId)
          )
          .first();
          
        if (botExperience) {
          await ctx.db.delete(botExperience._id);
        }
        
        // Delete player description (if not already deleted by cleanup)
        const playerDesc = await ctx.db
          .query('playerDescriptions')
          .withIndex('worldId', (q: any) => 
            q.eq('worldId', world._id).eq('playerId', agent.playerId)
          )
          .first();
          
        if (playerDesc) {
          await ctx.db.delete(playerDesc._id);
        }
        
        // Delete any inventory items
        const inventoryItems = await ctx.db
          .query('items')
          .withIndex('owner', (q: any) => q.eq('worldId', world._id).eq('ownerId', agent.playerId))
          .collect();
          
        for (const item of inventoryItems) {
          await ctx.db.delete(item._id);
        }
        
        // Delete any inventory records
        const inventory = await ctx.db
          .query('inventories')
          .withIndex('player', (q: any) => 
            q.eq('worldId', world._id).eq('playerId', agent.playerId)
          )
          .first();
          
        if (inventory) {
          await ctx.db.delete(inventory._id);
        }
        
        // Delete any house records
        const house = await ctx.db
          .query('houses')
          .withIndex('owner', (q: any) => 
            q.eq('worldId', world._id).eq('ownerId', agent.playerId)
          )
          .first();
          
        if (house) {
          await ctx.db.delete(house._id);
        }
        
        // Finally, remove the agent and player from the world arrays
        const updatedAgents = world.agents.filter((a: any) => a.id !== agent.id);
        const updatedPlayers = world.players.filter((p: any) => p.id !== agent.playerId);
        
        await ctx.db.patch(world._id, {
          agents: updatedAgents,
          players: updatedPlayers,
        });
        
        deletedCount++;
        console.log(`✅ Successfully deleted bot ${args.aiArenaBotId} from world ${world._id}`);
      }
    }
    
    return { 
      deletedCount,
      cleanupResults: cleanupResults.length > 0 ? cleanupResults : undefined
    };
  },
});