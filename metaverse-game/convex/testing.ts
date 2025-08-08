import { Id, TableNames } from './_generated/dataModel';
import { internal } from './_generated/api';
import {
  DatabaseReader,
  internalAction,
  internalMutation,
  mutation,
  query,
} from './_generated/server';
import { v } from 'convex/values';
import schema from './schema';
import { DELETE_BATCH_SIZE } from './constants';
import { kickEngine, startEngine, stopEngine } from './aiTown/main';
import { insertInput } from './aiTown/insertInput';
import { fetchEmbedding } from './util/llm';
import { chatCompletion } from './util/llm';
import { startConversationMessage } from './agent/conversation';
import { GameId } from './aiTown/ids';

// Clear all of the tables except for the embeddings cache.
const excludedTables: Array<TableNames> = ['embeddingsCache'];

export const wipeAllTables = internalMutation({
  handler: async (ctx) => {
    for (const tableName of Object.keys(schema.tables)) {
      if (excludedTables.includes(tableName as TableNames)) {
        continue;
      }
      await ctx.scheduler.runAfter(0, internal.testing.deletePage, { tableName, cursor: null });
    }
  },
});

export const deletePage = internalMutation({
  args: {
    tableName: v.string(),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query(args.tableName as TableNames)
      .paginate({ cursor: args.cursor, numItems: DELETE_BATCH_SIZE });
    for (const row of results.page) {
      await ctx.db.delete(row._id);
    }
    if (!results.isDone) {
      await ctx.scheduler.runAfter(0, internal.testing.deletePage, {
        tableName: args.tableName,
        cursor: results.continueCursor,
      });
    }
  },
});

export const kick = internalMutation({
  handler: async (ctx) => {
    const { worldStatus } = await getDefaultWorld(ctx.db);
    await kickEngine(ctx, worldStatus.worldId);
  },
});

export const stopAllowed = query({
  handler: async () => {
    return !process.env.STOP_NOT_ALLOWED;
  },
});

export const stop = mutation({
  handler: async (ctx) => {
    if (process.env.STOP_NOT_ALLOWED) throw new Error('Stop not allowed');
    const { worldStatus, engine } = await getDefaultWorld(ctx.db);
    if (worldStatus.status === 'inactive' || worldStatus.status === 'stoppedByDeveloper') {
      if (engine.running) {
        throw new Error(`Engine ${engine._id} isn't stopped?`);
      }
      console.debug(`World ${worldStatus.worldId} is already inactive`);
      return;
    }
    console.log(`Stopping engine ${engine._id}...`);
    await ctx.db.patch(worldStatus._id, { status: 'stoppedByDeveloper' });
    await stopEngine(ctx, worldStatus.worldId);
  },
});

export const resume = mutation({
  handler: async (ctx) => {
    const { worldStatus, engine } = await getDefaultWorld(ctx.db);
    if (worldStatus.status === 'running') {
      if (!engine.running) {
        throw new Error(`Engine ${engine._id} isn't running?`);
      }
      console.debug(`World ${worldStatus.worldId} is already running`);
      return;
    }
    console.log(
      `Resuming engine ${engine._id} for world ${worldStatus.worldId} (state: ${worldStatus.status})...`,
    );
    await ctx.db.patch(worldStatus._id, { status: 'running' });
    await startEngine(ctx, worldStatus.worldId);
  },
});

export const archive = internalMutation({
  handler: async (ctx) => {
    const { worldStatus, engine } = await getDefaultWorld(ctx.db);
    if (engine.running) {
      throw new Error(`Engine ${engine._id} is still running!`);
    }
    console.log(`Archiving world ${worldStatus.worldId}...`);
    await ctx.db.patch(worldStatus._id, { isDefault: false });
  },
});

async function getDefaultWorld(db: DatabaseReader) {
  const worldStatus = await db
    .query('worldStatus')
    .filter((q) => q.eq(q.field('isDefault'), true))
    .first();
  if (!worldStatus) {
    throw new Error('No default world found');
  }
  const engine = await db.get(worldStatus.engineId);
  if (!engine) {
    throw new Error(`Engine ${worldStatus.engineId} not found`);
  }
  return { worldStatus, engine };
}

export const setupZones = mutation({
  handler: async (ctx) => {
    console.log('🏗️ Setting up Crime City zones...');
    
    // Get default world and map
    const worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
      
    if (!worldStatus) {
      return { success: false, message: 'No default world found' };
    }
    
    const worldId = worldStatus.worldId;
    
    // Get the map for this world
    const map = await ctx.db
      .query('maps')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .unique();
      
    if (!map) {
      return { success: false, message: 'No map found for world' };
    }
    
    // Check if zones already exist
    const existingZones = await ctx.db
      .query('zones')
      .collect();
    
    if (existingZones.length > 0) {
      console.log(`Zones already exist: ${existingZones.map(z => z.name).join(', ')}`);
      return { success: true, message: 'Zones already exist', count: existingZones.length };
    }
    
    // Create zones
    const zoneTypes: Array<'casino' | 'darkAlley' | 'suburb' | 'downtown' | 'underground'> = 
      ['casino', 'darkAlley', 'suburb', 'downtown', 'underground'];
    
    for (const zoneType of zoneTypes) {
      await ctx.db.insert('zones', {
        zoneType: zoneType,
        name: zoneType,
        mapId: map._id,
        maxPlayers: 50,
        maxBots: 100,
        currentPlayers: 0,
        currentBots: 0,
      });
      
      // Create world instance for the zone
      await ctx.db.insert('worldInstances', {
        zoneType: zoneType,
        worldId,
        instanceNumber: 1,
        status: 'active',
        currentPlayers: 0,
        currentBots: 0,
        createdAt: Date.now(),
      });
    }
    
    console.log(`✅ Created ${zoneTypes.length} zones`);
    return { success: true, message: `Created ${zoneTypes.length} zones`, count: zoneTypes.length };
  },
});

export const debugCreatePlayers = internalMutation({
  args: {
    numPlayers: v.number(),
  },
  handler: async (ctx, args) => {
    const { worldStatus } = await getDefaultWorld(ctx.db);
    for (let i = 0; i < args.numPlayers; i++) {
      const inputId = await insertInput(ctx, worldStatus.worldId, 'join', {
        name: `Robot${i}`,
        description: `This player is a robot.`,
        character: `f${1 + (i % 8)}`,
      });
    }
  },
});

export const randomPositions = internalMutation({
  handler: async (ctx) => {
    const { worldStatus } = await getDefaultWorld(ctx.db);
    const map = await ctx.db
      .query('maps')
      .withIndex('worldId', (q) => q.eq('worldId', worldStatus.worldId))
      .unique();
    if (!map) {
      throw new Error(`No map for world ${worldStatus.worldId}`);
    }
    const world = await ctx.db.get(worldStatus.worldId);
    if (!world) {
      throw new Error(`No world for world ${worldStatus.worldId}`);
    }
    for (const player of world.players) {
      await insertInput(ctx, world._id, 'moveTo', {
        playerId: player.id,
        destination: {
          x: 1 + Math.floor(Math.random() * (map.width - 2)),
          y: 1 + Math.floor(Math.random() * (map.height - 2)),
        },
      });
    }
  },
});

export const testEmbedding = internalAction({
  args: { input: v.string() },
  handler: async (_ctx, args) => {
    return await fetchEmbedding(args.input);
  },
});

export const testCompletion = internalAction({
  args: {},
  handler: async (ctx, args) => {
    return await chatCompletion({
      messages: [
        { content: 'You are helpful', role: 'system' },
        { content: 'Where is pizza?', role: 'user' },
      ],
    });
  },
});

export const testConvo = internalAction({
  args: {},
  handler: async (ctx, args) => {
    const a: any = (await startConversationMessage(
      ctx,
      'm1707m46wmefpejw1k50rqz7856qw3ew' as Id<'worlds'>,
      'c:115' as GameId<'conversations'>,
      'p:1' as GameId<'players'>,
      'p:6' as GameId<'players'>,
    )) as any;
    return await a.readAll();
  },
});
export const clearAllAgents = mutation({
  handler: async (ctx) => {
    const worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    
    if (!worldStatus) {
      return { success: false, message: 'No default world found' };
    }
    
    const world = await ctx.db.get(worldStatus.worldId);
    if (!world) {
      return { success: false, message: 'World not found' };
    }
    
    // Clear all agents and players
    const agentCount = world.agents.length;
    const playerCount = world.players.length;
    
    await ctx.db.patch(worldStatus.worldId, {
      agents: [],
      players: [],
      conversations: [],
      nextId: 1,
    });
    
    // Also clear any archived data
    const archivedPlayers = await ctx.db
      .query('archivedPlayers')
      .withIndex('worldId', (q) => q.eq('worldId', worldStatus.worldId))
      .collect();
    
    for (const player of archivedPlayers) {
      await ctx.db.delete(player._id);
    }
    
    const archivedAgents = await ctx.db
      .query('archivedAgents')
      .withIndex('worldId', (q) => q.eq('worldId', worldStatus.worldId))
      .collect();
    
    for (const agent of archivedAgents) {
      await ctx.db.delete(agent._id);
    }
    
    return {
      success: true,
      message: `Cleared ${agentCount} agents and ${playerCount} players from world`,
      agentCount,
      playerCount,
    };
  },
});

export const fixWorldInstances = mutation({
  handler: async (ctx) => {
    const worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    
    if (!worldStatus) {
      return { success: false, message: 'No default world found' };
    }
    
    const correctWorldId = worldStatus.worldId;
    
    // Update all world instances to use the correct worldId
    const instances = await ctx.db.query('worldInstances').collect();
    let updated = 0;
    
    for (const instance of instances) {
      if (instance.worldId !== correctWorldId) {
        await ctx.db.patch(instance._id, {
          worldId: correctWorldId
        });
        updated++;
      }
    }
    
    return { 
      success: true, 
      message: `Updated ${updated} instances to use worldId: ${correctWorldId}`,
      worldId: correctWorldId
    };
  },
});

export const countAgentsByBotId = query({
  handler: async (ctx) => {
    const worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    
    if (!worldStatus) {
      return { error: 'No default world found' };
    }
    
    const world = await ctx.db.get(worldStatus.worldId);
    if (!world) {
      return { error: 'World not found' };
    }
    
    // Count agents by AI Arena bot ID
    const agentsByBotId: { [key: string]: number } = {};
    let totalAgents = 0;
    
    if (world.agents && Array.isArray(world.agents)) {
      for (const agent of world.agents) {
        totalAgents++;
        // Extract AI Arena bot ID from identity if present
        const agentData = agent as any;
        const identity = agentData.identity || '';
        const match = identity.match(/cmdzny0ua0005ruglc0glac9e|cmdzjdbrf0001ru9e890apnnv/);
        if (match) {
          const botId = match[0];
          agentsByBotId[botId] = (agentsByBotId[botId] || 0) + 1;
        }
      }
    }
    
    return {
      totalAgents,
      totalPlayers: world.players?.length || 0,
      agentsByBotId,
      agentIds: world.agents?.map((a: any) => a.id) || [],
    };
  },
});

export const checkInstances = query({
  handler: async (ctx) => {
    const instances = await ctx.db.query('worldInstances').collect();
    const worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    
    return {
      defaultWorldId: worldStatus?.worldId,
      instances: instances.map(i => ({
        id: i._id,
        worldId: i.worldId,
        zoneType: i.zoneType
      }))
    };
  },
});

// Remove a specific agent from a world (for cleanup)
export const removeAgent = mutation({
  args: {
    worldId: v.id('worlds'),
    agentId: v.string(),
    playerId: v.string(),
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error('World not found');
    }
    
    // Remove agent from agents array
    const updatedAgents = world.agents.filter((a: any) => a.id !== args.agentId);
    
    // Remove player from players array
    const updatedPlayers = world.players.filter((p: any) => p.id !== args.playerId);
    
    // Update world
    await ctx.db.patch(args.worldId, {
      agents: updatedAgents,
      players: updatedPlayers,
    });
    
    // Remove agent description if exists
    const agentDesc = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q: any) => q.eq('worldId', args.worldId).eq('agentId', args.agentId))
      .first();
      
    if (agentDesc) {
      await ctx.db.delete(agentDesc._id);
    }
    
    return { removed: true };
  },
});

export const checkAgentDetails = query({
  handler: async (ctx) => {
    const worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    
    if (!worldStatus) {
      return { error: 'No default world found' };
    }
    
    const world = await ctx.db.get(worldStatus.worldId);
    if (!world) {
      return { error: 'World not found' };
    }
    
    // Get detailed agent info
    const agents = world.agents?.map((agent: any) => ({
      id: agent.id,
      playerId: agent.playerId,
      aiArenaBotId: agent.aiArenaBotId,
      personality: agent.personality,
      hasAiArenaBotId: !!agent.aiArenaBotId
    })) || [];
    
    // Count duplicates
    const botIdCounts: { [key: string]: number } = {};
    for (const agent of agents) {
      if (agent.aiArenaBotId) {
        botIdCounts[agent.aiArenaBotId] = (botIdCounts[agent.aiArenaBotId] || 0) + 1;
      }
    }
    
    return {
      totalAgents: agents.length,
      agents,
      botIdCounts,
      duplicates: Object.entries(botIdCounts).filter(([_, count]) => count > 1)
    };
  },
});
