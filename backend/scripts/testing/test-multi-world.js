#!/usr/bin/env node

/**
 * Test Multi-World Navigation
 * Demonstrates the current multi-world system functionality
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testMultiWorld() {
  console.log('🧪 Testing Multi-World Navigation System\n');
  
  try {
    // 1. List all available channels
    console.log('📊 Available Channels:');
    console.log('====================');
    const channels = await prisma.channelMetadata.findMany({
      select: {
        channel: true,
        channelType: true,
        status: true,
        currentBots: true,
        maxBots: true,
        worldId: true,
        region: true
      }
    });
    
    channels.forEach(ch => {
      const icon = ch.channelType === 'MAIN' ? '🌍' : 
                    ch.channelType === 'VIP' ? '👑' : 
                    ch.channelType === 'TEST' ? '🧪' : '📍';
      const capacity = `${ch.currentBots}/${ch.maxBots}`;
      const utilization = ch.maxBots > 0 ? 
        Math.round((ch.currentBots / ch.maxBots) * 100) : 0;
      
      console.log(`\n${icon} ${ch.channel}`);
      console.log(`   Type: ${ch.channelType}`);
      console.log(`   Status: ${ch.status}`);
      console.log(`   Capacity: ${capacity} bots (${utilization}% full)`);
      console.log(`   World ID: ${ch.worldId || 'Not assigned yet'}`);
      console.log(`   Region: ${ch.region || 'us-west-2'}`);
    });
    
    // 2. Simulate finding optimal channel for a new bot
    console.log('\n\n🤖 Finding Optimal Channel for New Bot:');
    console.log('=======================================');
    
    const optimalChannel = await findOptimalChannel('us-west-2', 'MAIN');
    if (optimalChannel) {
      console.log(`✅ Recommended channel: ${optimalChannel.channel}`);
      console.log(`   Current load: ${optimalChannel.currentBots}/${optimalChannel.maxBots}`);
      console.log(`   Utilization: ${Math.round((optimalChannel.currentBots / optimalChannel.maxBots) * 100)}%`);
    } else {
      console.log('❌ No available channels found');
    }
    
    // 3. Simulate channel utilization across types
    console.log('\n\n📈 Channel Utilization by Type:');
    console.log('================================');
    
    const utilization = await prisma.channelMetadata.groupBy({
      by: ['channelType'],
      _sum: {
        currentBots: true,
        maxBots: true
      },
      where: {
        status: 'ACTIVE'
      }
    });
    
    utilization.forEach(u => {
      const used = u._sum.currentBots || 0;
      const total = u._sum.maxBots || 0;
      const percent = total > 0 ? Math.round((used / total) * 100) : 0;
      
      console.log(`\n${u.channelType}:`);
      console.log(`   Capacity: ${used}/${total} bots`);
      console.log(`   Utilization: ${percent}%`);
      console.log(`   ${createProgressBar(percent)}`);
    });
    
    // 4. Test auto-scaling recommendations
    console.log('\n\n⚖️ Auto-Scaling Recommendations:');
    console.log('=================================');
    
    for (const channel of channels) {
      const utilization = channel.maxBots > 0 ? 
        (channel.currentBots / channel.maxBots) : 0;
      
      if (utilization > 0.8) {
        console.log(`\n⚠️ ${channel.channel}: HIGH LOAD (${Math.round(utilization * 100)}%)`);
        console.log('   Recommendation: Scale up or create new channel');
      } else if (utilization < 0.2 && channel.channelType !== 'MAIN') {
        console.log(`\n💤 ${channel.channel}: LOW LOAD (${Math.round(utilization * 100)}%)`);
        console.log('   Recommendation: Consider draining channel');
      }
    }
    
    // 5. Simulate bot deployment to different channels
    console.log('\n\n🚀 Simulating Bot Deployments:');
    console.log('==============================');
    
    const testBots = [
      { name: 'CriminalBot', personality: 'CRIMINAL', preferredChannel: 'main' },
      { name: 'VIPGambler', personality: 'GAMBLER', preferredChannel: 'vip-lounge' },
      { name: 'TestWorker', personality: 'WORKER', preferredChannel: 'test-world' }
    ];
    
    for (const bot of testBots) {
      const channel = await prisma.channelMetadata.findFirst({
        where: { channel: bot.preferredChannel }
      });
      
      if (channel) {
        const canDeploy = channel.currentBots < channel.maxBots;
        const icon = canDeploy ? '✅' : '❌';
        
        console.log(`\n${icon} ${bot.name} → ${bot.preferredChannel}`);
        console.log(`   Personality: ${bot.personality}`);
        console.log(`   Channel capacity: ${channel.currentBots}/${channel.maxBots}`);
        console.log(`   Can deploy: ${canDeploy ? 'Yes' : 'No (channel full)'}`);
        
        if (canDeploy) {
          // Simulate incrementing bot count
          console.log(`   📝 Would increment ${channel.channel} bot count to ${channel.currentBots + 1}`);
        }
      } else {
        console.log(`\n❌ ${bot.name} → ${bot.preferredChannel}`);
        console.log(`   Error: Channel not found`);
      }
    }
    
    // 6. Production readiness check
    console.log('\n\n🏭 Production Readiness Check:');
    console.log('==============================');
    
    const checks = [
      {
        name: 'Multiple channels exist',
        pass: channels.length > 1,
        critical: true
      },
      {
        name: 'Auto-scaling capability',
        pass: false, // Would need orchestrator service
        critical: true
      },
      {
        name: 'Geographic distribution',
        pass: channels.some(c => c.region && c.region !== 'us-west-2'),
        critical: true
      },
      {
        name: 'Channel capacity monitoring',
        pass: true, // We can calculate utilization
        critical: false
      },
      {
        name: 'World assignment working',
        pass: channels.some(c => c.worldId !== null),
        critical: true
      }
    ];
    
    let criticalPassed = 0;
    let totalCritical = 0;
    
    checks.forEach(check => {
      const icon = check.pass ? '✅' : (check.critical ? '❌' : '⚠️');
      console.log(`\n${icon} ${check.name}`);
      if (check.critical) {
        totalCritical++;
        if (check.pass) criticalPassed++;
      }
    });
    
    const readiness = Math.round((criticalPassed / totalCritical) * 100);
    console.log(`\n📊 Production Readiness: ${readiness}%`);
    console.log(`   ${createProgressBar(readiness)}`);
    
    if (readiness <= 50) {
      console.log('\n⚠️ WARNING: System not ready for production scale (10,000+ players)!');
      console.log('\nMissing critical components:');
      console.log('   ❌ Channel Orchestrator service for auto-scaling');
      console.log('   ❌ Multi-region infrastructure for geographic distribution');
      console.log('   ❌ Multiple Convex deployments (need 30 for 10k players)');
      console.log('\nCurrent capacity: ~1,000 concurrent players maximum');
      console.log('See PRODUCTION_ARCHITECTURE.md for scaling to 10,000+ players');
    } else {
      console.log('\n✅ System ready for production!');
    }
    
  } catch (error) {
    console.error('❌ Error testing multi-world system:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to find optimal channel
async function findOptimalChannel(region, type) {
  const channels = await prisma.channelMetadata.findMany({
    where: {
      status: 'ACTIVE',
      channelType: type || 'MAIN'
    },
    orderBy: [
      // Sort by utilization (ascending)
      {
        currentBots: 'asc'
      }
    ]
  });
  
  // Return least loaded channel or first available
  return channels.find(c => c.currentBots < c.maxBots * 0.8) || channels[0] || null;
}

// Helper function to create progress bar
function createProgressBar(percent) {
  const filled = Math.round(percent / 5);
  const empty = 20 - filled;
  return `[${'█'.repeat(filled)}${'-'.repeat(empty)}] ${percent}%`;
}

// Run the test
testMultiWorld();