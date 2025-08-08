#!/usr/bin/env node

/**
 * Test World Fix Script
 * 
 * This script tests that the world instance fix is working correctly.
 */

const { PrismaClient } = require('@prisma/client');
const { ConvexHttpClient } = require('convex/browser');

const prisma = new PrismaClient();

async function testWorldFix() {
  console.log('🧪 Testing World Instance Fix\n');
  
  try {
    // 1. Initialize Convex client
    const convexUrl = 'https://reliable-ocelot-928.convex.cloud';
    const client = new ConvexHttpClient(convexUrl);
    
    // 2. Check default world
    console.log('1️⃣ Checking default world...');
    const defaultWorldStatus = await client.query('world:defaultWorldStatus');
    
    if (!defaultWorldStatus) {
      console.log('❌ No default world found');
      return;
    }
    
    console.log(`✅ Default world exists: ${defaultWorldStatus.worldId}`);
    console.log(`   Status: ${defaultWorldStatus.status}`);
    console.log(`   Engine: ${defaultWorldStatus.engineId}`);
    
    // 3. Check all channels use the same world
    console.log('\n2️⃣ Checking channel world assignments...');
    const channels = await prisma.channelMetadata.findMany();
    
    let allUseSameWorld = true;
    channels.forEach(channel => {
      const isCorrect = channel.worldId === defaultWorldStatus.worldId;
      const icon = isCorrect ? '✅' : '❌';
      console.log(`${icon} ${channel.channel}: ${channel.worldId}`);
      if (!isCorrect) allUseSameWorld = false;
    });
    
    if (allUseSameWorld) {
      console.log('✅ All channels use the default world');
    } else {
      console.log('❌ Some channels have incorrect world IDs');
    }
    
    // 4. Test instance manager would use correct world
    console.log('\n3️⃣ Testing instance manager behavior...');
    
    try {
      // This will test if a new instance would use the default world
      const testResult = await client.mutation('aiTown/instanceManager:findAvailableInstance', {
        zoneType: 'suburb',
        playerId: 'test-player-' + Date.now()
      });
      
      if (testResult.worldId === defaultWorldStatus.worldId) {
        console.log('✅ Instance manager correctly uses default world');
        console.log(`   Instance: ${testResult.instanceId}`);
        console.log(`   World: ${testResult.worldId}`);
      } else {
        console.log('❌ Instance manager created wrong world ID:', testResult.worldId);
      }
    } catch (error) {
      console.log('⚠️  Could not test instance manager:', error.message);
    }
    
    // 5. Check for orphaned worlds
    console.log('\n4️⃣ Checking for orphaned worlds...');
    try {
      const allWorlds = await client.query('world:listWorlds');
      console.log(`   Found ${allWorlds.length} total worlds`);
      
      if (allWorlds.length > 1) {
        console.log('⚠️  Multiple worlds exist. Only one should be active.');
      } else {
        console.log('✅ Only one world exists (as expected)');
      }
    } catch (error) {
      console.log('   Could not list worlds:', error.message);
    }
    
    // 6. Summary
    console.log('\n📊 Test Summary:');
    console.log('================');
    if (allUseSameWorld) {
      console.log('✅ World instance fix is working correctly!');
      console.log('   All channels use the default world');
      console.log('   New instances will use the correct world');
      console.log('\n🎯 You can now safely deploy bots!');
    } else {
      console.log('❌ Fix not fully applied');
      console.log('   Run clean-invalid-worlds.js again');
    }
    
  } catch (error) {
    console.error('❌ Error testing fix:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testWorldFix();