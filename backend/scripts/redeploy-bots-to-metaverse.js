#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');

const prisma = new PrismaClient();

async function redeployBots() {
  try {
    console.log('🔄 Starting bot redeployment to metaverse...');
    
    // Get all bots that need deployment
    const bots = await prisma.bot.findMany({
      where: {
        OR: [
          { metaverseAgentId: null },
          { metaverseAgentId: '' }
        ]
      },
      include: {
        creator: true
      }
    });
    
    console.log(`📊 Found ${bots.length} bots to deploy`);
    
    if (bots.length === 0) {
      console.log('✅ No bots need deployment');
      return;
    }
    
    // Deploy bots in a batch to avoid overwriting
    const deploymentPromises = bots.map(async (bot, index) => {
      // Add a small delay between each bot to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, index * 100));
      
      const personality = bot.personality || 'WORKER';
      const personalityDescriptions = {
        CRIMINAL: "ruthless criminal mastermind who thrives in the shadows",
        GAMBLER: "risk-taker who lives for the thrill of the bet", 
        WORKER: "steady grinder who builds value through hard work"
      };
      
      const requestBody = {
        worldId: 'm17d3kkh2pskb10damz507s6fd7n3kz4', // Main world ID
        name: bot.name,
        character: `f${(index % 8) + 1}`, // Cycle through available characters
        identity: `${bot.name} is a ${personalityDescriptions[personality]}. ${bot.prompt || ''}`,
        plan: `Dominate the metaverse through ${personality === 'CRIMINAL' ? 'crime and intimidation' : personality === 'GAMBLER' ? 'high-stakes gambling' : 'steady accumulation'}`,
        aiArenaBotId: bot.id,
        initialZone: personality === 'CRIMINAL' ? 'darkAlley' : personality === 'GAMBLER' ? 'casino' : 'suburb'
      };
      
      console.log(`🤖 Deploying bot: ${bot.name} (${bot.id})`);
      
      try {
        const response = await fetch('https://reliable-ocelot-928.convex.site/api/bots/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
        
        const result = await response.json();
        
        if (result.agentId && result.playerId) {
          // Update bot with metaverse IDs
          await prisma.bot.update({
            where: { id: bot.id },
            data: {
              metaverseAgentId: result.agentId,
              metaverseCharacter: requestBody.character,
              currentZone: requestBody.initialZone,
            }
          });
          
          // Create or update bot sync record
          await prisma.botSync.upsert({
            where: { botId: bot.id },
            create: {
              botId: bot.id,
              channel: 'main',
              syncStatus: 'SYNCED',
              convexWorldId: requestBody.worldId,
              convexAgentId: result.agentId,
              convexPlayerId: result.playerId,
              personalityMapped: true,
              lastSyncedAt: new Date()
            },
            update: {
              syncStatus: 'SYNCED',
              convexWorldId: requestBody.worldId,
              convexAgentId: result.agentId,
              convexPlayerId: result.playerId,
              personalityMapped: true,
              lastSyncedAt: new Date()
            }
          });
          
          console.log(`✅ Deployed: ${bot.name} -> Agent: ${result.agentId}`);
          return { success: true, bot: bot.name, agentId: result.agentId };
        } else if (result.status === 'pending') {
          console.log(`⏳ Deployment pending for: ${bot.name}`);
          return { success: false, bot: bot.name, status: 'pending' };
        } else {
          console.error(`❌ Failed to deploy: ${bot.name}`, result);
          return { success: false, bot: bot.name, error: result.error };
        }
      } catch (error) {
        console.error(`❌ Error deploying ${bot.name}:`, error.message);
        return { success: false, bot: bot.name, error: error.message };
      }
    });
    
    // Wait for all deployments to complete
    const results = await Promise.all(deploymentPromises);
    
    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log('\n📊 Deployment Summary:');
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    
    if (failed > 0) {
      console.log('\nFailed deployments:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.bot}: ${r.error || r.status}`);
      });
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the deployment
redeployBots();
