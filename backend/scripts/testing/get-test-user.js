const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getTestUser() {
  try {
    // Find users with bots
    const users = await prisma.user.findMany({
      where: {
        bots: {
          some: {}
        }
      },
      include: {
        bots: {
          select: {
            id: true,
            name: true,
            personality: true,
            isActive: true,
            botSync: {
              select: {
                syncStatus: true
              }
            }
          }
        }
      },
      take: 5
    });
    
    if (users.length === 0) {
      console.log('No users with bots found in database.');
      return;
    }
    
    console.log('🧪 Test Users with Bots:\n');
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. User: ${user.username || 'Anonymous'}`);
      console.log(`   Address: ${user.address}`);
      console.log(`   Bots: ${user.bots.length}`);
      
      user.bots.forEach(bot => {
        const syncStatus = bot.botSync?.syncStatus || 'NOT_SYNCED';
        const emoji = bot.personality === 'CRIMINAL' ? '🔫' : 
                      bot.personality === 'GAMBLER' ? '🎰' : '⚒️';
        console.log(`     - ${emoji} ${bot.name} (${syncStatus})`);
      });
      
      console.log('');
    });
    
    if (users[0]) {
      console.log('💡 To use the first user in the metaverse game:');
      console.log('   1. Open http://localhost:8080 in your browser');
      console.log('   2. Open the browser console (F12)');
      console.log('   3. Run this command:');
      console.log(`      localStorage.setItem('testUserAddress', '${users[0].address}');`);
      console.log('   4. Refresh the page');
    }
    
  } catch (error) {
    console.error('Error getting test users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getTestUser();