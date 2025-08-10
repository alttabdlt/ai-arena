#!/usr/bin/env node

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.VITE_CONVEX_URL || "https://reliable-ocelot-928.convex.cloud";

async function testLogging() {
  const client = new ConvexHttpClient(CONVEX_URL);
  
  console.log("Testing Activity Logging System...\n");
  
  // Get default world
  // @ts-ignore - Known Convex type depth issue
  const worldStatus = await client.query(api.world.defaultWorldStatus);
  if (!worldStatus) {
    console.log("No default world found!");
    return;
  }
  
  const worldId = worldStatus.worldId;
  console.log(`Found world: ${worldId}\n`);
  
  // Get recent activity logs
  const logs = await client.query(api.world.getActivityLogs, {
    worldId,
    limit: 20
  });
  
  console.log(`Found ${logs.length} activity logs:\n`);
  
  if (logs.length === 0) {
    console.log("No activity logs found. Bots may not be active.");
  } else {
    logs.forEach((log: any) => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      console.log(`[${time}] ${log.emoji || '📝'} ${log.type}: ${log.description}`);
      if (log.details) {
        console.log(`  Details:`, log.details);
      }
    });
  }
  
  // Get conversations
  // @ts-ignore - Known Convex type depth issue
  const worldData = await client.query(api.world.worldState, { worldId });
  if (worldData && worldData.world) {
    const { world } = worldData;
    
    if (world.conversations) {
      console.log(`\n${world.conversations.length} active conversations`);
      world.conversations.forEach((conv: any) => {
        console.log(`  Conversation ${conv.id}: ${conv.numMessages} messages`);
      });
    }
    
    // Get players
    if (world.players) {
      console.log(`\n${world.players.length} players in world:`);
      world.players.forEach((player: any) => {
        console.log(`  ${player.name} (${player.id}) - Zone: ${player.currentZone || 'unknown'}`);
      });
    }
  }
}

testLogging().catch(console.error);