#!/usr/bin/env node

/**
 * Check bot registration status
 */

const { ConvexClient } = require('convex/browser');

async function checkBotRegistration(botId) {
  const client = new ConvexClient(process.env.CONVEX_URL || 'https://harmless-marlin-231.convex.cloud');
  
  try {
    // Query for the bot's registration
    const registrations = await client.query(async ({ db }) => {
      const all = await db.query('pendingBotRegistrations').collect();
      return all.filter(r => r.aiArenaBotId === botId);
    });
    
    console.log(`Found ${registrations.length} registrations for bot ${botId}:`);
    registrations.forEach(reg => {
      console.log(`  ID: ${reg._id}`);
      console.log(`  Status: ${reg.status}`);
      console.log(`  Created: ${new Date(reg.createdAt).toISOString()}`);
      console.log(`  Error: ${reg.error || 'none'}`);
      console.log(`  Result: ${JSON.stringify(reg.result || {})}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('Error checking registration:', error);
  } finally {
    await client.close();
  }
}

const botId = process.argv[2] || 'cmec1ppw50002ru4ry3zg1qms';
checkBotRegistration(botId);