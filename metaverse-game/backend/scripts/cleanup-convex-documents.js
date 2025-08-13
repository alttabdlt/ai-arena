#!/usr/bin/env node

/**
 * Cleanup Convex Documents Script
 * 
 * This script helps clean up accumulated documents in Convex database
 * to stay under the 32,000 document read limit.
 * 
 * Usage:
 *   node scripts/cleanup-convex-documents.js                # Normal cleanup
 *   node scripts/cleanup-convex-documents.js --aggressive   # Aggressive cleanup
 *   node scripts/cleanup-convex-documents.js --analyze      # Just analyze, don't clean
 */

require('dotenv').config();
const { ConvexHttpClient } = require('convex/browser');
const { api } = require('../../convex/_generated/api');

// Get Convex URL from environment
const CONVEX_URL = process.env.CONVEX_URL || 'https://reliable-ocelot-928.convex.cloud';

// Parse command line arguments
const args = process.argv.slice(2);
const aggressive = args.includes('--aggressive');
const analyzeOnly = args.includes('--analyze');
const help = args.includes('--help') || args.includes('-h');

if (help) {
  console.log(`
Convex Document Cleanup Script
==============================

This script helps manage document accumulation in Convex database.

Usage:
  node scripts/cleanup-convex-documents.js [options]

Options:
  --analyze      Only analyze document counts, don't clean
  --aggressive   Use aggressive cleanup (shorter retention periods)
  --help, -h     Show this help message

Retention Periods:
  Normal Mode:
    - Engine Inputs: 7 days
    - Activity Logs: 30 days
    - Memories: 14 days
    - Bot Registrations: 24 hours
    - Archived Messages: 30 days

  Aggressive Mode:
    - Engine Inputs: 3 days
    - Activity Logs: 14 days
    - Memories: 7 days
    - Bot Registrations: 6 hours
    - Archived Messages: 14 days
`);
  process.exit(0);
}

// Initialize Convex client
const client = new ConvexHttpClient(CONVEX_URL);

async function analyzeDocuments() {
  console.log('\n📊 Analyzing Convex Document Counts...\n');
  
  try {
    const analysis = await client.query(api.cleanup.documentCleanup.analyzeDocumentCounts);
    
    console.log('Document Counts by Table:');
    console.log('========================');
    
    const sortedTables = Object.entries(analysis.counts)
      .sort(([,a], [,b]) => b - a);
    
    for (const [table, count] of sortedTables) {
      if (count === -1) {
        console.log(`  ${table.padEnd(25)} ERROR (could not read)`);
      } else if (count === 1000) {
        console.log(`  ${table.padEnd(25)} 1000+ documents (sampled)`);
      } else {
        console.log(`  ${table.padEnd(25)} ${count} documents`);
      }
      
      const oldestDate = analysis.oldestDocs[table];
      if (oldestDate) {
        const age = Math.floor((Date.now() - new Date(oldestDate).getTime()) / (1000 * 60 * 60 * 24));
        console.log(`    └─ Oldest: ${age} days ago`);
      }
    }
    
    console.log('\n------------------------');
    console.log(`Total Documents (sampled): ${analysis.totalDocuments}+`);
    console.log('Note: Actual count likely exceeds 32,000 documents');
    
    // Get cleanup recommendations
    const status = await client.query(api.cleanup.documentCleanup.getCleanupStatus);
    
    if (status.recommendations.length > 0) {
      console.log('\n⚠️  Cleanup Recommendations:');
      console.log('===========================');
      for (const rec of status.recommendations) {
        console.log(`  ${rec}`);
      }
      console.log(`\n  Suggested Action: ${status.suggestedAction}`);
      console.log(`  Estimated Documents to Clean: ${status.estimatedDocumentsToClean}+`);
    } else {
      console.log('\n✅ No immediate cleanup needed');
    }
    
  } catch (error) {
    console.error('❌ Error analyzing documents:', error.message);
    if (error.message.includes('Too many documents')) {
      console.log('\n⚠️  Hit document limit during analysis. Cleanup is definitely needed!');
    }
  }
}

async function runCleanup() {
  const mode = aggressive ? 'AGGRESSIVE' : 'NORMAL';
  console.log(`\n🧹 Starting ${mode} Cleanup...\n`);
  
  try {
    const startTime = Date.now();
    
    // Run the full cleanup mutation
    const results = await client.mutation(api.cleanup.documentCleanup.runFullCleanup, {
      aggressive
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('Cleanup Results:');
    console.log('================');
    console.log(`  Mode: ${results.mode.toUpperCase()}`);
    console.log(`  Duration: ${duration} seconds`);
    console.log('');
    console.log('  Documents Deleted:');
    console.log(`    • Engine Inputs:      ${results.inputs.deleted}`);
    console.log(`    • Activity Logs:      ${results.activityLogs.deleted}`);
    console.log(`    • Memories:           ${results.memories.deleted}`);
    console.log(`    • Memory Embeddings:  ${results.memories.embeddings}`);
    console.log(`    • Bot Registrations:  ${results.registrations.deleted}`);
    console.log(`    • Messages:           ${results.messages.deleted}`);
    console.log(`    • Conversations:      ${results.messages.conversations}`);
    console.log('');
    console.log(`  📊 Total Deleted: ${results.totalDeleted} documents`);
    
    // Check if more cleanup might be needed
    if (results.totalDeleted >= 2000) {
      console.log('\n⚠️  Large number of documents deleted.');
      console.log('    Consider running cleanup again to process more batches.');
    }
    
    // Analyze again to show new state
    console.log('\n📊 Post-Cleanup Analysis:');
    await analyzeDocuments();
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    
    if (error.message.includes('Too many documents')) {
      console.log('\n⚠️  Document limit hit during cleanup.');
      console.log('    Try running with --aggressive flag for more aggressive cleanup.');
    }
  }
}

async function main() {
  console.log('================================');
  console.log('  Convex Document Cleanup Tool  ');
  console.log('================================');
  console.log(`Deployment: ${CONVEX_URL}`);
  console.log(`Mode: ${aggressive ? 'AGGRESSIVE' : 'NORMAL'}`);
  
  if (analyzeOnly) {
    await analyzeDocuments();
  } else {
    // First analyze
    await analyzeDocuments();
    
    // Ask for confirmation
    console.log('\n⚠️  Warning: This will permanently delete old documents.');
    console.log(`   Retention periods: ${aggressive ? 'AGGRESSIVE (shorter)' : 'NORMAL (standard)'}`);
    console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Run cleanup
    await runCleanup();
  }
  
  console.log('\n✅ Done!');
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

// Run the script
main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});