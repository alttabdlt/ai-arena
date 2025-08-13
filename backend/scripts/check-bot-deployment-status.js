#!/usr/bin/env node

/**
 * Check Bot Deployment Status
 * Verifies the deployment status of bots in both Arena and Metaverse
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

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkMetaverseAgent(aiArenaBotId) {
  try {
    const response = await axios.get(
      `${METAVERSE_BACKEND_URL}/api/metaverse/bots/${aiArenaBotId}/status`
    );
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

async function main() {
  log('\n🔍 Bot Deployment Status Check', 'bright');
  log('================================\n', 'bright');

  try {
    // Get user address from command line or use default
    const userAddress = process.argv[2] || '0x2487155df829977813ea9b4f992c229f86d4f16a';
    
    log(`📍 Checking bots for user: ${userAddress}\n`, 'cyan');

    // Get user and their bots
    const user = await prisma.user.findUnique({
      where: { address: userAddress },
      include: {
        bots: {
          include: {
            botSync: true
          }
        }
      }
    });

    if (!user) {
      log('❌ User not found', 'red');
      process.exit(1);
    }

    if (user.bots.length === 0) {
      log('📭 No bots found for this user', 'yellow');
      process.exit(0);
    }

    log(`📦 Found ${user.bots.length} bot(s)\n`, 'green');

    // Check each bot
    for (const bot of user.bots) {
      log(`\n🤖 Bot: ${bot.name} (ID: ${bot.id})`, 'bright');
      log('─'.repeat(50), 'cyan');
      
      // Arena Backend Status
      log('\n📊 Arena Backend Status:', 'magenta');
      log(`  • Name: ${bot.name}`, 'reset');
      log(`  • Personality: ${bot.personality}`, 'reset');
      log(`  • Model: ${bot.modelType}`, 'reset');
      log(`  • Channel: ${bot.channel || 'main'}`, 'reset');
      log(`  • Current Zone: ${bot.currentZone || 'Not set'}`, 'reset');
      log(`  • Created: ${bot.createdAt.toISOString()}`, 'reset');
      
      // Metaverse IDs
      log('\n🔗 Metaverse IDs:', 'magenta');
      if (bot.metaverseAgentId) {
        log(`  ✅ Agent ID: ${bot.metaverseAgentId}`, 'green');
      } else {
        log(`  ❌ Agent ID: Not set`, 'red');
      }
      
      if (bot.metaversePosition && typeof bot.metaversePosition === 'object') {
        const pos = bot.metaversePosition;
        if (pos.playerId) {
          log(`  ✅ Player ID: ${pos.playerId}`, 'green');
        }
        if (pos.worldId) {
          log(`  ✅ World ID: ${pos.worldId}`, 'green');
        }
      } else {
        log(`  ❌ Position data: Not set`, 'red');
      }
      
      // Bot Sync Status
      if (bot.botSync) {
        log('\n🔄 Bot Sync Record:', 'magenta');
        log(`  • Sync Status: ${bot.botSync.syncStatus}`, 'reset');
        log(`  • Channel: ${bot.botSync.channel}`, 'reset');
        if (bot.botSync.convexAgentId) {
          log(`  • Convex Agent: ${bot.botSync.convexAgentId}`, 'reset');
        }
        if (bot.botSync.convexWorldId) {
          log(`  • Convex World: ${bot.botSync.convexWorldId}`, 'reset');
        }
        if (bot.botSync.lastSyncedAt) {
          log(`  • Last Synced: ${bot.botSync.lastSyncedAt.toISOString()}`, 'reset');
        }
        if (bot.botSync.syncErrors && bot.botSync.syncErrors.length > 0) {
          log(`  • Sync Errors: ${JSON.stringify(bot.botSync.syncErrors)}`, 'yellow');
        }
      } else {
        log('\n🔄 Bot Sync Record: None', 'yellow');
      }
      
      // Deployment Status Summary
      log('\n📌 Deployment Status:', 'bright');
      if (bot.metaverseAgentId) {
        log('  ✅ Bot is DEPLOYED to metaverse', 'green');
      } else if (bot.botSync?.syncStatus === 'SYNCING') {
        log('  ⏳ Bot deployment is IN PROGRESS', 'yellow');
      } else if (bot.botSync?.syncStatus === 'FAILED') {
        log('  ❌ Bot deployment FAILED', 'red');
        if (bot.botSync.syncErrors) {
          log(`     Error: ${JSON.stringify(bot.botSync.syncErrors)}`, 'red');
        }
      } else {
        log('  ⚠️ Bot is NOT DEPLOYED to metaverse', 'yellow');
      }
    }

    // Summary Statistics
    log('\n\n📊 Summary Statistics', 'bright');
    log('─'.repeat(50), 'cyan');
    
    const deployed = user.bots.filter(b => b.metaverseAgentId).length;
    const notDeployed = user.bots.filter(b => !b.metaverseAgentId).length;
    const syncing = user.bots.filter(b => b.botSync?.syncStatus === 'SYNCING').length;
    const failed = user.bots.filter(b => b.botSync?.syncStatus === 'FAILED').length;
    
    log(`  Total Bots: ${user.bots.length}`, 'reset');
    log(`  ✅ Deployed: ${deployed}`, deployed > 0 ? 'green' : 'reset');
    log(`  ⚠️ Not Deployed: ${notDeployed}`, notDeployed > 0 ? 'yellow' : 'reset');
    log(`  ⏳ Syncing: ${syncing}`, syncing > 0 ? 'cyan' : 'reset');
    log(`  ❌ Failed: ${failed}`, failed > 0 ? 'red' : 'reset');
    
    // Recommendations
    if (notDeployed > 0) {
      log('\n💡 Recommendations:', 'bright');
      log('  • Run "npm run deploy:bots" to deploy undeployed bots', 'cyan');
      log('  • Check metaverse backend is running on port 5001', 'cyan');
      log('  • Verify Convex deployment is active', 'cyan');
    }

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    console.error(error);
  } finally {
    await prisma.$disconnect();
    log('\n✨ Status check complete\n', 'magenta');
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };