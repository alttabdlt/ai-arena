#!/usr/bin/env node

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.VITE_CONVEX_URL || "https://reliable-ocelot-928.convex.cloud";

async function directDeploy() {
  const client = new ConvexHttpClient(CONVEX_URL);
  
  console.log("Direct Bot Deployment...\n");
  
  // Get default world
  // @ts-ignore - Known Convex type depth issue
  const worldStatus = await client.query(api.world.defaultWorldStatus);
  if (!worldStatus) {
    console.log("No default world found!");
    return;
  }
  
  const worldId = worldStatus.worldId;
  console.log(`Found world: ${worldId}`);
  console.log(`Engine status: ${worldStatus.status}\n`);
  
  // Test bots with personalities
  const testBots = [
    {
      name: "Alice",
      character: "f1",
      identity: "A hardworking bot who likes to grind and build her empire steadily",
      plan: "I want to work hard, save money, and build a nice house in the suburbs",
      aiArenaBotId: `alice-${Date.now()}`,
      initialZone: "suburb",
      personality: "WORKER",
    },
    {
      name: "Bob", 
      character: "f5",
      identity: "A criminal mastermind always looking for the next score",
      plan: "I want to rob other bots, intimidate workers, and rule the dark alleys",
      aiArenaBotId: `bob-${Date.now()}`,
      initialZone: "darkAlley",
      personality: "CRIMINAL",
    },
  ];
  
  console.log("Creating bots directly via sendInput...\n");
  
  for (const bot of testBots) {
    try {
      // Create bot directly via sendInput
      const inputId = await client.mutation(api.aiTown.main.sendInput, {
        worldId: worldId,
        name: "createAgentWithPersonality",
        args: {
          name: bot.name,
          character: bot.character,
          identity: bot.identity,
          plan: bot.plan,
          aiArenaBotId: bot.aiArenaBotId,
          initialZone: bot.initialZone,
          personality: bot.personality,
        },
      });
      
      console.log(`✅ Created input for ${bot.name} (${bot.personality})`);
      console.log(`   Input ID: ${inputId}`);
      
      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check input status
      const status = await client.query(api.aiTown.main.inputStatus, { inputId });
      if (status) {
        console.log(`   Status: ${status.kind === 'ok' ? 'Success' : 'Failed'}`);
        if (status.kind === 'ok' && status.value) {
          console.log(`   Player ID: ${status.value.playerId}`);
          console.log(`   Agent ID: ${status.value.agentId}`);
        } else if (status.kind === 'error') {
          console.log(`   Error: ${status.message}`);
        }
      } else {
        console.log(`   Status: Processing...`);
      }
    } catch (error: any) {
      console.error(`❌ Failed to deploy ${bot.name}:`, error.message);
    }
  }
  
  console.log("\n🎮 Checking world state...");
  
  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Check world state
  // @ts-ignore - Known Convex type depth issue
  const worldData = await client.query(api.world.worldState, { worldId });
  if (worldData && worldData.world) {
    const { world } = worldData;
    console.log(`\nPlayers in world: ${world.players?.length || 0}`);
    console.log(`Agents: ${world.agents?.length || 0}`);
    console.log(`Conversations: ${world.conversations?.length || 0}`);
    
    if (world.players && world.players.length > 0) {
      console.log("\n✅ Success! Bots are in the world:");
      world.players.forEach((player: any) => {
        console.log(`  - ${player.name} (${player.id}) in ${player.currentZone || 'unknown'}`);
      });
      
      console.log("\n🎉 Bot deployment working! Now they should start interacting.");
      console.log("Check the Activity Logs in the UI to see conversations and relationships!");
    }
  }
}

directDeploy().catch(console.error);