#!/usr/bin/env node

/**
 * Script to deploy bots to the metaverse
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();
const METAVERSE_BACKEND_URL = 'http://localhost:5001';

async function deployBotsToMetaverse() {
  try {
    console.log('🚀 Deploying bots to metaverse...');
    
    // Get the user's bots
    const user = await prisma.user.findUnique({
      where: { address: '0x2487155df829977813ea9b4f992c229f86d4f16a' },
      include: {
        bots: true
      }
    });
    
    if (!user) {
      console.error('❌ User not found');
      process.exit(1);
    }
    
    console.log(`📦 Found ${user.bots.length} bots to deploy`);
    
    for (const bot of user.bots) {
      try {
        console.log(`\n🤖 Deploying bot "${bot.name}"...`);
        
        // Register bot in metaverse
        const response = await axios.post(`${METAVERSE_BACKEND_URL}/api/metaverse/bots/register`, {
          aiArenaBotId: bot.id,
          name: bot.name,
          personality: bot.personality,
          modelType: bot.modelType,
          initialZone: 'casino',
          avatar: bot.avatar || `${bot.personality.toLowerCase()}1`
        });
        
        console.log('Response:', response.data);
        
        if (response.data.success) {
          if (response.data.agentId) {
            // Update bot with metaverse agent ID
            await prisma.bot.update({
              where: { id: bot.id },
              data: {
                metaverseAgentId: response.data.agentId,
                currentZone: 'casino'
              }
            });
            
            console.log(`✅ Bot "${bot.name}" deployed successfully!`);
            console.log(`   Agent ID: ${response.data.agentId}`);
            console.log(`   World ID: ${response.data.worldId}`);
          } else if (response.data.registrationId) {
            console.log(`⏳ Bot "${bot.name}" registration queued`);
            console.log(`   Registration ID: ${response.data.registrationId}`);
            console.log(`   Message: ${response.data.message}`);
          } else {
            console.log(`⚠️ Bot "${bot.name}" response without agentId:`, response.data);
          }
        } else {
          console.error(`❌ Failed to deploy bot "${bot.name}":`, response.data.error);
        }
      } catch (error) {
        console.error(`❌ Error deploying bot "${bot.name}":`, error.message);
        if (error.response) {
          console.error('Response data:', error.response.data);
          console.error('Response status:', error.response.status);
        }
        // Continue with next bot
      }
    }
    
    console.log('\n✨ Bot deployment complete!');
    
  } catch (error) {
    console.error('❌ Error deploying bots:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
deployBotsToMetaverse();