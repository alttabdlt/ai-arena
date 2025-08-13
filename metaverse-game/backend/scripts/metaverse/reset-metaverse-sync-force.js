#!/usr/bin/env node

/**
 * Reset Metaverse Sync - Force Mode (Non-Interactive)
 * 
 * This script resets all metaverse sync data to handle Convex world wipes
 * Use when: Convex has been wiped and old world IDs are invalid
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetMetaverseSync() {
  console.log('\n🔄 Metaverse Sync Reset Script (Force Mode)\n');
  console.log('=' .repeat(40) + '\n');

  try {
    // Get current stats
    const botSyncCount = await prisma.botSync.count();
    const botsWithMetaverse = await prisma.bot.count({
      where: {
        metaverseAgentId: { not: null }
      }
    });

    console.log('📊 Current Status:');
    console.log(`   - Bot sync records: ${botSyncCount}`);
    console.log(`   - Bots with metaverse IDs: ${botsWithMetaverse}\n`);

    console.log('🔧 Resetting sync data...\n');

    // Reset all BotSync records
    const botSyncResult = await prisma.botSync.updateMany({
      data: {
        convexWorldId: null,
        convexAgentId: null,
        convexPlayerId: null,
        syncStatus: 'PENDING',
        lastSyncedAt: null,
        syncErrors: [],
        personalityMapped: false,
        positionSynced: false,
        statsSynced: false,
      }
    });

    console.log(`   ✅ Reset ${botSyncResult.count} BotSync records`);

    // Clear metaverse fields from all bots
    const botResult = await prisma.bot.updateMany({
      data: {
        metaverseAgentId: null,
        currentZone: null,
        metaversePosition: {},
        lastZoneChange: null,
      }
    });

    console.log(`   ✅ Cleared metaverse data from ${botResult.count} bots`);

    // Clear any channel world IDs
    const channelResult = await prisma.channelMetadata.updateMany({
      data: {
        worldId: null,
      }
    });

    console.log(`   ✅ Cleared world IDs from ${channelResult.count} channels`);

    // Get final stats
    const finalBotSyncCount = await prisma.botSync.count({
      where: { syncStatus: 'PENDING' }
    });

    console.log('\n✨ Reset Complete!\n');
    console.log('📊 Final Status:');
    console.log(`   - Pending syncs: ${finalBotSyncCount}`);
    console.log(`   - All bots will be re-deployed on next sync cycle`);
    console.log('\n📝 Next Steps:');
    console.log('   1. Restart the backend server: npm run dev');
    console.log('   2. The bot sync service will automatically re-deploy bots');
    console.log('   3. Monitor logs for successful world creation and bot deployment\n');

  } catch (error) {
    console.error('❌ Error during reset:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the reset
resetMetaverseSync().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});