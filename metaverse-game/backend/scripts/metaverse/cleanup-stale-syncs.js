const { PrismaClient } = require('@prisma/client');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const prisma = new PrismaClient();

async function getAgentsFromConvex() {
  try {
    const { stdout } = await execAsync('cd ../metaverse-game && npx convex run debugging:checkAgentDetails');
    return JSON.parse(stdout);
  } catch (error) {
    console.error('Error getting agents from Convex:', error);
    return null;
  }
}

async function cleanupStaleSyncs() {
  console.log('🧹 Starting cleanup of stale bot syncs...');
  
  try {
    // Get all bot syncs
    const syncs = await prisma.botSync.findMany({
      include: { bot: true }
    });
    
    console.log(`📊 Found ${syncs.length} bot syncs to check`);
    
    // Get current agents from Convex
    const worldDoc = await getAgentsFromConvex();
    if (!worldDoc) {
      console.error('❌ Could not fetch agents from Convex');
      return;
    }
    
    const existingAgentIds = new Set(worldDoc.agentDetails.map(a => a.id));
    const existingAiArenaBotIds = new Set(worldDoc.agentDetails.map(a => a.aiArenaBotId));
    
    console.log(`🌍 Found ${existingAgentIds.size} agents in the metaverse`);
    console.log('Existing agent IDs:', Array.from(existingAgentIds));
    console.log('Existing AI Arena bot IDs:', Array.from(existingAiArenaBotIds));
    
    const staleSync = [];
    const validSync = [];
    
    for (const sync of syncs) {
      // Check if the agent exists by convexAgentId or if the bot's ID matches an aiArenaBotId
      if (!existingAgentIds.has(sync.convexAgentId) && !existingAiArenaBotIds.has(sync.botId)) {
        console.log(`❌ Agent ${sync.convexAgentId} for bot ${sync.bot.name} (${sync.botId}) not found`);
        staleSync.push(sync);
      } else {
        console.log(`✅ Agent ${sync.convexAgentId} for bot ${sync.bot.name} exists`);
        validSync.push(sync);
      }
    }
    
    if (staleSync.length > 0) {
      console.log(`\n🗑️ Removing ${staleSync.length} stale bot syncs...`);
      
      for (const sync of staleSync) {
        await prisma.botSync.delete({
          where: { id: sync.id }
        });
        console.log(`  - Deleted sync for bot ${sync.bot.name} (${sync.botId})`);
      }
      
      console.log('✅ Stale syncs cleaned up');
    } else {
      console.log('✅ No stale syncs found');
    }
    
    // Re-deploy bots that lost their sync
    const botsWithoutSync = await prisma.bot.findMany({
      where: {
        botSync: null
      }
    });
    
    if (botsWithoutSync.length > 0) {
      console.log(`\n🚀 Found ${botsWithoutSync.length} bots without sync records`);
      console.log('Run the deployment script to re-deploy these bots to the metaverse');
      botsWithoutSync.forEach(bot => {
        console.log(`  - ${bot.name} (${bot.id})`);
      });
    }
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupStaleSyncs();