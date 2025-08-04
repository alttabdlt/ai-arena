const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listBots() {
  try {
    const bots = await prisma.bot.findMany({
      select: {
        id: true,
        name: true,
        personality: true,
        metaverseAgentId: true,
        currentZone: true,
        botSync: {
          select: {
            syncStatus: true,
          }
        }
      },
      take: 10
    });
    
    console.log('🤖 Available bots in database:\n');
    
    if (bots.length === 0) {
      console.log('No bots found in database.');
      return;
    }
    
    bots.forEach(bot => {
      const syncStatus = bot.botSync?.syncStatus || 'NOT_SYNCED';
      const isInMetaverse = bot.metaverseAgentId ? '✅' : '❌';
      console.log(`${isInMetaverse} ${bot.name} (${bot.personality})`);
      console.log(`   ID: ${bot.id}`);
      console.log(`   Sync Status: ${syncStatus}`);
      if (bot.currentZone) {
        console.log(`   Current Zone: ${bot.currentZone}`);
      }
      console.log();
    });
    
    const unsynced = bots.filter(b => !b.metaverseAgentId);
    if (unsynced.length > 0) {
      console.log(`\n💡 ${unsynced.length} bots are not yet in the metaverse and can be registered.`);
      console.log('Copy these bot IDs to test-bot-registration.js:');
      unsynced.forEach(bot => console.log(`  '${bot.id}',`));
    }
    
  } catch (error) {
    console.error('Error listing bots:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listBots();