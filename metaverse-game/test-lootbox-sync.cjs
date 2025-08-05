// Test script to sync lootboxes from AI Arena to the metaverse
// Run with: node test-lootbox-sync.cjs

const fetch = require('node-fetch');

async function testLootboxSync() {
  // You'll need to update these IDs based on your actual data
  const CONVEX_URL = 'http://localhost:5000'; // Your Convex HTTP endpoint
  const AI_ARENA_BOT_ID = 'test-bot-1'; // Replace with actual bot ID
  
  const testLootboxes = [
    {
      id: 'lootbox-test-1',
      rarity: 'EPIC',
      equipmentRewards: [
        {
          name: 'Crimson Blade',
          type: 'WEAPON',
          rarity: 'EPIC',
          powerBonus: 25,
          defenseBonus: 0
        },
        {
          name: 'Shadow Armor',
          type: 'ARMOR',
          rarity: 'RARE',
          powerBonus: 0,
          defenseBonus: 20
        }
      ],
      furnitureRewards: [
        {
          name: 'Golden Trophy',
          type: 'TROPHY',
          rarity: 'EPIC',
          scoreBonus: 100,
          defenseBonus: 5
        }
      ],
      currencyReward: 500
    },
    {
      id: 'lootbox-test-2',
      rarity: 'RARE',
      equipmentRewards: [
        {
          name: 'Steel Dagger',
          type: 'WEAPON',
          rarity: 'RARE',
          powerBonus: 15,
          defenseBonus: 0
        }
      ],
      furnitureRewards: [
        {
          name: 'Security Camera',
          type: 'DEFENSIVE',
          rarity: 'RARE',
          scoreBonus: 50,
          defenseBonus: 10
        }
      ],
      currencyReward: 200
    },
    {
      id: 'lootbox-test-3',
      rarity: 'LEGENDARY',
      equipmentRewards: [
        {
          name: 'Godfather\'s Ring',
          type: 'ACCESSORY',
          rarity: 'LEGENDARY',
          powerBonus: 50,
          defenseBonus: 50
        }
      ],
      furnitureRewards: [
        {
          name: 'Diamond Throne',
          type: 'TROPHY',
          rarity: 'LEGENDARY',
          scoreBonus: 500,
          defenseBonus: 20
        }
      ],
      currencyReward: 2000
    }
  ];

  try {
    console.log('Syncing lootboxes to metaverse...');
    
    const response = await fetch(`${CONVEX_URL}/api/lootbox/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        aiArenaBotId: AI_ARENA_BOT_ID,
        lootboxes: testLootboxes
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Success!', result);
      console.log(`Synced ${result.synced || result.count} lootboxes`);
      console.log('\nNow you can:');
      console.log('1. Open the metaverse game');
      console.log('2. Select a bot');
      console.log('3. Click the Inventory button');
      console.log('4. Open the lootboxes!');
    } else {
      console.error('❌ Error:', result);
    }
  } catch (error) {
    console.error('❌ Failed to sync:', error);
    console.log('\nMake sure:');
    console.log('1. The metaverse game is running (npm run dev)');
    console.log('2. You have created a bot in AI Arena');
    console.log('3. The bot has been registered in the metaverse');
  }
}

testLootboxSync();