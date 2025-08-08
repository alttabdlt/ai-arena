const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupInvalidBotSyncs() {
  try {
    console.log('🧹 Starting cleanup of invalid bot syncs...\n');
    
    // Find all bot syncs with FAILED status or invalid world IDs
    const failedSyncs = await prisma.botSync.findMany({
      where: {
        OR: [
          { syncStatus: 'FAILED' },
          { 
            AND: [
              { convexWorldId: { not: null } },
              { convexWorldId: 'm17dkz0psv5e7b812sjjxwpwgd7n374s' } // Known invalid world
            ]
          }
        ]
      },
      include: {
        bot: true
      }
    });
    
    if (failedSyncs.length === 0) {
      console.log('✅ No invalid bot syncs found!');
      return;
    }
    
    console.log(`Found ${failedSyncs.length} invalid bot syncs to clean up:\n`);
    
    for (const sync of failedSyncs) {
      console.log(`🤖 Bot: ${sync.bot.name}`);
      console.log(`   Status: ${sync.syncStatus}`);
      console.log(`   World ID: ${sync.convexWorldId || 'None'}`);
      console.log(`   Errors: ${sync.syncErrors.join(', ') || 'None'}`);
    }
    
    console.log('\n🔄 Resetting invalid syncs...');
    
    // Reset all invalid syncs
    const result = await prisma.botSync.updateMany({
      where: {
        OR: [
          { syncStatus: 'FAILED' },
          { 
            AND: [
              { convexWorldId: { not: null } },
              { convexWorldId: 'm17dkz0psv5e7b812sjjxwpwgd7n374s' }
            ]
          }
        ]
      },
      data: {
        syncStatus: 'PENDING',
        syncErrors: [],
        convexWorldId: null,
        convexAgentId: null,
        convexPlayerId: null,
        personalityMapped: false,
        positionSynced: false,
        statsSynced: false,
        lastSyncedAt: null
      }
    });
    
    console.log(`\n✅ Reset ${result.count} bot sync records to PENDING status`);
    
    // Also clear metaverse data from bots
    const botsReset = await prisma.bot.updateMany({
      where: {
        OR: [
          { metaverseAgentId: { not: null } },
          { currentZone: { not: null } }
        ]
      },
      data: {
        metaverseAgentId: null,
        currentZone: null,
        metaversePosition: null,
        lastZoneChange: null
      }
    });
    
    console.log(`✅ Cleared metaverse data from ${botsReset.count} bots`);
    
    console.log('\n🎉 Cleanup complete! You can now re-deploy bots to the metaverse.');
    console.log('   Run: node scripts/deploy-all-bots-to-metaverse.js');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run cleanup
cleanupInvalidBotSyncs();