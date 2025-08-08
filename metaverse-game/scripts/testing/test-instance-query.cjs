const { ConvexHttpClient } = require('convex/browser');

async function testInstanceQuery() {
  const client = new ConvexHttpClient('https://reliable-ocelot-928.convex.cloud');
  
  console.log('🧪 Testing instance query...\n');
  
  try {
    // Test the findAvailableInstance query
    const result = await client.query('aiTown/instanceManager:findAvailableInstance', {
      zoneType: 'suburb',
      playerId: 'test-player',
    });
    
    console.log('✅ Query result:', result);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testInstanceQuery();