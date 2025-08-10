import { httpAction } from '../_generated/server';
import { api, internal } from '../_generated/api';

export const getAllArenaAgents = httpAction(async (ctx, request) => {
  try {
    const result = await ctx.runQuery(api.cleanup.orphanCleanup.getAllArenaAgents, {});
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error getting arena agents:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to get arena agents',
      agents: [],
      players: [],
      playerDescriptions: []
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

export const deleteOrphanedAgent = httpAction(async (ctx, request) => {
  try {
    const body = await request.json();
    const { worldId, agentId, playerId } = body;
    
    await ctx.runMutation(internal.cleanup.orphanCleanup.deleteOrphanedAgent, {
      worldId,
      agentId,
      playerId,
      reason: 'Orphaned agent cleanup via HTTP'
    });
    
    return new Response(JSON.stringify({ 
      success: true,
      message: `Agent ${agentId} deleted successfully`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error deleting orphaned agent:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Failed to delete orphaned agent'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

export const removePlayer = httpAction(async (ctx, request) => {
  try {
    const body = await request.json();
    const { worldId, playerId } = body;
    
    // Get the world to verify it exists
    const world = await ctx.runQuery(api.world.defaultWorldStatus, {});
    if (!world) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'World not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Send input to remove the player
    await ctx.runMutation(api.aiTown.main.sendInput, {
      worldId,
      name: 'leave',
      args: { playerId }
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Player ${playerId} removed successfully` 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error removing player:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Failed to remove player' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});