#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixReformed1() {
  try {
    console.log('🔍 Looking for reformed1 bot...');
    
    // Find reformed1
    const bot = await prisma.bot.findFirst({
      where: { name: 'reformed1' },
      include: { 
        botSync: true 
      }
    });
    
    if (!bot) {
      console.log('❌ Bot reformed1 not found');
      return;
    }
    
    console.log(`✅ Found reformed1 (ID: ${bot.id})`);
    console.log(`   Current metaverseAgentId: ${bot.metaverseAgentId}`);
    console.log(`   isDeployed: ${bot.isDeployed}`);
    
    if (bot.metaverseAgentId === 'a:387302') {
      console.log('⚠️  Bot has stale agent ID a:387302, clearing it...');
      
      // Clear the stale agent ID from the bot
      await prisma.bot.update({
        where: { id: bot.id },
        data: {
          metaverseAgentId: null,
          isDeployed: false
        }
      });
      
      console.log('✅ Cleared stale metaverseAgentId from bot');
    }
    
    // Check metaverse sync status
    if (bot.metaverseSync) {
      console.log(`\n📊 MetaverseSync status: ${bot.metaverseSync.status}`);
      console.log(`   convexAgentId: ${bot.metaverseSync.convexAgentId}`);
      console.log(`   convexWorldId: ${bot.metaverseSync.convexWorldId}`);
      
      // Reset sync to PENDING for fresh deployment
      await prisma.metaverseSync.update({
        where: { id: bot.metaverseSync.id },
        data: {
          status: 'PENDING',
          convexAgentId: null,
          convexPlayerId: null,
          lastError: null,
          retryCount: 0
        }
      });
      
      console.log('✅ Reset MetaverseSync to PENDING status');
    } else {
      // Create a new sync record if it doesn't exist
      await prisma.metaverseSync.create({
        data: {
          botId: bot.id,
          status: 'PENDING',
          channelId: bot.channelId || 1, // Use bot's channel or default
          convexWorldId: null,
          convexAgentId: null,
          convexPlayerId: null,
          lastAttempt: new Date()
        }
      });
      
      console.log('✅ Created new MetaverseSync record');
    }
    
    console.log('\n🎯 Reformed1 is now ready for fresh deployment!');
    console.log('   Start the metaverse backend to trigger deployment');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixReformed1();