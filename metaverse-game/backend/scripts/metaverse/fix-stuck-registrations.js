#!/usr/bin/env node

/**
 * Fix Stuck Bot Registrations Script
 * 
 * This script checks for stuck bot registrations in Convex and triggers
 * the batch processor to process them.
 */

const { PrismaClient } = require('@prisma/client');
const { ConvexHttpClient } = require('convex/browser');

const prisma = new PrismaClient();

async function fixStuckRegistrations() {
  console.log('🔧 Fixing Stuck Bot Registrations\n');
  
  try {
    // 1. Initialize Convex client
    const convexUrl = 'https://reliable-ocelot-928.convex.cloud';
    const client = new ConvexHttpClient(convexUrl);
    
    // 2. Check queue status
    console.log('1️⃣ Checking registration queue status...');
    const queueStatus = await client.query('aiTown/batchRegistration:getQueueStatus');
    
    console.log(`   Total registrations: ${queueStatus.total}`);
    console.log(`   Pending: ${queueStatus.pending}`);
    console.log(`   Processing: ${queueStatus.processing}`);
    console.log(`   Completed: ${queueStatus.completed}`);
    console.log(`   Failed: ${queueStatus.failed}`);
    
    if (queueStatus.oldestPending) {
      const ageMs = Date.now() - queueStatus.oldestPending;
      const ageMinutes = Math.floor(ageMs / 60000);
      console.log(`   Oldest pending: ${ageMinutes} minutes ago`);
    }
    
    // 3. If there are stuck registrations, trigger processing
    if (queueStatus.pending > 0 || queueStatus.processing > 0) {
      console.log('\n2️⃣ Found stuck registrations, triggering batch processor...');
      
      const result = await client.mutation('aiTown/batchRegistration:triggerBatchProcessing');
      console.log(`   Processed ${result.processed || 0} registrations`);
      
      // Wait a moment for processing
      console.log('   Waiting for processing to complete...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check status again
      console.log('\n3️⃣ Checking queue status after processing...');
      const newStatus = await client.query('aiTown/batchRegistration:getQueueStatus');
      
      console.log(`   Pending: ${newStatus.pending}`);
      console.log(`   Processing: ${newStatus.processing}`);
      console.log(`   Completed: ${newStatus.completed}`);
      console.log(`   Failed: ${newStatus.failed}`);
      
      // 4. If still stuck, check specific registration
      if (newStatus.pending > 0 || newStatus.processing > 0) {
        console.log('\n4️⃣ Registrations still stuck, checking for known registration...');
        
        // The registration ID we saw in the logs
        const registrationId = 'nn741fbxf1qzcbzk2029f8dz8d7n6s41';
        
        try {
          const regStatus = await client.query('aiTown/botHttp:getRegistrationStatus', {
            registrationId
          });
          
          console.log(`   Registration ${registrationId}:`);
          console.log(`   Status: ${regStatus.status}`);
          console.log(`   Created: ${new Date(regStatus.createdAt).toLocaleString()}`);
          if (regStatus.processedAt) {
            console.log(`   Processed: ${new Date(regStatus.processedAt).toLocaleString()}`);
          }
          if (regStatus.error) {
            console.log(`   Error: ${regStatus.error}`);
          }
        } catch (error) {
          console.log(`   Could not find registration ${registrationId}`);
        }
        
        // 5. Retry failed registrations
        console.log('\n5️⃣ Retrying any failed registrations...');
        const retryResult = await client.mutation('aiTown/batchRegistration:retryFailedRegistrations');
        console.log(`   Retried ${retryResult.retried} failed registrations`);
      }
    } else {
      console.log('\n✅ No stuck registrations found!');
    }
    
    // 6. Clean up old completed registrations
    console.log('\n6️⃣ Cleaning up old completed registrations...');
    const cleanupResult = await client.mutation('aiTown/batchRegistration:cleanupOldRegistrations', {
      olderThanHours: 1
    });
    console.log(`   Deleted ${cleanupResult.deleted} old registrations`);
    
    // 7. Check bot sync status in database
    console.log('\n7️⃣ Checking bot sync status in database...');
    const undeployedBots = await prisma.bot.findMany({
      where: {
        metaverseAgentId: null,
        txHash: { not: null }
      },
      select: {
        id: true,
        name: true,
        channel: true,
        createdAt: true
      }
    });
    
    if (undeployedBots.length > 0) {
      console.log(`   Found ${undeployedBots.length} undeployed bots:`);
      undeployedBots.forEach(bot => {
        console.log(`   - ${bot.name} (channel: ${bot.channel})`);
      });
      
      console.log('\n💡 Solution:');
      console.log('   1. Restart the backend to retry deployment');
      console.log('   2. Or manually trigger deployment with deploy-all-bots-to-metaverse.js');
    } else {
      console.log('   All bots are deployed or pending deployment');
    }
    
    // 8. Summary
    console.log('\n📊 Summary:');
    console.log('=============');
    const finalStatus = await client.query('aiTown/batchRegistration:getQueueStatus');
    
    if (finalStatus.pending === 0 && finalStatus.processing === 0) {
      console.log('✅ All registrations processed successfully!');
      console.log('   Restart the backend to continue normal operations');
    } else {
      console.log('⚠️  Some registrations may still be stuck');
      console.log('   Try running this script again in a minute');
      console.log('   Or check Convex dashboard for more details');
    }
    
  } catch (error) {
    console.error('❌ Error fixing registrations:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixStuckRegistrations();