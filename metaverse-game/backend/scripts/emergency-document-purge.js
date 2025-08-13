#!/usr/bin/env node

/**
 * Emergency Document Purge Script
 * 
 * This script performs emergency cleanup of Convex documents when the system
 * is completely overloaded and normal cleanup methods fail.
 * 
 * Usage:
 *   node scripts/emergency-document-purge.js              # Interactive mode
 *   node scripts/emergency-document-purge.js --auto       # Auto mode (dangerous!)
 *   node scripts/emergency-document-purge.js --stats      # Just show stats
 */

require('dotenv').config();
const { ConvexHttpClient } = require('convex/browser');
const { api } = require('../../convex/_generated/api');
const readline = require('readline');

// Get Convex URL from environment
const CONVEX_URL = process.env.CONVEX_URL || 'https://reliable-ocelot-928.convex.cloud';

// Parse command line arguments
const args = process.argv.slice(2);
const autoMode = args.includes('--auto');
const statsOnly = args.includes('--stats');

// Initialize Convex client
const client = new ConvexHttpClient(CONVEX_URL);

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
};

async function getStats() {
  console.log('\n📊 Getting quick stats (sampled)...\n');
  
  try {
    const stats = await client.query(api.cleanup.emergencyCleanup.getQuickStats);
    
    if (stats.error) {
      console.error('❌ Error getting stats:', stats.error);
      return null;
    }
    
    console.log('Document Samples (10 each):');
    console.log('===========================');
    console.log(`  Inputs:          ${stats.samples.inputs}/10 found`);
    console.log(`  Memories:        ${stats.samples.memories}/10 found`);
    console.log(`  Registrations:   ${stats.samples.registrations}/10 found`);
    console.log(`  Activity Logs:   ${stats.samples.activityLogs}/10 found`);
    
    if (stats.engineStatus) {
      console.log('\nEngine Status:');
      console.log('==============');
      console.log(`  Running:         ${stats.engineStatus.running ? '✅ Yes' : '❌ No'}`);
      console.log(`  Next Input ID:   ${stats.engineStatus.nextInputNumber}`);
      console.log(`  Processed ID:    ${stats.engineStatus.processedInputNumber}`);
      console.log(`  Unprocessed:     ${stats.engineStatus.unprocessed}`);
    }
    
    console.log('\n⚠️  Note: Actual document counts are likely in the hundreds of thousands!');
    
    return stats;
  } catch (error) {
    console.error('❌ Failed to get stats:', error.message);
    return null;
  }
}

async function deleteInputsBatch(preserveProcessed = true) {
  const batchSize = 100;
  let totalDeleted = 0;
  let totalSkipped = 0;
  let iterations = 0;
  const maxIterations = 5000; // Max 500,000 documents
  
  console.log(`\n🗑️  Starting input deletion (batch size: ${batchSize})...\n`);
  
  while (iterations < maxIterations) {
    try {
      const result = await client.mutation(api.cleanup.emergencyCleanup.emergencyDeleteInputs, {
        batchSize,
        preserveProcessed
      });
      
      if (result.error) {
        console.error(`❌ Error in batch ${iterations + 1}:`, result.error);
        break;
      }
      
      totalDeleted += result.deletedCount;
      totalSkipped += result.skippedCount;
      iterations++;
      
      // Show progress every 10 batches
      if (iterations % 10 === 0) {
        console.log(`  Progress: ${iterations} batches | Deleted: ${totalDeleted} | Skipped: ${totalSkipped}`);
      }
      
      // Stop if no more documents
      if (!result.hasMore || result.deletedCount === 0) {
        console.log('\n✅ No more inputs to delete!');
        break;
      }
      
      // Small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Failed at batch ${iterations + 1}:`, error.message);
      break;
    }
  }
  
  console.log('\n📊 Final Results:');
  console.log(`  Total Deleted: ${totalDeleted}`);
  console.log(`  Total Skipped: ${totalSkipped}`);
  console.log(`  Batches Run:   ${iterations}`);
  
  return { totalDeleted, totalSkipped };
}

async function clearPendingRegistrations() {
  console.log('\n🗑️  Clearing pending bot registrations...\n');
  
  let totalDeleted = 0;
  let iterations = 0;
  
  while (iterations < 100) { // Max 100 batches
    try {
      const result = await client.mutation(api.cleanup.emergencyCleanup.clearAllPendingRegistrations, {
        confirm: true
      });
      
      if (result.error) {
        console.error('❌ Error:', result.error);
        break;
      }
      
      totalDeleted += result.deletedCount;
      iterations++;
      
      console.log(`  Batch ${iterations}: Deleted ${result.deletedCount} registrations`);
      
      if (!result.hasMore || result.deletedCount === 0) {
        console.log('✅ All registrations cleared!');
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error('❌ Failed:', error.message);
      break;
    }
  }
  
  console.log(`\n📊 Total Deleted: ${totalDeleted} registrations`);
  return totalDeleted;
}

async function resumeEngine() {
  console.log('\n🔄 Resuming engine...\n');
  
  try {
    const result = await client.mutation(api.cleanup.emergencyCleanup.resumeEngineAfterCleanup, {
      confirm: true
    });
    
    if (result.error) {
      console.error('❌ Failed to resume engine:', result.error);
      return false;
    }
    
    console.log('✅ Engine resumed successfully!');
    console.log(`  Engine ID: ${result.engineId}`);
    return true;
    
  } catch (error) {
    console.error('❌ Error resuming engine:', error.message);
    return false;
  }
}

async function runEmergencyCleanup() {
  console.log('==========================================');
  console.log('  🚨 EMERGENCY DOCUMENT PURGE TOOL 🚨    ');
  console.log('==========================================');
  console.log(`Deployment: ${CONVEX_URL}`);
  console.log('');
  console.log('⚠️  WARNING: This will delete documents to recover from overload!');
  console.log('');
  
  // Get initial stats
  const stats = await getStats();
  
  if (statsOnly) {
    console.log('\n✅ Stats displayed. Use without --stats to perform cleanup.');
    rl.close();
    return;
  }
  
  if (!stats) {
    console.log('\n❌ Could not get stats. System may be completely overloaded.');
  }
  
  // Ask for confirmation unless in auto mode
  if (!autoMode) {
    const answer = await askQuestion('\n⚠️  Do you want to proceed with emergency cleanup? (yes/no): ');
    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Cleanup cancelled.');
      rl.close();
      return;
    }
  }
  
  console.log('\n🚀 Starting emergency cleanup...\n');
  
  // Step 1: Clear pending registrations
  console.log('Step 1: Clearing pending registrations...');
  await clearPendingRegistrations();
  
  // Step 2: Delete input documents
  console.log('\nStep 2: Deleting input documents...');
  const deleteResult = await deleteInputsBatch(true); // Preserve processed inputs
  
  // Step 3: Resume engine if it was stopped
  if (stats && stats.engineStatus && !stats.engineStatus.running) {
    console.log('\nStep 3: Resuming stopped engine...');
    await resumeEngine();
  } else {
    console.log('\nStep 3: Engine already running or status unknown.');
  }
  
  // Get final stats
  console.log('\n📊 Getting final stats...');
  await getStats();
  
  console.log('\n==========================================');
  console.log('  ✅ EMERGENCY CLEANUP COMPLETE           ');
  console.log('==========================================');
  console.log('\nNext steps:');
  console.log('1. Start Convex dev: npm run dev');
  console.log('2. Monitor document creation');
  console.log('3. Redeploy bots if needed');
  
  rl.close();
}

async function main() {
  try {
    await runEmergencyCleanup();
  } catch (error) {
    console.error('❌ Fatal error:', error);
    rl.close();
    process.exit(1);
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\n\n❌ Cleanup interrupted by user.');
  rl.close();
  process.exit(0);
});

// Run the script
main().catch(error => {
  console.error('❌ Script failed:', error);
  rl.close();
  process.exit(1);
});