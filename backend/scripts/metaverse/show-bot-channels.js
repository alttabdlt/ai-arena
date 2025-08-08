#!/usr/bin/env node

/**
 * Show Bot Channel Assignments
 * 
 * This script displays which channel each bot is assigned to
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function showBotChannels() {
  console.log('\n📍 Bot Channel Assignments\n');
  console.log('=' .repeat(60) + '\n');

  try {
    // Get all bots with their channels
    const bots = await prisma.bot.findMany({
      select: {
        id: true,
        name: true,
        channel: true,
        isActive: true,
        creator: {
          select: {
            username: true,
            address: true
          }
        }
      },
      orderBy: {
        channel: 'asc'
      }
    });

    if (bots.length === 0) {
      console.log('❌ No bots found in the database\n');
      console.log('To create a bot, use the frontend at http://localhost:5173\n');
      return;
    }

    // Group bots by channel
    const channels = {};
    for (const bot of bots) {
      const channel = bot.channel || 'unassigned';
      if (!channels[channel]) {
        channels[channel] = [];
      }
      channels[channel].push(bot);
    }

    // Display bots grouped by channel
    for (const [channelName, channelBots] of Object.entries(channels)) {
      console.log(`📺 Channel: ${channelName} (${channelBots.length} bots)`);
      console.log('-'.repeat(40));
      
      for (const bot of channelBots) {
        const owner = bot.creator?.username || bot.creator?.address?.slice(0, 8) || 'Unknown';
        const status = bot.isActive ? '🟢' : '🔴';
        console.log(`  ${status} ${bot.name} (Owner: ${owner})`);
      }
      console.log('');
    }

    // Get channel metadata
    const channelMeta = await prisma.channelMetadata.findMany({
      orderBy: {
        channel: 'asc'
      }
    });

    if (channelMeta.length > 0) {
      console.log('📊 Channel Metadata:');
      console.log('-'.repeat(40));
      
      for (const meta of channelMeta) {
        const load = ((meta.currentBots / meta.maxBots) * 100).toFixed(1);
        const status = meta.status === 'ACTIVE' ? '🟢' : 
                      meta.status === 'FULL' ? '🔴' : '🟡';
        
        console.log(`${status} ${meta.channel}:`);
        console.log(`   Type: ${meta.channelType}`);
        console.log(`   Capacity: ${meta.currentBots}/${meta.maxBots} (${load}% full)`);
        
        if (meta.worldId) {
          console.log(`   World: ${meta.worldId.substring(0, 12)}...`);
        }
        console.log('');
      }
    }

    // Summary
    console.log('📈 Summary:');
    console.log(`   Total Bots: ${bots.length}`);
    console.log(`   Active Bots: ${bots.filter(b => b.isActive).length}`);
    console.log(`   Channels Used: ${Object.keys(channels).length}`);
    console.log(`   Default Channel: main`);
    console.log('');
    
    console.log('💡 Notes:');
    console.log('   - All bots are assigned to "main" channel by default');
    console.log('   - Channels are created automatically when needed');
    console.log('   - Each channel can hold 30 bots (optimal for AI Town)');
    console.log('   - Users cannot currently see or change channels\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
showBotChannels().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});