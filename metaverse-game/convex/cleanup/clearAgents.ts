import { v } from 'convex/values';
import { mutation } from '../_generated/server';
import { GameId } from '../aiTown/ids';

// Webhook URL for AI Arena backend
const AI_ARENA_WEBHOOK_URL = process.env.AI_ARENA_WEBHOOK_URL || 'http://localhost:4000/api/webhooks';

// Clear all agents from a world
export const clearAllAgents = mutation({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error('World not found');
    }

    // Get all agents from the world document
    const agents = world.agents || [];
    const players = world.players || [];

    // Archive each agent before clearing
    for (const agent of agents) {
      await ctx.db.insert('archivedAgents', {
        worldId: args.worldId,
        ...agent
      });
    }
    
    // Archive each player before clearing
    for (const player of players) {
      await ctx.db.insert('archivedPlayers', {
        worldId: args.worldId,
        ...player
      });
    }

    // Clear agents and players from world
    await ctx.db.patch(args.worldId, {
      agents: [],
      players: [],
      conversations: [],
    });

    return {
      message: `Deleted ${agents.length} agents from world`,
      deletedCount: agents.length,
    };
  },
});

// Clear specific agents by name
export const clearAgentsByName = mutation({
  args: {
    worldId: v.id('worlds'),
    names: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error('World not found');
    }

    // Get agents and players from the world document
    const agents = world.agents || [];
    const players = world.players || [];
    
    // Get player descriptions to access names
    const playerDescriptions = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    
    const playerDescMap = new Map(playerDescriptions.map(pd => [pd.playerId, pd]));
    const playerMap = new Map(players.map((p: any) => [p.id, p]));
    let deletedCount = 0;
    const remainingAgents: any[] = [];
    const remainingPlayers: any[] = [];

    const deletedAgentsWithAIArenaIds: Array<{ agentId: string; aiArenaBotId: string }> = [];

    for (const agent of agents) {
      const player = playerMap.get(agent.playerId);
      const playerDesc = playerDescMap.get(agent.playerId);
      if (player && playerDesc && args.names.includes(playerDesc.name)) {
        // Track agents with AI Arena bot IDs for webhook notification
        if (agent.aiArenaBotId) {
          deletedAgentsWithAIArenaIds.push({
            agentId: agent.id,
            aiArenaBotId: agent.aiArenaBotId,
          });
        }

        // Archive the agent and player
        await ctx.db.insert('archivedAgents', {
          worldId: args.worldId,
          ...agent
        });
        
        await ctx.db.insert('archivedPlayers', {
          worldId: args.worldId,
          ...player
        });
        
        deletedCount++;
      } else {
        remainingAgents.push(agent);
      }
    }
    
    // Keep players that weren't deleted
    for (const player of players) {
      const playerDesc = playerDescMap.get(player.id);
      if (!playerDesc || !args.names.includes(playerDesc.name)) {
        remainingPlayers.push(player);
      }
    }

    // Update world with remaining agents and players
    await ctx.db.patch(args.worldId, {
      agents: remainingAgents,
      players: remainingPlayers,
    });

    // Notify AI Arena about deleted agents (async, don't wait)
    for (const deletedAgent of deletedAgentsWithAIArenaIds) {
      try {
        // Note: In Convex mutations, we can't make external HTTP calls directly
        // We'll need to schedule an action or use a different approach
        // For now, we'll log the deletion
        console.log(`Agent ${deletedAgent.agentId} with AI Arena Bot ID ${deletedAgent.aiArenaBotId} was deleted from metaverse`);
        // TODO: Implement webhook notification via Convex action
      } catch (error) {
        console.error('Failed to notify AI Arena about agent deletion:', error);
      }
    }

    return {
      message: `Deleted ${deletedCount} agents with names: ${args.names.join(', ')}`,
      deletedCount,
    };
  },
});

// Clear mock/test agents
export const clearMockAgents = mutation({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    // Names of the mock agents
    const mockNames = ['Defensive Master', 'Aggressive Player', 'Strategic Analyser'];
    
    // Reuse the logic from clearAgentsByName
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error('World not found');
    }

    // Get agents and players from the world document
    const agents = world.agents || [];
    const players = world.players || [];
    
    // Get player descriptions to access names
    const playerDescriptions = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    
    const playerDescMap = new Map(playerDescriptions.map(pd => [pd.playerId, pd]));
    const playerMap = new Map(players.map((p: any) => [p.id, p]));
    let deletedCount = 0;
    const remainingAgents: any[] = [];
    const remainingPlayers: any[] = [];

    for (const agent of agents) {
      const player = playerMap.get(agent.playerId);
      const playerDesc = playerDescMap.get(agent.playerId);
      if (player && playerDesc && mockNames.includes(playerDesc.name)) {
        // Archive the agent and player
        await ctx.db.insert('archivedAgents', {
          worldId: args.worldId,
          ...agent
        });
        
        await ctx.db.insert('archivedPlayers', {
          worldId: args.worldId,
          ...player
        });
        
        deletedCount++;
      } else {
        remainingAgents.push(agent);
      }
    }
    
    // Keep players that weren't deleted
    for (const player of players) {
      const playerDesc = playerDescMap.get(player.id);
      if (!playerDesc || !mockNames.includes(playerDesc.name)) {
        remainingPlayers.push(player);
      }
    }

    // Update world with remaining agents and players
    await ctx.db.patch(args.worldId, {
      agents: remainingAgents,
      players: remainingPlayers,
    });

    return {
      message: `Deleted ${deletedCount} mock agents`,
      deletedCount,
    };
  },
});