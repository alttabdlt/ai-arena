#!/usr/bin/env node

/**
 * Reset All Undeployed Bots Script
 * 
 * This script resets all undeployed bots to ensure they can deploy fresh.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function resetAllUndeployedBots() {
  console.log('🔄 Resetting All Undeployed Bots\n');
  
  try {
    // 1. Find all undeployed bots
    console.log('1️⃣ Finding undeployed bots...');
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
    
    if (undeployedBots.length === 0) {
      console.log('   No undeployed bots found');
      return;
    }
    
    console.log(`   Found ${undeployedBots.length} undeployed bots:`);
    for (const bot of undeployedBots) {
      console.log(`   - ${bot.name} (channel: ${bot.channel || 'main'})`);
    }
    
    // 2. Clear all bot sync records
    console.log('\n2️⃣ Clearing all bot sync records...');
    const deleteResult = await prisma.botSync.deleteMany({});
    console.log(`   Deleted ${deleteResult.count} bot sync records`);
    
    // 3. Reset metaverse fields for all bots
    console.log('\n3️⃣ Resetting bot metaverse fields...');
    const updateResult = await prisma.bot.updateMany({
      where: {
        metaverseAgentId: null
      },
      data: {
        metaverseAgentId: null
      }
    });
    console.log(`   Reset ${updateResult.count} bots`);
    
    // 4. Clear cache
    console.log('\n4️⃣ Clearing cache...');
    const cacheDir = require('path').join(__dirname, '../../.cache');
    const fs = require('fs');
    
    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir);
      let cacheCleared = 0;
      files.forEach(file => {
        fs.unlinkSync(require('path').join(cacheDir, file));
        cacheCleared++;
      });
      console.log(`   Cleared ${cacheCleared} cache files`);
    }
    
    console.log('\n📊 Summary:');
    console.log('=============');
    console.log('✅ Bot sync records cleared');
    console.log('✅ Bot metaverse fields reset');
    console.log('✅ Cache cleared');
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('1. Restart the backend server');
    console.log('2. All undeployed bots will deploy fresh on next sync');
    console.log('3. Watch logs for successful deployments');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
resetAllUndeployedBots();