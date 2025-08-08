import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';

export const checkPendingInputs = query({
  handler: async (ctx) => {
    // Get all inputs
    const allInputs = await ctx.db.query('inputs').collect();
    
    // Filter for createAgentFromAIArena inputs
    const agentInputs = allInputs.filter(input => 
      input.name === 'createAgentFromAIArena'
    );
    
    // Categorize by processing status
    const pending = agentInputs.filter(input => !input.returnValue);
    const processed = agentInputs.filter(input => input.returnValue);
    
    return {
      totalInputs: allInputs.length,
      agentInputs: agentInputs.length,
      pending: pending.length,
      processed: processed.length,
      pendingDetails: pending.map(input => ({
        id: input._id,
        name: input.name,
        args: input.args,
        createdAt: input._creationTime,
      })),
      processedDetails: processed.slice(-5).map(input => ({
        id: input._id,
        name: input.name,
        args: input.args,
        returnValue: input.returnValue,
        createdAt: input._creationTime,
      }))
    };
  },
});

export const checkEngineStatus = query({
  args: {
    worldId: v.optional(v.id('worlds')),
  },
  handler: async (ctx, args) => {
    let worldId = args.worldId;
    
    // If no worldId provided, get default
    if (!worldId) {
      const defaultWorld = await ctx.db
        .query('worldStatus')
        .filter((q) => q.eq(q.field('isDefault'), true))
        .first();
      
      if (defaultWorld) {
        worldId = defaultWorld.worldId;
      }
    }
    
    if (!worldId) {
      return { error: 'No world found' };
    }
    
    // Get world data
    const world = await ctx.db.get(worldId);
    if (!world) {
      return { error: 'World not found' };
    }
    
    // Get world status
    const worldStatus = await ctx.db
      .query('worldStatus')
      .withIndex('worldId', (q) => q.eq('worldId', worldId!))
      .first();
    
    // Get engine if exists
    let engine = null;
    if (worldStatus?.engineId) {
      engine = await ctx.db.get(worldStatus.engineId);
    }
    
    return {
      worldId,
      worldStatus: worldStatus?.status,
      engineId: worldStatus?.engineId,
      engineRunning: engine?.running,
      lastViewed: worldStatus?.lastViewed,
      agents: world.agents?.length || 0,
      players: world.players?.length || 0,
      nextId: world.nextId,
    };
  },
});

export const debugWorldLoading = query({
  handler: async (ctx) => {
    // Get the default world dynamically
    const worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    
    if (!worldStatus) {
      return { error: 'No default world found' };
    }
    
    const worldId = worldStatus.worldId;
    const world = await ctx.db.get(worldId) as any;
    
    // Get the engine
    let engine = null;
    if (worldStatus?.engineId) {
      engine = await ctx.db.get(worldStatus.engineId) as any;
    }
    
    return {
      worldDocument: {
        nextId: world?.nextId,
        numAgents: world?.agents?.length || 0,
        numPlayers: world?.players?.length || 0,
        agentIds: world?.agents?.map((a: any) => a.id) || [],
      },
      worldStatus: {
        status: worldStatus?.status,
        engineId: worldStatus?.engineId,
      },
      engine: {
        running: engine?.running,
        generationNumber: engine?.generationNumber,
        processedInputNumber: engine?.processedInputNumber,
      },
    };
  },
});

export const checkWorldDocument = query({
  handler: async (ctx) => {
    // Get the default world dynamically
    const worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    
    if (!worldStatus) {
      return { error: 'No default world found' };
    }
    
    const worldId = worldStatus.worldId;
    const world = await ctx.db.get(worldId) as any;
    if (!world) {
      return { error: 'World not found' };
    }
    
    return {
      worldId,
      hasWorld: true,
      nextId: world.nextId,
      numAgents: world.agents?.length || 0,
      numPlayers: world.players?.length || 0,
      agentIds: world.agents?.map((a: any) => a.id) || [],
      playerIds: world.players?.map((p: any) => p.id) || [],
      conversations: world.conversations?.length || 0,
    };
  },
});

export const checkEngines = query({
  handler: async (ctx) => {
    const engines = await ctx.db.query('engines').collect();
    return engines.map(e => ({
      id: e._id,
      running: e.running,
      currentTime: e.currentTime,
      lastStepTs: e.lastStepTs,
      generationNumber: e.generationNumber,
      processedInputNumber: e.processedInputNumber,
      timeSinceLastStep: e.lastStepTs ? Date.now() - e.lastStepTs : null,
    }));
  },
});

export const getUnprocessedInputs = query({
  handler: async (ctx) => {
    const inputs = await ctx.db
      .query('inputs')
      .filter(q => q.eq(q.field('name'), 'createAgentFromAIArena'))
      .collect();
    
    const unprocessed = inputs.filter(i => !i.returnValue);
    
    return {
      count: unprocessed.length,
      inputs: unprocessed.map(i => ({
        id: i._id,
        args: i.args,
        createdAt: i._creationTime,
        timeSinceCreation: Date.now() - i._creationTime,
      }))
    };
  },
});

// Force recreate agents from processed inputs
export const testCreateMultipleAgents = mutation({
  handler: async (ctx) => {
    // Get the default world
    const worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    
    if (!worldStatus) {
      throw new Error('No default world found');
    }
    
    // Get the current highest input number
    const inputs = await ctx.db.query('inputs').collect();
    let maxNumber = Math.max(...inputs.map(i => i.number || 0), 100000);
    
    // Create 3 agents in quick succession
    const inputIds = [];
    for (let i = 0; i < 3; i++) {
      const inputId = await ctx.db.insert('inputs', {
        engineId: worldStatus.engineId,
        name: 'createAgentFromAIArena',
        args: {
          name: `TestBot${i}`,
          character: `f${i + 1}`,
          identity: `Test bot ${i} for debugging`,
          plan: `Test the system ${i}`,
          aiArenaBotId: `batch-test-${Date.now()}-${i}`,
          initialZone: 'suburb',
        },
        received: Date.now() + i, // Slightly stagger the received times
        number: maxNumber + i + 1,
      });
      inputIds.push(inputId);
    }
    
    return {
      success: true,
      inputIds,
      worldId: worldStatus.worldId,
      message: 'Created 3 agent inputs',
    };
  },
});

export const testCreateAgent = mutation({
  handler: async (ctx) => {
    // Get the default world
    const worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    
    if (!worldStatus) {
      throw new Error('No default world found');
    }
    
    // Send an input to create an agent
    const inputId = await ctx.db.insert('inputs', {
      engineId: worldStatus.engineId,
      name: 'createAgentFromAIArena',
      args: {
        name: 'TestBot',
        character: 'f1',
        identity: 'A test bot for debugging',
        plan: 'Test the system',
        aiArenaBotId: 'test-' + Date.now(),
        initialZone: 'suburb',
      },
      received: Date.now(),
      number: 99999,
    });
    
    return {
      success: true,
      inputId,
      worldId: worldStatus.worldId,
    };
  },
});

export const checkAgentDetails = query({
  handler: async (ctx) => {
    // Get the default world dynamically
    const worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    
    if (!worldStatus) {
      return { error: 'No default world found' };
    }
    
    const worldId = worldStatus.worldId;
    const world = await ctx.db.get(worldId) as any;
    if (!world) return { error: 'World not found' };
    
    const agents = world.agents || [];
    return {
      totalAgents: agents.length,
      agentDetails: agents.map((a: any) => ({
        id: a.id,
        playerId: a.playerId,
        aiArenaBotId: a.aiArenaBotId || 'unknown'
      }))
    };
  },
});

export const checkArchivedAgents = query({
  handler: async (ctx) => {
    const archivedAgents = await ctx.db.query('archivedAgents').collect();
    const archivedPlayers = await ctx.db.query('archivedPlayers').collect();
    return {
      archivedAgents: archivedAgents.length,
      archivedPlayers: archivedPlayers.length,
      samples: archivedAgents.slice(0, 5).map((a: any) => ({
        id: a.id,
        aiArenaBotId: a.aiArenaBotId,
        playerId: a.playerId
      }))
    };
  },
});

// Check registration queue status
export const checkRegistrationQueue = query({
  handler: async (ctx) => {
    const registrations = await ctx.db
      .query('pendingBotRegistrations')
      .collect();
    
    const byStatus = {
      pending: [] as any[],
      processing: [] as any[],
      completed: [] as any[],
      failed: [] as any[],
    };
    
    for (const reg of registrations) {
      byStatus[reg.status].push({
        id: reg._id,
        aiArenaBotId: reg.aiArenaBotId,
        name: reg.name,
        createdAt: reg.createdAt,
        processedAt: reg.processedAt,
        completedAt: reg.completedAt,
        result: reg.result,
        error: reg.error,
      });
    }
    
    return {
      total: registrations.length,
      pending: byStatus.pending.length,
      processing: byStatus.processing.length,
      completed: byStatus.completed.length,
      failed: byStatus.failed.length,
      details: byStatus,
    };
  },
});

// Clear all pending registrations
export const clearRegistrationQueue = mutation({
  handler: async (ctx) => {
    const registrations = await ctx.db
      .query('pendingBotRegistrations')
      .collect();
    
    let deleted = 0;
    for (const reg of registrations) {
      await ctx.db.delete(reg._id);
      deleted++;
    }
    
    return { deleted };
  },
});


export const recreateAgentsFromInputs = mutation({
  handler: async (ctx) => {
    // Get the default world
    const worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    
    if (!worldStatus) {
      throw new Error('No default world found');
    }
    
    const world = await ctx.db.get(worldStatus.worldId);
    if (!world) {
      throw new Error('World not found');
    }
    
    // Get all processed createAgentFromAIArena inputs
    const inputs = await ctx.db
      .query('inputs')
      .filter(q => q.eq(q.field('name'), 'createAgentFromAIArena'))
      .collect();
    
    const processedInputs = inputs.filter(i => 
      i.returnValue && 
      (i.returnValue as any).kind === 'ok'
    );
    
    // Get the last 2 unique bot IDs
    const botIds = new Set<string>();
    const inputsToRecreate = [];
    
    for (let i = processedInputs.length - 1; i >= 0; i--) {
      const input = processedInputs[i];
      const args = input.args as any;
      if (args.aiArenaBotId && !botIds.has(args.aiArenaBotId)) {
        botIds.add(args.aiArenaBotId);
        inputsToRecreate.push(input);
        if (botIds.size >= 2) break;
      }
    }
    
    // Now manually recreate these agents in the world
    const agents = [];
    const players = [];
    let nextId = 1;
    
    for (const input of inputsToRecreate) {
      const args = input.args as any;
      const returnValue = (input.returnValue as any).value;
      
      // Create player
      const playerId = `p:${nextId}`;
      nextId++;
      
      players.push({
        id: playerId,
        human: args.name,
        name: args.name,
        character: args.character,
        identity: args.identity,
        position: {
          x: Math.floor(Math.random() * 30),
          y: Math.floor(Math.random() * 30)
        },
        speed: 1,
        facing: { dx: 0, dy: 1 },
        lastInput: 0,
        currentZone: args.initialZone || 'suburb',
      } as any);
      
      // Create agent
      const agentId = `a:${nextId}`;
      nextId++;
      
      agents.push({
        id: agentId,
        playerId: playerId,
        aiArenaBotId: args.aiArenaBotId,
        personality: args.personality,
      });
    }
    
    // Update the world with the recreated agents
    await ctx.db.patch(worldStatus.worldId, {
      agents: agents as any,
      players: players as any,
      nextId: nextId,
    });
    
    return {
      success: true,
      agentsCreated: agents.length,
      playersCreated: players.length,
      agents: agents.map(a => ({ id: a.id, aiArenaBotId: a.aiArenaBotId })),
    };
  },
});