#!/usr/bin/env node

/**
 * Clear Channel Metadata World IDs
 * 
 * This script clears world IDs from ChannelMetadata table
 * Use this when Convex worlds have been wiped but PostgreSQL still references them
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearChannelMetadata() {
  try {
    console.log('🔄 Clearing Channel Metadata World IDs\n');
    
    // Get current channel metadata
    const channels = await prisma.channelMetadata.findMany();
    
    if (channels.length === 0) {
      console.log('No channel metadata found');
      return;
    }
    
    console.log(`Found ${channels.length} channel(s) with metadata:`);
    for (const channel of channels) {
      console.log(`  - ${channel.channel}: ${channel.worldId || 'No world ID'}`);
    }
    
    // Clear all world IDs
    console.log('\n🧹 Clearing world IDs...');
    const result = await prisma.channelMetadata.updateMany({
      data: {
        worldId: null
      }
    });
    
    console.log(`✅ Cleared world IDs from ${result.count} channel(s)`);
    
    // Verify
    const updated = await prisma.channelMetadata.findMany();
    console.log('\n📊 Updated channel metadata:');
    for (const channel of updated) {
      console.log(`  - ${channel.channel}: ${channel.worldId || 'No world ID ✓'}`);
    }
    
    console.log('\n✨ Channel metadata cleared successfully!');
    console.log('The backend will discover/create new worlds on next sync cycle.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearChannelMetadata();