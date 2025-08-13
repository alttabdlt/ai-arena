#!/usr/bin/env node

/**
 * Clean Invalid World Instances Script
 * 
 * This script cleans up invalid world instances that were created
 * without proper initialization (missing worldStatus and engine).
 */

const { PrismaClient } = require('@prisma/client');
const { ConvexHttpClient } = require('convex/browser');

const prisma = new PrismaClient();

async function cleanInvalidWorlds() {
  console.log('🧹 Cleaning Invalid World Instances\n');
  
  try {
    // 1. Initialize Convex client
    const convexUrl = process.env.VITE_CONVEX_URL || 'https://reliable-ocelot-928.convex.cloud';
    const client = new ConvexHttpClient(convexUrl);
    
    // 2. Check for default world status
    console.log('1️⃣ Checking for default world...');
    let defaultWorldStatus;
    try {
      defaultWorldStatus = await client.query('world:defaultWorldStatus');
      if (defaultWorldStatus) {
        console.log(`✅ Found default world: ${defaultWorldStatus.worldId}`);
      }
    } catch (error) {
      console.error('❌ Could not fetch default world status:', error.message);
      console.log('   Please ensure Convex is running and initialized');
      return;
    }
    
    if (!defaultWorldStatus) {
      console.log('⚠️  No default world found. Run the init mutation in Convex dashboard first.');
      return;
    }
    
    const defaultWorldId = defaultWorldStatus.worldId;
    
    // 3. Reset all channel world IDs to use the default world
    console.log('\n2️⃣ Resetting channel world IDs to use default world...');
    const channelUpdateResult = await prisma.channelMetadata.updateMany({
      data: {
        worldId: defaultWorldId
      }
    });
    console.log(`✅ Updated ${channelUpdateResult.count} channels to use default world`);
    
    // 4. Clear any orphaned bot sync entries
    console.log('\n3️⃣ Cleaning up bot sync entries...');
    
    // Find bots with invalid metaverse agent IDs
    const botsWithAgents = await prisma.bot.findMany({
      where: {
        metaverseAgentId: { not: null }
      },
      select: {
        id: true,
        name: true,
        metaverseAgentId: true,
        channel: true
      }
    });
    
    let cleanedBots = 0;
    for (const bot of botsWithAgents) {
      try {
        // Check if the agent exists in the default world
        const agents = await client.query('aiTown/agentQuery:listAgents', {
          worldId: defaultWorldId
        });
        
        const agentExists = agents && agents.some(a => a.id === bot.metaverseAgentId);
        
        if (!agentExists) {
          // Agent doesn't exist, clear the reference
          await prisma.bot.update({
            where: { id: bot.id },
            data: { 
              metaverseAgentId: null,
              metaverseLastSync: null
            }
          });
          console.log(`   Cleaned bot ${bot.name} (invalid agent reference)`);
          cleanedBots++;
        }
      } catch (error) {
        console.log(`   Error checking agent for bot ${bot.name}:`, error.message);
      }
    }
    
    if (cleanedBots > 0) {
      console.log(`✅ Cleaned ${cleanedBots} bots with invalid agent references`);
    } else {
      console.log('✅ No invalid agent references found');
    }
    
    // 5. Clear the world discovery cache
    console.log('\n4️⃣ Clearing world discovery cache...');
    const cacheDir = require('path').join(__dirname, '../../.cache');
    const fs = require('fs');
    
    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir);
      files.forEach(file => {
        if (file.startsWith('world-') && file.endsWith('.json')) {
          fs.unlinkSync(require('path').join(cacheDir, file));
        }
      });
      console.log('✅ Cleared world discovery cache');
    }
    
    // 6. Summary
    console.log('\n📊 Cleanup Summary:');
    console.log('====================');
    console.log(`✅ Default world ID: ${defaultWorldId}`);
    console.log(`✅ Channels updated: ${channelUpdateResult.count}`);
    console.log(`✅ Invalid bot references cleaned: ${cleanedBots}`);
    console.log('✅ World discovery cache cleared');
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Restart the backend server to pick up changes');
    console.log('2. Deploy new bots - they will now use the default world');
    console.log('3. All zones will share the same world for simplicity');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanInvalidWorlds();