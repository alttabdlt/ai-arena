import { v } from 'convex/values';
import { internalQuery } from '../_generated/server';
import { internal } from '../_generated/api';
import { playerId } from './ids';

// Simple test function to verify relationship system works
export const testRelationshipSystem: any = internalQuery({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    console.log('[TEST] Starting relationship system test');
    
    // Get the world
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      return { error: 'World not found' };
    }
    
    // Get first two players
    const players = world.players.slice(0, 2);
    if (players.length < 2) {
      return { error: 'Not enough players to test' };
    }
    
    console.log(`[TEST] Testing with players: ${players[0].id} and ${players[1].id}`);
    
    try {
      // Try to get relationship
      const relationship: any = await ctx.runQuery(internal.aiTown.relationshipService.getRelationship, {
        worldId: args.worldId,
        fromPlayer: players[0].id,
        toPlayer: players[1].id,
      });
      
      console.log('[TEST] Successfully got relationship:', relationship);
      
      return {
        success: true,
        player1: players[0].id,
        player2: players[1].id,
        relationship,
      };
    } catch (error) {
      console.error('[TEST] Error getting relationship:', error);
      return {
        error: 'Failed to get relationship',
        details: error,
      };
    }
  },
});