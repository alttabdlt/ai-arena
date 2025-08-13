#!/usr/bin/env node

/**
 * Clear Convex Registrations Script
 * 
 * This script directly clears stuck registrations from the Convex database.
 */

const { ConvexHttpClient } = require('convex/browser');

async function clearConvexRegistrations() {
  console.log('🧹 Clearing Stuck Convex Registrations\n');
  
  try {
    // 1. Initialize Convex client
    const convexUrl = 'https://reliable-ocelot-928.convex.cloud';
    const client = new ConvexHttpClient(convexUrl);
    
    // 2. Check current queue status
    console.log('1️⃣ Checking current queue status...');
    const queueStatus = await client.query('aiTown/batchRegistration:getQueueStatus');
    
    console.log(`   Total registrations: ${queueStatus.total}`);
    console.log(`   Pending: ${queueStatus.pending}`);
    console.log(`   Processing: ${queueStatus.processing}`);
    console.log(`   Completed: ${queueStatus.completed}`);
    console.log(`   Failed: ${queueStatus.failed}`);
    
    if (queueStatus.pending > 0 || queueStatus.processing > 0) {
      // 3. Clear stuck registrations
      console.log('\n2️⃣ Clearing stuck registrations...');
      const result = await client.mutation('aiTown/batchRegistration:clearStuckRegistrations');
      console.log(`   Cleared ${result.cleared} stuck registrations`);
      
      // 4. Verify clearing
      console.log('\n3️⃣ Verifying queue is clear...');
      const newStatus = await client.query('aiTown/batchRegistration:getQueueStatus');
      
      console.log(`   Pending: ${newStatus.pending}`);
      console.log(`   Processing: ${newStatus.processing}`);
      
      if (newStatus.pending === 0 && newStatus.processing === 0) {
        console.log('\n✅ All stuck registrations cleared successfully!');
      } else {
        console.log('\n⚠️  Some registrations may still be stuck');
      }
    } else {
      console.log('\n✅ No stuck registrations found');
    }
    
    console.log('\n📊 Summary:');
    console.log('=============');
    console.log('✅ Convex registrations cleared');
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('1. The backend has already been reset');
    console.log('2. The bot should deploy successfully on next sync');
    console.log('3. Watch the backend logs for deployment confirmation');
    
  } catch (error) {
    console.error('❌ Error clearing registrations:', error);
  }
}

// Run the cleanup
clearConvexRegistrations();