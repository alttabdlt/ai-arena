const { ConvexHttpClient } = require('convex/browser');

async function initWorldInstances() {
  const client = new ConvexHttpClient('https://reliable-ocelot-928.convex.cloud');
  
  console.log('🌍 Initializing world instances...\n');
  
  try {
    const result = await client.mutation('init/createWorldInstances:createWorldInstances', {});
    console.log('✅ Success:', result);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

initWorldInstances();