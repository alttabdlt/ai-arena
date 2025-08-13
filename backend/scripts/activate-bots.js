#!/usr/bin/env node

/**
 * Script to activate bots
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function activateBots() {
  try {
    console.log('🔧 Activating bots...');
    
    // Activate the specific bots
    const botTokenIds = [143947077, 354196252, 372744167];
    
    for (const tokenId of botTokenIds) {
      const bot = await prisma.bot.update({
        where: { tokenId },
        data: { 
          isActive: true,
          modelType: 'GPT_4O', // Set a valid model type
          channel: 'main' // Ensure they have a channel
        }
      });
      console.log(`✅ Activated bot "${bot.name}" with model ${bot.modelType}`);
    }
    
    console.log('\n✨ All bots activated successfully!');
    
  } catch (error) {
    console.error('❌ Error activating bots:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
activateBots();