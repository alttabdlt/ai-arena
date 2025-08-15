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

async function testBotMovement() {
  const client = new ConvexHttpClient(CONVEX_URL);
  
  console.log('🤖 Testing bot movement in metaverse...\n');
  
  try {
    // Get default world status
    const worldStatus = await client.query(api.world.defaultWorldStatus, {});
    if (!worldStatus) {
      console.error('❌ No default world found');
      return;
    }
    
    const worldId = worldStatus.worldId;
    console.log(`🌍 Using world: ${worldId}`);
    
    // Get world state
    const worldState = await client.query(api.world.worldState, { worldId });
    if (!worldState?.world) {
      console.error('❌ Could not get world state');
      return;
    }
    
    // Get all agents and players
    const agents = worldState.world.agents || [];
    const players = worldState.world.players || [];
    
    console.log(`\n📊 World Statistics:`);
    console.log(`   Total Agents: ${agents.length}`);
    console.log(`   Total Players: ${players.length}`);
    
    // Check each agent's movement status
    console.log(`\n🔍 Bot Movement Status:\n`);
    
    let movingCount = 0;
    let stoppedCount = 0;
    let noPlayerCount = 0;
    let outOfEnergyCount = 0;
    
    for (const agent of agents) {
      const player = players.find(p => p.id === agent.playerId);
      
      if (!player) {
        console.log(`   ⚠️  Bot ${agent.aiArenaBotId || agent.id} - NO PLAYER FOUND`);
        noPlayerCount++;
        continue;
      }
      
      const isMoving = !!player.pathfinding;
      const hasEnergy = player.currentEnergy > 0;
      const activity = player.activity?.description || 'none';
      const zone = player.currentZone || 'unknown';
      
      const status = isMoving ? '✅ MOVING' : '🛑 STOPPED';
      const energyStatus = hasEnergy ? `Energy: ${player.currentEnergy}/${player.maxEnergy}` : '⚡ OUT OF ENERGY';
      
      console.log(`   ${status} Bot ${agent.aiArenaBotId || agent.id}`);
      console.log(`      - Position: (${Math.round(player.position.x)}, ${Math.round(player.position.y)})`);
      console.log(`      - Zone: ${zone}`);
      console.log(`      - ${energyStatus}`);
      console.log(`      - Activity: ${activity}`);
      
      if (player.pathfinding?.destination) {
        console.log(`      - Destination: (${player.pathfinding.destination.x}, ${player.pathfinding.destination.y})`);
      }
      
      console.log('');
      
      if (isMoving) movingCount++;
      else stoppedCount++;
      if (!hasEnergy) outOfEnergyCount++;
    }
    
    // Summary
    console.log(`\n📈 Summary:`);
    console.log(`   ✅ Moving: ${movingCount} bots`);
    console.log(`   🛑 Stopped: ${stoppedCount} bots`);
    console.log(`   ⚡ Out of Energy: ${outOfEnergyCount} bots`);
    console.log(`   ⚠️  Missing Player: ${noPlayerCount} agents`);
    
    // Check activity logs for recent movement
    console.log(`\n📜 Recent Activity (last 10 entries):\n`);
    const activities = await client.query(api.aiTown.activityLog.getRecentActivities, {
      worldId,
      limit: 10
    });
    
    for (const activity of activities || []) {
      const time = new Date(activity.timestamp).toLocaleTimeString();
      console.log(`   [${time}] ${activity.emoji || '📍'} ${activity.description}`);
    }
    
    // Final verdict
    console.log('\n' + '='.repeat(50));
    if (movingCount > 0) {
      console.log('✅ BOTS ARE MOVING! The fixes worked!');
    } else if (players.length === 0) {
      console.log('⚠️ No bots deployed yet. Deploy some bots first.');
    } else if (outOfEnergyCount === players.length) {
      console.log('⚡ All bots are out of energy. They need time to regenerate.');
    } else {
      console.log('❌ Bots are still frozen. Further investigation needed.');
    }
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('❌ Error testing bot movement:', error);
  }
}

// Run the test
testBotMovement().catch(console.error);