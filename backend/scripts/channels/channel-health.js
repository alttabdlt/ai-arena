#!/usr/bin/env node

/**
 * Channel Health Monitor
 * 
 * This script checks the health of all channels and provides recommendations
 */

const { PrismaClient } = require('@prisma/client');
const { worldDiscoveryService } = require('../dist/services/worldDiscoveryService');
const { channelService } = require('../dist/services/channelService');

const prisma = new PrismaClient();

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function printHealthBar(percentage) {
  const barLength = 30;
  const filled = Math.round((percentage / 100) * barLength);
  const empty = barLength - filled;
  
  let color = colors.green;
  if (percentage > 90) color = colors.red;
  else if (percentage > 70) color = colors.yellow;
  
  const bar = color + '█'.repeat(filled) + colors.reset + '░'.repeat(empty);
  return `[${bar}] ${percentage.toFixed(1)}%`;
}

async function checkChannelHealth() {
  console.log(`${colors.bright}🏥 AI Arena Channel Health Monitor${colors.reset}\n`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('═'.repeat(60) + '\n');

  try {
    // Get all channels
    const channels = await prisma.channelMetadata.findMany({
      orderBy: [
        { channelType: 'asc' },
        { channel: 'asc' }
      ]
    });

    if (channels.length === 0) {
      console.log(`${colors.yellow}⚠️  No channels found. Run 'node scripts/initialize-channels.js' first${colors.reset}`);
      return;
    }

    // Overall statistics
    const totalBots = channels.reduce((sum, c) => sum + c.currentBots, 0);
    const totalCapacity = channels.reduce((sum, c) => sum + c.maxBots, 0);
    const overallLoad = (totalBots / totalCapacity) * 100;

    console.log(`${colors.bright}📊 Overall Statistics${colors.reset}`);
    console.log(`   Total Channels: ${channels.length}`);
    console.log(`   Total Bots: ${totalBots}`);
    console.log(`   Total Capacity: ${totalCapacity}`);
    console.log(`   Overall Load: ${printHealthBar(overallLoad)}\n`);

    // Check each channel
    console.log(`${colors.bright}🔍 Channel Details${colors.reset}\n`);

    for (const channel of channels) {
      console.log(`${colors.cyan}━━━ ${channel.channel} ━━━${colors.reset}`);
      
      // Basic info
      console.log(`   Type: ${channel.channelType}`);
      console.log(`   Status: ${getStatusIcon(channel.status)} ${channel.status}`);
      console.log(`   Bots: ${channel.currentBots}/${channel.maxBots}`);
      
      const loadPercentage = (channel.currentBots / channel.maxBots) * 100;
      console.log(`   Load: ${printHealthBar(loadPercentage)}`);
      
      // Check world validity
      if (channel.worldId) {
        const isValid = await worldDiscoveryService.validateWorldId(channel.worldId);
        if (isValid) {
          console.log(`   World: ${colors.green}✓${colors.reset} ${channel.worldId.substring(0, 12)}...`);
        } else {
          console.log(`   World: ${colors.red}✗${colors.reset} ${channel.worldId.substring(0, 12)}... (Invalid)`);
        }
      } else {
        console.log(`   World: ${colors.yellow}⚠${colors.reset} Not assigned`);
      }

      // Health check using service
      const health = await channelService.getChannelHealth(channel.channel);
      
      if (health.errors.length > 0) {
        console.log(`   ${colors.red}Issues:${colors.reset}`);
        health.errors.forEach(error => {
          console.log(`      - ${error}`);
        });
      } else {
        console.log(`   ${colors.green}Health: Good ✓${colors.reset}`);
      }

      // Recommendations
      const recommendations = getRecommendations(channel, loadPercentage);
      if (recommendations.length > 0) {
        console.log(`   ${colors.yellow}Recommendations:${colors.reset}`);
        recommendations.forEach(rec => {
          console.log(`      - ${rec}`);
        });
      }

      console.log('');
    }

    // System recommendations
    console.log(`${colors.bright}💡 System Recommendations${colors.reset}\n`);
    
    const systemRecs = getSystemRecommendations(channels, totalBots, totalCapacity);
    if (systemRecs.length > 0) {
      systemRecs.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
    } else {
      console.log(`   ${colors.green}✓ System is healthy${colors.reset}`);
    }

    // Check for sync issues
    console.log(`\n${colors.bright}🔄 Sync Status${colors.reset}\n`);
    
    const pendingSyncs = await prisma.botSync.count({
      where: { syncStatus: 'PENDING' }
    });
    const failedSyncs = await prisma.botSync.count({
      where: { syncStatus: 'FAILED' }
    });
    const syncingSyncs = await prisma.botSync.count({
      where: { syncStatus: 'SYNCING' }
    });
    
    console.log(`   Pending: ${pendingSyncs}`);
    console.log(`   Syncing: ${syncingSyncs}`);
    console.log(`   Failed: ${failedSyncs}`);
    
    if (failedSyncs > 0) {
      console.log(`\n   ${colors.red}⚠️  ${failedSyncs} bots failed to sync${colors.reset}`);
      console.log(`   Run 'node scripts/reset-metaverse-sync.js' to reset failed syncs`);
    }

    // Bot distribution by channel type
    console.log(`\n${colors.bright}📈 Bot Distribution${colors.reset}\n`);
    
    const distribution = {};
    for (const channel of channels) {
      if (!distribution[channel.channelType]) {
        distribution[channel.channelType] = {
          count: 0,
          bots: 0,
          capacity: 0
        };
      }
      distribution[channel.channelType].count++;
      distribution[channel.channelType].bots += channel.currentBots;
      distribution[channel.channelType].capacity += channel.maxBots;
    }
    
    for (const [type, stats] of Object.entries(distribution)) {
      const load = (stats.bots / stats.capacity) * 100;
      console.log(`   ${type}: ${stats.count} channel(s), ${stats.bots}/${stats.capacity} bots (${load.toFixed(1)}%)`);
    }

  } catch (error) {
    console.error(`\n${colors.red}❌ Error checking channel health:${colors.reset}`, error);
  } finally {
    await prisma.$disconnect();
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'ACTIVE': return '🟢';
    case 'FULL': return '🔴';
    case 'DRAINING': return '🟡';
    case 'MAINTENANCE': return '🔧';
    default: return '⚫';
  }
}

function getRecommendations(channel, loadPercentage) {
  const recs = [];
  
  if (loadPercentage > 90) {
    recs.push('Channel is near capacity - consider creating a new shard');
  }
  
  if (loadPercentage < 10 && channel.channelType === 'MAIN' && channel.channel !== 'main') {
    recs.push('Channel is underutilized - consider load balancing');
  }
  
  if (channel.status === 'DRAINING') {
    recs.push('Channel is draining - migrate bots to other channels');
  }
  
  if (!channel.worldId) {
    recs.push('No world assigned - sync will create one automatically');
  }
  
  return recs;
}

function getSystemRecommendations(channels, totalBots, totalCapacity) {
  const recs = [];
  const overallLoad = (totalBots / totalCapacity) * 100;
  
  // Check if we need more channels
  if (overallLoad > 80) {
    recs.push('System load is high (>80%) - consider creating additional channels');
  }
  
  // Check for too many channels
  const mainChannels = channels.filter(c => c.channelType === 'MAIN');
  if (mainChannels.length > 3 && overallLoad < 30) {
    recs.push('System has many channels but low load - consider consolidating');
  }
  
  // Check for tournament channels that should be closed
  const tournamentChannels = channels.filter(c => c.channelType === 'TOURNAMENT');
  if (tournamentChannels.length > 0) {
    const emptyTournaments = tournamentChannels.filter(c => c.currentBots === 0);
    if (emptyTournaments.length > 0) {
      recs.push(`${emptyTournaments.length} empty tournament channel(s) can be closed`);
    }
  }
  
  // Check for load imbalance
  if (mainChannels.length > 1) {
    const loads = mainChannels.map(c => (c.currentBots / c.maxBots) * 100);
    const maxLoad = Math.max(...loads);
    const minLoad = Math.min(...loads);
    
    if (maxLoad - minLoad > 40) {
      recs.push('Load imbalance detected - run channel balancing');
    }
  }
  
  return recs;
}

// Run the health check
checkChannelHealth().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});