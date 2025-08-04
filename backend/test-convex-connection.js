const fetch = require('node-fetch');

async function testConvexConnection() {
  const convexUrl = 'https://reliable-ocelot-928.convex.cloud';
  
  console.log('🧪 Testing Convex connection...\n');
  
  try {
    // Test if we can reach the Convex deployment
    const response = await fetch(convexUrl);
    console.log(`✅ Convex deployment is reachable: ${response.status} ${response.statusText}`);
    
    // Test the bot registration endpoint
    const testData = {
      worldId: 'test-world-id',
      name: 'Test Bot',
      character: 'A test bot',
      identity: 'I am a test bot',
      plan: 'Test the connection',
      aiArenaBotId: 'test-bot-id',
      initialZone: 'suburb'
    };
    
    console.log('\n📤 Testing bot registration endpoint...');
    const registerResponse = await fetch(`${convexUrl}/api/bots/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });
    
    const responseText = await registerResponse.text();
    console.log(`Response status: ${registerResponse.status}`);
    console.log(`Response: ${responseText}`);
    
    if (registerResponse.status === 400 || registerResponse.status === 500) {
      // This is expected if the world doesn't exist
      console.log('⚠️  Endpoint is reachable but returned an error (expected if world does not exist)');
    } else if (registerResponse.status === 200) {
      console.log('✅ Bot registration endpoint is working!');
    }
    
  } catch (error) {
    console.error('❌ Error testing Convex connection:', error.message);
  }
}

testConvexConnection();