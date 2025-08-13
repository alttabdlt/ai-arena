#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');

const prisma = new PrismaClient();

async function getValidBots() {
  try {
    // Get all bots with metaverse agents from AI Arena
    const bots = await prisma.bot.findMany({
      where: {
        metaverseAgentId: { not: null }
      },
      select: {
        id: true,
        name: true,
        metaverseAgentId: true,
      }
    });

    console.log(`\n✅ Found ${bots.length} valid bots in AI Arena:`);
    bots.forEach(bot => {
      console.log(`  - ${bot.name} (${bot.id}) -> Agent: ${bot.metaverseAgentId}`);
    });

    return bots.map(bot => bot.id);
  } catch (error) {
    console.error('❌ Error fetching valid bots:', error);
    throw error;
  }
}

async function fetchMetaverseBots() {
  try {
    const CONVEX_URL = 'https://reliable-ocelot-928.convex.cloud';
    
    // This would normally require proper Convex client setup
    // For now, we'll just display what needs to be done
    console.log('\n📋 To cleanup ghost bots in Convex:');
    console.log('1. Open Convex Dashboard: https://dashboard.convex.dev/d/reliable-ocelot-928');
    console.log('2. Navigate to Functions -> migrations/cleanupAction');
    console.log('3. Run "cleanupGhostBotsWithFetch" with your world ID');
    console.log('\nAlternatively, run this command from the metaverse-game directory:');
    console.log('npx convex run migrations/cleanupAction:cleanupGhostBotsWithFetch --worldId "<YOUR_WORLD_ID>"');
    
    return [];
  } catch (error) {
    console.error('❌ Error fetching metaverse bots:', error);
    throw error;
  }
}

async function identifyGhostBots() {
  try {
    // Get valid bots from AI Arena
    const validBotIds = await getValidBots();
    
    // Known ghost bots from investigation
    const knownGhosts = [
      { id: 'cme5o5mcm0001ru0tl017jfd3', agentId: 'a:278206', name: 'old Axel' },
      { id: 'cme5o7ane000jru0twzyi852j', agentId: 'a:278445', name: 'old ZY' }
    ];
    
    console.log('\n👻 Known ghost bots to remove:');
    knownGhosts.forEach(ghost => {
      if (!validBotIds.includes(ghost.id)) {
        console.log(`  - ${ghost.name} (${ghost.id}) -> Agent: ${ghost.agentId}`);
      }
    });
    
    // Check if any current bots are missing from metaverse
    const botsWithAgents = await prisma.bot.findMany({
      where: {
        metaverseAgentId: { not: null }
      },
      select: {
        id: true,
        name: true,
        metaverseAgentId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('\n📊 Bot Status Summary:');
    console.log(`  - Total bots with metaverse agents: ${botsWithAgents.length}`);
    console.log(`  - Valid bots (should keep): ${validBotIds.length}`);
    console.log(`  - Ghost bots (should remove): ${knownGhosts.length}`);
    
    await fetchMetaverseBots();
    
  } catch (error) {
    console.error('❌ Error identifying ghost bots:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
console.log('🤖 AI Arena Ghost Bot Cleanup Tool');
console.log('===================================');

identifyGhostBots().catch(error => {
  console.error('Failed to run cleanup:', error);
  process.exit(1);
});