#!/usr/bin/env node

/**
 * Configure Channel Settings
 * 
 * This script allows manual configuration of channel capacity and settings
 * 
 * Usage:
 *   node scripts/configure-channel.js --channel main --max-bots 30
 *   node scripts/configure-channel.js --channel vip --max-bots 20
 *   node scripts/configure-channel.js --list
 */

const { PrismaClient, ChannelStatus } = require('@prisma/client');
const prisma = new PrismaClient();

const args = process.argv.slice(2);
const flags = {};

// Parse command line arguments
for (let i = 0; i < args.length; i += 2) {
  const flag = args[i];
  const value = args[i + 1];
  flags[flag] = value;
}

async function listChannels() {
  console.log('\n📊 Current Channel Configuration\n');
  console.log('Channel Name    | Type     | Max Bots | Current | Status');
  console.log('---------------|----------|----------|---------|----------');
  
  const channels = await prisma.channelMetadata.findMany({
    orderBy: { channel: 'asc' }
  });
  
  for (const channel of channels) {
    const loadPercentage = ((channel.currentBots / channel.maxBots) * 100).toFixed(1);
    console.log(
      `${channel.channel.padEnd(14)} | ${channel.channelType.padEnd(8)} | ${
        channel.maxBots.toString().padEnd(8)
      } | ${channel.currentBots.toString().padEnd(7)} | ${channel.status} (${loadPercentage}%)`
    );
  }
  
  console.log('\n💡 Performance Recommendations:');
  console.log('   - MAIN channels: 30 bots (optimal)');
  console.log('   - VIP channels: 20 bots (premium performance)');
  console.log('   - TEST channels: 10 bots (development)');
  console.log('   - Maximum recommended: 50 bots (AI Town O(n²) pathfinding limit)\n');
}

async function configureChannel(channelName, maxBots) {
  // Validate max bots
  if (maxBots > 50) {
    console.warn('⚠️  Warning: Setting max bots above 50 may cause performance issues in AI Town');
    console.warn('   AI Town uses O(n²) pathfinding algorithms that degrade with more agents');
  }
  
  if (maxBots < 1) {
    console.error('❌ Error: Max bots must be at least 1');
    process.exit(1);
  }
  
  // Find channel
  const channel = await prisma.channelMetadata.findFirst({
    where: { channel: channelName }
  });
  
  if (!channel) {
    console.error(`❌ Error: Channel "${channelName}" not found`);
    console.log('\n💡 Tip: Use --list to see all channels');
    process.exit(1);
  }
  
  // Check if new capacity is less than current bots
  if (maxBots < channel.currentBots) {
    console.error(`❌ Error: Cannot set max bots to ${maxBots} - channel has ${channel.currentBots} bots`);
    console.log('   Options:');
    console.log('   1. Move some bots to other channels first');
    console.log('   2. Set a higher capacity (minimum: ' + channel.currentBots + ')');
    process.exit(1);
  }
  
  // Update channel
  const oldMaxBots = channel.maxBots;
  await prisma.channelMetadata.update({
    where: { id: channel.id },
    data: { 
      maxBots,
      status: maxBots <= channel.currentBots ? 'FULL' : 'ACTIVE'
    }
  });
  
  console.log(`\n✅ Channel "${channelName}" updated:`);
  console.log(`   Max bots: ${oldMaxBots} → ${maxBots}`);
  console.log(`   Current bots: ${channel.currentBots}`);
  console.log(`   Load: ${((channel.currentBots / maxBots) * 100).toFixed(1)}%`);
  
  if (maxBots <= 30) {
    console.log('   ✨ Optimal performance configuration');
  } else if (maxBots <= 50) {
    console.log('   ⚠️  Acceptable performance, monitor for lag');
  } else {
    console.log('   ⚠️  Performance may be impacted with this many bots');
  }
}

async function main() {
  try {
    if (flags['--list']) {
      await listChannels();
    } else if (flags['--channel'] && flags['--max-bots']) {
      const channelName = flags['--channel'];
      const maxBots = parseInt(flags['--max-bots']);
      
      if (isNaN(maxBots)) {
        console.error('❌ Error: --max-bots must be a number');
        process.exit(1);
      }
      
      await configureChannel(channelName, maxBots);
    } else {
      console.log('\n🔧 Channel Configuration Tool\n');
      console.log('Usage:');
      console.log('  List all channels:');
      console.log('    node scripts/configure-channel.js --list\n');
      console.log('  Configure a channel:');
      console.log('    node scripts/configure-channel.js --channel <name> --max-bots <number>\n');
      console.log('Examples:');
      console.log('  node scripts/configure-channel.js --channel main --max-bots 30');
      console.log('  node scripts/configure-channel.js --channel vip --max-bots 20');
      console.log('  node scripts/configure-channel.js --list\n');
      console.log('Performance Guidelines:');
      console.log('  📈 10-20 bots: Excellent performance');
      console.log('  ✅ 20-30 bots: Good performance (recommended)');
      console.log('  ⚠️  30-50 bots: Acceptable, may see some lag');
      console.log('  ❌ 50+ bots: Not recommended, severe performance issues\n');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});