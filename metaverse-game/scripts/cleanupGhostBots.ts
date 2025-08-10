#!/usr/bin/env node

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.VITE_CONVEX_URL || "https://reliable-ocelot-928.convex.cloud";

async function cleanupGhostBots() {
  const client = new ConvexHttpClient(CONVEX_URL);
  
  console.log("🔍 Finding and cleaning up ghost bots...\n");
  
  try {
    // Get the default world
    const worldStatus = await client.query(api.world.defaultWorldStatus, {});
    if (!worldStatus) {
      console.error("❌ No default world found");
      return;
    }
    
    const worldId = worldStatus.worldId;
    console.log(`📍 World ID: ${worldId}`);
    
    // First do a dry run to see what will be deleted
    console.log("\n🔍 Running dry run to identify ghost bots...");
    const dryRunResult = await client.mutation(api.migrations.migration.cleanupAllGhostBots, {
      worldId,
      dryRun: true,
    });
    
    console.log("\n📊 Dry Run Results:");
    console.log(`  Total ghost bots found: ${dryRunResult.totalGhostBots}`);
    console.log(`  Valid agents: ${dryRunResult.validAgents}`);
    console.log(`  Valid players: ${dryRunResult.validPlayers}`);
    
    if (dryRunResult.ghostBots && dryRunResult.ghostBots.length > 0) {
      console.log("\n👻 Ghost bots to be removed:");
      dryRunResult.ghostBots.forEach((bot: any) => {
        console.log(`  - Agent: ${bot.agentId}, Player: ${bot.playerId}, ArenaID: ${bot.aiArenaBotId}`);
      });
      
      // Ask for confirmation
      console.log("\n⚠️  Proceeding with cleanup...");
      
      // Run the actual cleanup
      const cleanupResult = await client.mutation(api.migrations.migration.cleanupAllGhostBots, {
        worldId,
        dryRun: false,
      });
      
      console.log("\n✅ Cleanup Complete!");
      console.log(`  Successfully cleaned: ${cleanupResult.successfulCleanups} bots`);
      console.log(`  Failed cleanups: ${cleanupResult.failedCleanups}`);
      console.log(`  Remaining agents: ${cleanupResult.remainingAgents}`);
      console.log(`  Remaining players: ${cleanupResult.remainingPlayers}`);
    } else {
      console.log("\n✅ No ghost bots found! Your world is clean.");
    }
    
  } catch (error) {
    console.error("\n❌ Error during cleanup:", error);
  }
}

// Run the cleanup
cleanupGhostBots().catch(console.error);