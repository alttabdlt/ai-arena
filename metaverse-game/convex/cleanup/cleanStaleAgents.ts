import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

// Query to find all stale agent references in worlds
export const findStaleAgents = query({
  args: {},
  handler: async (ctx) => {
    // Get all worlds
    const worlds = await ctx.db.query('worlds').collect();
    
    const staleAgents: Array<{
      worldId: string;
      agentId: string;
      aiArenaBotId: string | null;
    }> = [];
    
    for (const world of worlds) {
      if (world.agents && Array.isArray(world.agents)) {
        for (const agentRef of world.agents) {
          // Check if agent has a corresponding player
          const hasPlayer = world.players?.some(
            (player: any) => player.id === agentRef.playerId
          );
          
          if (!hasPlayer) {
            staleAgents.push({
              worldId: world._id,
              agentId: agentRef.id,
              aiArenaBotId: agentRef.aiArenaBotId || null,
            });
          }
        }
      }
    }
    
    return {
      totalWorlds: worlds.length,
      staleAgentsFound: staleAgents.length,
      staleAgents,
    };
  },
});

// Mutation to clean up stale agent references
export const cleanStaleAgents = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all worlds
    const worlds = await ctx.db.query('worlds').collect();
    
    let totalCleaned = 0;
    const cleanedDetails: Array<{
      worldId: string;
      agentsRemoved: string[];
    }> = [];
    
    for (const world of worlds) {
      if (world.agents && Array.isArray(world.agents)) {
        const validAgents = [];
        const removedAgents = [];
        
        for (const agentRef of world.agents) {
          // Check if agent has a corresponding player
          const hasPlayer = world.players?.some(
            (player: any) => player.id === agentRef.playerId
          );
          
          if (hasPlayer) {
            validAgents.push(agentRef);
          } else {
            removedAgents.push(agentRef.id);
            console.log(`Removing stale agent ${agentRef.id} from world ${world._id}`);
          }
        }
        
        // Update world if any agents were removed
        if (removedAgents.length > 0) {
          await ctx.db.patch(world._id, { agents: validAgents });
          totalCleaned += removedAgents.length;
          cleanedDetails.push({
            worldId: world._id,
            agentsRemoved: removedAgents,
          });
        }
      }
    }
    
    return {
      success: true,
      totalCleaned,
      cleanedDetails,
      message: `Cleaned ${totalCleaned} stale agent references from ${cleanedDetails.length} worlds`,
    };
  },
});

// Clean a specific agent reference from all worlds
export const cleanSpecificAgent = mutation({
  args: {
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    const worlds = await ctx.db.query('worlds').collect();
    let cleaned = 0;
    
    for (const world of worlds) {
      if (world.agents && Array.isArray(world.agents)) {
        const hasAgent = world.agents.some((a: any) => a.id === args.agentId);
        
        if (hasAgent) {
          const updatedAgents = world.agents.filter((a: any) => a.id !== args.agentId);
          await ctx.db.patch(world._id, { agents: updatedAgents });
          cleaned++;
          console.log(`Removed agent ${args.agentId} from world ${world._id}`);
        }
      }
    }
    
    return {
      success: true,
      worldsCleaned: cleaned,
      message: `Removed agent ${args.agentId} from ${cleaned} worlds`,
    };
  },
});