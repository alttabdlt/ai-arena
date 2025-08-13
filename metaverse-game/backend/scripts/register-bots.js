const fetch = require('node-fetch');

// Bot data from user request
const bots = [
  {
    id: 'cme88hnrg0002ruqssazwd2vg',
    name: 'Axel',
  },
  {
    id: 'cme88lzkm0008ruqskpjgqvlw',
    name: 'Feng Min',
  },
  {
    id: 'cme88m9uo000eruqsr94i86si',
    name: 'yk',
  },
  {
    id: 'cme88mnem000kruqszirqefty',
    name: 'honeydew',
  }
];

async function registerBot(bot) {
  try {
    console.log(`🤖 Registering bot: ${bot.name} (${bot.id})`);
    
    const response = await fetch('https://reliable-ocelot-928.convex.site/api/bots/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        worldId: 'm179x0xjt139d2dk0v6zn11j4s7n7x0c', // From the debug output
        name: bot.name,
        character: `${bot.name} is a Crime Metaverse bot with unique personality traits.`,
        identity: `A unique bot in the AI Arena crime metaverse.`,
        plan: `Navigate the metaverse, interact with other bots, and build criminal empires.`,
        aiArenaBotId: bot.id,
        initialZone: 'Casino', // Default zone
        avatar: 'f1' // Default avatar
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to register ${bot.name}: ${errorText}`);
      return;
    }

    const result = await response.json();
    console.log(`✅ Bot ${bot.name} registration status:`, result);

    // If pending, we can track it
    if (result.status === 'pending' && result.registrationId) {
      console.log(`⏳ Bot ${bot.name} is pending with registrationId: ${result.registrationId}`);
    }
    
  } catch (error) {
    console.error(`❌ Error registering bot ${bot.name}:`, error.message);
  }
}

async function main() {
  console.log('🚀 Starting bot registration...');
  console.log(`📊 Found ${bots.length} bots to register`);
  
  for (const bot of bots) {
    await registerBot(bot);
    // Wait a bit between registrations
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('🏁 Bot registration complete');
}

main().catch(console.error);