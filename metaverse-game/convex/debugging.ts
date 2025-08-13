import { query } from './_generated/server';
import { v } from 'convex/values';

export const checkPendingInputs = query({
  handler: async (ctx) => {
    // Get limited inputs to avoid hitting document limit
    const allInputs = await ctx.db.query('inputs').take(1000);
    
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