#!/usr/bin/env node

/**
 * Automatic Bot Deployment Script
 * Runs periodically to deploy undeployed bots to the metaverse
 * 
 * Usage: node scripts/auto-deploy-bots.js
 * Or add to cron: */5 * * * * node /path/to/auto-deploy-bots.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();
const METAVERSE_BACKEND_URL = process.env.METAVERSE_BACKEND_URL || 'http://localhost:5001';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

async function log(message, color = 'reset') {
  const timestamp = new Date().toISOString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

async function checkMetaverseHealth() {
  try {
    const response = await axios.get(`${METAVERSE_BACKEND_URL}/health`, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

async function getAvailableWorld() {
  try {
    const response = await axios.get(`${METAVERSE_BACKEND_URL}/api/metaverse/world/available`);
    return response.data.worldId;
  } catch (error) {
    log(`Failed to get available world: ${error.message}`, 'red');
    return null;
  }
}

async function deployBot(bot, worldId) {
  try {
    log(`  Deploying ${bot.name} (${bot.personality})...`, 'cyan');

    // Generate character based on personality
    const character = bot.personality === 'CRIMINAL' ? 'f1' :
                     bot.personality === 'GAMBLER' ? 'f4' : 'f7';

    const deploymentData = {
      worldId,
      name: bot.name,
      character,
      identity: `You are ${bot.name}, a ${bot.personality.toLowerCase()} in the AI Arena metaverse.`,
      plan: bot.personality === 'CRIMINAL' ? 'Rob and fight for dominance' :
            bot.personality === 'GAMBLER' ? 'Take risks and win big' :
            'Work hard and build steady wealth',
      aiArenaBotId: bot.id,
      initialZone: bot.personality === 'CRIMINAL' ? 'darkAlley' :
                   bot.personality === 'GAMBLER' ? 'casino' : 'suburb',
      avatar: bot.avatar,
      modelType: bot.modelType
    };

    const response = await axios.post(
      `${METAVERSE_BACKEND_URL}/api/metaverse/bots/register`,
      deploymentData,
      { timeout: 30000 }
    );

    if (response.data.agentId) {
      // Update bot with metaverse IDs
      await prisma.bot.update({
        where: { id: bot.id },
        data: {
          metaverseAgentId: response.data.agentId,
          metaversePosition: {
            playerId: response.data.playerId || '',
            worldId: worldId
          },
          currentZone: deploymentData.initialZone,
          lastZoneChange: new Date()
        }
      });

      log(`  ✅ ${bot.name} deployed successfully (Agent: ${response.data.agentId})`, 'green');
      return true;
    } else if (response.data.registrationId) {
      log(`  ⏳ ${bot.name} registration queued: ${response.data.registrationId}`, 'yellow');
      
      // Poll for completion (simplified version)
      for (let i = 0; i < 15; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          const statusResponse = await axios.get(
            `${METAVERSE_BACKEND_URL}/api/metaverse/registration/${response.data.registrationId}/status`
          );
          
          if (statusResponse.data.status === 'completed' && statusResponse.data.result) {
            await prisma.bot.update({
              where: { id: bot.id },
              data: {
                metaverseAgentId: statusResponse.data.result.agentId,
                metaversePosition: {
                  playerId: statusResponse.data.result.playerId || '',
                  worldId: worldId
                },
                currentZone: deploymentData.initialZone,
                lastZoneChange: new Date()
              }
            });
            
            log(`  ✅ ${bot.name} registration completed`, 'green');
            return true;
          } else if (statusResponse.data.status === 'failed') {
            throw new Error(statusResponse.data.error);
          }
        } catch (pollError) {
          // Continue polling
        }
      }
      
      log(`  ⚠️ ${bot.name} registration timeout`, 'yellow');
      return false;
    }

    return false;
  } catch (error) {
    log(`  ❌ Failed to deploy ${bot.name}: ${error.message}`, 'red');
    
    // Mark deployment as failed
    await prisma.bot.update({
      where: { id: bot.id },
      data: {
        deploymentError: error.message
      }
    });
    
    return false;
  }
}

async function main() {
  log('🚀 Starting automatic bot deployment...', 'bright');

  try {
    // Check metaverse health
    const isHealthy = await checkMetaverseHealth();
    if (!isHealthy) {
      log('❌ Metaverse backend is not healthy, aborting', 'red');
      return;
    }

    // Get available world
    const worldId = await getAvailableWorld();
    if (!worldId) {
      log('❌ No available world instance, aborting', 'red');
      return;
    }

    log(`Found available world: ${worldId}`, 'cyan');

    // Find undeployed bots (those without metaverseAgentId)
    const undeployedBots = await prisma.bot.findMany({
      where: {
        metaverseAgentId: null
      },
      take: 5, // Deploy 5 bots at a time
      orderBy: { createdAt: 'asc' } // Deploy oldest first
    });

    if (undeployedBots.length === 0) {
      log('✅ All bots are deployed!', 'green');
      return;
    }

    log(`Found ${undeployedBots.length} undeployed bots`, 'yellow');

    let successCount = 0;
    let failCount = 0;

    // Deploy each bot
    for (const bot of undeployedBots) {
      const success = await deployBot(bot, worldId);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    log(`\n📊 Deployment Summary:`, 'bright');
    log(`  Successful: ${successCount}`, 'green');
    log(`  Failed: ${failCount}`, failCount > 0 ? 'red' : 'green');

    // Check for bots with botSync but no metaverseAgentId (inconsistent state)
    const inconsistentBots = await prisma.bot.findMany({
      where: {
        metaverseAgentId: null,
        botSync: {
          isNot: null
        }
      }
    });

    if (inconsistentBots.length > 0) {
      log(`\n⚠️ Found ${inconsistentBots.length} bots with sync records but no agent ID`, 'yellow');
      log(`  These bots may need manual investigation`, 'cyan');
    }

  } catch (error) {
    log(`❌ Fatal error: ${error.message}`, 'red');
    console.error(error);
  } finally {
    await prisma.$disconnect();
    log('👋 Auto-deployment complete', 'magenta');
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };