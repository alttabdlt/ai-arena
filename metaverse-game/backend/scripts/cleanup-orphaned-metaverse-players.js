#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();
const CONVEX_HTTP_URL = process.env.CONVEX_HTTP_URL || 'https://immense-leopard-301.convex.site';

async function cleanupOrphanedPlayers() {
  try {
    console.log('🧹 Starting cleanup of orphaned metaverse players...\n');

    // Step 1: Get all valid bot IDs from Arena database
    const arenaBots = await prisma.bot.findMany({
      select: { id: true, name: true }
    });
    const validBotIds = new Set(arenaBots.map(bot => bot.id));
    console.log(`✅ Found ${arenaBots.length} valid bots in Arena database`);

    // Step 2: Get all agents from metaverse
    const metaverseResponse = await axios.post(`${CONVEX_HTTP_URL}/getAllArenaAgents`, {});
    const metaverseData = metaverseResponse.data;
    
    if (!metaverseData.agents || !Array.isArray(metaverseData.agents)) {
      console.log('❌ Failed to get metaverse agents');
      return;
    }

    console.log(`📊 Found ${metaverseData.agents.length} agents in metaverse`);
    console.log(`📊 Found ${metaverseData.players?.length || 0} players in metaverse\n`);

    // Step 3: Identify orphaned agents
    const orphanedAgents = metaverseData.agents.filter(agent => {
      // Agent without aiArenaBotId is orphaned
      if (!agent.aiArenaBotId) {
        return true;
      }
      // Agent with invalid aiArenaBotId is orphaned
      return !validBotIds.has(agent.aiArenaBotId);
    });

    console.log(`🔍 Found ${orphanedAgents.length} orphaned agents to remove`);
    
    if (orphanedAgents.length > 0) {
      console.log('\nOrphaned agents:');
      orphanedAgents.forEach(agent => {
        console.log(`  - ${agent.name} (ID: ${agent.id}, Arena Bot ID: ${agent.aiArenaBotId || 'none'})`);
      });
    }

    // Step 4: Delete orphaned agents
    for (const agent of orphanedAgents) {
      try {
        console.log(`\n🗑️  Deleting orphaned agent: ${agent.name}`);
        
        const deleteResponse = await axios.post(`${CONVEX_HTTP_URL}/deleteOrphanedAgent`, {
          worldId: agent.worldId,
          agentId: agent.id,
          playerId: agent.playerId
        });
        
        if (deleteResponse.data.success) {
          console.log(`   ✅ Successfully deleted agent ${agent.name}`);
        } else {
          console.log(`   ❌ Failed to delete agent ${agent.name}: ${deleteResponse.data.error}`);
        }
      } catch (error) {
        console.error(`   ❌ Error deleting agent ${agent.name}:`, error.message);
      }
    }

    // Step 5: Clean up any players without descriptions
    const playersToClean = metaverseData.players?.filter(player => {
      // Check if player has a description
      const hasDescription = metaverseData.playerDescriptions?.some(
        desc => desc.playerId === player.id
      );
      return !hasDescription;
    }) || [];

    if (playersToClean.length > 0) {
      console.log(`\n🔍 Found ${playersToClean.length} players without descriptions to remove`);
      
      for (const player of playersToClean) {
        try {
          console.log(`🗑️  Removing player without description: ${player.id}`);
          
          const removeResponse = await axios.post(`${CONVEX_HTTP_URL}/removePlayer`, {
            worldId: player.worldId || metaverseData.worldId,
            playerId: player.id
          });
          
          if (removeResponse.data.success) {
            console.log(`   ✅ Successfully removed player ${player.id}`);
          } else {
            console.log(`   ❌ Failed to remove player: ${removeResponse.data.error}`);
          }
        } catch (error) {
          console.error(`   ❌ Error removing player:`, error.message);
        }
      }
    }

    // Step 6: Summary
    console.log('\n📊 Cleanup Summary:');
    console.log(`   - Valid Arena bots: ${arenaBots.length}`);
    console.log(`   - Orphaned agents deleted: ${orphanedAgents.length}`);
    console.log(`   - Players without descriptions removed: ${playersToClean.length}`);
    console.log(`   - Remaining valid agents: ${metaverseData.agents.length - orphanedAgents.length}`);
    
    console.log('\n✅ Cleanup complete!');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupOrphanedPlayers();