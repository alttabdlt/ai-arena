const { GraphQLClient } = require('graphql-request');

const client = new GraphQLClient('http://localhost:4000/graphql');

const REGISTER_BOT_MUTATION = `
  mutation RegisterBotInMetaverse($botId: ID!) {
    registerBotInMetaverse(botId: $botId) {
      success
      message
      botSync {
        id
        syncStatus
        convexAgentId
        convexWorldId
      }
      metaverseInfo {
        agentId
        playerId
        worldId
        zone
        position {
          x
          y
          worldInstanceId
        }
      }
    }
  }
`;

async function testBotRegistration() {
  try {
    console.log('🧪 Testing bot registration flow...\n');
    
    // List of test bot IDs from your database
    const testBotIds = [
      'cmdv8op1r0002ruiftp96muk9',
      'cmdv8op200006ruift9m843s6',
      'cmdv8op21000aruif5bilyiq8',
    ];
    
    if (testBotIds.length === 0) {
      console.log('⚠️  No bot IDs provided. Please add bot IDs to test.');
      console.log('You can get bot IDs by running:');
      console.log('  cd backend && npx prisma studio');
      console.log('  Then look for bot IDs in the Bot table\n');
      return;
    }
    
    for (const botId of testBotIds) {
      console.log(`📤 Registering bot ${botId}...`);
      
      try {
        const result = await client.request(REGISTER_BOT_MUTATION, { botId });
        
        if (result.registerBotInMetaverse.success) {
          console.log(`✅ Bot ${botId} registered successfully!`);
          console.log(`   Agent ID: ${result.registerBotInMetaverse.metaverseInfo.agentId}`);
          console.log(`   Zone: ${result.registerBotInMetaverse.metaverseInfo.zone}`);
          console.log(`   Position: (${result.registerBotInMetaverse.metaverseInfo.position.x}, ${result.registerBotInMetaverse.metaverseInfo.position.y})`);
          console.log(`   World Instance: ${result.registerBotInMetaverse.metaverseInfo.position.worldInstanceId}\n`);
        } else {
          console.log(`❌ Failed to register bot ${botId}: ${result.registerBotInMetaverse.message}\n`);
        }
      } catch (error) {
        console.error(`❌ Error registering bot ${botId}:`, error.message);
        if (error.response?.errors) {
          console.error('GraphQL errors:', error.response.errors);
        }
        console.error('Full error:', error);
        console.log();
      }
    }
    
    console.log('🏁 Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testBotRegistration();