import { v } from 'convex/values';
import { api, internal } from '../_generated/api';
import { Id } from '../_generated/dataModel';
import { httpAction, internalMutation, mutation, query } from '../_generated/server';
import { startEngine, kickEngine } from './main';

// Map personality to appropriate character sprites
function getCharacterForPersonality(personality: string): string {
  const personalityUpper = personality.toUpperCase();
  
  // Map based on personality - using only f1-f8 characters from 32x32folk.png
  if (personalityUpper === 'CRIMINAL') {
    // Use f1-f4 for criminals
    const criminalChars = ['f1', 'f2', 'f3', 'f4'];
    return criminalChars[Math.floor(Math.random() * criminalChars.length)];
  } else if (personalityUpper === 'GAMBLER') {
    // Use f5-f6 for gamblers
    const gamblerChars = ['f5', 'f6'];
    return gamblerChars[Math.floor(Math.random() * gamblerChars.length)];
  } else {
    // Use f7-f8 for workers
    const workerChars = ['f7', 'f8'];
    return workerChars[Math.floor(Math.random() * workerChars.length)];
  }
}

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
  const body = await request.json() as {
    worldId: string;
    name: string;
    character: string;
    identity: string;
    plan: string;
    aiArenaBotId: string;
    initialZone?: string;
    avatar?: any;
  };
  
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
  const body = await request.json() as {
    agentId: string;
    worldId: string;
    position: { x: number; y: number };
    zone: string;
  };
  
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
  const body = await request.json() as {
    agentId: string;
    worldId: string;
    stats: any;
  };
  
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

// Public mutation for bot registration (for metaverse backend)
export const registerBot = mutation({
  args: {
    worldId: v.string(),
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
    
    console.log('registerBot called with:', { worldIdStr, name, aiArenaBotId, initialZone });
    
    // Validate worldId format and convert to Convex ID type
    if (!worldIdStr || worldIdStr.length < 32 || worldIdStr.length > 34) {
      throw new Error(`Invalid worldId format: expected 32-34 chars, got ${worldIdStr.length}`);
    }
    
    // Cast the string to Convex ID type
    const worldId = worldIdStr as Id<'worlds'>;
    
    // Get the world to ensure it exists
    const world = await ctx.db.get(worldId);
    if (!world) {
      throw new Error('World not found');
    }
    
    // Ensure the world is active and engine is running
    const worldStatus = await ctx.db
      .query('worldStatus')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .first();
    
    if (worldStatus) {
      const now = Date.now();
      
      // Update last viewed to prevent world from going inactive
      if (!worldStatus.lastViewed || worldStatus.lastViewed < now - 30000) {
        await ctx.db.patch(worldStatus._id, {
          lastViewed: now,
        });
      }
      
      // If world is inactive, activate it
      if (worldStatus.status === 'inactive') {
        console.log(`Activating inactive world ${worldId} for bot registration`);
        await ctx.db.patch(worldStatus._id, { 
          status: 'running',
          lastViewed: now,
        });
        
        // Schedule engine start
        await startEngine(ctx, worldId);
      }
      
      // Check if engine needs to be started or kicked
      const engine = await ctx.db.get(worldStatus.engineId);
      if (engine) {
        if (!engine.running) {
          console.log(`Starting stopped engine ${worldStatus.engineId} for bot registration`);
          await startEngine(ctx, worldId);
        } else {
          // Engine marked as running but might be stalled
          const now = Date.now();
          const engineTimeout = now - 120000; // 2 minutes
          if (engine.currentTime && engine.currentTime < engineTimeout) {
            console.log(`Kicking stalled engine ${worldStatus.engineId}`);
            await kickEngine(ctx, worldId);
          }
        }
      }
    }

    // Check if an agent for this AI Arena bot already exists
    const worldData = world as any;
    if (worldData.agents && Array.isArray(worldData.agents)) {
      const existingAgentRef = worldData.agents.find(
        (agent: any) => agent.aiArenaBotId === aiArenaBotId
      );
      
      if (existingAgentRef) {
        console.log(`Found existing agent for AI Arena bot ${aiArenaBotId}: ${existingAgentRef.id}`);
        
        // Verify the agent actually exists (check if there's a corresponding player)
        const agentIdParts = existingAgentRef.id.split(':');
        let agentExists = false;
        
        // Check if there's a player with the ID from the agent reference
        if (agentIdParts.length === 2 && agentIdParts[0] === 'a') {
          // In this schema, agents have corresponding players
          const correspondingPlayer = worldData.players?.find(
            (player: any) => player.id === existingAgentRef.playerId
          );
          
          if (correspondingPlayer) {
            agentExists = true;
          } else {
            console.log(`Agent ${existingAgentRef.id} has no corresponding player, will create new one`);
            agentExists = false;
          }
        }
        
        if (agentExists) {
          // Agent and player exist, can safely return
          console.log(`Verified existing agent ${existingAgentRef.id} for bot ${aiArenaBotId}`);
          return { 
            agentId: existingAgentRef.id, 
            playerId: existingAgentRef.playerId,
            message: 'Agent already exists, returning existing IDs'
          };
        } else {
          // Agent doesn't exist in database, remove stale reference from world
          console.log(`Removing stale agent reference ${existingAgentRef.id} from world`);
          const updatedAgents = worldData.agents.filter(
            (agent: any) => agent.id !== existingAgentRef.id
          );
          await ctx.db.patch(worldId, { agents: updatedAgents });
          // Continue to create a new agent
        }
      }
    }
    
    // Check if there's already a pending registration for this bot (unless forceNew is true)
    const forceNew = (args as any).forceNew || false;
    
    if (!forceNew) {
      const existingRegistration = await ctx.db
        .query('pendingBotRegistrations')
        .withIndex('aiArenaBotId', (q) => q.eq('aiArenaBotId', aiArenaBotId))
        .first();
      
      if (existingRegistration) {
        // For completed registrations, just return them without validation
        // The agentId format is "a:XXXXX" which is a game engine ID, not a Convex document ID
        // We cannot validate existence this way
        if (existingRegistration.status === 'completed' && existingRegistration.result?.agentId) {
          console.log(`Found existing completed registration for bot ${aiArenaBotId}: ${existingRegistration._id}`);
          return {
            registrationId: existingRegistration._id,
            status: existingRegistration.status,
            message: 'Registration already exists',
            agentId: existingRegistration.result.agentId,
            playerId: existingRegistration.result.playerId
          };
        } else {
          // Registration not completed yet, return it
          console.log(`Found pending registration for bot ${aiArenaBotId}: ${existingRegistration._id}`);
          return {
            registrationId: existingRegistration._id,
            status: existingRegistration.status,
            message: 'Registration already exists'
          };
        }
      }
    } else {
      // Force new registration - delete any existing one
      const existingRegistration = await ctx.db
        .query('pendingBotRegistrations')
        .withIndex('aiArenaBotId', (q) => q.eq('aiArenaBotId', aiArenaBotId))
        .first();
      
      if (existingRegistration) {
        console.log(`Force new registration - deleting existing registration ${existingRegistration._id}`);
        await ctx.db.delete(existingRegistration._id);
      }
    }
    
    // Get personality from identity (it should be mentioned there)
    const personality = identity.toLowerCase().includes('criminal') ? 'CRIMINAL' :
                       identity.toLowerCase().includes('gambler') ? 'GAMBLER' : 'WORKER';
    
    // Use the provided character if valid, otherwise map based on personality
    const validCharacters = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'];
    const validCharacter = validCharacters.includes(character) 
      ? character 
      : getCharacterForPersonality(personality);
    
    console.log(`Bot ${name}: Using character=${validCharacter} (provided=${character}, fallback=${!validCharacters.includes(character)})`);
    
    // Queue the registration for batch processing with valid character
    const registrationId = await ctx.db.insert('pendingBotRegistrations', {
      worldId,
      name,
      character: validCharacter, // Use validated character
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
    forceNew: v.optional(v.boolean()), // Force create new registration even if one exists
  },
  handler: async (ctx, args) => {
    const { worldId: worldIdStr, name, character, identity, plan, aiArenaBotId, initialZone, avatar } = args;
    
    console.log('createBotAgent called with:', { worldIdStr, name, aiArenaBotId, initialZone });
    
    // No pattern-based validation - all bot IDs from AI Arena are valid
    
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
      const existingAgentRef = worldData.agents.find(
        (agent: any) => agent.aiArenaBotId === aiArenaBotId
      );
      
      if (existingAgentRef) {
        console.log(`Found agent reference for AI Arena bot ${aiArenaBotId}: ${existingAgentRef.id}`);
        
        // Verify the agent actually exists by checking for corresponding player
        // This is the ONLY reliable way to know if an agent is valid
        const existingPlayer = worldData.players?.find(
          (player: any) => player.id === existingAgentRef.playerId
        );
        
        if (existingPlayer) {
          // Player exists, so agent is valid
          console.log(`✅ Verified existing agent ${existingAgentRef.id} with player ${existingPlayer.id} for bot ${aiArenaBotId}`);
          
          // Double-check the agent ID format is valid
          const agentIdParts = existingAgentRef.id.split(':');
          if (agentIdParts.length === 2 && agentIdParts[0] === 'a') {
            return { 
              agentId: existingAgentRef.id, 
              playerId: existingPlayer.id,
              message: 'Agent already exists and is valid, returning existing IDs'
            };
          } else {
            console.warn(`⚠️ Agent ${existingAgentRef.id} has invalid format, will recreate`);
          }
        }
        
        // No corresponding player found - agent reference is definitely stale
        console.log(`❌ Agent ${existingAgentRef.id} has no corresponding player - removing stale reference`);
        
        // Remove stale agent reference from world
        const updatedAgents = worldData.agents.filter(
          (agent: any) => agent.id !== existingAgentRef.id
        );
        
        // Also remove orphaned player if it somehow exists without being found above
        let updatedPlayers = worldData.players || [];
        if (existingAgentRef.playerId) {
          updatedPlayers = updatedPlayers.filter(
            (p: any) => p.id !== existingAgentRef.playerId
          );
        }
        
        // Update the world to remove all stale references
        await ctx.db.patch(worldId, {
          agents: updatedAgents,
          players: updatedPlayers,
        });
        
        console.log(`✅ Cleaned up stale agent ${existingAgentRef.id} for bot ${aiArenaBotId}, proceeding with new registration`);
      }
    }
    
    // Check if there's already a pending registration for this bot
    const existingRegistration = await ctx.db
      .query('pendingBotRegistrations')
      .withIndex('aiArenaBotId', (q) => q.eq('aiArenaBotId', aiArenaBotId))
      .first();
    
    if (existingRegistration) {
      console.log(`Registration already exists for bot ${aiArenaBotId}: ${existingRegistration._id} (status: ${existingRegistration.status})`);
      
      // If forceNew is set, delete the existing registration
      if (args.forceNew) {
        console.log(`Force new registration - deleting existing registration ${existingRegistration._id}`);
        await ctx.db.delete(existingRegistration._id);
        // Continue to create a new registration below
      } else {
        // If it's completed, return the result
        if (existingRegistration.status === 'completed' && existingRegistration.result) {
          return {
            agentId: existingRegistration.result.agentId,
            playerId: existingRegistration.result.playerId,
            message: 'Registration completed, returning result'
          };
        }
        
        // If it's failed or stuck in processing for > 5 minutes, delete and recreate
        const now = Date.now();
        const isStuck = (existingRegistration.status === 'processing' && 
                         existingRegistration.processedAt && 
                         (now - existingRegistration.processedAt) > 5 * 60 * 1000) ||
                        existingRegistration.status === 'failed';
        
        if (isStuck) {
          console.log(`Registration ${existingRegistration._id} is stuck (${existingRegistration.status}), deleting and recreating...`);
          await ctx.db.delete(existingRegistration._id);
          // Continue to create a new registration below
        } else if (existingRegistration.status === 'pending') {
          // Return pending status for polling
          return {
            registrationId: existingRegistration._id,
            status: 'pending',
            message: 'Registration is pending'
          };
        } else {
          // Processing but not stuck yet
          return {
            registrationId: existingRegistration._id,
            status: existingRegistration.status,
            message: `Registration is ${existingRegistration.status}`
          };
        }
      }
    }
    
    // Determine personality from identity and select appropriate character
    let personality: 'CRIMINAL' | 'GAMBLER' | 'WORKER' = 'WORKER';
    const identityLower = identity.toLowerCase();
    if (identityLower.includes('criminal') || identityLower.includes('thief') || identityLower.includes('robber')) {
      personality = 'CRIMINAL';
    } else if (identityLower.includes('gambler') || identityLower.includes('risk') || identityLower.includes('casino')) {
      personality = 'GAMBLER';
    }
    
    // Use the provided character if valid, otherwise map based on personality
    const validCharacters = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'];
    const validCharacter = validCharacters.includes(character) 
      ? character 
      : getCharacterForPersonality(personality);
    
    console.log(`Bot ${name}: Using character=${validCharacter} (provided=${character}, fallback=${!validCharacters.includes(character)})`);
    
    // Queue the registration for batch processing with valid character
    const registrationId = await ctx.db.insert('pendingBotRegistrations', {
      worldId,
      name,
      character: validCharacter, // Use validated character
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
  const body = await request.json() as {
    aiArenaBotId: string;
    lootboxes: any[];
  };
  
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
    const body = await request.json() as {
      worldId: string;
      agentId: string;
    };
    const { worldId, agentId } = body;
    
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
        name: v.optional(v.string()),  // Make name optional
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
              // Use the provided name or generate one from type and rarity
              const itemName = item.name || `${lootbox.rarity} ${item.type}`;
              
              await ctx.db.insert('items', {
                worldId: world._id,
                ownerId: agent.playerId,
                itemId: `${lootbox.id}_${itemName}`,
                name: itemName,
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
  const body = await request.json() as {
    aiArenaBotId: string;
  };
  
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

// Get bot experience data
export const getBotExperience = httpAction(async (ctx, request) => {
  const body = await request.json() as {
    worldId: string;
    aiArenaBotId: string;
  };
  
  const { worldId, aiArenaBotId } = body;
  
  if (!worldId || !aiArenaBotId) {
    return new Response(JSON.stringify({ error: 'Missing required fields: worldId, aiArenaBotId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  try {
    // Convert worldId string to Convex ID
    const worldIdDoc = worldId as any;
    
    // Get experience data
    const experience = await ctx.runQuery(api.aiTown.experience.getBotExperience, {
      worldId: worldIdDoc,
      aiArenaBotId,
    });
    
    if (!experience) {
      return new Response(JSON.stringify({ error: 'No experience record found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify(experience), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error getting bot experience:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to get bot experience',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// Internal mutation to delete bot from all worlds with comprehensive cascade deletion
export const deleteBotFromWorlds = internalMutation({
  args: {
    aiArenaBotId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log('🗑️ Starting comprehensive bot deletion for:', args.aiArenaBotId);
    
    let deletedCount = 0;
    const cleanupStats = {
      worlds: 0,
      agents: 0,
      players: 0,
      inputs: 0,
      messages: 0,
      memories: 0,
      items: 0,
      activityLogs: 0,
      relationships: 0,
      conversations: 0,
      other: 0,
    };
    
    // Find all worlds
    const worlds = await ctx.db.query('worlds').collect();
    
    for (const world of worlds) {
      // Find all agents with this aiArenaBotId in this world (defensive: allow multiple)
      const agents = (world.agents || []).filter((a: any) => a.aiArenaBotId === args.aiArenaBotId);
      
      for (const agent of agents) {
        console.log(`Found bot ${args.aiArenaBotId} in world ${world._id}, cleaning up...`);
        
        // First, perform comprehensive cleanup of all related data
        // This handles messages, conversations, relationships, activity logs, etc.
        try {
          // Import the cleanup helper function at the top of the file instead of dynamic import
          // For now, we'll skip the comprehensive cleanup due to dynamic import limitations in Convex
          // The cleanup code below handles the essential tables
          console.log(`Performing cleanup for ${agent.playerId}...`);
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
          cleanupStats.items++;
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
        
        // Houses table removed - not implemented in current system
        
        // Delete pending bot registrations
        const pendingRegistrations = await ctx.db
          .query('pendingBotRegistrations')
          .withIndex('aiArenaBotId', (q: any) => q.eq('aiArenaBotId', args.aiArenaBotId))
          .collect();
        
        for (const reg of pendingRegistrations) {
          await ctx.db.delete(reg._id);
        }
        
        // Delete lootbox queue entries
        const lootboxQueue = await ctx.db
          .query('lootboxQueue')
          .withIndex('aiArenaBotId', (q: any) => 
            q.eq('worldId', world._id).eq('aiArenaBotId', args.aiArenaBotId)
          )
          .collect();
          
        for (const lootbox of lootboxQueue) {
          await ctx.db.delete(lootbox._id);
        }
        
        // Delete player last viewed records
        const lastViewed = await ctx.db
          .query('playerLastViewed')
          .withIndex('by_player', (q: any) => 
            q.eq('worldId', world._id).eq('playerId', agent.playerId)
          )
          .first();
          
        if (lastViewed) {
          await ctx.db.delete(lastViewed._id);
        }
        
        // Player zone history table removed - no longer needed
        
        // Marriages table removed - relationships handle this now
        
        // Factions table removed - not implemented yet
        
        // Reputation records removed - handled by relationship scores

        // Delete relationship records (both directions)
        const relFrom = await ctx.db
          .query('relationships')
          .withIndex('fromTo', (q: any) => q.eq('worldId', world._id).eq('fromPlayer', agent.playerId))
          .collect();
        for (const r of relFrom) {
          await ctx.db.delete(r._id);
          cleanupStats.relationships++;
        }
        const relTo = await ctx.db
          .query('relationships')
          .withIndex('toFrom', (q: any) => q.eq('worldId', world._id).eq('toPlayer', agent.playerId))
          .collect();
        for (const r of relTo) {
          await ctx.db.delete(r._id);
          cleanupStats.relationships++;
        }

        // Collect participatedTogether edges (both player1 and player2) to remove archived conversations/messages
        const pt1 = await ctx.db
          .query('participatedTogether')
          .withIndex('edge', (q: any) => q.eq('worldId', world._id).eq('player1', agent.playerId))
          .collect();
        const pt2 = await ctx.db
          .query('participatedTogether')
          .withIndex('edge', (q: any) => q.eq('worldId', world._id).eq('player2', agent.playerId))
          .collect();

        // Delete archived conversations and messages linked via edges
        const conversationIds = Array.from(new Set([
          ...pt1.map((e: any) => e.conversationId),
          ...pt2.map((e: any) => e.conversationId),
        ]));
        for (const convoId of conversationIds) {
          const archived = await ctx.db
            .query('archivedConversations')
            .withIndex('worldId', (q: any) => q.eq('worldId', world._id).eq('id', convoId))
            .first();
          if (archived) {
            await ctx.db.delete(archived._id);
          }
          // Delete messages for this conversation
          const messages = await ctx.db
            .query('messages')
            .withIndex('conversationId', (q: any) => q.eq('worldId', world._id).eq('conversationId', convoId))
            .collect();
          for (const m of messages) {
            await ctx.db.delete(m._id);
            cleanupStats.messages++;
          }
        }
        // Delete participatedTogether edges
        for (const e of [...pt1, ...pt2]) {
          await ctx.db.delete(e._id);
        }

        // Delete activity logs for this player or bot id (with batching to handle large volumes)
        const logBatchSize = 200;
        let hasMoreLogs = true;
        let logsDeleted = 0;
        
        while (hasMoreLogs) {
          const playerLogs = await ctx.db
            .query('activityLogs')
            .withIndex('player', (q: any) => q.eq('worldId', world._id).eq('playerId', agent.playerId))
            .take(logBatchSize);
          
          for (const log of playerLogs) {
            await ctx.db.delete(log._id);
            logsDeleted++;
          }
          
          hasMoreLogs = playerLogs.length === logBatchSize;
          
          // Avoid timeout
          if (logsDeleted > 1000) break;
        }
        
        // Also delete by aiArenaBotId
        hasMoreLogs = true;
        while (hasMoreLogs) {
          const botLogs = await ctx.db
            .query('activityLogs')
            .withIndex('aiArenaBotId', (q: any) => q.eq('worldId', world._id).eq('aiArenaBotId', args.aiArenaBotId))
            .take(logBatchSize);
          
          for (const log of botLogs) {
            await ctx.db.delete(log._id);
            logsDeleted++;
          }
          
          hasMoreLogs = botLogs.length === logBatchSize;
          
          // Avoid timeout
          if (logsDeleted > 2000) break;
        }
        
        cleanupStats.activityLogs += logsDeleted;
        console.log(`✅ Deleted ${logsDeleted} activity logs`);

        // CRITICAL: Delete all inputs created by this agent/player to prevent accumulation
        // This is especially important as inputs were causing the 32k document limit issue
        const inputBatchSize = 100;
        let inputsDeleted = 0;
        let hasMoreInputs = true;
        
        console.log(`🧹 Cleaning up inputs for agent ${agent.id} / player ${agent.playerId}`);
        
        while (hasMoreInputs) {
          const inputs = await ctx.db
            .query('inputs')
            .take(inputBatchSize);
          
          let batchDeleted = 0;
          for (const input of inputs) {
            // Check if this input was created by this agent/player
            // Inputs for agent operations typically have args containing the agentId or playerId
            if (input.args && (
              input.args.agentId === agent.id ||
              input.args.playerId === agent.playerId ||
              input.args.aiArenaBotId === args.aiArenaBotId ||
              // Also check for createAgentFromAIArena inputs
              (input.name === 'createAgentFromAIArena' && input.args.aiArenaBotId === args.aiArenaBotId)
            )) {
              await ctx.db.delete(input._id);
              batchDeleted++;
              inputsDeleted++;
            }
          }
          
          hasMoreInputs = inputs.length === inputBatchSize && batchDeleted > 0;
          
          // Break if we've deleted too many to avoid timeout
          if (inputsDeleted > 1000) {
            console.log(`⚠️ Deleted ${inputsDeleted} inputs, stopping to avoid timeout`);
            break;
          }
        }
        
        cleanupStats.inputs += inputsDeleted;
        console.log(`✅ Deleted ${inputsDeleted} inputs for bot ${args.aiArenaBotId}`);
        
        // Delete archived player records
        const archivedPlayer = await ctx.db
          .query('archivedPlayers')
          .withIndex('worldId', (q: any) => 
            q.eq('worldId', world._id).eq('id', agent.playerId)
          )
          .first();
          
        if (archivedPlayer) {
          await ctx.db.delete(archivedPlayer._id);
        }
        
        // Delete archived agent records
        const archivedAgent = await ctx.db
          .query('archivedAgents')
          .withIndex('worldId', (q: any) => 
            q.eq('worldId', world._id).eq('id', agent.id)
          )
          .first();
          
        if (archivedAgent) {
          await ctx.db.delete(archivedAgent._id);
        }
        
        // Finally, remove the agent and player from the world arrays and clean active conversations
        const updatedAgents = (world.agents || []).filter((a: any) => a.id !== agent.id);
        const updatedPlayers = (world.players || []).filter((p: any) => p.id !== agent.playerId);
        const updatedConversations = (world.conversations || []).filter((c: any) =>
          !(c.participants || []).some((p: any) => p.playerId === agent.playerId || p.id === agent.playerId)
        );
        
        console.log(`Removing agent ${agent.id} and player ${agent.playerId} from world arrays`);
        console.log(`Before: ${world.agents.length} agents, ${world.players.length} players`);
        console.log(`After: ${updatedAgents.length} agents, ${updatedPlayers.length} players`);
        
        await ctx.db.patch(world._id, {
          agents: updatedAgents,
          players: updatedPlayers,
          conversations: updatedConversations,
        });
        
        deletedCount++;
        cleanupStats.agents++;
        cleanupStats.players++;
        cleanupStats.worlds++;
        
        console.log(`✅ Successfully deleted bot ${args.aiArenaBotId} from world ${world._id}`);
      }
    }
    
    // Log comprehensive cleanup statistics
    const totalCleaned = Object.values(cleanupStats).reduce((a, b) => a + b, 0);
    console.log(`🎯 Cascade deletion complete for ${args.aiArenaBotId}:`);
    console.log(`   - Worlds affected: ${cleanupStats.worlds}`);
    console.log(`   - Agents deleted: ${cleanupStats.agents}`);
    console.log(`   - Players deleted: ${cleanupStats.players}`);
    console.log(`   - Inputs cleaned: ${cleanupStats.inputs}`);
    console.log(`   - Messages deleted: ${cleanupStats.messages}`);
    console.log(`   - Items deleted: ${cleanupStats.items}`);
    console.log(`   - Activity logs: ${cleanupStats.activityLogs}`);
    console.log(`   - Relationships: ${cleanupStats.relationships}`);
    console.log(`   - Total documents: ${totalCleaned}`);
    
    return { 
      deletedCount,
      cleanupStats,
      totalDocumentsCleaned: totalCleaned
    };
  },
});