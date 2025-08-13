#!/usr/bin/env node

/**
 * Force Redeploy Bot Script
 * 
 * This script completely resets the bot's deployment status to force a fresh deployment.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function forceRedeployBot() {
  console.log('🔄 Force Redeploy Bot\n');
  
  try {
    // 1. Find the bot
    console.log('1️⃣ Finding bot "Broccoli"...');
    const bot = await prisma.bot.findFirst({
      where: { name: 'Broccoli' }
    });
    
    if (!bot) {
      console.log('❌ Bot not found');
      return;
    }
    
    console.log(`   Found bot: ${bot.name} (${bot.id})`);
    
    // 2. Clear all sync records
    console.log('\n2️⃣ Clearing all sync records...');
    await prisma.botSync.deleteMany({
      where: { botId: bot.id }
    });
    console.log('   Bot sync records deleted');
    
    // 3. Reset the bot's metaverse fields
    console.log('\n3️⃣ Resetting bot metaverse fields...');
    await prisma.bot.update({
      where: { id: bot.id },
      data: {
        metaverseAgentId: null
      }
    });
    console.log('   Bot metaverse agent ID cleared');
    
    // 4. Clear cache
    console.log('\n4️⃣ Clearing cache...');
    const cacheDir = require('path').join(__dirname, '../../.cache');
    const fs = require('fs');
    
    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir);
      files.forEach(file => {
        if (file.includes('deployment') || file.includes('world')) {
          fs.unlinkSync(require('path').join(cacheDir, file));
        }
      });
      console.log('   Cache cleared');
    }
    
    console.log('\n📊 Summary:');
    console.log('=============');
    console.log('✅ Bot sync records cleared');
    console.log('✅ Bot metaverse fields reset');
    console.log('✅ Cache cleared');
    console.log('');
    console.log('🎯 The bot will be deployed fresh on the next sync cycle');
    console.log('   Watch the backend logs for: "Creating bot agent"');
    console.log('   This happens every 30 seconds automatically');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
forceRedeployBot();