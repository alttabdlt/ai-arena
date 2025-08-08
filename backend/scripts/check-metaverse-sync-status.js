#!/usr/bin/env node

/**
 * Check the synchronization status between Arena bots and Metaverse agents
 * 
 * Usage:
 *   node backend/scripts/check-metaverse-sync-status.js
 *   
 *   Options:
 *     --verbose    Show detailed information for each bot
 */

require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const { ConvexHttpClient } = require('convex/browser');

const prisma = new PrismaClient();
const convexUrl = process.env.CONVEX_URL || 'https://quaint-koala-55.convex.cloud';
const convexClient = new ConvexHttpClient(convexUrl);

// Parse command line arguments
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');

async function getAllArenaAgents() {
  try {
    const result = await convexClient.query('aiTown/orphanCleanup:getAllArenaAgents');
    return result;
  } catch (error) {
    console.error('Error getting Arena agents from metaverse:', error);
    return null;
  }
}

async function main() {
  console.log('🔍 Metaverse Synchronization Status Check');
  console.log('==========================================');
  
  try {
    // Get all Arena bots
    console.log('\n📊 Fetching Arena bots...');
    const arenaBots = await prisma.bot.findMany({
      include: {
        botSync: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`✓ Found ${arenaBots.length} bots in Arena database`);
    
    // Get all metaverse agents
    console.log('\n🌐 Fetching metaverse agents...');
    const metaverseData = await getAllArenaAgents();
    
    if (!metaverseData) {
      console.error('❌ Failed to fetch metaverse agents');
      process.exit(1);
    }
    
    console.log(`✓ Found ${metaverseData.totalAgents} total agents in metaverse`);
    console.log(`✓ Found ${metaverseData.arenaAgents} Arena-managed agents`);
    
    // Create lookup maps
    const metaverseAgentsByBotId = new Map();
    metaverseData.agents.forEach(agent => {
      if (agent.aiArenaBotId) {
        metaverseAgentsByBotId.set(agent.aiArenaBotId, agent);
      }
    });
    
    // Analyze sync status
    const synced = [];
    const notSynced = [];
    const orphaned = [];
    const failed = [];
    
    // Check Arena bots
    arenaBots.forEach(bot => {
      const metaverseAgent = metaverseAgentsByBotId.get(bot.id);
      
      if (metaverseAgent) {
        synced.push({ bot, agent: metaverseAgent });
      } else if (bot.botSync?.syncStatus === 'FAILED') {
        failed.push(bot);
      } else {
        notSynced.push(bot);
      }
    });
    
    // Check for orphans
    metaverseData.agents.forEach(agent => {
      if (agent.aiArenaBotId) {
        const arenaBot = arenaBots.find(b => b.id === agent.aiArenaBotId);
        if (!arenaBot) {
          orphaned.push(agent);
        }
      }
    });
    
    // Display summary
    console.log('\n📈 SYNC STATUS SUMMARY');
    console.log('======================');
    console.log(`✅ Synced:       ${synced.length} bots`);
    console.log(`⏳ Not Synced:   ${notSynced.length} bots`);
    console.log(`❌ Failed:       ${failed.length} bots`);
    console.log(`⚠️  Orphaned:     ${orphaned.length} agents`);
    
    // Show details if verbose
    if (verbose) {
      if (synced.length > 0) {
        console.log('\n✅ SYNCED BOTS');
        console.log('──────────────');
        synced.forEach(({ bot, agent }) => {
          console.log(`• ${bot.name} (${bot.id})`);
          console.log(`  Agent: ${agent.agentId}`);
          console.log(`  Zone: ${bot.currentZone || 'unknown'}`);
          console.log(`  Sync Status: ${bot.botSync?.syncStatus || 'N/A'}`);
        });
      }
      
      if (notSynced.length > 0) {
        console.log('\n⏳ NOT SYNCED BOTS');
        console.log('──────────────────');
        notSynced.forEach(bot => {
          console.log(`• ${bot.name} (${bot.id})`);
          console.log(`  Created: ${bot.createdAt.toISOString()}`);
          console.log(`  Channel: ${bot.channel || 'main'}`);
          console.log(`  Sync Status: ${bot.botSync?.syncStatus || 'PENDING'}`);
        });
      }
      
      if (failed.length > 0) {
        console.log('\n❌ FAILED SYNCS');
        console.log('───────────────');
        failed.forEach(bot => {
          console.log(`• ${bot.name} (${bot.id})`);
          console.log(`  Error: ${bot.botSync?.syncErrors?.join(', ') || 'Unknown'}`);
          console.log(`  Last Attempt: ${bot.botSync?.lastSyncedAt?.toISOString() || 'Never'}`);
        });
      }
      
      if (orphaned.length > 0) {
        console.log('\n⚠️  ORPHANED AGENTS');
        console.log('──────────────────');
        orphaned.forEach(agent => {
          console.log(`• ${agent.name} (${agent.agentId})`);
          console.log(`  Arena Bot ID: ${agent.aiArenaBotId} (deleted)`);
          console.log(`  Identity: ${agent.identity}`);
        });
      }
    }
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS');
    console.log('==================');
    
    if (notSynced.length > 0) {
      console.log(`• ${notSynced.length} bots need to be deployed to metaverse`);
      console.log('  → The sync service will deploy them automatically within 30 seconds');
    }
    
    if (failed.length > 0) {
      console.log(`• ${failed.length} bots have failed sync attempts`);
      console.log('  → Check the logs and retry with: npm run sync:bots');
    }
    
    if (orphaned.length > 0) {
      console.log(`• ${orphaned.length} orphaned agents should be cleaned up`);
      console.log('  → Run: node backend/scripts/cleanup-orphaned-metaverse-bots.js');
    }
    
    if (synced.length === arenaBots.length && orphaned.length === 0) {
      console.log('✅ Everything is perfectly synchronized!');
    }
    
  } catch (error) {
    console.error('\n❌ Error during status check:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});