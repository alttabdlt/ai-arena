#!/usr/bin/env node

/**
 * Reset Metaverse Sync Script
 * 
 * This script clears all invalid world references and resets bot sync status
 * Use this after Convex world wipes or when world IDs become invalid
 * 
 * Usage: node backend/scripts/reset-metaverse-sync.js [--force]
 */

const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function resetMetaverseSync(force = false) {
  try {
    console.log('🔄 Metaverse Sync Reset Script');
    console.log('================================\n');

    // Count affected records
    const botSyncCount = await prisma.botSync.count();
    const botsWithAgentId = await prisma.bot.count({
      where: {
        OR: [
          { metaverseAgentId: { not: null } },
          { metaverseAgentId: { not: '' } }
        ]
      }
    });

    console.log(`📊 Current Status:`);
    console.log(`   - Bot sync records: ${botSyncCount}`);
    console.log(`   - Bots with metaverse IDs: ${botsWithAgentId}`);
    console.log(`\n⚠️  This will:`);
    console.log(`   1. Clear all BotSync world IDs and agent IDs`);
    console.log(`   2. Reset all BotSync statuses to PENDING`);
    console.log(`   3. Clear all Bot metaverseAgentId fields`);
    console.log(`   4. Clear all Bot metaverse positions and zones`);
    console.log(`   5. Clear all ChannelMetadata world IDs`);
    console.log(`   6. Force re-deployment of all bots on next sync\n`);

    if (!force) {
      const answer = await askQuestion('Are you sure you want to proceed? (yes/no): ');
      if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        console.log('❌ Reset cancelled');
        process.exit(0);
      }
    }

    console.log('\n🚀 Starting reset...\n');

    // Step 1: Reset all BotSync records
    console.log('1️⃣  Resetting BotSync records...');
    const botSyncResult = await prisma.botSync.updateMany({
      data: {
        convexWorldId: null,
        convexAgentId: null,
        convexPlayerId: null,
        syncStatus: 'PENDING',
        syncErrors: [],
        personalityMapped: false,
        positionSynced: false,
        statsSynced: false,
        lastSyncedAt: null
      }
    });
    console.log(`   ✅ Reset ${botSyncResult.count} BotSync records`);

    // Step 2: Clear Bot metaverse fields
    console.log('\n2️⃣  Clearing Bot metaverse fields...');
    const botResult = await prisma.bot.updateMany({
      data: {
        metaverseAgentId: null,
        metaversePosition: null,
        currentZone: null,
        lastZoneChange: null
      }
    });
    console.log(`   ✅ Cleared metaverse data for ${botResult.count} bots`);
    
    // Step 3: Clear Channel Metadata world IDs
    console.log('\n3️⃣  Clearing Channel Metadata world IDs...');
    const channelResult = await prisma.channelMetadata.updateMany({
      data: {
        worldId: null
      }
    });
    console.log(`   ✅ Cleared world IDs from ${channelResult.count} channel(s)`);

    // Step 4: Get statistics for verification
    console.log('\n4️⃣  Verifying reset...');
    const verifySync = await prisma.botSync.count({
      where: {
        OR: [
          { convexWorldId: { not: null } },
          { convexAgentId: { not: null } }
        ]
      }
    });
    const verifyBots = await prisma.bot.count({
      where: {
        OR: [
          { metaverseAgentId: { not: null } },
          { metaverseAgentId: { not: '' } }
        ]
      }
    });

    if (verifySync === 0 && verifyBots === 0) {
      console.log('   ✅ All metaverse references cleared successfully');
    } else {
      console.log(`   ⚠️  Warning: ${verifySync} sync records and ${verifyBots} bots still have metaverse data`);
    }

    // Step 5: Provide next steps
    console.log('\n✨ Reset Complete!\n');
    console.log('⚠️  IMPORTANT: The backend has an in-memory cache that must be cleared!\n');
    console.log('📝 Required Steps (in order):');
    console.log('   1. STOP the backend if running (Ctrl+C)');
    console.log('   2. Ensure Convex metaverse is running: cd metaverse-game && npm run dev');
    console.log('   3. If worlds were wiped, wait for auto-creation or run: npx convex run init');
    console.log('   4. START the backend fresh: cd backend && npm run dev');
    console.log('   5. The cache will be empty and new world IDs will be discovered');
    console.log('   6. Bots will auto-deploy to new world on next sync cycle (every 30s)');
    console.log('   7. Monitor logs for successful deployments\n');
    console.log('💡 Note: The backend caches world IDs for 5 minutes. Restarting clears this cache.');

    // Optional: Show sample bots that will be re-deployed
    const sampleBots = await prisma.bot.findMany({
      take: 5,
      select: {
        id: true,
        name: true,
        personality: true
      }
    });

    if (sampleBots.length > 0) {
      console.log('🤖 Sample bots to be re-deployed:');
      sampleBots.forEach(bot => {
        console.log(`   - ${bot.name} (${bot.personality || 'No personality'})`);
      });
      if (botResult.count > 5) {
        console.log(`   ... and ${botResult.count - 5} more`);
      }
    }

    console.log('\n✅ Script completed successfully');

  } catch (error) {
    console.error('\n❌ Error during reset:', error);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const force = args.includes('--force');

// Run the reset
resetMetaverseSync(force).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});