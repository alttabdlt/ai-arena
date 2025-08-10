#!/usr/bin/env node

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.VITE_CONVEX_URL || "https://reliable-ocelot-928.convex.cloud";

async function deployTestBots() {
  const client = new ConvexHttpClient(CONVEX_URL);
  
  console.log("Deploying Test Bots via HTTP...\n");
  
  // Get default world
  const worldStatus = await client.query(api.world.defaultWorldStatus);
  if (!worldStatus) {
    console.log("No default world found!");
    return;
  }
  
  const worldId = worldStatus.worldId;
  console.log(`Found world: ${worldId}\n`);
  
  // Test bot data
  const testBots = [
    {
      name: "Alice",
      character: "f1",
      identity: "A hardworking bot who likes to grind and build her empire steadily",
      plan: "I want to work hard, save money, and build a nice house in the suburbs",
      personality: "WORKER",
      aiArenaBotId: `test-alice-${Date.now()}`,
      initialZone: "suburb",
    },
    {
      name: "Bob", 
      character: "f5",
      identity: "A criminal mastermind always looking for the next score",
      plan: "I want to rob other bots, intimidate workers, and rule the dark alleys",
      personality: "CRIMINAL",
      aiArenaBotId: `test-bob-${Date.now()}`,
      initialZone: "darkAlley",
    },
    {
      name: "Charlie",
      character: "f2",
      identity: "A risk-taker who loves gambling and making big bets",
      plan: "I want to spend my time in the casino, make risky deals, and live on the edge",
      personality: "GAMBLER",
      aiArenaBotId: `test-charlie-${Date.now()}`,
      initialZone: "casino",
    },
    {
      name: "Diana",
      character: "f3",
      identity: "Another hardworking bot focused on trading and building wealth",
      plan: "I want to trade with others, avoid conflict, and build a successful business",
      personality: "WORKER",
      aiArenaBotId: `test-diana-${Date.now()}`,
      initialZone: "downtown",
    },
  ];
  
  for (const bot of testBots) {
    try {
      // Register bot via HTTP endpoint
      const response = await fetch(`${CONVEX_URL.replace('cloud', 'site')}/api/bots/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          worldId: worldId,
          name: bot.name,
          character: bot.character,
          identity: bot.identity,
          plan: bot.plan,
          aiArenaBotId: bot.aiArenaBotId,
          initialZone: bot.initialZone,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }
      
      const result = await response.json();
      console.log(`✅ Deployed ${bot.name} (${bot.personality})`);
      console.log(`   Player ID: ${result.playerId}`);
      console.log(`   Agent ID: ${result.agentId}`);
      console.log(`   Zone: ${bot.initialZone}`);
    } catch (error: any) {
      console.error(`❌ Failed to deploy ${bot.name}:`, error.message);
    }
  }
  
  console.log("\n🎮 Test bots deployed!");
  console.log("They should start interacting soon. Watch the Activity Logs!");
  console.log("\nTo check their status:");
  console.log("  npx tsx scripts/checkBots.ts");
  console.log("\nTo view activity logs:");
  console.log("  npx tsx scripts/testLogging.ts");
}

deployTestBots().catch(console.error);