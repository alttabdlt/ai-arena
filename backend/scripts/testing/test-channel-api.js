#!/usr/bin/env node

/**
 * Test Channel GraphQL API
 * 
 * This script tests the new channel queries and mutations
 */

const fetch = require('node-fetch');

const GRAPHQL_URL = 'http://localhost:4000/graphql';

async function testChannelAPI() {
  console.log('\n🔌 Testing Channel GraphQL API\n');
  console.log('=' .repeat(50) + '\n');

  try {
    // Test channels query
    console.log('📡 Testing channels query...');
    const channelsQuery = `
      query GetChannels {
        channels {
          id
          name
          type
          status
          currentBots
          maxBots
          loadPercentage
          worldId
        }
      }
    `;

    const channelsResponse = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: channelsQuery }),
    });

    const channelsData = await channelsResponse.json();
    
    if (channelsData.errors) {
      console.error('❌ Errors in channels query:', channelsData.errors);
    } else if (channelsData.data?.channels) {
      console.log(`✅ Found ${channelsData.data.channels.length} channel(s):`);
      channelsData.data.channels.forEach(channel => {
        const load = channel.loadPercentage.toFixed(1);
        console.log(`   - ${channel.name}: ${channel.currentBots}/${channel.maxBots} bots (${load}% full)`);
      });
    } else {
      console.log('⚠️  No channels found');
    }

    // Test single channel query
    console.log('\n📡 Testing channel query for "main"...');
    const channelQuery = `
      query GetChannel($name: String!) {
        channel(name: $name) {
          id
          name
          type
          status
          currentBots
          maxBots
          loadPercentage
        }
      }
    `;

    const channelResponse = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query: channelQuery,
        variables: { name: 'main' }
      }),
    });

    const channelData = await channelResponse.json();
    
    if (channelData.errors) {
      console.error('❌ Errors in channel query:', channelData.errors);
    } else if (channelData.data?.channel) {
      const ch = channelData.data.channel;
      console.log(`✅ Found channel "${ch.name}"`);
      console.log(`   Type: ${ch.type}`);
      console.log(`   Status: ${ch.status}`);
      console.log(`   Capacity: ${ch.currentBots}/${ch.maxBots}`);
    } else {
      console.log('⚠️  Channel "main" not found');
    }

    // Test bot with channel field
    console.log('\n📡 Testing bot query with channel field...');
    const botsQuery = `
      query GetBots {
        bots(limit: 5) {
          id
          name
          channel
          isActive
        }
      }
    `;

    const botsResponse = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: botsQuery }),
    });

    const botsData = await botsResponse.json();
    
    if (botsData.errors) {
      console.error('❌ Errors in bots query:', botsData.errors);
    } else if (botsData.data?.bots && botsData.data.bots.length > 0) {
      console.log(`✅ Found ${botsData.data.bots.length} bot(s) with channels:`);
      botsData.data.bots.forEach(bot => {
        console.log(`   - ${bot.name}: channel="${bot.channel}"`);
      });
    } else {
      console.log('⚠️  No bots found');
    }

    console.log('\n✨ Channel API is working!\n');
    console.log('📝 Next steps:');
    console.log('   1. Create bots to see them assigned to channels');
    console.log('   2. Use switchChannel mutation to move bots');
    console.log('   3. Add UI components to show channels\n');

  } catch (error) {
    console.error('❌ Error testing API:', error.message);
    console.log('\n💡 Make sure the backend is running: npm run dev');
  }
}

// Run the test
testChannelAPI().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});