const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearMetaverseIds() {
  const result = await prisma.bot.updateMany({
    data: {
      metaverseAgentId: null,
      currentZone: null,
      metaversePosition: null
    }
  });
  
  console.log(`Cleared metaverse IDs from ${result.count} bots`);
  
  // Also clear bot sync records
  const syncResult = await prisma.botSync.deleteMany({});
  console.log(`Deleted ${syncResult.count} bot sync records`);
  
  await prisma.$disconnect();
}

clearMetaverseIds();