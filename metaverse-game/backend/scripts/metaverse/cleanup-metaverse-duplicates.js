#!/usr/bin/env node
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { ConvexHttpClient } = require('convex/browser');

const prisma = new PrismaClient();

// Initialize Convex client - use metaverse-game's Convex URL
const convexUrl = 'https://quaint-koala-55.convex.cloud'; // metaverse-game deployment
const convexClient = new ConvexHttpClient(convexUrl);

async function cleanupDuplicates() {
  try {
    console.log('🧹 Starting metaverse duplicate cleanup...');
    console.log(`📍 Convex URL: ${convexUrl}`);
    
    // Get all synced bots from our database
    const syncedBots = await prisma.botSync.findMany({
      where: {
        syncStatus: 'SYNCED',
        convexAgentId: { not: null }
      },
      include: {
        bot: true
      }
    });
    
    console.log(`Found ${syncedBots.length} synced bots in database`);
    
    // Get all worlds from Convex
    const worlds = await convexClient.query('world:listWorlds');
    console.log(`Found ${worlds?.length || 0} worlds in Convex`);
    
    if (!worlds || worlds.length === 0) {
      console.log('⚠️ No worlds found');
      return;
    }
    
    // Map to track which agents should exist
    const validAgents = new Map(); // aiArenaBotId -> { agentId, worldId }
    
    // Track all agents by aiArenaBotId
    const agentsByBotId = new Map(); // aiArenaBotId -> [{ agentId, worldId, playerId }]
    
    // Iterate through each world
    for (const world of worlds) {
      try {
        // Get world data
        const worldData = await convexClient.query('world:worldState', { 
          worldId: world._id 
        });
        
        if (!worldData) {
          console.log(`⚠️ Could not get data for world ${world._id}`);
          continue;
        }
        
        console.log(`\nWorld ${world._id}:`);
        console.log(`  - Status: ${worldData.worldStatus?.status}`);
        console.log(`  - Agents: ${worldData.agents?.length || 0}`);
        console.log(`  - Players: ${worldData.players?.length || 0}`);
        
        // Check each agent in this world
        if (worldData.agents && Array.isArray(worldData.agents)) {
          for (const agent of worldData.agents) {
            if (agent.aiArenaBotId) {
              // Track this agent
              if (!agentsByBotId.has(agent.aiArenaBotId)) {
                agentsByBotId.set(agent.aiArenaBotId, []);
              }
              
              const player = worldData.players?.find(p => p.id === agent.playerId);
              
              agentsByBotId.get(agent.aiArenaBotId).push({
                agentId: agent.id,
                worldId: world._id,
                playerId: agent.playerId,
                playerName: player?.name || 'Unknown'
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error processing world ${world._id}:`, error.message);
      }
    }
    
    // Now identify duplicates
    console.log('\n📊 Duplicate Analysis:');
    let totalDuplicates = 0;
    
    for (const [aiArenaBotId, agents] of agentsByBotId) {
      if (agents.length > 1) {
        console.log(`\n🔍 Bot ${aiArenaBotId} has ${agents.length} agents (DUPLICATES!):`);
        
        // Find the corresponding BotSync record
        const botSync = syncedBots.find(s => s.botId === aiArenaBotId);
        
        let keepAgent = null;
        if (botSync && botSync.convexAgentId) {
          // Keep the one that matches our database
          keepAgent = agents.find(a => a.agentId === botSync.convexAgentId);
          if (keepAgent) {
            console.log(`  ✅ Keeping agent ${keepAgent.agentId} (matches database)`);
          }
        }
        
        if (!keepAgent) {
          // Keep the first one if no match in database
          keepAgent = agents[0];
          console.log(`  ✅ Keeping agent ${keepAgent.agentId} (first found)`);
        }
        
        // Mark others for deletion
        for (const agent of agents) {
          if (agent.agentId !== keepAgent.agentId) {
            console.log(`  ❌ Will remove agent ${agent.agentId} from world ${agent.worldId}`);
            totalDuplicates++;
          }
        }
      }
    }
    
    if (totalDuplicates === 0) {
      console.log('\n✅ No duplicates found!');
      return;
    }
    
    console.log(`\n⚠️ Found ${totalDuplicates} duplicate agents to remove`);
    
    // Ask for confirmation
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      readline.question('Do you want to remove these duplicates? (yes/no): ', resolve);
    });
    readline.close();
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Cleanup cancelled');
      return;
    }
    
    // Perform cleanup
    console.log('\n🗑️ Removing duplicates...');
    let removed = 0;
    
    for (const [aiArenaBotId, agents] of agentsByBotId) {
      if (agents.length > 1) {
        const botSync = syncedBots.find(s => s.botId === aiArenaBotId);
        
        let keepAgent = null;
        if (botSync && botSync.convexAgentId) {
          keepAgent = agents.find(a => a.agentId === botSync.convexAgentId);
        }
        
        if (!keepAgent) {
          keepAgent = agents[0];
        }
        
        // Remove duplicates
        for (const agent of agents) {
          if (agent.agentId !== keepAgent.agentId) {
            try {
              // Call the internal mutation to remove this agent
              await convexClient.mutation('testing:removeAgent', {
                worldId: agent.worldId,
                agentId: agent.agentId,
                playerId: agent.playerId
              });
              
              console.log(`  ✅ Removed agent ${agent.agentId} from world ${agent.worldId}`);
              removed++;
            } catch (error) {
              console.error(`  ❌ Failed to remove agent ${agent.agentId}:`, error.message);
            }
          }
        }
      }
    }
    
    console.log(`\n🎉 Cleanup complete! Removed ${removed} duplicate agents`);
    
    // Update database sync records if needed
    console.log('\n📝 Updating database sync records...');
    
    for (const sync of syncedBots) {
      const agents = agentsByBotId.get(sync.botId) || [];
      
      if (agents.length === 0) {
        // Bot has no agents in metaverse
        console.log(`⚠️ Bot ${sync.bot.name} has no agents in metaverse, marking as pending`);
        await prisma.botSync.update({
          where: { id: sync.id },
          data: {
            syncStatus: 'PENDING',
            convexAgentId: null,
            convexPlayerId: null,
            convexWorldId: null,
            syncErrors: ['Agent not found in metaverse']
          }
        });
      } else if (agents.length === 1) {
        // Update sync record with correct agent ID if different
        const agent = agents[0];
        if (sync.convexAgentId !== agent.agentId) {
          console.log(`📝 Updating bot ${sync.bot.name} with correct agent ID: ${agent.agentId}`);
          await prisma.botSync.update({
            where: { id: sync.id },
            data: {
              convexAgentId: agent.agentId,
              convexPlayerId: agent.playerId,
              convexWorldId: agent.worldId
            }
          });
        }
      }
    }
    
    console.log('\n✅ Database sync records updated');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Add the removeAgent mutation if not exists
async function addRemoveAgentMutation() {
  console.log('📝 Checking if removeAgent mutation exists...');
  
  const testingPath = '/Users/axel/Desktop/Coding-Projects/ai-arena/metaverse-game/convex/testing.ts';
  const fs = require('fs');
  
  if (fs.existsSync(testingPath)) {
    const content = fs.readFileSync(testingPath, 'utf8');
    
    if (!content.includes('removeAgent')) {
      console.log('Adding removeAgent mutation to testing.ts...');
      
      const newMutation = `
// Remove a specific agent from a world (for cleanup)
export const removeAgent = mutation({
  args: {
    worldId: v.id('worlds'),
    agentId: v.string(),
    playerId: v.string(),
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error('World not found');
    }
    
    // Remove agent from agents array
    const updatedAgents = world.agents.filter((a: any) => a.id !== args.agentId);
    
    // Remove player from players array
    const updatedPlayers = world.players.filter((p: any) => p.id !== args.playerId);
    
    // Update world
    await ctx.db.patch(args.worldId, {
      agents: updatedAgents,
      players: updatedPlayers,
    });
    
    // Remove agent description if exists
    const agentDesc = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q: any) => q.eq('worldId', args.worldId).eq('agentId', args.agentId))
      .first();
      
    if (agentDesc) {
      await ctx.db.delete(agentDesc._id);
    }
    
    return { removed: true };
  },
});`;
      
      // Add the mutation to the file
      fs.appendFileSync(testingPath, newMutation);
      console.log('✅ Added removeAgent mutation');
      console.log('⚠️ Please deploy to Convex before running cleanup: npx convex deploy');
      process.exit(0);
    }
  }
}

// Check if mutation exists first
addRemoveAgentMutation().then(() => {
  cleanupDuplicates();
});