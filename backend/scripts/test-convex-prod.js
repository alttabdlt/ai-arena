#!/usr/bin/env node

/**
 * Test Convex Production Connection
 * 
 * Verifies that the backend can connect to the production Convex deployment
 * and that the getDefaultWorld query is available
 */

const { ConvexHttpClient } = require('convex/browser');

async function testConnection() {
  const CONVEX_URL = 'https://quaint-koala-55.convex.cloud';
  
  console.log('\n🔌 Testing Convex Production Connection\n');
  console.log(`URL: ${CONVEX_URL}\n`);
  
  try {
    const client = new ConvexHttpClient(CONVEX_URL);
    
    // Test getDefaultWorld query
    console.log('📡 Testing getDefaultWorld query...');
    const defaultWorld = await client.query('queries:getDefaultWorld');
    
    if (defaultWorld) {
      console.log('✅ Query successful! Default world found:');
      console.log(`   World ID: ${defaultWorld.worldId}`);
      console.log(`   Status: ${defaultWorld.status}`);
      console.log(`   Agents: ${defaultWorld.agentCount}`);
      console.log(`   Players: ${defaultWorld.playerCount}`);
    } else {
      console.log('⚠️  Query successful but no default world exists yet');
      console.log('   This is normal - a world will be created on first bot deployment');
    }
    
    // Test getWorldByChannel query
    console.log('\n📡 Testing getWorldByChannel query...');
    const channelWorld = await client.query('queries:getWorldByChannel', { channel: 'main' });
    
    if (channelWorld) {
      console.log('✅ Channel query successful!');
    } else {
      console.log('⚠️  Channel query successful but no world for channel "main" yet');
    }
    
    // Test getAllWorlds query
    console.log('\n📡 Testing getAllWorlds query...');
    const allWorlds = await client.query('queries:getAllWorlds');
    console.log(`✅ Found ${allWorlds.length} world(s) total`);
    
    console.log('\n✨ All queries are working correctly!\n');
    console.log('📝 Next Steps:');
    console.log('   1. The backend should now be able to connect');
    console.log('   2. Restart the backend if needed: npm run dev');
    console.log('   3. Bots will sync automatically\n');
    
  } catch (error) {
    console.error('❌ Error connecting to Convex:', error.message);
    
    if (error.message.includes('Could not find public function')) {
      console.log('\n💡 The query functions are not deployed.');
      console.log('   Run: cd metaverse-game && npx convex deploy --yes');
    } else if (error.message.includes('Failed to fetch')) {
      console.log('\n💡 Network error. Check your internet connection.');
    } else {
      console.log('\n💡 Unknown error. Check the Convex dashboard for issues.');
    }
    
    process.exit(1);
  }
}

// Run the test
testConnection().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});