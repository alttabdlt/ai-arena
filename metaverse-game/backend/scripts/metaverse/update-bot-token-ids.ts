import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateBotTokenIds() {
  try {
    // Find all bots without tokenId
    const botsWithoutTokenId = await prisma.bot.findMany({
      where: {
        tokenId: 0 // Check for default value instead of null
      }
    });

    console.log(`Found ${botsWithoutTokenId.length} bots without tokenId`);

    // Update each bot with a unique tokenId
    for (const bot of botsWithoutTokenId) {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000000);
      const tokenId = parseInt(`${timestamp}${random}`.slice(-9));
      
      // Make sure it's unique
      let existingBot = await prisma.bot.findUnique({
        where: { tokenId }
      });
      
      // If collision, regenerate
      while (existingBot) {
        const newRandom = Math.floor(Math.random() * 1000000);
        const newTokenId = parseInt(`${timestamp}${newRandom}`.slice(-9));
        existingBot = await prisma.bot.findUnique({
          where: { tokenId: newTokenId }
        });
        if (!existingBot) {
          await prisma.bot.update({
            where: { id: bot.id },
            data: { tokenId: newTokenId }
          });
          console.log(`Updated bot ${bot.name} (${bot.id}) with tokenId: ${newTokenId}`);
          break;
        }
      }
      
      if (!existingBot) {
        await prisma.bot.update({
          where: { id: bot.id },
          data: { tokenId }
        });
        console.log(`Updated bot ${bot.name} (${bot.id}) with tokenId: ${tokenId}`);
      }
      
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    console.log('All bots have been updated with unique tokenIds');
  } catch (error) {
    console.error('Error updating bot token IDs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateBotTokenIds();