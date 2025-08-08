#!/usr/bin/env node

/**
 * Create Test Channel Script
 * 
 * This script creates a test channel for demonstrating multi-world functionality
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestChannel() {
  try {
    console.log('🌍 Creating Test Channel for Multi-World Demo\n');
    
    // Check if test channel already exists
    const existing = await prisma.channelMetadata.findFirst({
      where: { channel: 'test-world' }
    });
    
    if (existing) {
      console.log('⚠️  Test channel already exists');
      console.log(`   Name: ${existing.channel}`);
      console.log(`   Type: ${existing.channelType}`);
      console.log(`   Status: ${existing.status}`);
      console.log(`   World ID: ${existing.worldId || 'Not assigned yet'}`);
      return;
    }
    
    // Create test channel
    const testChannel = await prisma.channelMetadata.create({
      data: {
        channel: 'test-world',
        channelType: 'TEST',
        status: 'ACTIVE',
        maxBots: 10,
        currentBots: 0,
        metadata: {
          description: 'Test channel for multi-world navigation demo',
          createdBy: 'script',
          features: ['multi-world', 'test']
        }
      }
    });
    
    console.log('✅ Test channel created successfully!');
    console.log('\n📊 Channel Details:');
    console.log(`   Name: ${testChannel.channel}`);
    console.log(`   Type: ${testChannel.channelType}`);
    console.log(`   Status: ${testChannel.status}`);
    console.log(`   Capacity: ${testChannel.currentBots}/${testChannel.maxBots} bots`);
    console.log('\n🎯 Next Steps:');
    console.log('   1. The world will be auto-created when first accessed');
    console.log('   2. Deploy a bot to this channel using:');
    console.log('      channel: "test-world" in the deployBot mutation');
    console.log('   3. Switch between worlds in the metaverse UI using the world selector');
    console.log('\n💡 You can also create a VIP channel:');
    console.log('   node scripts/create-test-channel.js --vip');
    
  } catch (error) {
    console.error('❌ Error creating test channel:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function createVIPChannel() {
  try {
    console.log('👑 Creating VIP Channel for Multi-World Demo\n');
    
    // Check if VIP channel already exists
    const existing = await prisma.channelMetadata.findFirst({
      where: { channel: 'vip-lounge' }
    });
    
    if (existing) {
      console.log('⚠️  VIP channel already exists');
      console.log(`   Name: ${existing.channel}`);
      console.log(`   Type: ${existing.channelType}`);
      console.log(`   Status: ${existing.status}`);
      console.log(`   World ID: ${existing.worldId || 'Not assigned yet'}`);
      return;
    }
    
    // Create VIP channel
    const vipChannel = await prisma.channelMetadata.create({
      data: {
        channel: 'vip-lounge',
        channelType: 'VIP',
        status: 'ACTIVE',
        maxBots: 5,
        currentBots: 0,
        metadata: {
          description: 'Exclusive VIP lounge for premium bots',
          createdBy: 'script',
          features: ['exclusive', 'premium', 'limited-access'],
          requirements: ['premium-tier', 'invite-only']
        }
      }
    });
    
    console.log('✅ VIP channel created successfully!');
    console.log('\n📊 Channel Details:');
    console.log(`   Name: ${vipChannel.channel}`);
    console.log(`   Type: ${vipChannel.channelType}`);
    console.log(`   Status: ${vipChannel.status}`);
    console.log(`   Capacity: ${vipChannel.currentBots}/${vipChannel.maxBots} bots (Limited!)`);
    console.log('\n🎯 Features:');
    console.log('   - Exclusive access');
    console.log('   - Limited to 5 bots');
    console.log('   - Premium environment');
    console.log('   - Separate world instance');
    
  } catch (error) {
    console.error('❌ Error creating VIP channel:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const isVIP = args.includes('--vip');

// Run the appropriate function
if (isVIP) {
  createVIPChannel();
} else {
  createTestChannel();
}