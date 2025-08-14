#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkReformedBots() {
  try {
    const bots = await prisma.bot.findMany({
      where: {
        name: { in: ['reformed1', 'reformed2'] }
      },
      include: {
        botSync: true
      }
    });
    
    console.log('\n=== Reformed Bots Status ===\n');
    
    for (const bot of bots) {
      console.log(`Bot: ${bot.name}`);
      console.log(`  ID: ${bot.id}`);
      console.log(`  metaverseAgentId: ${bot.metaverseAgentId || 'null (cleared)'}`);
      console.log(`  currentZone: ${bot.currentZone || 'null'}`);
      console.log(`  channel: ${bot.channel}`);
      
      if (bot.botSync) {
        console.log(`  Sync Status: ${bot.botSync.syncStatus}`);
        console.log(`  convexAgentId: ${bot.botSync.convexAgentId || 'null'}`);
        console.log(`  convexWorldId: ${bot.botSync.convexWorldId || 'null'}`);
        console.log(`  syncErrors: ${bot.botSync.syncErrors || 'none'}`);
      } else {
        console.log(`  Sync Status: No sync record`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkReformedBots();