const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
require('dotenv').config();

const prisma = new PrismaClient();
const METAVERSE_BACKEND_URL = process.env.METAVERSE_BACKEND_URL || 'http://localhost:5001';

async function initializeChannels() {
  console.log('🔧 Initializing channel metadata...');
  
  const channels = [
    {
      channel: 'main',
      channelType: 'MAIN',
      status: 'ACTIVE',
      worldId: 'm179x0xjt139d2dk0v6zn11j4s7n7x0c',
      currentBots: 1,
      maxBots: 100,
      region: 'us-east',
      metadata: {
        description: 'Main public channel',
        created: new Date().toISOString()
      }
    },
    {
      channel: 'beta',
      channelType: 'TEST',
      status: 'ACTIVE',
      worldId: null,
      currentBots: 0,
      maxBots: 50,
      region: 'us-east',
      metadata: {
        description: 'Beta testing channel',
        created: new Date().toISOString()
      }
    }
  ];

  for (const channelData of channels) {
    try {
      // Check if channel exists
      const existing = await prisma.channelMetadata.findFirst({
        where: { channel: channelData.channel }
      });

      if (existing) {
        console.log(`✅ Channel ${channelData.channel} already exists`);
        // Update world ID if needed
        if (channelData.channel === 'main' && existing.worldId !== channelData.worldId) {
          await prisma.channelMetadata.update({
            where: { id: existing.id },
            data: { worldId: channelData.worldId }
          });
          console.log(`  ↳ Updated world ID for main channel`);
        }
      } else {
        const created = await prisma.channelMetadata.create({
          data: channelData
        });
        console.log(`✅ Created channel: ${created.channel}`);
      }
    } catch (error) {
      console.error(`❌ Error with channel ${channelData.channel}:`, error.message);
    }
  }
}

async function clearGhostBot(botId) {
  console.log(`\n🧹 Clearing ghost bot registration for ${botId}...`);
  
  try {
    // Clear metaverse agent ID from bot
    const bot = await prisma.bot.update({
      where: { id: botId },
      data: {
        metaverseAgentId: null,
        metaversePosition: null
      }
    });
    
    console.log('✅ Cleared metaverse agent ID from bot');
    
    // Clear bot sync record
    const syncRecord = await prisma.botSync.findFirst({
      where: { botId }
    });
    
    if (syncRecord) {
      await prisma.botSync.delete({
        where: { id: syncRecord.id }
      });
      console.log('✅ Deleted bot sync record');
    }
    
    return bot;
  } catch (error) {
    console.error('❌ Error clearing ghost bot:', error.message);
    throw error;
  }
}

async function redeployBot(botId) {
  console.log(`\n🚀 Re-deploying bot ${botId}...`);
  
  try {
    // Get bot details
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      include: {
        creator: true
      }
    });
    
    if (!bot) {
      throw new Error('Bot not found');
    }
    
    console.log(`📦 Bot: ${bot.name} (${bot.personality})`);
    
    // Call metaverse backend to register bot
    const response = await axios.post(`${METAVERSE_BACKEND_URL}/api/metaverse/bots/register`, {
      aiArenaBotId: bot.id,
      name: bot.name,
      personality: bot.personality,
      modelType: bot.modelType,
      avatarData: bot.avatarData,
      creatorAddress: bot.creator.address,
      initialZone: bot.currentZone || 'darkAlley'
    });
    
    if (response.data.success) {
      // Check if bot was already registered
      if (response.data.agentId && response.data.playerId) {
        console.log('✅ Bot was already registered!');
        console.log('  Agent ID:', response.data.agentId);
        console.log('  Player ID:', response.data.playerId);
        
        // Update bot with metaverse IDs
        await prisma.bot.update({
          where: { id: botId },
          data: {
            metaverseAgentId: response.data.agentId,
            metaversePosition: {
              playerId: response.data.playerId || '',
              worldId: response.data.worldId
            }
          }
        });
        
        return response.data;
      }
      
      // New registration flow
      if (response.data.registrationId) {
        console.log('✅ Bot registration initiated');
        console.log('  Registration ID:', response.data.registrationId);
        
        // Poll for completion
        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
          attempts++;
          console.log(`  Checking status... (attempt ${attempts}/${maxAttempts})`);
          
          // Send heartbeat every 10 attempts
          if (attempts % 10 === 0) {
            try {
              await axios.post(`${METAVERSE_BACKEND_URL}/api/metaverse/world/heartbeat`, {
                worldId: 'm179x0xjt139d2dk0v6zn11j4s7n7x0c'
              });
              console.log('  💓 Sent world heartbeat');
            } catch (err) {
              console.warn('  ⚠️ Heartbeat failed:', err.message);
            }
          }
          
          const statusResponse = await axios.get(
            `${METAVERSE_BACKEND_URL}/api/metaverse/bots/registration-status/${response.data.registrationId}`
          );
          
          if (statusResponse.data.status === 'completed') {
            console.log('✅ Bot deployed successfully!');
            console.log('  Agent ID:', statusResponse.data.agentId);
            console.log('  Player ID:', statusResponse.data.playerId);
            
            // Update bot with metaverse IDs
            await prisma.bot.update({
              where: { id: botId },
              data: {
                metaverseAgentId: statusResponse.data.agentId,
                metaversePosition: {
                  playerId: statusResponse.data.playerId || '',
                  worldId: response.data.worldId
                }
              }
            });
            
            return statusResponse.data;
          } else if (statusResponse.data.status === 'failed') {
            throw new Error(`Registration failed: ${statusResponse.data.error}`);
          }
          
          // Wait before next attempt
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        throw new Error('Registration timed out');
      }
      
      // Unexpected response
      throw new Error('Unexpected registration response - no agentId or registrationId');
    } else {
      throw new Error(`Registration failed: ${response.data.error}`);
    }
  } catch (error) {
    console.error('❌ Error re-deploying bot:', error.message);
    throw error;
  }
}

async function verifyDeployment(botId) {
  console.log(`\n🔍 Verifying deployment...`);
  
  try {
    // Check bot in database
    const bot = await prisma.bot.findUnique({
      where: { id: botId }
    });
    
    console.log('📊 Bot Status:');
    console.log('  Metaverse Agent ID:', bot.metaverseAgentId || 'Not set');
    console.log('  Current Zone:', bot.currentZone || 'Not set');
    
    // Check bot sync
    const syncRecord = await prisma.botSync.findFirst({
      where: { botId }
    });
    
    if (syncRecord) {
      console.log('🔄 Sync Record:');
      console.log('  Status:', syncRecord.status);
      console.log('  Convex Agent:', syncRecord.convexAgentId);
      console.log('  Last Synced:', syncRecord.lastSyncedAt);
    } else {
      console.log('⚠️ No sync record found');
    }
    
    return { bot, syncRecord };
  } catch (error) {
    console.error('❌ Error verifying deployment:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🛠️ AI Arena Channel Fix & Bot Redeploy Tool');
  console.log('==========================================\n');
  
  const botId = 'cme9r3l630002ru01kbbwc6iv'; // pigu1000
  
  try {
    // Step 1: Initialize channels
    await initializeChannels();
    
    // Step 2: Clear ghost bot
    await clearGhostBot(botId);
    
    // Step 3: Redeploy bot
    await redeployBot(botId);
    
    // Step 4: Verify deployment
    await verifyDeployment(botId);
    
    console.log('\n✨ All operations completed successfully!');
  } catch (error) {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);