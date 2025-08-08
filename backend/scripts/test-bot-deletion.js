#!/usr/bin/env node

/**
 * Script to test bot deletion with various queue entry scenarios
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testBotDeletion() {
  console.log('🧪 Testing bot deletion with queue entries...\n');

  try {
    // Find a bot to test with
    const bot = await prisma.bot.findFirst({
      where: {
        isDemo: false,
      },
      include: {
        queueEntries: true,
      }
    });

    if (!bot) {
      console.log('❌ No bot found for testing');
      return;
    }

    console.log(`📋 Testing with bot: ${bot.name} (${bot.id})`);
    console.log(`   Current queue entries: ${bot.queueEntries.length}`);

    // Create test queue entries with different statuses
    console.log('\n📝 Creating test queue entries...');
    
    // Create an EXPIRED entry
    await prisma.queueEntry.create({
      data: {
        botId: bot.id,
        status: 'EXPIRED',
        expiresAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      }
    });
    console.log('   ✅ Created EXPIRED queue entry');

    // Create a CANCELLED entry
    await prisma.queueEntry.create({
      data: {
        botId: bot.id,
        status: 'CANCELLED',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
      }
    });
    console.log('   ✅ Created CANCELLED queue entry');

    // Verify entries were created
    const entriesAfter = await prisma.queueEntry.findMany({
      where: { botId: bot.id }
    });
    console.log(`\n📊 Queue entries after creation: ${entriesAfter.length}`);
    entriesAfter.forEach(entry => {
      console.log(`   - ${entry.status} (${entry.id})`);
    });

    // Now try to delete the bot
    console.log('\n🗑️  Attempting to delete bot...');
    
    try {
      // First clean up queue entries (mimicking the resolver logic)
      const deletedEntries = await prisma.queueEntry.deleteMany({
        where: { botId: bot.id }
      });
      console.log(`   ✅ Cleaned up ${deletedEntries.count} queue entries`);

      // Now delete the bot
      await prisma.bot.delete({
        where: { id: bot.id }
      });
      console.log('   ✅ Bot deleted successfully!');
      
      // Verify deletion
      const deletedBot = await prisma.bot.findUnique({
        where: { id: bot.id }
      });
      
      if (!deletedBot) {
        console.log('   ✅ Bot confirmed deleted from database');
      } else {
        console.log('   ❌ Bot still exists in database!');
      }

      // Check if cascade delete worked for queue entries
      const remainingEntries = await prisma.queueEntry.findMany({
        where: { botId: bot.id }
      });
      console.log(`   📊 Remaining queue entries: ${remainingEntries.length}`);
      
    } catch (deleteError) {
      console.error('   ❌ Delete failed:', deleteError.message);
      
      // Clean up test entries if delete failed
      console.log('\n🧹 Cleaning up test entries...');
      await prisma.queueEntry.deleteMany({
        where: { 
          botId: bot.id,
          status: { in: ['EXPIRED', 'CANCELLED'] }
        }
      });
      console.log('   ✅ Test entries cleaned up');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBotDeletion().catch(console.error);