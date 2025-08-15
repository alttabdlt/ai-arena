#!/usr/bin/env npx tsx

import { ConvexHttpClient } from 'convex/browser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { api } from '../convex/_generated/api';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const CONVEX_URL = process.env.VITE_CONVEX_URL;
if (!CONVEX_URL) {
  console.error('❌ VITE_CONVEX_URL not found in .env.local');
  process.exit(1);
}

async function fixStuckBot() {
  const client = new ConvexHttpClient(CONVEX_URL);
  
  console.log('🔧 Fixing stuck bot registration...');
  
  try {
    // Step 1: Clear all stuck registrations
    console.log('📋 Clearing stuck registrations...');
    const clearResult = await client.mutation(api.migrations.batchRegistration.clearStuckRegistrations, {});
    console.log(`✅ Cleared ${clearResult.cleared} stuck registrations`);
    
    // Step 2: Retry failed registrations
    console.log('🔄 Retrying failed registrations...');
    const retryResult = await client.mutation(api.migrations.batchRegistration.retryFailedRegistrations, {
      maxRetries: 3
    });
    console.log(`✅ Retried ${retryResult.retried} failed registrations`);
    
    // Step 3: Check queue status
    console.log('📊 Checking queue status...');
    const queueStatus = await client.query(api.migrations.batchRegistration.getQueueStatus, {});
    console.log('Queue Status:', {
      pending: queueStatus.pending,
      processing: queueStatus.processing,
      completed: queueStatus.completed,
      failed: queueStatus.failed,
      total: queueStatus.total
    });
    
    // Step 4: Trigger batch processing if there are pending registrations
    if (queueStatus.pending > 0) {
      console.log('⚙️ Triggering batch processing...');
      const processResult = await client.mutation(api.migrations.batchRegistration.triggerBatchProcessing, {});
      console.log('Processing result:', processResult);
    }
    
    console.log('✅ Bot registration cleanup complete!');
    
  } catch (error) {
    console.error('❌ Error fixing stuck bot:', error);
    process.exit(1);
  }
}

// Run the fix
fixStuckBot().catch(console.error);