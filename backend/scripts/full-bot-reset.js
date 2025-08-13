const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
require('dotenv').config();

const prisma = new PrismaClient();
const METAVERSE_BACKEND_URL = process.env.METAVERSE_BACKEND_URL || 'http://localhost:5001';

async function fullBotReset(botId) {
  console.log('🔧 Full Bot Reset Tool');
  console.log('====================\n');
  
  try {
    // Step 1: Clear all metaverse data from bot
    console.log('Step 1: Clearing metaverse data from bot...');
    await prisma.bot.update({
      where: { id: botId },
      data: {
        metaverseAgentId: null,
        metaversePosition: null,
        currentZone: 'darkAlley',
        lastZoneChange: new Date()
      }
    });
    console.log('✅ Cleared metaverse data');
    
    // Step 2: Delete any bot sync records
    console.log('\nStep 2: Deleting bot sync records...');
    const deletedSync = await prisma.botSync.deleteMany({
      where: { botId }
    });
    console.log(`✅ Deleted ${deletedSync.count} sync records`);
    
    // Step 3: Call metaverse backend to force unregister
    console.log('\nStep 3: Force unregistering from metaverse...');
    try {
      const unregisterRes = await axios.post(`${METAVERSE_BACKEND_URL}/api/metaverse/bots/unregister`, {
        aiArenaBotId: botId
      });
      console.log('✅ Unregistered from metaverse');
    } catch (err) {
      console.log('⚠️ Unregister endpoint not available or bot not found');
    }
    
    // Wait a bit for cleanup
    console.log('\nWaiting 3 seconds for cleanup...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 4: Get bot data for re-registration
    console.log('\nStep 4: Getting bot data...');
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      include: { creator: true }
    });
    
    if (!bot) {
      throw new Error('Bot not found');
    }
    
    console.log(`✅ Found bot: ${bot.name} (${bot.personality})`);
    
    // Step 5: Fresh registration
    console.log('\nStep 5: Fresh registration to metaverse...');
    const regResponse = await axios.post(`${METAVERSE_BACKEND_URL}/api/metaverse/bots/register`, {
      aiArenaBotId: bot.id,
      name: bot.name,
      personality: bot.personality,
      modelType: bot.modelType,
      avatarData: bot.avatarData,
      creatorAddress: bot.creator.address,
      initialZone: 'darkAlley',
      forceNew: true // Force new registration even if exists
    });
    
    if (!regResponse.data.success) {
      throw new Error(`Registration failed: ${regResponse.data.error}`);
    }
    
    console.log('✅ Registration response:', regResponse.data);
    
    // Handle the response based on type
    let finalAgentId, finalPlayerId;
    
    if (regResponse.data.agentId && regResponse.data.playerId) {
      // Immediate success
      finalAgentId = regResponse.data.agentId;
      finalPlayerId = regResponse.data.playerId;
      console.log('✅ Got immediate registration success');
    } else if (regResponse.data.registrationId) {
      // Need to poll for completion
      console.log('⏳ Registration queued, polling for completion...');
      
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        attempts++;
        console.log(`  Attempt ${attempts}/${maxAttempts}...`);
        
        // Send heartbeat every 10 attempts
        if (attempts % 10 === 0) {
          try {
            await axios.post(`${METAVERSE_BACKEND_URL}/api/metaverse/world/heartbeat`, {
              worldId: regResponse.data.worldId
            });
            console.log('  💓 Sent world heartbeat');
          } catch (err) {
            console.warn('  ⚠️ Heartbeat failed');
          }
        }
        
        try {
          const statusRes = await axios.get(
            `${METAVERSE_BACKEND_URL}/api/metaverse/bots/registration-status/${regResponse.data.registrationId}`
          );
          
          if (statusRes.data.status === 'completed') {
            finalAgentId = statusRes.data.agentId;
            finalPlayerId = statusRes.data.playerId;
            console.log('✅ Registration completed!');
            break;
          } else if (statusRes.data.status === 'failed') {
            throw new Error(`Registration failed: ${statusRes.data.error}`);
          }
        } catch (err) {
          // Continue polling
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      if (!finalAgentId) {
        throw new Error('Registration timed out');
      }
    }
    
    // Step 6: Update bot with new IDs
    console.log('\nStep 6: Updating bot with new metaverse IDs...');
    await prisma.bot.update({
      where: { id: botId },
      data: {
        metaverseAgentId: finalAgentId,
        metaversePosition: {
          playerId: finalPlayerId || '',
          worldId: regResponse.data.worldId
        },
        currentZone: 'darkAlley'
      }
    });
    console.log('✅ Bot updated with new IDs');
    
    // Step 7: Create new sync record
    console.log('\nStep 7: Creating bot sync record...');
    await prisma.botSync.create({
      data: {
        botId: bot.id,
        channel: bot.channel || 'main',
        syncStatus: 'SYNCED',
        convexAgentId: finalAgentId,
        convexWorldId: regResponse.data.worldId,
        convexPlayerId: finalPlayerId,
        lastSyncedAt: new Date()
      }
    });
    console.log('✅ Created sync record');
    
    // Step 8: Verify registration
    console.log('\nStep 8: Verifying registration...');
    console.log('📊 Final Status:');
    console.log(`  Bot ID: ${bot.id}`);
    console.log(`  Bot Name: ${bot.name}`);
    console.log(`  Agent ID: ${finalAgentId}`);
    console.log(`  Player ID: ${finalPlayerId}`);
    console.log(`  World ID: ${regResponse.data.worldId}`);
    console.log(`  Channel: ${bot.channel || 'main'}`);
    
    return {
      success: true,
      agentId: finalAgentId,
      playerId: finalPlayerId,
      worldId: regResponse.data.worldId
    };
    
  } catch (error) {
    console.error('❌ Error during reset:', error.message);
    throw error;
  }
}

async function main() {
  const botId = 'cme9r3l630002ru01kbbwc6iv'; // pigu1000
  
  try {
    const result = await fullBotReset(botId);
    console.log('\n✨ Full bot reset completed successfully!');
    console.log('Result:', result);
  } catch (error) {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);