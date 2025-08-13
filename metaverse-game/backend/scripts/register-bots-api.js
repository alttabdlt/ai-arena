const fetch = require('node-fetch');

// Bot data from user request
const bots = [
  {
    id: 'cme88hnrg0002ruqssazwd2vg',
    name: 'Axel',
    personality: 'WORKER',
  },
  {
    id: 'cme88lzkm0008ruqskpjgqvlw',
    name: 'Feng Min',
    personality: 'CRIMINAL',
  },
  {
    id: 'cme88m9uo000eruqsr94i86si',
    name: 'yk',
    personality: 'CRIMINAL',
  },
  {
    id: 'cme88mnem000kruqszirqefty',
    name: 'honeydew',
    personality: 'WORKER',
  }
];

async function registerBot(bot) {
  try {
    console.log(`🤖 Registering bot: ${bot.name} (${bot.id})`);
    
    // Use the metaverse backend API which will find the right world
    const response = await fetch('http://localhost:5001/api/metaverse/bots/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        botId: bot.id,
        name: bot.name,
        personality: bot.personality,
        modelType: 'gpt-4', // Default model
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to register ${bot.name}: ${errorText}`);
      return;
    }

    const result = await response.json();
    console.log(`✅ Bot ${bot.name} registered:`, result);
    
  } catch (error) {
    console.error(`❌ Error registering bot ${bot.name}:`, error.message);
  }
}

async function main() {
  console.log('🚀 Starting bot registration via Metaverse Backend API...');
  console.log(`📊 Found ${bots.length} bots to register`);
  
  for (const bot of bots) {
    await registerBot(bot);
    // Wait a bit between registrations
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('🏁 Bot registration complete');
}

main().catch(console.error);