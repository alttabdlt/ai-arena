#!/usr/bin/env node

/**
 * Verify World Instances Script
 * 
 * This script checks all worldInstances in Convex and identifies
 * which ones have invalid world IDs.
 */

const { ConvexHttpClient } = require('convex/browser');

async function verifyWorldInstances() {
  console.log('🔍 Verifying World Instances\n');
  
  try {
    // 1. Initialize Convex client
    const convexUrl = 'https://reliable-ocelot-928.convex.cloud';
    const client = new ConvexHttpClient(convexUrl);
    
    // 2. Get the default world ID
    console.log('1️⃣ Getting default world ID...');
    const defaultWorldStatus = await client.query('world:defaultWorldStatus');
    
    if (!defaultWorldStatus) {
      console.log('❌ No default world found');
      return;
    }
    
    const correctWorldId = defaultWorldStatus.worldId;
    console.log(`   ✅ Default world: ${correctWorldId}`);
    console.log(`   Status: ${defaultWorldStatus.status}`);
    
    // 3. Get all world instances
    console.log('\n2️⃣ Checking all world instances...');
    let instances;
    try {
      instances = await client.query('testing/debug:listWorldInstances');
    } catch (error) {
      console.log('   Could not query world instances:', error.message);
      console.log('   Trying alternative query...');
      
      // Try a simpler approach
      try {
        const result = await client.query('aiTown/instanceManager:getInstanceStats');
        console.log('   Instance stats:', JSON.stringify(result, null, 2));
      } catch (err) {
        console.log('   Could not get instance stats:', err.message);
      }
      return;
    }
    
    if (!instances || instances.length === 0) {
      console.log('   No world instances found');
      return;
    }
    
    console.log(`   Found ${instances.length} world instances`);
    
    // 4. Check each instance
    console.log('\n3️⃣ Analyzing instances...');
    let validCount = 0;
    let invalidCount = 0;
    const invalidInstances = [];
    
    for (const instance of instances) {
      const isValid = instance.worldId === correctWorldId;
      if (isValid) {
        validCount++;
        console.log(`   ✅ ${instance.zoneType} (${instance.id}): Valid world ID`);
      } else {
        invalidCount++;
        invalidInstances.push(instance);
        console.log(`   ❌ ${instance.zoneType} (${instance.id}): Invalid world ID`);
        console.log(`      Current: ${instance.worldId}`);
        console.log(`      Should be: ${correctWorldId}`);
      }
    }
    
    // 5. Summary
    console.log('\n📊 Summary:');
    console.log('=============');
    console.log(`Total instances: ${instances.length}`);
    console.log(`Valid instances: ${validCount}`);
    console.log(`Invalid instances: ${invalidCount}`);
    
    if (invalidCount > 0) {
      console.log('\n⚠️  Found invalid world instances!');
      console.log('   These instances have wrong world IDs and need to be fixed.');
      console.log('\n🎯 Next Steps:');
      console.log('1. Run fix-world-instances.js to correct them');
      console.log('2. Restart the backend service');
      
      console.log('\n📝 Invalid instances detail:');
      for (const inst of invalidInstances) {
        console.log(`   - ${inst.zoneType}: ${inst.id}`);
        console.log(`     Players: ${inst.currentPlayers}, Bots: ${inst.currentBots}`);
        console.log(`     Status: ${inst.status}`);
      }
    } else {
      console.log('\n✅ All instances have the correct world ID!');
      console.log('   No fixes needed.');
    }
    
  } catch (error) {
    console.error('❌ Error verifying instances:', error);
  }
}

// Run the verification
verifyWorldInstances();