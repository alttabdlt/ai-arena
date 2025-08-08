#!/usr/bin/env node

/**
 * Test World Discovery Service
 * 
 * This script tests the world discovery functionality
 * to ensure it can find or create worlds dynamically
 */

const { worldDiscoveryService } = require('../dist/services/worldDiscoveryService');

async function testWorldDiscovery() {
  console.log('🧪 Testing World Discovery Service\n');
  
  try {
    // Test 1: Discover default world
    console.log('Test 1: Discovering world for "main" channel...');
    const mainWorld = await worldDiscoveryService.discoverWorld('main');
    
    if (mainWorld) {
      console.log(`✅ Found world for "main": ${mainWorld}`);
    } else {
      console.log('❌ No world found for "main" channel');
      console.log('   Make sure Convex is running: cd metaverse-game && npm run dev');
      console.log('   Then run: npx convex run init');
      return;
    }
    
    // Test 2: Check if world is cached
    console.log('\nTest 2: Testing cache (should be instant)...');
    const start = Date.now();
    const cachedWorld = await worldDiscoveryService.discoverWorld('main');
    const elapsed = Date.now() - start;
    
    if (cachedWorld === mainWorld && elapsed < 100) {
      console.log(`✅ Cache working: Retrieved in ${elapsed}ms`);
    } else {
      console.log(`⚠️  Cache might not be working: ${elapsed}ms`);
    }
    
    // Test 3: Validate world ID
    console.log('\nTest 3: Validating world ID...');
    const isValid = await worldDiscoveryService.validateWorldId(mainWorld);
    
    if (isValid) {
      console.log('✅ World ID is valid and accessible');
    } else {
      console.log('❌ World ID validation failed');
    }
    
    // Test 4: Get all worlds
    console.log('\nTest 4: Getting all worlds...');
    const allWorlds = await worldDiscoveryService.getAllWorlds();
    
    console.log(`✅ Found ${allWorlds.length} world(s):`);
    allWorlds.forEach(world => {
      console.log(`   - Channel: ${world.channel}, ID: ${world.worldId}, Status: ${world.status}`);
    });
    
    // Test 5: Clear cache and re-discover
    console.log('\nTest 5: Clear cache and re-discover...');
    worldDiscoveryService.clearCache();
    console.log('   Cache cleared');
    
    const rediscoveredWorld = await worldDiscoveryService.discoverWorld('main');
    if (rediscoveredWorld === mainWorld) {
      console.log('✅ Successfully re-discovered same world after cache clear');
    } else {
      console.log(`⚠️  Different world discovered: ${rediscoveredWorld}`);
    }
    
    console.log('\n✨ All tests completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure Convex is running: cd metaverse-game && npm run dev');
    console.log('2. If you wiped tables, run: npx convex run init');
    console.log('3. Check CONVEX_URL in backend/.env matches metaverse-game deployment');
  }
}

testWorldDiscovery().catch(console.error);