#!/usr/bin/env node

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearBadSyncRecord() {
  try {
    console.log('🔍 Looking for problematic bot sync records...');
    
    // Find the bot sync with the problematic agent ID
    const badSync = await prisma.botSync.findFirst({
      where: {
        convexAgentId: 'a:387302'
      },
      include: {
        bot: true
      }
    });
    
    if (badSync) {
      console.log(`❌ Found problematic sync for bot: ${badSync.bot.name} (${badSync.botId})`);
      console.log(`   Agent ID: ${badSync.convexAgentId}`);
      console.log(`   World ID: ${badSync.convexWorldId}`);
      
      // Clear the sync record
      await prisma.botSync.update({
        where: { id: badSync.id },
        data: {
          syncStatus: 'PENDING',
          convexAgentId: null,
          convexWorldId: null,
          convexPlayerId: null,
          syncErrors: ['Agent not found, cleared for re-deployment'],
          statsSynced: false,
          positionSynced: false,
          personalityMapped: false,
          lastSyncedAt: new Date()
        }
      });
      
      // Clear the bot's metaverse fields
      await prisma.bot.update({
        where: { id: badSync.botId },
        data: {
          metaverseAgentId: null,
          currentZone: null,
          metaversePosition: null
        }
      });
      
      console.log('✅ Cleared bad sync record and bot metaverse fields');
      console.log('   Bot will be re-deployed on next sync cycle');
    } else {
      console.log('✅ No problematic sync records found with agent a:387302');
    }
    
    // Also check for any other bots that might be stuck
    const stuckSyncs = await prisma.botSync.findMany({
      where: {
        OR: [
          {
            syncStatus: 'SYNCING',
            lastSyncedAt: {
              lt: new Date(Date.now() - 10 * 60 * 1000) // Older than 10 minutes
            }
          },
          {
            syncStatus: 'FAILED'
          }
        ]
      },
      include: {
        bot: true
      }
    });
    
    if (stuckSyncs.length > 0) {
      console.log(`\n⚠️ Found ${stuckSyncs.length} stuck sync records:`);
      
      for (const sync of stuckSyncs) {
        console.log(`  - Bot: ${sync.bot.name} (${sync.botId})`);
        console.log(`    Status: ${sync.syncStatus}`);
        console.log(`    Agent: ${sync.convexAgentId || 'none'}`);
        
        // Reset the sync
        await prisma.botSync.update({
          where: { id: sync.id },
          data: {
            syncStatus: 'PENDING',
            convexAgentId: null,
            convexWorldId: null,
            convexPlayerId: null,
            syncErrors: ['Reset stuck sync'],
            statsSynced: false,
            positionSynced: false,
            personalityMapped: false
          }
        });
        
        // Clear bot metaverse fields
        await prisma.bot.update({
          where: { id: sync.botId },
          data: {
            metaverseAgentId: null,
            currentZone: null,
            metaversePosition: null
          }
        });
      }
      
      console.log(`✅ Reset ${stuckSyncs.length} stuck sync records`);
    } else {
      console.log('\n✅ No stuck sync records found');
    }
    
  } catch (error) {
    console.error('❌ Error clearing bad sync records:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearBadSyncRecord();