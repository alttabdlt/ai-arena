#!/usr/bin/env node

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.VITE_CONVEX_URL || "https://reliable-ocelot-928.convex.cloud";

async function checkBots() {
  const client = new ConvexHttpClient(CONVEX_URL);
  
  console.log("Checking Bot Status...\n");
  
  // Get default world
  // @ts-ignore - Known Convex type depth issue
  const worldStatus = await client.query(api.world.defaultWorldStatus);
  if (!worldStatus) {
    console.log("No default world found!");
    return;
  }
  
  const worldId = worldStatus.worldId;
  console.log(`World ID: ${worldId}`);
  console.log(`Status: ${worldStatus.status}`);
  console.log(`Last Viewed: ${new Date(worldStatus.lastViewed || 0).toLocaleString()}\n`);
  
  // Get world state
  // @ts-ignore - Known Convex type depth issue
  const worldData = await client.query(api.world.worldState, { worldId });
  
  if (!worldData || !worldData.world) {
    console.log("No world data found!");
    return;
  }
  
  const { world } = worldData;
  
  console.log(`Players: ${world.players?.length || 0}`);
  console.log(`Agents: ${world.agents?.length || 0}`);
  console.log(`Conversations: ${world.conversations?.length || 0}\n`);
  
  // List players
  if (world.players && world.players.length > 0) {
    console.log("Players in world:");
    world.players.forEach((player: any) => {
      console.log(`  ${player.name || player.id}`);
      console.log(`    ID: ${player.id}`);
      console.log(`    Zone: ${player.currentZone || 'unknown'}`);
      console.log(`    Activity: ${player.activity?.description || 'none'}`);
      console.log(`    Position: (${Math.round(player.position.x)}, ${Math.round(player.position.y)})`);
      console.log(`    Human: ${player.human ? 'Yes' : 'No'}`);
    });
  } else {
    console.log("No players in world!");
    console.log("\nTo add bots:");
    console.log("1. Go to the AI Arena main app");
    console.log("2. Deploy some bots to the metaverse");
    console.log("3. Or use the 'Deploy Romeo & Juliet' test script");
  }
  
  // Check if engine is running
  console.log(`\nEngine Status: ${worldStatus.status}`);
  if (worldStatus.status !== 'running') {
    console.log("⚠️  Engine is not running! Bots won't be active.");
    console.log("The engine should start automatically when bots are added.");
  }
}

checkBots().catch(console.error);