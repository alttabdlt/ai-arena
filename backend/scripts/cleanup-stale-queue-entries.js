#!/usr/bin/env node

/**
 * Script to clean up stale queue entries
 * Run this periodically to clean up expired WAITING/MATCHED entries
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupStaleQueueEntries() {
  console.log('🧹 Starting cleanup of stale queue entries...\n');

  try {
    const now = new Date();
    
    // First, get a count of what we're about to clean
    const staleWaiting = await prisma.queueEntry.count({
      where: {
        status: 'WAITING',
        expiresAt: { lt: now }
      }
    });
    
    const staleMatched = await prisma.queueEntry.count({
      where: {
        status: 'MATCHED',
        expiresAt: { lt: now }
      }
    });
    
    console.log(`Found ${staleWaiting} expired WAITING entries`);
    console.log(`Found ${staleMatched} expired MATCHED entries`);
    
    if (staleWaiting > 0 || staleMatched > 0) {
      // Update expired WAITING entries to EXPIRED status
      const updateWaiting = await prisma.queueEntry.updateMany({
        where: {
          status: 'WAITING',
          expiresAt: { lt: now }
        },
        data: {
          status: 'EXPIRED'
        }
      });
      
      // Update expired MATCHED entries to EXPIRED status
      const updateMatched = await prisma.queueEntry.updateMany({
        where: {
          status: 'MATCHED',
          expiresAt: { lt: now }
        },
        data: {
          status: 'EXPIRED'
        }
      });
      
      console.log(`\n✅ Updated ${updateWaiting.count} WAITING entries to EXPIRED`);
      console.log(`✅ Updated ${updateMatched.count} MATCHED entries to EXPIRED`);
      
      // Optionally, delete very old EXPIRED entries (older than 7 days)
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const deleteOld = await prisma.queueEntry.deleteMany({
        where: {
          status: 'EXPIRED',
          expiresAt: { lt: sevenDaysAgo }
        }
      });
      
      if (deleteOld.count > 0) {
        console.log(`✅ Deleted ${deleteOld.count} old EXPIRED entries (>7 days)`);
      }
    } else {
      console.log('\n✅ No stale entries found - database is clean!');
    }
    
    // Show current stats
    const stats = await prisma.queueEntry.groupBy({
      by: ['status'],
      _count: true
    });
    
    console.log('\n📊 Current queue entry statistics:');
    stats.forEach(stat => {
      console.log(`   ${stat.status}: ${stat._count}`);
    });
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupStaleQueueEntries().catch(console.error);