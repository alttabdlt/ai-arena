const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addTestLootboxes() {
  try {
    // Find Ming Xuan bot by name
    const mingXuan = await prisma.bot.findFirst({
      where: {
        name: 'Ming Xuan'
      }
    });

    if (!mingXuan) {
      console.error('Ming Xuan bot not found!');
      return;
    }

    console.log(`Found Ming Xuan bot with ID: ${mingXuan.id}`);

    // Find or create a dummy match for the lootboxes
    let testMatch = await prisma.match.findFirst({
      where: {
        type: 'PRACTICE'
      }
    });

    if (!testMatch) {
      // Create a dummy practice match
      testMatch = await prisma.match.create({
        data: {
          type: 'PRACTICE',
          status: 'COMPLETED',
          completedAt: new Date(),
          gameHistory: [],
          decisions: [],
          tournament: {
            create: {
              name: 'Test Tournament',
              type: 'ROOKIE',
              status: 'COMPLETED',
              startTime: new Date(),
              endTime: new Date(),
              entryFee: '0',
              prizePool: '0'
            }
          }
        }
      });
    }

    // Create 10 lootboxes of various rarities
    const lootboxes = [];
    const rarities = ['COMMON', 'COMMON', 'COMMON', 'UNCOMMON', 'UNCOMMON', 'UNCOMMON', 'RARE', 'RARE', 'EPIC', 'LEGENDARY'];

    for (let i = 0; i < 10; i++) {
      lootboxes.push({
        matchId: testMatch.id,
        botId: mingXuan.id,
        lootboxRarity: rarities[i],
        equipmentRewards: [],
        furnitureRewards: [],
        currencyReward: Math.floor(Math.random() * 1000) + 100,
        opened: false
      });
    }

    // Insert all lootboxes
    const result = await prisma.lootboxReward.createMany({
      data: lootboxes
    });

    console.log(`Successfully added ${result.count} lootboxes to Ming Xuan!`);
    
    // Show current lootbox count
    const totalLootboxes = await prisma.lootboxReward.count({
      where: {
        botId: mingXuan.id,
        opened: false
      }
    });
    
    console.log(`Ming Xuan now has ${totalLootboxes} unopened lootboxes`);

  } catch (error) {
    console.error('Error adding test lootboxes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addTestLootboxes();