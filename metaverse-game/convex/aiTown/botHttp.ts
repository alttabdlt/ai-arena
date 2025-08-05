import { v } from 'convex/values';
import { httpAction, internalMutation } from '../_generated/server';
import { internal } from '../_generated/api';
import { insertInput } from './insertInput';

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
    // Update bot stats
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

    // Parse the agent ID to get the numeric ID
    const agentNumericId = parseInt(agentId.split(':')[1], 10);
    if (isNaN(agentNumericId)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid agent ID format' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate worldId format and convert to ID
    if (!worldId || worldId.length !== 32) {
      return new Response(JSON.stringify({ 
        error: 'Invalid worldId format' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // For HTTP actions, we'll use a simpler approach
    // In a real implementation, you'd want to add a proper query endpoint
    // For now, return a placeholder response
    return new Response(JSON.stringify({
      position: {
        x: Math.floor(Math.random() * 50),
        y: Math.floor(Math.random() * 50),
      },
      zone: 'downtown', // Default zone for now
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error getting bot position:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to get bot position' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// Internal mutation to sync lootboxes
export const syncBotLootboxes = internalMutation({
  args: {
    aiArenaBotId: v.string(),
    lootboxes: v.array(
      v.object({
        id: v.string(),
        rarity: v.union(
          v.literal('COMMON'),
          v.literal('UNCOMMON'),
          v.literal('RARE'),
          v.literal('EPIC'),
          v.literal('LEGENDARY')
        ),
        equipmentRewards: v.array(
          v.object({
            name: v.string(),
            type: v.union(
              v.literal('WEAPON'),
              v.literal('ARMOR'),
              v.literal('TOOL'),
              v.literal('ACCESSORY')
            ),
            rarity: v.string(),
            powerBonus: v.number(),
            defenseBonus: v.number(),
          })
        ),
        furnitureRewards: v.array(
          v.object({
            name: v.string(),
            type: v.union(
              v.literal('DECORATION'),
              v.literal('FUNCTIONAL'),
              v.literal('DEFENSIVE'),
              v.literal('TROPHY')
            ),
            rarity: v.string(),
            scoreBonus: v.number(),
            defenseBonus: v.number(),
          })
        ),
        currencyReward: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { aiArenaBotId, lootboxes } = args;
    
    // Find all agents with this aiArenaBotId across all worlds
    const agentDescriptions = await ctx.db
      .query('agentDescriptions')
      .collect();
    
    // Find agents that match this AI Arena bot
    let processedCount = 0;
    
    for (const agentDesc of agentDescriptions) {
      const world = await ctx.db.get(agentDesc.worldId);
      if (!world) continue;
      
      const agent = world.agents.find(a => a.id === agentDesc.agentId && a.aiArenaBotId === aiArenaBotId);
      if (agent) {
        const player = world.players.find(p => p.id === agent.playerId);
        if (!player) continue;
        
        // Process each lootbox
        for (const lootbox of lootboxes) {
          // Add lootbox to queue for processing
          await ctx.db.insert('lootboxQueue', {
            worldId: agentDesc.worldId,
            playerId: agent.playerId,
            aiArenaBotId: aiArenaBotId,
            lootboxId: lootbox.id,
            rarity: lootbox.rarity,
            rewards: [
              ...lootbox.equipmentRewards.map(e => ({
                itemId: `${lootbox.id}-${e.name.replace(/\s+/g, '-').toLowerCase()}`,
                name: e.name,
                type: e.type,
                rarity: e.rarity,
                stats: {
                  powerBonus: e.powerBonus,
                  defenseBonus: e.defenseBonus,
                  scoreBonus: undefined,
                },
              })),
              ...lootbox.furnitureRewards.map(f => ({
                itemId: `${lootbox.id}-${f.name.replace(/\s+/g, '-').toLowerCase()}`,
                name: f.name,
                type: 'FURNITURE',
                rarity: f.rarity,
                stats: {
                  powerBonus: 0,
                  defenseBonus: f.defenseBonus,
                  scoreBonus: f.scoreBonus,
                },
              })),
            ],
            processed: false,
            createdAt: Date.now(),
          });
          
          // Ensure player has an inventory
          let inventory = await ctx.db
            .query('inventories')
            .withIndex('player', q => q.eq('worldId', agentDesc.worldId).eq('playerId', agent.playerId))
            .first();
            
          if (!inventory) {
            // Create inventory for this player
            await ctx.db.insert('inventories', {
              worldId: agentDesc.worldId,
              playerId: agent.playerId,
              maxSlots: 50, // Default inventory size
              usedSlots: 0,
              lastUpdated: Date.now(),
              totalValue: 0,
            });
          }
          
          // Log activity
          await ctx.db.insert('activityLogs', {
            worldId: agentDesc.worldId,
            playerId: agent.playerId,
            agentId: agent.id,
            aiArenaBotId: aiArenaBotId,
            timestamp: Date.now(),
            type: 'item_collected',
            description: `Received ${lootbox.rarity} lootbox with ${lootbox.equipmentRewards.length + lootbox.furnitureRewards.length} items`,
            emoji: '📦',
            details: {
              item: `${lootbox.rarity} Lootbox`,
              amount: lootbox.equipmentRewards.length + lootbox.furnitureRewards.length,
            },
          });
        }
        processedCount++;
      }
    }
    
    return { count: processedCount };
  },
});

// Handle bot deletion from AI Arena
export const handleBotDeletion = httpAction(async (ctx, request) => {
  const body = await request.json();
  
  const { worldId, agentId, aiArenaBotId } = body;

  if (!worldId || !agentId || !aiArenaBotId) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Delete the agent via internal mutation
    const result = await ctx.runMutation(internal.aiTown.botHttp.deleteBotAgent, {
      worldId,
      agentId,
      aiArenaBotId,
    });

    return new Response(JSON.stringify(result), {
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

// Internal mutation to delete a bot agent
export const deleteBotAgent = internalMutation({
  args: {
    worldId: v.string(),
    agentId: v.string(),
    aiArenaBotId: v.string(),
  },
  handler: async (ctx, args) => {
    const { worldId: worldIdStr, agentId, aiArenaBotId } = args;
    
    // Validate worldId format
    if (!worldIdStr || worldIdStr.length !== 32) {
      throw new Error('Invalid worldId format');
    }
    
    const worldId = worldIdStr as any;
    
    // Get the world
    const world = await ctx.db.get(worldId);
    if (!world) {
      throw new Error('World not found');
    }
    
    // Cast world to have the proper structure
    const worldData = world as any;

    // Find the agent in the world
    const agent = worldData.agents?.find((a: any) => a.id === agentId && a.aiArenaBotId === aiArenaBotId);
    if (!agent) {
      throw new Error('Agent not found in world');
    }

    // Delete related data first
    
    // 1. Delete agent descriptions
    const agentDesc = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q: any) => q.eq('worldId', worldId).eq('agentId', agentId))
      .first();
    if (agentDesc) {
      await ctx.db.delete(agentDesc._id);
    }

    // 2. Delete from archived conversations involving this player
    const archivedConversations = await ctx.db
      .query('archivedConversations')
      .withIndex('worldId', (q: any) => q.eq('worldId', worldId))
      .collect();
    
    for (const conv of archivedConversations) {
      if (conv.participants.includes(agent.playerId)) {
        await ctx.db.delete(conv._id);
      }
    }

    // 3. Delete activity logs for this player
    const activityLogs = await ctx.db
      .query('activityLogs')
      .withIndex('player', (q: any) => q.eq('worldId', worldId).eq('playerId', agent.playerId))
      .collect();
    
    for (const log of activityLogs) {
      await ctx.db.delete(log._id);
    }

    // 4. Delete inventory
    const inventory = await ctx.db
      .query('inventories')
      .withIndex('player', (q: any) => q.eq('worldId', worldId).eq('playerId', agent.playerId))
      .first();
    if (inventory) {
      await ctx.db.delete(inventory._id);
    }

    // 5. Delete items
    const items = await ctx.db
      .query('items')
      .withIndex('owner', (q: any) => q.eq('worldId', worldId).eq('ownerId', agent.playerId))
      .collect();
    
    for (const item of items) {
      await ctx.db.delete(item._id);
    }

    // 6. Delete houses
    const houses = await ctx.db
      .query('houses')
      .withIndex('owner', (q: any) => q.eq('worldId', worldId).eq('ownerId', agent.playerId))
      .collect();
    
    for (const house of houses) {
      await ctx.db.delete(house._id);
    }

    // 7. Delete lootbox queue entries
    const lootboxes = await ctx.db
      .query('lootboxQueue')
      .withIndex('player', (q: any) => q.eq('worldId', worldId).eq('playerId', agent.playerId))
      .collect();
    
    for (const lootbox of lootboxes) {
      await ctx.db.delete(lootbox._id);
    }

    // 8. Remove agent from world arrays
    const updatedAgents = worldData.agents?.filter((a: any) => a.id !== agentId) || [];
    const updatedPlayers = worldData.players?.filter((p: any) => p.id !== agent.playerId) || [];
    const updatedConversations = worldData.conversations?.filter((c: any) => 
      !c.participants?.includes(agent.playerId)
    ) || [];
    
    await ctx.db.patch(worldId, {
      agents: updatedAgents,
      players: updatedPlayers,
      conversations: updatedConversations,
    });

    // 9. Archive the agent and player if needed
    await ctx.db.insert('archivedAgents', {
      worldId,
      ...agent
    });
    
    const player = worldData.players?.find((p: any) => p.id === agent.playerId);
    if (player) {
      await ctx.db.insert('archivedPlayers', {
        worldId,
        ...player
      });
    }

    // Log the deletion
    console.log(`✅ Deleted bot agent: ${agentId} (AI Arena Bot: ${aiArenaBotId})`);

    return {
      success: true,
      message: 'Bot agent deleted successfully',
      deletedAgentId: agentId,
      deletedPlayerId: agent.playerId,
    };
  },
});