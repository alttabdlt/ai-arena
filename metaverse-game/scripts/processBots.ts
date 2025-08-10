#!/usr/bin/env node

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.VITE_CONVEX_URL || "https://reliable-ocelot-928.convex.cloud";

async function processBots() {
  const client = new ConvexHttpClient(CONVEX_URL);
  
  console.log("Processing Bot Registrations...\n");
  
  // Check queue status first
  const queueStatus = await client.query(api.migrations.batchRegistration.getQueueStatus, {});
  console.log("Queue Status:");
  console.log(`  Pending: ${queueStatus.pending}`);
  console.log(`  Processing: ${queueStatus.processing}`);
  console.log(`  Completed: ${queueStatus.completed}`);
  console.log(`  Failed: ${queueStatus.failed}`);
  console.log(`  Total: ${queueStatus.total}\n`);
  
  if (queueStatus.pending > 0) {
    console.log("Triggering batch processing...");
    
    // Trigger batch processing
    const result = await client.mutation(api.migrations.batchRegistration.triggerBatchProcessing, {});
    console.log("Batch processing result:", result);
    
    // Wait a bit for processing
    console.log("\nWaiting for processing...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check queue status again
    const newStatus = await client.query(api.migrations.batchRegistration.getQueueStatus, {});
    console.log("\nUpdated Queue Status:");
    console.log(`  Pending: ${newStatus.pending}`);
    console.log(`  Processing: ${newStatus.processing}`);
    console.log(`  Completed: ${newStatus.completed}`);
    console.log(`  Failed: ${newStatus.failed}`);
  } else {
    console.log("No pending registrations to process.");
  }
  
  // Check if bots are now in the world
  console.log("\nChecking world status...");
  // @ts-ignore - Known Convex type depth issue
  const worldStatus = await client.query(api.world.defaultWorldStatus);
  if (worldStatus) {
    // @ts-ignore - Known Convex type depth issue
    const worldData = await client.query(api.world.worldState, { worldId: worldStatus.worldId });
    if (worldData && worldData.world) {
      const { world } = worldData;
      console.log(`\nBots in world: ${world.players?.length || 0}`);
      console.log(`Agents: ${world.agents?.length || 0}`);
    }
  }
}

processBots().catch(console.error);