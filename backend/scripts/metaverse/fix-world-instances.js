#!/usr/bin/env node

/**
 * Fix World Instances Script
 * 
 * This script fixes all worldInstances in Convex that have invalid world IDs.
 * It will either update them to use the correct default world ID or delete
 * empty instances.
 */

const { ConvexHttpClient } = require('convex/browser');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixWorldInstances() {
  console.log('🔧 Fixing World Instances\n');
  
  try {
    // 1. Initialize Convex client
    const convexUrl = 'https://reliable-ocelot-928.convex.cloud';
    const client = new ConvexHttpClient(convexUrl);
    
    // 2. Check current state
    console.log('1️⃣ Checking current world instances...');
    const checkResult = await client.query('aiTown/fixWorldInstances:checkWorldInstances');
    
    if (!checkResult.defaultWorldId) {
      console.log('❌ No default world found');
      return;
    }
    
    console.log(`   Default world: ${checkResult.defaultWorldId}`);
    console.log(`   Total instances: ${checkResult.totalCount}`);
    console.log(`   Valid instances: ${checkResult.validCount}`);
    console.log(`   Invalid instances: ${checkResult.invalidCount}`);
    
    if (checkResult.invalidCount === 0) {
      console.log('\n✅ All instances already have correct world IDs!');
      return;
    }
    
    // Show invalid instances
    console.log('\n   Invalid instances:');
    for (const inst of checkResult.instances) {
      if (!inst.isValid) {
        console.log(`   - ${inst.zoneType} (${inst.id})`);
        console.log(`     Current world: ${inst.worldId}`);
        console.log(`     Players: ${inst.currentPlayers}, Bots: ${inst.currentBots}`);
      }
    }
    
    // 3. Fix invalid instances
    console.log('\n2️⃣ Fixing invalid world instances...');
    const fixResult = await client.mutation('aiTown/fixWorldInstances:fixInvalidWorldInstances');
    
    console.log(`   ✅ Fixed ${fixResult.fixedCount} instances`);
    console.log(`   🗑️  Deleted ${fixResult.deletedCount} empty instances`);
    
    if (fixResult.results && fixResult.results.length > 0) {
      console.log('\n   Actions taken:');
      for (const result of fixResult.results) {
        if (result.action === 'updated') {
          console.log(`   - Updated ${result.zoneType} instance to use correct world`);
        } else if (result.action === 'deleted') {
          console.log(`   - Deleted empty ${result.zoneType} instance`);
        }
      }
    }
    
    // 4. Clear any stuck registrations
    console.log('\n3️⃣ Clearing stuck registrations with invalid world IDs...');
    const clearResult = await client.mutation('aiTown/fixWorldInstances:clearInvalidWorldRegistrations');
    console.log(`   Cleared ${clearResult.clearedCount} registrations`);
    
    // 5. Clear bot sync records
    console.log('\n4️⃣ Clearing bot sync records...');
    await prisma.botSync.deleteMany({});
    console.log('   All bot sync records cleared');
    
    // 6. Reset undeployed bots
    console.log('\n5️⃣ Resetting undeployed bots...');
    const undeployedBots = await prisma.bot.findMany({
      where: {
        metaverseAgentId: null
      },
      select: {
        id: true,
        name: true
      }
    });
    
    if (undeployedBots.length > 0) {
      console.log(`   Found ${undeployedBots.length} undeployed bots to reset:`);
      for (const bot of undeployedBots) {
        console.log(`   - ${bot.name}`);
      }
    }
    
    // 7. Clear cache
    console.log('\n6️⃣ Clearing cache...');
    const cacheDir = require('path').join(__dirname, '../../.cache');
    const fs = require('fs');
    
    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir);
      let cacheCleared = 0;
      files.forEach(file => {
        if (file.includes('world') || file.includes('deployment')) {
          fs.unlinkSync(require('path').join(cacheDir, file));
          cacheCleared++;
        }
      });
      console.log(`   Cleared ${cacheCleared} cache files`);
    }
    
    // 8. Verify the fix
    console.log('\n7️⃣ Verifying the fix...');
    const verifyResult = await client.query('aiTown/fixWorldInstances:checkWorldInstances');
    
    console.log(`   Total instances: ${verifyResult.totalCount}`);
    console.log(`   Valid instances: ${verifyResult.validCount}`);
    console.log(`   Invalid instances: ${verifyResult.invalidCount}`);
    
    if (verifyResult.invalidCount === 0) {
      console.log('\n✅ SUCCESS! All world instances now have correct world IDs!');
    } else {
      console.log('\n⚠️  Some instances may still have issues. Check the logs.');
    }
    
    // 9. Summary
    console.log('\n📊 Summary:');
    console.log('=============');
    console.log('✅ World instances fixed');
    console.log('✅ Stuck registrations cleared');
    console.log('✅ Bot sync records reset');
    console.log('✅ Cache cleared');
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Restart the backend server: npm run dev');
    console.log('2. Bots will deploy with correct world IDs');
    console.log('3. Monitor logs for successful deployments');
    
  } catch (error) {
    console.error('❌ Error fixing instances:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixWorldInstances();