const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBotStatus() {
  try {
    console.log('🔍 Checking bot metaverse status...\n');
    
    // Get all bots with their sync status
    const bots = await prisma.bot.findMany({
      include: {
        botSync: true,
        creator: {
          select: {
            username: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    
    if (bots.length === 0) {
      console.log('No bots found in database.');
      return;
    }
    
    // Categorize bots
    const synced = bots.filter(b => b.botSync?.syncStatus === 'SYNCED');
    const syncing = bots.filter(b => b.botSync?.syncStatus === 'SYNCING');
    const pending = bots.filter(b => b.botSync?.syncStatus === 'PENDING');
    const failed = bots.filter(b => b.botSync?.syncStatus === 'FAILED');
    const notStarted = bots.filter(b => !b.botSync);
    
    console.log('📊 Overall Statistics:');
    console.log(`   Total Bots: ${bots.length}`);
    console.log(`   ✅ Synced: ${synced.length}`);
    console.log(`   🔄 Syncing: ${syncing.length}`);
    console.log(`   ⏳ Pending: ${pending.length}`);
    console.log(`   ❌ Failed: ${failed.length}`);
    console.log(`   ⚪ Not Started: ${notStarted.length}`);
    console.log('\n' + '═'.repeat(80) + '\n');
    
    // Show detailed status for each bot
    console.log('📋 Detailed Bot Status:\n');
    
    bots.forEach((bot, index) => {
      const personality = bot.personality || 'WORKER';
      const emoji = personality === 'CRIMINAL' ? '🔫' : personality === 'GAMBLER' ? '🎰' : '⚒️';
      const statusEmoji = 
        bot.botSync?.syncStatus === 'SYNCED' ? '✅' :
        bot.botSync?.syncStatus === 'SYNCING' ? '🔄' :
        bot.botSync?.syncStatus === 'PENDING' ? '⏳' :
        bot.botSync?.syncStatus === 'FAILED' ? '❌' : '⚪';
      
      console.log(`${index + 1}. ${statusEmoji} ${bot.name} ${emoji}`);
      console.log(`   ID: ${bot.id}`);
      console.log(`   Creator: ${bot.creator.username}`);
      console.log(`   Personality: ${personality}`);
      console.log(`   Model: ${bot.modelType}`);
      console.log(`   Created: ${bot.createdAt.toLocaleDateString()}`);
      
      if (bot.botSync) {
        console.log(`   Sync Status: ${bot.botSync.syncStatus}`);
        if (bot.botSync.convexAgentId) {
          console.log(`   Agent ID: ${bot.botSync.convexAgentId}`);
        }
        if (bot.currentZone) {
          console.log(`   Current Zone: ${bot.currentZone}`);
        }
        if (bot.metaversePosition && bot.metaversePosition.x !== undefined) {
          console.log(`   Position: (${bot.metaversePosition.x}, ${bot.metaversePosition.y})`);
        }
        if (bot.botSync.lastSyncedAt) {
          console.log(`   Last Synced: ${bot.botSync.lastSyncedAt.toLocaleString()}`);
        }
        if (bot.botSync.syncErrors && bot.botSync.syncErrors.length > 0) {
          console.log(`   ⚠️  Errors: ${bot.botSync.syncErrors.join(', ')}`);
        }
      } else {
        console.log(`   Sync Status: Not Started`);
      }
      
      console.log('');
    });
    
    // Show action recommendations
    if (notStarted.length > 0 || failed.length > 0 || pending.length > 0) {
      console.log('═'.repeat(80));
      console.log('\n💡 Recommended Actions:\n');
      
      if (notStarted.length > 0) {
        console.log(`• ${notStarted.length} bots need to be deployed to the metaverse`);
        console.log('  Run: node scripts/deploy-all-bots-to-metaverse.js');
      }
      
      if (failed.length > 0) {
        console.log(`\n• ${failed.length} bots failed to sync and may need manual intervention`);
        failed.forEach(bot => {
          console.log(`  - ${bot.name}: Check error logs`);
        });
      }
      
      if (pending.length > 0) {
        console.log(`\n• ${pending.length} bots are pending sync`);
        console.log('  These should sync automatically within the next minute');
      }
    } else if (synced.length === bots.length) {
      console.log('🎉 All bots are successfully synced to the metaverse!');
    }
    
  } catch (error) {
    console.error('❌ Error checking bot status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkBotStatus();