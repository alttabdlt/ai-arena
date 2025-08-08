const { PrismaClient } = require('@prisma/client');
const { ConvexService } = require('../dist/services/convexService');

const prisma = new PrismaClient();
const convexService = ConvexService.getInstance();

async function clearTestAgents() {
  console.log('🧹 Clearing test agents from bot syncs...');
  
  // Find all test bot syncs
  const testSyncs = await prisma.botSync.findMany({
    where: {
      OR: [
        { convexAgentId: { contains: 'test' } },
        { convexAgentId: { contains: 'batch' } },
        { convexAgentId: { contains: 'queue' } }
      ]
    }
  });
  
  if (testSyncs.length > 0) {
    console.log(`Found ${testSyncs.length} test bot syncs to remove`);
    
    // Delete test syncs
    await prisma.botSync.deleteMany({
      where: {
        id: { in: testSyncs.map(s => s.id) }
      }
    });
    
    console.log('✅ Test bot syncs cleared');
  }
}

async function deployMultipleBots() {
  console.log('🚀 Testing batch registration with real bots...');
  
  // Get bots without metaverse deployment
  const botsToSync = await prisma.bot.findMany({
    where: {
      botSync: null
    },
    take: 5 // Deploy 5 bots for testing
  });
  
  if (botsToSync.length === 0) {
    console.log('No bots need deployment');
    return;
  }
  
  console.log(`📦 Deploying ${botsToSync.length} bots simultaneously...`);
  
  const deploymentPromises = botsToSync.map(async (bot) => {
    try {
      // Find an available instance
      const instance = await convexService.findAvailableInstance('suburb');
      
      if (!instance) {
        throw new Error('No available instances');
      }
      
      console.log(`🤖 Deploying ${bot.name} to world ${instance.worldId}...`);
      
      // Create the bot agent
      const result = await convexService.createBotAgent({
        worldId: instance.worldId,
        name: bot.name,
        character: `f${(bot.id % 8) + 1}`,
        identity: `${bot.name} is a ${bot.personality || 'WORKER'} bot in the AI Arena metaverse`,
        plan: `Explore the crime city and build reputation`,
        aiArenaBotId: bot.id,
        initialZone: 'suburb'
      });
      
      // Save the sync record
      await prisma.botSync.create({
        data: {
          botId: bot.id,
          convexWorldId: instance.worldId,
          convexAgentId: result.agentId,
          convexPlayerId: result.playerId,
          syncStatus: 'ACTIVE',
          lastSyncedAt: new Date()
        }
      });
      
      console.log(`✅ ${bot.name} deployed successfully!`);
      return { bot: bot.name, success: true };
      
    } catch (error) {
      console.error(`❌ Failed to deploy ${bot.name}:`, error.message);
      return { bot: bot.name, success: false, error: error.message };
    }
  });
  
  // Wait for all deployments
  const results = await Promise.all(deploymentPromises);
  
  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log('\n📊 Batch Registration Results:');
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  
  results.forEach(r => {
    if (!r.success) {
      console.log(`  - ${r.bot}: ${r.error}`);
    }
  });
}

async function checkWorldState() {
  console.log('\n🌍 Checking world state...');
  
  const { ConvexHttpClient } = require('convex/browser');
  const client = new ConvexHttpClient('https://quaint-koala-55.convex.cloud');
  
  const worldDoc = await client.query('aiTown/debugging:checkWorldDocument');
  console.log(`Agents in world: ${worldDoc.numAgents}`);
  console.log(`Players in world: ${worldDoc.numPlayers}`);
  
  const agentDetails = await client.query('aiTown/debugging:checkAgentDetails');
  console.log('\nAgent details:');
  agentDetails.agentDetails.forEach(agent => {
    console.log(`  - ${agent.id}: AI Arena Bot ${agent.aiArenaBotId}`);
  });
}

async function main() {
  try {
    await clearTestAgents();
    await deployMultipleBots();
    await checkWorldState();
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();