#!/usr/bin/env npx tsx

import { ConvexHttpClient } from 'convex/browser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { api } from '../convex/_generated/api';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const CONVEX_URL = process.env.VITE_CONVEX_URL;
if (!CONVEX_URL) {
  console.error('❌ VITE_CONVEX_URL not found in .env.local');
  process.exit(1);
}

async function clearStuckOperations() {
  const client = new ConvexHttpClient(CONVEX_URL);
  
  console.log('🔧 Clearing stuck agent operations...\n');
  
  try {
    // Get world state
    const worldStatus = await client.query(api.world.defaultWorldStatus, {});
    const worldState = await client.query(api.world.worldState, { worldId: worldStatus.worldId });
    
    const agents = worldState?.world?.agents || [];
    
    console.log(`Found ${agents.length} agents\n`);
    
    // Check each agent's operation
    for (const agent of agents) {
      if (agent.inProgressOperation) {
        console.log(`Agent ${agent.id} has stuck operation: ${agent.inProgressOperation.name}`);
        console.log(`  Started: ${new Date(agent.inProgressOperation.started).toLocaleTimeString()}`);
        const elapsed = Date.now() - agent.inProgressOperation.started;
        console.log(`  Elapsed: ${Math.round(elapsed / 1000)} seconds`);
        
        // If operation is older than 30 seconds, it's definitely stuck
        if (elapsed > 30000) {
          console.log(`  ⚠️ Operation is stuck (>30s old)`);
          
          // Send a finishDoSomething input to clear the operation
          try {
            console.log(`  Sending finishDoSomething to clear operation...`);
            await client.mutation(api.aiTown.main.sendInput, {
              worldId: worldStatus.worldId,
              name: 'finishDoSomething',
              args: {
                operationId: agent.inProgressOperation.operationId,
                agentId: agent.id,
                destination: { x: 20, y: 20 }, // Move to center
              },
            });
            console.log(`  ✅ Cleared stuck operation for agent ${agent.id}`);
          } catch (err: any) {
            console.log(`  ❌ Failed to clear: ${err.message}`);
          }
        } else {
          console.log(`  ⏳ Operation still processing (${Math.round(elapsed / 1000)}s)`);
        }
      } else {
        console.log(`Agent ${agent.id} has no operation in progress`);
      }
      console.log('');
    }
    
    // Wait for operations to clear
    console.log('Waiting 5 seconds for operations to clear...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check status again
    const newWorldState = await client.query(api.world.worldState, { worldId: worldStatus.worldId });
    const newAgents = newWorldState?.world?.agents || [];
    const newPlayers = newWorldState?.world?.players || [];
    
    console.log('Final Status:');
    let movingCount = 0;
    for (const agent of newAgents) {
      const player = newPlayers.find(p => p.id === agent.playerId);
      if (player) {
        const status = player.pathfinding ? '✅ MOVING' : '🛑 STOPPED';
        const hasOp = agent.inProgressOperation ? 'HAS OP' : 'NO OP';
        console.log(`${status} Agent ${agent.id}: ${hasOp}`);
        if (player.pathfinding) movingCount++;
      }
    }
    
    console.log(`\n${movingCount}/${newAgents.length} agents are now moving`);
    
    if (movingCount > 0) {
      console.log('\n🎉 SUCCESS! Bots are now moving!');
    } else {
      console.log('\n⚠️ Bots still not moving. May need to restart the engine.');
    }
    
  } catch (error) {
    console.error('❌ Error clearing operations:', error);
  }
}

// Run the script
clearStuckOperations().catch(console.error);