require('dotenv').config();
const { ConvexClient } = require('convex/browser');
const { api } = require('../../convex/_generated/api');

const client = new ConvexClient(process.env.CONVEX_URL);

async function forceRecreateAgent() {
  const botData = {
    aiArenaBotId: 'cme9r3l630002ru01kbbwc6iv',
    name: 'pigu1000',
    personality: 'CRIMINAL',
    modelType: 'DEEPSEEK_CHAT',
    initialZone: 'darkAlley'
  };
  
  const worldId = 'm179x0xjt139d2dk0v6zn11j4s7n7x0c';
  
  console.log('🔧 Force recreating agent in Convex...');
  
  try {
    // First, try to remove any existing registration
    console.log('Checking for existing registrations...');
    const registrations = await client.query(api.aiTown.botHttp.getPendingRegistrations, {
      worldIdStr: worldId
    });
    console.log('Pending registrations:', registrations);
    
    // Create a new bot agent directly
    console.log('Creating new bot agent...');
    const result = await client.mutation(api.aiTown.botHttp.createBotAgent, {
      worldIdStr: worldId,
      ...botData
    });
    
    console.log('✅ Agent created:', result);
    return result;
  } catch (error) {
    console.error('❌ Failed to create agent:', error);
    
    // Try alternative approach - restart the engine
    console.log('Attempting to restart engine...');
    try {
      await client.mutation(api.testing.resume, {
        worldId: worldId
      });
      console.log('✅ Engine restarted');
      
      // Wait a bit for engine to restart
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Try creating agent again
      const result = await client.mutation(api.aiTown.botHttp.createBotAgent, {
        worldIdStr: worldId,
        ...botData
      });
      
      console.log('✅ Agent created after restart:', result);
      return result;
    } catch (restartError) {
      console.error('❌ Failed to restart and create:', restartError);
    }
  }
}

forceRecreateAgent()
  .then(result => {
    console.log('✨ Done!', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });