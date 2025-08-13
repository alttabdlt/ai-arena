#!/usr/bin/env node

/**
 * Script to create/update user record and associate existing bots
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixUserBotAssociation() {
  const walletAddress = '0x2487155df829977813ea9b4f992c229f86d4f16a';
  
  try {
    console.log('🔧 Fixing user-bot association...');
    console.log(`📋 Wallet address: ${walletAddress}`);
    
    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { address: walletAddress.toLowerCase() }
    });
    
    if (!user) {
      console.log('❌ User not found, creating new user...');
      user = await prisma.user.create({
        data: {
          address: walletAddress.toLowerCase(),
          username: 'axel', // You can change this
          role: 'USER'
        }
      });
      console.log(`✅ Created user with ID: ${user.id}`);
    } else {
      console.log(`✅ Found existing user with ID: ${user.id}`);
    }
    
    // Find bots that might belong to this user
    // Look for bots with names that suggest they're yours
    const botsToAssociate = await prisma.bot.findMany({
      where: {
        OR: [
          { name: 'Axel' },
          { name: 'lyuuhh' },
          { name: 'milaqs' },
          { tokenId: { in: [143947077, 354196252, 372744167] } }
        ]
      }
    });
    
    console.log(`📦 Found ${botsToAssociate.length} bots to associate`);
    
    // Update bots to be associated with the user
    for (const bot of botsToAssociate) {
      await prisma.bot.update({
        where: { id: bot.id },
        data: { creatorId: user.id }
      });
      console.log(`✅ Associated bot "${bot.name}" (${bot.id}) with user`);
    }
    
    // Verify the association
    const userWithBots = await prisma.user.findUnique({
      where: { address: walletAddress.toLowerCase() },
      include: {
        bots: {
          select: {
            id: true,
            name: true,
            tokenId: true,
            personality: true,
            isActive: true
          }
        }
      }
    });
    
    console.log('\n📊 Final User Status:');
    console.log(`User ID: ${userWithBots.id}`);
    console.log(`Address: ${userWithBots.address}`);
    console.log(`Bots: ${userWithBots.bots.length}`);
    
    if (userWithBots.bots.length > 0) {
      console.log('\n🤖 Associated Bots:');
      userWithBots.bots.forEach(bot => {
        console.log(`  - ${bot.name} (ID: ${bot.id}, TokenID: ${bot.tokenId}, Active: ${bot.isActive})`);
      });
    }
    
    console.log('\n✨ User-bot association fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing user-bot association:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixUserBotAssociation();