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

async function kickEngine() {
  const client = new ConvexHttpClient(CONVEX_URL);
  
  const worldStatus = await client.query(api.world.defaultWorldStatus, {});
  console.log('Sending heartbeat to world:', worldStatus.worldId);
  
  try {
    await client.mutation(api.world.sendWorldHeartbeat, { worldId: worldStatus.worldId });
    console.log('✅ Heartbeat sent successfully');
  } catch (err: any) {
    console.log('Heartbeat error:', err.message);
  }
  
  // Wait a bit for engine to process
  console.log('\nWaiting 5 seconds for engine to process...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Check bot status again
  const worldState = await client.query(api.world.worldState, { worldId: worldStatus.worldId });
  const agents = worldState?.world?.agents || [];
  const players = worldState?.world?.players || [];
  
  console.log('\nBot Movement Status:');
  let movingCount = 0;
  for (const agent of agents) {
    const player = players.find(p => p.id === agent.playerId);
    if (player) {
      const moving = player.pathfinding ? 'MOVING ✅' : 'STOPPED 🛑';
      const activity = player.activity?.description || 'none';
      console.log(`Bot ${agent.aiArenaBotId || agent.id}: ${moving}, activity: ${activity}`);
      if (player.pathfinding) movingCount++;
    }
  }
  
  console.log(`\nSummary: ${movingCount}/${agents.length} bots are moving`);
  
  if (movingCount > 0) {
    console.log('\n🎉 SUCCESS! Bots are now moving!');
  } else {
    console.log('\n⚠️ Bots still not moving. Checking agent details...');
    
    // Show more details about first agent
    if (agents[0]) {
      console.log('\nFirst agent details:', {
        id: agents[0].id,
        playerId: agents[0].playerId,
        aiArenaBotId: agents[0].aiArenaBotId,
        hasOperation: Boolean(agents[0].inProgressOperation),
        operationName: agents[0].inProgressOperation?.name || 'none',
        lastConversation: agents[0].lastConversation,
        personality: agents[0].personality
      });
    }
  }
}

// Run the script
kickEngine().catch(console.error);