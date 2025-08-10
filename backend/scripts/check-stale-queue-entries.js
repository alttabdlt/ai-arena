#\!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStaleQueueEntries() {
  console.log('🔍 Checking for stale queue entries...\n');

  try {
    // Get all queue entries
    const allEntries = await prisma.queueEntry.findMany({
      include: {
        bot: {
          select: {
            name: true,
            id: true,
          }
        }
      }
    });

    console.log(`Total queue entries: ${allEntries.length}\n`);

    // Check for expired but still WAITING/MATCHED entries
    const now = new Date();
    const staleEntries = allEntries.filter(entry => {
      const isExpired = new Date(entry.expiresAt) < now;
      const isActive = entry.status === 'WAITING' || entry.status === 'MATCHED';
      return isExpired && isActive;
    });

    if (staleEntries.length > 0) {
      console.log(`⚠️  Found ${staleEntries.length} stale entries (expired but still WAITING/MATCHED):\n`);
      staleEntries.forEach(entry => {
        const hoursAgo = Math.floor((now - new Date(entry.expiresAt)) / (1000 * 60 * 60));
        console.log(`   Bot: ${entry.bot?.name || 'Unknown'} (${entry.botId})`);
        console.log(`   Status: ${entry.status}`);
        console.log(`   Expired: ${hoursAgo} hours ago`);
        console.log(`   Entry ID: ${entry.id}\n`);
      });
    } else {
      console.log('✅ No stale entries found\n');
    }

    // Group entries by status
    const byStatus = {};
    allEntries.forEach(entry => {
      byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;
    });

    console.log('Queue entries by status:');
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    // Check for specific bot if provided
    const botId = process.argv[2];
    if (botId) {
      console.log(`\n🔍 Checking queue entries for bot ${botId}:`);
      const botEntries = allEntries.filter(e => e.botId === botId);
      if (botEntries.length > 0) {
        botEntries.forEach(entry => {
          console.log(`   Status: ${entry.status}`);
          console.log(`   Created: ${entry.enteredAt}`);
          console.log(`   Expires: ${entry.expiresAt}`);
          console.log(`   Is expired: ${new Date(entry.expiresAt) < now}`);
        });
      } else {
        console.log('   No queue entries found for this bot');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStaleQueueEntries().catch(console.error);
