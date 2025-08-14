#!/usr/bin/env node

/**
 * Complete fix for stale agent IDs
 * This script completely clears stale IDs from BOTH Bot and BotSync tables
 * to prevent the sync loop that keeps restoring them
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function completeStaleIdFix() {
  try {
    console.log('🔧 Complete Stale Agent ID Fix');
    console.log('================================\n');
    
    // Get all bots with metaverse agent IDs or sync records
    const botsWithAgents = await prisma.bot.findMany({
      where: {
        OR: [
          { metaverseAgentId: { not: null } },
          { botSync: { isNot: null } }
        ]
      },
      include: {
        botSync: true
      }
    });
    
    console.log(`Found ${botsWithAgents.length} bots to check\n`);
    
    let clearedCount = 0;
    
    for (const bot of botsWithAgents) {
      console.log(`📊 Processing bot: ${bot.name} (${bot.id})`);
      
      // Check for stale IDs (a:387302 and a:387306 are known stale)
      const knownStaleIds = ['a:387302', 'a:387306'];
      const hasStaleId = bot.metaverseAgentId && (
        knownStaleIds.includes(bot.metaverseAgentId) ||
        bot.metaverseAgentId.startsWith('a:387')  // All old IDs in this range are likely stale
      );
      
      if (hasStaleId || bot.metaverseAgentId) {
        console.log(`   Current metaverseAgentId: ${bot.metaverseAgentId}`);
        
        // Clear from Bot table
        await prisma.bot.update({
          where: { id: bot.id },
          data: {
            metaverseAgentId: null,
            currentZone: null,
            metaversePosition: null
          }
        });
        console.log(`   ✅ Cleared Bot table`);
        
        // Clear or reset BotSync record
        if (bot.botSync) {
          console.log(`   Current sync status: ${bot.botSync.syncStatus}`);
          console.log(`   Current convexAgentId: ${bot.botSync.convexAgentId}`);
          
          // Completely reset the sync record
          await prisma.botSync.update({
            where: { id: bot.botSync.id },
            data: {
              syncStatus: 'PENDING',
              convexAgentId: null,
              convexPlayerId: null,
              convexWorldId: null,  // Clear world ID too to force fresh discovery
              statsSynced: false,
              positionSynced: false,
              syncErrors: JSON.stringify(['Cleared stale agent ID - awaiting fresh deployment']),
              lastSyncedAt: null
            }
          });
          console.log(`   ✅ Reset BotSync record completely`);
        } else {
          // Create a fresh sync record
          await prisma.botSync.create({
            data: {
              botId: bot.id,
              channel: bot.channel || 'main',
              syncStatus: 'PENDING',
              convexWorldId: null,
              convexAgentId: null,
              convexPlayerId: null,
              statsSynced: false,
              positionSynced: false
            }
          });
          console.log(`   ✅ Created fresh BotSync record`);
        }
        
        clearedCount++;
        console.log(`   ✨ Bot fully cleared and ready for fresh deployment\n`);
      } else {
        console.log(`   ℹ️ No metaverse agent ID found, skipping\n`);
      }
    }
    
    console.log('='.repeat(60));
    console.log(`✅ Complete! Cleared ${clearedCount} bots`);
    console.log('='.repeat(60));
    
    if (clearedCount > 0) {
      console.log('\n📌 Next Steps:');
      console.log('1. Make sure metaverse backend is stopped');
      console.log('2. Run: cd metaverse-game/backend && npm run dev');
      console.log('3. Bots will be redeployed with fresh agent IDs');
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute
completeStaleIdFix().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});