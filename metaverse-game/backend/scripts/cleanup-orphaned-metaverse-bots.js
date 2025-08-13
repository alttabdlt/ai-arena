#!/usr/bin/env node

/**
 * Manual cleanup script for orphaned metaverse bots
 * This script removes metaverse agents that no longer have corresponding bots in the Arena database
 * 
 * Usage:
 *   node backend/scripts/cleanup-orphaned-metaverse-bots.js
 *   
 *   Options:
 *     --dry-run    Show what would be deleted without actually deleting
 *     --force      Skip confirmation prompt
 */

require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const { ConvexHttpClient } = require('convex/browser');

const prisma = new PrismaClient();
const convexUrl = process.env.CONVEX_URL || 'https://quaint-koala-55.convex.cloud';
const convexClient = new ConvexHttpClient(convexUrl);

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const forceMode = args.includes('--force');

async function getAllArenaAgents() {
  try {
    const result = await convexClient.query('cleanup/orphanCleanup:getAllArenaAgents');
    return result;
  } catch (error) {
    console.error('Error getting Arena agents from metaverse:', error);
    return null;
  }
}

async function deleteOrphanedAgents(agents, worldId) {
  try {
    const result = await convexClient.mutation('cleanup/orphanCleanup:batchDeleteOrphanedAgents', {
      worldId,
      agents,
      reason: 'Manual cleanup - Bot no longer exists in Arena database',
    });
    return result;
  } catch (error) {
    console.error('Error deleting orphaned agents:', error);
    throw error;
  }
}

async function main() {
  console.log('🧹 Orphaned Metaverse Bot Cleanup Script');
  console.log('=========================================');
  
  if (isDryRun) {
    console.log('🔍 Running in DRY RUN mode - no changes will be made');
  }
  
  try {
    // Get all Arena bot IDs
    console.log('\n📊 Fetching Arena bots...');
    const arenaBots = await prisma.bot.findMany({
      select: { 
        id: true,
        name: true,
        metaverseAgentId: true,
      }
    });
    
    const arenaBotIds = new Set(arenaBots.map(bot => bot.id));
    console.log(`✓ Found ${arenaBots.length} bots in Arena database`);
    
    // Get all metaverse agents with aiArenaBotId
    console.log('\n🌐 Fetching metaverse agents...');
    const metaverseData = await getAllArenaAgents();
    
    if (!metaverseData) {
      console.error('❌ Failed to fetch metaverse agents');
      process.exit(1);
    }
    
    console.log(`✓ Found ${metaverseData.totalAgents} total agents in metaverse`);
    console.log(`✓ Found ${metaverseData.arenaAgents} Arena-managed agents`);
    
    // Find orphans
    const orphanedAgents = metaverseData.agents.filter(agent => {
      if (!agent.aiArenaBotId) return false;
      return !arenaBotIds.has(agent.aiArenaBotId);
    });
    
    if (orphanedAgents.length === 0) {
      console.log('\n✅ No orphaned agents found! Everything is in sync.');
      process.exit(0);
    }
    
    // Display orphaned agents
    console.log(`\n⚠️  Found ${orphanedAgents.length} orphaned agents:`);
    console.log('────────────────────────────────────────');
    
    orphanedAgents.forEach((agent, index) => {
      console.log(`${index + 1}. Agent: ${agent.name}`);
      console.log(`   ID: ${agent.agentId}`);
      console.log(`   Arena Bot ID: ${agent.aiArenaBotId} (deleted)`);
      console.log(`   Identity: ${agent.identity}`);
      console.log('');
    });
    
    if (isDryRun) {
      console.log('🔍 DRY RUN completed - no agents were deleted');
      process.exit(0);
    }
    
    // Ask for confirmation
    if (!forceMode) {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        readline.question('\n⚠️  Delete these orphaned agents? (yes/no): ', resolve);
      });
      
      readline.close();
      
      if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        console.log('❌ Cleanup cancelled');
        process.exit(0);
      }
    }
    
    // Delete orphaned agents
    console.log('\n🗑️  Deleting orphaned agents...');
    
    if (metaverseData.worldId) {
      const deleteResult = await deleteOrphanedAgents(
        orphanedAgents.map(agent => ({
          agentId: agent.agentId,
          playerId: agent.playerId,
          aiArenaBotId: agent.aiArenaBotId,
        })),
        metaverseData.worldId
      );
      
      if (deleteResult) {
        console.log(`\n✅ Cleanup completed!`);
        console.log(`   Successful: ${deleteResult.successful}`);
        console.log(`   Failed: ${deleteResult.failed}`);
        
        if (deleteResult.failed > 0) {
          console.log('\n⚠️  Some agents failed to delete. Check the logs for details.');
        }
      }
    } else {
      console.error('❌ Could not find world ID');
      process.exit(1);
    }
    
    // Clean up orphaned BotSync records
    console.log('\n🗑️  Cleaning up orphaned sync records...');
    const orphanedBotIds = orphanedAgents
      .filter(agent => agent.aiArenaBotId)
      .map(agent => agent.aiArenaBotId);
    
    if (orphanedBotIds.length > 0) {
      const deletedSyncs = await prisma.botSync.deleteMany({
        where: {
          botId: { in: orphanedBotIds }
        }
      });
      
      if (deletedSyncs.count > 0) {
        console.log(`✓ Cleaned up ${deletedSyncs.count} orphaned sync records`);
      }
    }
    
    console.log('\n✅ Cleanup complete!');
    
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
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