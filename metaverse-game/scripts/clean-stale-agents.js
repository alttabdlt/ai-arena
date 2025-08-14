#!/usr/bin/env node

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

async function cleanStaleAgents() {
  // Get Convex URL from environment
  const convexUrl = process.env.VITE_CONVEX_URL || 'https://reliable-ocelot-928.convex.cloud';
  
  console.log('🔍 Connecting to Convex:', convexUrl);
  const client = new ConvexHttpClient(convexUrl);
  
  try {
    // First, find all stale agents
    console.log('\n📊 Checking for stale agent references...');
    const staleAgentsResult = await client.query(api.cleanup.cleanStaleAgents.findStaleAgents, {});
    
    console.log(`\n✅ Scanned ${staleAgentsResult.totalWorlds} worlds`);
    console.log(`⚠️ Found ${staleAgentsResult.staleAgentsFound} stale agent references`);
    
    if (staleAgentsResult.staleAgentsFound > 0) {
      console.log('\n📋 Stale agents found:');
      staleAgentsResult.staleAgents.forEach(stale => {
        console.log(`  - Agent ${stale.agentId} in world ${stale.worldId}`);
        if (stale.aiArenaBotId) {
          console.log(`    Associated with AI Arena bot: ${stale.aiArenaBotId}`);
        }
      });
      
      // Clean up the stale references
      console.log('\n🧹 Cleaning up stale references...');
      const cleanupResult = await client.mutation(api.cleanup.cleanStaleAgents.cleanStaleAgents, {});
      
      console.log(`\n✅ ${cleanupResult.message}`);
      
      if (cleanupResult.cleanedDetails.length > 0) {
        console.log('\n📋 Cleanup details:');
        cleanupResult.cleanedDetails.forEach(detail => {
          console.log(`  World ${detail.worldId}:`);
          detail.agentsRemoved.forEach(agentId => {
            console.log(`    - Removed agent ${agentId}`);
          });
        });
      }
    } else {
      console.log('\n✅ No stale agent references found. All agents are valid!');
    }
    
    // Specifically check for and clean agent a:387302 if it exists
    console.log('\n🔍 Checking for specific problematic agent a:387302...');
    const cleanSpecificResult = await client.mutation(api.cleanup.cleanStaleAgents.cleanSpecificAgent, {
      agentId: 'a:387302'
    });
    
    console.log(`✅ ${cleanSpecificResult.message}`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
  
  console.log('\n✨ Cleanup complete!');
}

// Run the cleanup
cleanStaleAgents().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});