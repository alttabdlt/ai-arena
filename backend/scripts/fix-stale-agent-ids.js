#!/usr/bin/env node

/**
 * Recovery script to fix stale agent IDs in the Arena backend
 * This script:
 * 1. Scans all bots with metaverseAgentId
 * 2. Verifies each agent exists in Convex
 * 3. Clears stale IDs and resets sync status
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

// Metaverse backend URL
const METAVERSE_BACKEND_URL = process.env.METAVERSE_BACKEND_URL || 'http://localhost:5001';

async function verifyAgentExists(worldId, agentId) {
  try {
    const response = await axios.post(`${METAVERSE_BACKEND_URL}/api/metaverse/agent/verify`, {
      worldId,
      agentId
    });
    return response.data.exists === true;
  } catch (error) {
    console.error(`Error verifying agent ${agentId}:`, error.message);
    return false;
  }
}

async function fixStaleAgentIds() {
  try {
    console.log('🔍 Scanning for bots with metaverse agent IDs...');
    
    // Get all bots with metaverse agent IDs
    const botsWithAgents = await prisma.bot.findMany({
      where: {
        metaverseAgentId: { not: null }
      },
      include: {
        botSync: true
      }
    });
    
    console.log(`Found ${botsWithAgents.length} bots with metaverse agent IDs`);
    
    let staleCount = 0;
    let validCount = 0;
    let errorCount = 0;
    
    for (const bot of botsWithAgents) {
      console.log(`\n📊 Checking bot: ${bot.name} (${bot.id})`);
      console.log(`   Agent ID: ${bot.metaverseAgentId}`);
      
      // Check if we have sync information
      if (!bot.botSync || !bot.botSync.convexWorldId) {
        console.log(`   ⚠️ No sync information found - marking as stale`);
        staleCount++;
        
        // Clear the stale agent ID
        await prisma.bot.update({
          where: { id: bot.id },
          data: {
            metaverseAgentId: null,
            currentZone: null,
            metaversePosition: null
          }
        });
        
        // Reset or create sync record
        if (bot.botSync) {
          await prisma.botSync.update({
            where: { id: bot.botSync.id },
            data: {
              syncStatus: 'PENDING',
              convexAgentId: null,
              convexPlayerId: null,
              statsSynced: false,
              syncErrors: JSON.stringify(['Agent ID was stale - cleared for redeployment'])
            }
          });
        } else {
          await prisma.botSync.create({
            data: {
              botId: bot.id,
              channel: bot.channel || 'main',
              syncStatus: 'PENDING',
              convexWorldId: null,
              convexAgentId: null,
              convexPlayerId: null
            }
          });
        }
        
        console.log(`   ✅ Cleared stale agent ID and reset sync`);
        continue;
      }
      
      // Verify the agent exists in Convex
      try {
        const exists = await verifyAgentExists(
          bot.botSync.convexWorldId,
          bot.metaverseAgentId
        );
        
        if (exists) {
          console.log(`   ✅ Agent verified - exists in Convex`);
          validCount++;
        } else {
          console.log(`   ❌ Agent not found in Convex - marking as stale`);
          staleCount++;
          
          // Clear the stale agent ID
          await prisma.bot.update({
            where: { id: bot.id },
            data: {
              metaverseAgentId: null,
              currentZone: null,
              metaversePosition: null
            }
          });
          
          // Reset sync record
          await prisma.botSync.update({
            where: { id: bot.botSync.id },
            data: {
              syncStatus: 'PENDING',
              convexAgentId: null,
              convexPlayerId: null,
              statsSynced: false,
              syncErrors: JSON.stringify(['Agent not found in Convex - cleared for redeployment'])
            }
          });
          
          console.log(`   ✅ Cleared stale agent ID and reset sync`);
        }
      } catch (error) {
        console.error(`   ❌ Error verifying agent:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   Total bots checked: ${botsWithAgents.length}`);
    console.log(`   Valid agents: ${validCount}`);
    console.log(`   Stale agents cleared: ${staleCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log('='.repeat(60));
    
    if (staleCount > 0) {
      console.log('\n✅ Stale agent IDs have been cleared.');
      console.log('   Run the metaverse backend to trigger redeployment.');
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Add endpoint verification check
async function checkMetaverseBackend() {
  try {
    const response = await axios.get(`${METAVERSE_BACKEND_URL}/health`);
    if (response.status === 200) {
      console.log(`✅ Metaverse backend is running at ${METAVERSE_BACKEND_URL}`);
      return true;
    }
  } catch (error) {
    console.error(`❌ Cannot connect to metaverse backend at ${METAVERSE_BACKEND_URL}`);
    console.error('   Please ensure the metaverse backend is running.');
    console.error('   Run: cd metaverse-game/backend && npm run dev');
    return false;
  }
}

// Main execution
async function main() {
  console.log('🔧 Stale Agent ID Recovery Script');
  console.log('==================================\n');
  
  // Check if metaverse backend is running
  const backendAvailable = await checkMetaverseBackend();
  
  if (!backendAvailable) {
    console.log('\n⚠️  Proceeding with limited functionality...');
    console.log('   Will only clear bots without sync information.\n');
  }
  
  await fixStaleAgentIds();
}

main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});