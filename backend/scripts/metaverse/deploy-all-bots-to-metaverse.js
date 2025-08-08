const { PrismaClient } = require('@prisma/client');
const { GraphQLClient } = require('graphql-request');

const prisma = new PrismaClient();
const client = new GraphQLClient('http://localhost:4000/graphql', {
  headers: {
    'Content-Type': 'application/json'
  }
});

const REGISTER_BOT_MUTATION = `
  mutation RegisterBotInMetaverse($botId: ID!) {
    registerBotInMetaverse(botId: $botId) {
      success
      message
      botSync {
        id
        syncStatus
        convexAgentId
        convexWorldId
      }
      metaverseInfo {
        agentId
        playerId
        worldId
        zone
        position {
          x
          y
          worldInstanceId
        }
      }
    }
  }
`;

const BATCH_REGISTER_MUTATION = `
  mutation BatchRegisterBots($botIds: [ID!]!) {
    batchRegisterBots(botIds: $botIds) {
      success
      message
      registeredCount
      failedCount
      results {
        botId
        success
        message
        syncStatus
      }
    }
  }
`;

async function deployAllBots() {
  try {
    console.log('🚀 Starting automatic bot deployment to metaverse...\n');
    
    // Get all bots that are not synced
    const unsyncedBots = await prisma.bot.findMany({
      where: {
        OR: [
          { metaverseAgentId: null },
          { botSync: null },
          { botSync: { syncStatus: { not: 'SYNCED' } } }
        ]
      },
      include: {
        botSync: true
      }
    });
    
    if (unsyncedBots.length === 0) {
      console.log('✅ All bots are already deployed to the metaverse!');
      return;
    }
    
    console.log(`📊 Found ${unsyncedBots.length} bots to deploy:\n`);
    
    unsyncedBots.forEach(bot => {
      const personality = bot.personality || 'WORKER';
      const emoji = personality === 'CRIMINAL' ? '🔫' : personality === 'GAMBLER' ? '🎰' : '⚒️';
      console.log(`  ${emoji} ${bot.name} (${personality})`);
    });
    
    console.log('\n🔄 Starting deployment process...\n');
    
    // Skip batch registration as it's not implemented yet
    console.log('📤 Starting individual bot registration...\n');
    
    // Option 2: Register bots one by one
    let successCount = 0;
    let failCount = 0;
    
    for (const bot of unsyncedBots) {
      console.log(`📤 Deploying ${bot.name} (${bot.personality})...`);
      
      try {
        const result = await client.request(REGISTER_BOT_MUTATION, { botId: bot.id });
        
        if (result.registerBotInMetaverse.success) {
          successCount++;
          const metaInfo = result.registerBotInMetaverse.metaverseInfo;
          console.log(`   ✅ Success!`);
          console.log(`   📍 Zone: ${metaInfo.zone}`);
          console.log(`   🎯 Position: (${metaInfo.position.x}, ${metaInfo.position.y})`);
          console.log(`   🌍 World Instance: ${metaInfo.position.worldInstanceId.slice(0, 8)}...`);
          console.log(`   🤖 Agent ID: ${metaInfo.agentId}\n`);
        } else {
          failCount++;
          console.log(`   ❌ Failed: ${result.registerBotInMetaverse.message}\n`);
        }
        
        // Add a small delay between registrations to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        failCount++;
        console.error(`   ❌ Error: ${error.message}`);
        console.error(`   Stack: ${error.stack}\n`);
      }
    }
    
    console.log('\n📊 Deployment Summary:');
    console.log(`   ✅ Successfully deployed: ${successCount} bots`);
    console.log(`   ❌ Failed deployments: ${failCount} bots`);
    console.log(`   📈 Total processed: ${unsyncedBots.length} bots`);
    
    if (successCount > 0) {
      console.log('\n🎉 Bots are now live in the metaverse!');
      console.log('   Visit http://localhost:8080 to see them in action');
    }
    
  } catch (error) {
    console.error('❌ Deployment script failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Check for command line flags
const args = process.argv.slice(2);
const showHelp = args.includes('--help') || args.includes('-h');

if (showHelp) {
  console.log(`
🤖 AI Arena Bot Deployment Script
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This script automatically deploys all unsynced bots from your AI Arena 
platform to the AI Town metaverse.

Usage:
  node deploy-all-bots-to-metaverse.js

Prerequisites:
  1. Backend server running (npm run dev in backend/)
  2. Metaverse game running (npm run dev in metaverse-game/)
  3. At least one bot created in the platform

The script will:
  - Find all bots not yet in the metaverse
  - Deploy them with appropriate zones based on personality
  - Report success/failure for each deployment
  `);
} else {
  deployAllBots();
}