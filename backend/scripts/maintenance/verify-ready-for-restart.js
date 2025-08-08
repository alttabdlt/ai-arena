#!/usr/bin/env node

/**
 * Verify Ready for Restart Script
 * 
 * This script checks that everything is clean and ready for a backend restart.
 */

const { PrismaClient } = require('@prisma/client');
const { ConvexHttpClient } = require('convex/browser');

const prisma = new PrismaClient();

async function verifyReadyForRestart() {
  console.log('✅ Verifying System Ready for Restart\n');
  
  let allGood = true;
  
  try {
    // 1. Initialize Convex client
    const convexUrl = 'https://reliable-ocelot-928.convex.cloud';
    const client = new ConvexHttpClient(convexUrl);
    
    // 2. Check default world
    console.log('1️⃣ Checking default world...');
    const defaultWorldStatus = await client.query('world:defaultWorldStatus');
    
    if (!defaultWorldStatus) {
      console.log('   ❌ No default world found');
      allGood = false;
    } else {
      console.log(`   ✅ Default world exists: ${defaultWorldStatus.worldId}`);
    }
    
    // 3. Check world instances
    console.log('\n2️⃣ Checking world instances...');
    const checkResult = await client.query('aiTown/fixWorldInstances:checkWorldInstances');
    
    if (checkResult.invalidCount > 0) {
      console.log(`   ❌ Found ${checkResult.invalidCount} invalid world instances`);
      allGood = false;
    } else {
      console.log(`   ✅ All ${checkResult.totalCount} world instances are valid`);
    }
    
    // 4. Check bot registrations
    console.log('\n3️⃣ Checking bot registrations...');
    const queueStatus = await client.query('aiTown/batchRegistration:getQueueStatus');
    
    if (queueStatus.pending > 0 || queueStatus.processing > 0) {
      console.log(`   ⚠️  Found ${queueStatus.pending} pending and ${queueStatus.processing} processing registrations`);
      console.log('   These will be cleared on restart');
    } else {
      console.log(`   ✅ No stuck registrations (${queueStatus.completed} completed, ${queueStatus.failed} failed)`);
    }
    
    // 5. Check undeployed bots
    console.log('\n4️⃣ Checking undeployed bots...');
    const undeployedBots = await prisma.bot.findMany({
      where: {
        metaverseAgentId: null
      },
      select: {
        id: true,
        name: true,
        channel: true
      }
    });
    
    if (undeployedBots.length > 0) {
      console.log(`   📝 ${undeployedBots.length} bots ready to deploy:`);
      for (const bot of undeployedBots) {
        console.log(`      - ${bot.name} (${bot.channel || 'main'})`);
      }
    } else {
      console.log('   ✅ All bots are deployed');
    }
    
    // 6. Check bot sync records
    console.log('\n5️⃣ Checking bot sync records...');
    const syncCount = await prisma.botSync.count();
    
    if (syncCount > 0) {
      console.log(`   ⚠️  Found ${syncCount} bot sync records (will be cleared on restart)`);
    } else {
      console.log('   ✅ No stuck bot sync records');
    }
    
    // 7. Check channels
    console.log('\n6️⃣ Checking channels...');
    const channels = await prisma.channelMetadata.findMany({
      select: {
        channel: true,
        worldId: true
      }
    });
    
    console.log(`   Found ${channels.length} channels:`);
    for (const channel of channels) {
      const worldIdDisplay = channel.worldId 
        ? (channel.worldId === defaultWorldStatus?.worldId ? '✅ default' : '❌ invalid')
        : '⚠️  none';
      console.log(`   - ${channel.channel}: ${worldIdDisplay}`);
    }
    
    // Summary
    console.log('\n📊 Summary:');
    console.log('=============');
    
    if (allGood) {
      console.log('✅ System is READY for restart!');
      console.log('');
      console.log('🎯 Action Required:');
      console.log('1. Stop the backend server (Ctrl+C in the terminal)');
      console.log('2. Start it again: npm run dev');
      console.log('3. Watch for "Creating bot agent" messages');
      console.log('4. Bots will deploy with correct world IDs');
    } else {
      console.log('⚠️  Some issues detected. Run fix-world-instances.js again.');
    }
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the verification
verifyReadyForRestart();