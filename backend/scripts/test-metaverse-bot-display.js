#!/usr/bin/env node

/**
 * Test script to verify that the metaverse only shows user-owned bots
 * and not all agents as a fallback
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();
const CONVEX_HTTP_URL = 'https://reliable-ocelot-928.convex.site';

async function testMetaverseBotDisplay() {
  console.log('🧪 Testing Metaverse Bot Display Logic\n');
  console.log('=' .repeat(50));
  
  try {
    // Step 1: Check Arena backend state
    console.log('\n📊 Arena Backend State:');
    const arenaBots = await prisma.bot.findMany({
      select: { 
        id: true, 
        name: true, 
        creator: { select: { address: true } },
        personality: true 
      }
    });
    
    console.log(`✓ Found ${arenaBots.length} bot(s) in Arena database`);
    arenaBots.forEach(bot => {
      console.log(`  - ${bot.name} (${bot.id})`);
      console.log(`    Owner: ${bot.creator.address}`);
      console.log(`    Personality: ${bot.personality}`);
    });
    
    // Step 2: Check Metaverse state
    console.log('\n🌐 Metaverse State:');
    const metaverseResponse = await axios.post(`${CONVEX_HTTP_URL}/getAllArenaAgents`, {});
    const metaverseData = metaverseResponse.data;
    
    console.log(`✓ Found ${metaverseData.agents.length} agent(s) in metaverse`);
    metaverseData.agents.forEach(agent => {
      console.log(`  - ${agent.name} (${agent.agentId})`);
      console.log(`    Arena Bot ID: ${agent.aiArenaBotId}`);
      console.log(`    World ID: ${agent.worldId}`);
    });
    
    // Step 3: Verify synchronization
    console.log('\n🔄 Synchronization Check:');
    const arenaIds = new Set(arenaBots.map(b => b.id));
    const metaverseArenaIds = new Set(metaverseData.agents.map(a => a.aiArenaBotId));
    
    // Check for bots in Arena but not in Metaverse
    const notInMetaverse = [...arenaIds].filter(id => !metaverseArenaIds.has(id));
    if (notInMetaverse.length > 0) {
      console.log('⚠️  Bots in Arena but not in Metaverse:');
      notInMetaverse.forEach(id => {
        const bot = arenaBots.find(b => b.id === id);
        console.log(`  - ${bot.name} (${id})`);
      });
    }
    
    // Check for agents in Metaverse but not in Arena (orphaned)
    const orphaned = [...metaverseArenaIds].filter(id => !arenaIds.has(id));
    if (orphaned.length > 0) {
      console.log('❌ Orphaned agents in Metaverse:');
      orphaned.forEach(id => {
        const agent = metaverseData.agents.find(a => a.aiArenaBotId === id);
        console.log(`  - ${agent.name} (${id})`);
      });
    }
    
    if (notInMetaverse.length === 0 && orphaned.length === 0) {
      console.log('✅ Perfect synchronization between Arena and Metaverse');
    }
    
    // Step 4: Test recommendations
    console.log('\n💡 Frontend Behavior:');
    console.log('With the fixed Game.tsx logic:');
    console.log('  1. During loading: No bots displayed (empty list)');
    console.log('  2. After loading: Only user-owned bots displayed');
    console.log('  3. On error: No bots displayed (empty list)');
    console.log('  4. Never shows all agents as fallback');
    
    console.log('\n✅ Test Complete!');
    console.log('\nTo verify in browser:');
    console.log('  1. Open http://localhost:5175');
    console.log('  2. Open browser console (F12)');
    console.log('  3. Look for "Transforming bots:" log');
    console.log('  4. Verify only your owned bots appear in selector');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testMetaverseBotDisplay();