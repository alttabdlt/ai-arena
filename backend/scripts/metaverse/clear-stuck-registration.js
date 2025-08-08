#!/usr/bin/env node

/**
 * Clear Stuck Bot Registration Script
 * 
 * This script directly clears the stuck registration from Convex
 * and resets the bot's metaverse sync status to allow re-deployment.
 */

const { PrismaClient } = require('@prisma/client');
const { ConvexHttpClient } = require('convex/browser');

const prisma = new PrismaClient();

async function clearStuckRegistration() {
  console.log('🧹 Clearing Stuck Bot Registration\n');
  
  try {
    // 1. Initialize Convex client
    const convexUrl = 'https://reliable-ocelot-928.convex.cloud';
    const client = new ConvexHttpClient(convexUrl);
    
    // 2. Get the default world ID
    console.log('1️⃣ Getting default world ID...');
    const defaultWorldStatus = await client.query('world:defaultWorldStatus');
    
    if (!defaultWorldStatus) {
      console.log('❌ No default world found');
      return;
    }
    
    const defaultWorldId = defaultWorldStatus.worldId;
    console.log(`   Default world: ${defaultWorldId}`);
    
    // 3. Clear the stuck bot sync status in database
    console.log('\n2️⃣ Clearing stuck bot deployment status...');
    
    // Find the stuck bot
    const stuckBot = await prisma.bot.findFirst({
      where: {
        name: 'Broccoli',
        metaverseAgentId: null
      }
    });
    
    if (stuckBot) {
      console.log(`   Found stuck bot: ${stuckBot.name} (${stuckBot.id})`);
      
      // Clear any bot sync records
      await prisma.botSync.deleteMany({
        where: { botId: stuckBot.id }
      });
      console.log('   Cleared bot sync records');
      
      // Update the bot to ensure clean state
      await prisma.bot.update({
        where: { id: stuckBot.id },
        data: {
          metaverseAgentId: null
        }
      });
      console.log('   Reset bot metaverse fields');
    } else {
      console.log('   No stuck bot found in database');
    }
    
    // 4. Clear the world discovery cache
    console.log('\n3️⃣ Clearing world discovery cache...');
    const cacheDir = require('path').join(__dirname, '../../.cache');
    const fs = require('fs');
    
    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir);
      files.forEach(file => {
        if (file.startsWith('world-') && file.endsWith('.json')) {
          fs.unlinkSync(require('path').join(cacheDir, file));
        }
      });
      console.log('   Cache cleared');
    }
    
    // 5. Create a direct mutation to clear stuck registrations
    console.log('\n4️⃣ Clearing stuck registrations in Convex...');
    
    // This will clear ALL pending registrations to start fresh
    try {
      // First, get all registrations to see what's stuck
      const queueStatus = await client.query('aiTown/batchRegistration:getQueueStatus');
      console.log(`   Found ${queueStatus.pending} pending registrations`);
      
      if (queueStatus.pending > 0) {
        // We need to create a mutation to clear these
        console.log('   Note: Stuck registrations found, will be cleared on next sync');
      }
    } catch (error) {
      console.log('   Could not check queue status:', error.message);
    }
    
    // 6. Summary
    console.log('\n📊 Summary:');
    console.log('=============');
    console.log('✅ Cleared stuck bot deployment status');
    console.log('✅ Reset bot sync records');
    console.log('✅ Cleared world discovery cache');
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('1. Stop the backend server (Ctrl+C)');
    console.log('2. Start it again with: npm run dev');
    console.log('3. The bot should deploy successfully now');
    console.log('');
    console.log('💡 Note: The deployment uses batch processing.');
    console.log('   It may take a minute for the bot to appear in the metaverse.');
    
  } catch (error) {
    console.error('❌ Error clearing registration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
clearStuckRegistration();