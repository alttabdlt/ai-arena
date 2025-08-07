#!/usr/bin/env node

/**
 * Initialize Channel System
 * 
 * This script sets up the channel system for the AI Arena metaverse
 * Creates the default main channel and updates existing bots
 */

const { PrismaClient, ChannelType, ChannelStatus } = require('@prisma/client');
const prisma = new PrismaClient();

async function initializeChannels() {
  console.log('🚀 Initializing Channel System\n');

  try {
    // Step 1: Check if main channel exists
    console.log('1️⃣  Checking for existing main channel...');
    let mainChannel = await prisma.channelMetadata.findFirst({
      where: { channel: 'main' }
    });

    if (mainChannel) {
      console.log('   ✅ Main channel already exists');
    } else {
      // Create main channel
      console.log('   Creating main channel...');
      
      // Count existing bots
      const botCount = await prisma.bot.count();
      
      mainChannel = await prisma.channelMetadata.create({
        data: {
          channel: 'main',
          channelType: 'MAIN',
          status: 'ACTIVE',
          maxBots: Math.max(30, botCount + 10),
          currentBots: botCount,
          metadata: {
            description: 'Default main channel',
            createdBy: 'system'
          }
        }
      });
      
      console.log(`   ✅ Created main channel with capacity for ${mainChannel.maxBots} bots (optimized for AI Town performance)`);
    }

    // Step 2: Update all existing bots to use main channel
    console.log('\n2️⃣  Checking bot channel assignments...');
    
    // Since channel has a default value, check if any bots have non-main channels
    const allBots = await prisma.bot.findMany({
      select: {
        id: true,
        name: true,
        channel: true
      }
    });
    
    const botsWithoutMainChannel = allBots.filter(bot => !bot.channel || bot.channel === '');
    
    if (botsWithoutMainChannel.length > 0) {
      // Update bots without proper channel
      for (const bot of botsWithoutMainChannel) {
        await prisma.bot.update({
          where: { id: bot.id },
          data: { channel: 'main' }
        });
      }
      console.log(`   ✅ Updated ${botsWithoutMainChannel.length} bots to main channel`);
    } else {
      console.log(`   ✅ All ${allBots.length} bots have channels assigned`);
    }
    
    // Update main channel bot count
    await prisma.channelMetadata.update({
      where: { id: mainChannel.id },
      data: { currentBots: allBots.length }
    });

    // Step 3: Update BotSync records
    console.log('\n3️⃣  Updating bot sync records...');
    
    // Get all sync records
    const allSyncs = await prisma.botSync.findMany({
      select: {
        id: true,
        channel: true
      }
    });
    
    const syncsWithoutChannel = allSyncs.filter(sync => !sync.channel || sync.channel === '');
    
    if (syncsWithoutChannel.length > 0) {
      // Update syncs without proper channel
      for (const sync of syncsWithoutChannel) {
        await prisma.botSync.update({
          where: { id: sync.id },
          data: { channel: 'main' }
        });
      }
      console.log(`   ✅ Updated ${syncsWithoutChannel.length} sync records to main channel`);
    } else {
      console.log(`   ✅ All ${allSyncs.length} sync records have channels assigned`);
    }

    // Step 4: Display channel statistics
    console.log('\n4️⃣  Channel Statistics:');
    
    const channels = await prisma.channelMetadata.findMany({
      orderBy: { channel: 'asc' }
    });
    
    console.log('\n   📊 Active Channels:');
    for (const channel of channels) {
      const loadPercentage = ((channel.currentBots / channel.maxBots) * 100).toFixed(1);
      const status = channel.status === 'ACTIVE' ? '🟢' : 
                    channel.status === 'FULL' ? '🔴' : 
                    channel.status === 'DRAINING' ? '🟡' : '⚫';
      
      console.log(`      ${status} ${channel.channel}: ${channel.currentBots}/${channel.maxBots} bots (${loadPercentage}% full)`);
      
      if (channel.worldId) {
        console.log(`         World ID: ${channel.worldId}`);
      }
      
    }

    // Step 5: Check for bots in non-existent channels
    console.log('\n5️⃣  Checking for orphaned bots...');
    
    const allChannelNames = channels.map(c => c.channel);
    const orphanedBots = await prisma.bot.findMany({
      where: {
        channel: {
          notIn: allChannelNames
        }
      },
      select: {
        id: true,
        name: true,
        channel: true
      }
    });
    
    if (orphanedBots.length > 0) {
      console.log(`   ⚠️  Found ${orphanedBots.length} bots in non-existent channels:`);
      for (const bot of orphanedBots) {
        console.log(`      - ${bot.name} (channel: ${bot.channel})`);
      }
      
      // Move orphaned bots to main
      await prisma.bot.updateMany({
        where: {
          id: { in: orphanedBots.map(b => b.id) }
        },
        data: {
          channel: 'main'
        }
      });
      
      console.log('   ✅ Moved orphaned bots to main channel');
      
      // Update main channel bot count
      const newBotCount = await prisma.bot.count({ where: { channel: 'main' } });
      await prisma.channelMetadata.update({
        where: { id: mainChannel.id },
        data: { currentBots: newBotCount }
      });
    } else {
      console.log('   ✅ No orphaned bots found');
    }

    // Step 6: Recommendations
    console.log('\n✨ Channel System Initialized!\n');
    console.log('📝 Next Steps:');
    console.log('   1. Start the backend: npm run dev');
    console.log('   2. Bots will sync to their channels automatically');
    console.log('   3. Create tournament channels when tournaments start');
    console.log('   4. Monitor channel health with: node scripts/channel-health.js\n');

    // Display sample channel commands
    console.log('🛠️  Useful Commands:');
    console.log('   - Create VIP channel: POST /api/channels { type: "VIP" }');
    console.log('   - Assign bot to channel: POST /api/channels/:channel/assign-bot');
    console.log('   - Get channel stats: GET /api/channels/:channel/stats');
    console.log('   - Balance channels: POST /api/channels/balance\n');

  } catch (error) {
    console.error('\n❌ Error initializing channels:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the initialization
initializeChannels().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});