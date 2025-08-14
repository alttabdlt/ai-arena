#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function monitorBots() {
  console.log('\n📊 Bot Deployment Monitor');
  console.log('=========================\n');
  
  const bots = await prisma.bot.findMany({
    where: {
      name: { in: ['reformed1', 'reformed2'] }
    },
    include: {
      botSync: true
    }
  });
  
  for (const bot of bots) {
    console.log(`Bot: ${bot.name}`);
    console.log(`  metaverseAgentId: ${bot.metaverseAgentId || '❌ null'}`);
    console.log(`  currentZone: ${bot.currentZone || '❌ null'}`);
    
    if (bot.botSync) {
      console.log(`  Sync Status: ${bot.botSync.syncStatus}`);
      console.log(`  convexAgentId: ${bot.botSync.convexAgentId || '❌ null'}`);
      console.log(`  convexWorldId: ${bot.botSync.convexWorldId || '❌ null'}`);
      
      // Check for stale IDs
      const knownStaleIds = ['a:387302', 'a:387306'];
      if (bot.metaverseAgentId && knownStaleIds.includes(bot.metaverseAgentId)) {
        console.log(`  ⚠️ WARNING: STALE ID DETECTED!`);
      } else if (bot.metaverseAgentId) {
        console.log(`  ✅ NEW AGENT ID ASSIGNED!`);
      }
    }
    console.log('');
  }
  
  await prisma.$disconnect();
}

// Run in a loop
async function watchLoop() {
  while (true) {
    await monitorBots();
    await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
  }
}

// Run once if called directly
if (require.main === module) {
  monitorBots().catch(console.error);
}