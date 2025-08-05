#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const { GraphQLClient, gql } = require('graphql-request');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();
const graphqlClient = new GraphQLClient('http://localhost:4000/graphql');

class BotDeploymentManager {
  constructor() {
    this.stats = {
      worldsCreated: 0,
      invalidSyncsCleared: 0,
      botsDeployed: 0,
      botsFailed: 0,
      errors: []
    };
  }

  async run() {
    console.log('🚀 Starting unified bot deployment process...\n');
    
    try {
      // Step 1: Ensure world instances exist
      console.log('📍 Step 1: Initializing world instances...');
      await this.initializeWorldInstances();
      
      // Step 2: Clean up invalid syncs
      console.log('\n🧹 Step 2: Cleaning up invalid bot syncs...');
      await this.cleanupInvalidSyncs();
      
      // Step 3: Deploy all unsynced bots
      console.log('\n🤖 Step 3: Deploying bots to metaverse...');
      await this.deployAllBots();
      
      // Step 4: Report results
      this.reportResults();
      
    } catch (error) {
      console.error('❌ Deployment failed:', error);
      this.stats.errors.push(error.message);
      this.reportResults();
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  }

  async initializeWorldInstances() {
    try {
      // Check if Convex is running
      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || 'https://polished-otter-734.convex.cloud';
      const response = await fetch(`${convexUrl}/api/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'aiTown/botHttp:getWorlds',
          args: {}
        })
      });

      if (!response.ok) {
        throw new Error('Convex server is not accessible');
      }

      const worlds = await response.json();
      
      if (worlds.data && worlds.data.length > 0) {
        console.log(`✅ Found ${worlds.data.length} existing world instances`);
        return;
      }

      // Create default world and zone instances
      console.log('Creating default world instances...');
      
      const zones = ['casino', 'darkAlley', 'suburb'];
      for (const zone of zones) {
        const createResponse = await fetch(`${convexUrl}/api/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: 'aiTown/botHttp:createWorld',
            args: { zone }
          })
        });

        if (createResponse.ok) {
          this.stats.worldsCreated++;
          console.log(`✅ Created world instance for zone: ${zone}`);
        }
      }
    } catch (error) {
      console.error('⚠️ World initialization error:', error.message);
      // Non-fatal: Continue with deployment
    }
  }

  async cleanupInvalidSyncs() {
    try {
      // Find all invalid syncs
      const invalidSyncs = await prisma.botSync.findMany({
        where: {
          OR: [
            { status: 'FAILED' },
            { 
              AND: [
                { metaverseWorldId: { not: null } },
                { metaverseWorldId: 'm17dkz0psv5e7b812sjjxwpwgd7n374s' } // Known invalid ID
              ]
            }
          ]
        },
        include: { bot: true }
      });

      if (invalidSyncs.length === 0) {
        console.log('✅ No invalid syncs found');
        return;
      }

      console.log(`Found ${invalidSyncs.length} invalid sync records to clean`);

      for (const sync of invalidSyncs) {
        // Reset sync status
        await prisma.botSync.update({
          where: { id: sync.id },
          data: {
            status: 'PENDING',
            metaverseWorldId: null,
            metaverseAgentId: null,
            lastSyncError: null
          }
        });

        // Clear bot metaverse fields
        await prisma.bot.update({
          where: { id: sync.botId },
          data: {
            metaverseAgentId: null,
            currentZone: null,
            position: null
          }
        });

        this.stats.invalidSyncsCleared++;
        console.log(`✅ Cleaned sync for bot: ${sync.bot.name}`);
      }
    } catch (error) {
      console.error('⚠️ Cleanup error:', error.message);
      this.stats.errors.push(`Cleanup: ${error.message}`);
    }
  }

  async deployAllBots() {
    try {
      // Get all unsynced bots
      const unsynced = await prisma.bot.findMany({
        where: {
          OR: [
            { metaverseAgentId: null },
            { metaverseAgentId: '' }
          ]
        },
        include: {
          user: true,
          botSync: true
        }
      });

      if (unsynced.length === 0) {
        console.log('✅ All bots are already deployed');
        return;
      }

      console.log(`Found ${unsynced.length} bots to deploy`);

      const REGISTER_BOT_MUTATION = gql`
        mutation RegisterBotInMetaverse($botId: ID!) {
          registerBotInMetaverse(botId: $botId) {
            success
            message
            agentId
            worldId
          }
        }
      `;

      // Deploy with rate limiting
      for (let i = 0; i < unsynced.length; i++) {
        const bot = unsynced[i];
        
        try {
          console.log(`\n[${i + 1}/${unsynced.length}] Deploying ${bot.name}...`);
          
          const result = await graphqlClient.request(REGISTER_BOT_MUTATION, {
            botId: bot.id
          });

          if (result.registerBotInMetaverse.success) {
            this.stats.botsDeployed++;
            console.log(`✅ Successfully deployed: ${bot.name}`);
            console.log(`   Agent ID: ${result.registerBotInMetaverse.agentId}`);
            console.log(`   World ID: ${result.registerBotInMetaverse.worldId}`);
          } else {
            this.stats.botsFailed++;
            console.log(`❌ Failed to deploy: ${bot.name}`);
            console.log(`   Reason: ${result.registerBotInMetaverse.message}`);
          }
          
          // Rate limiting: Wait 500ms between deployments
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          this.stats.botsFailed++;
          console.error(`❌ Error deploying ${bot.name}:`, error.message);
          this.stats.errors.push(`Bot ${bot.name}: ${error.message}`);
        }
      }
    } catch (error) {
      console.error('⚠️ Deployment error:', error.message);
      this.stats.errors.push(`Deploy: ${error.message}`);
    }
  }

  reportResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 DEPLOYMENT SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Worlds Created:        ${this.stats.worldsCreated}`);
    console.log(`🧹 Invalid Syncs Cleared: ${this.stats.invalidSyncsCleared}`);
    console.log(`✅ Bots Deployed:         ${this.stats.botsDeployed}`);
    console.log(`❌ Bots Failed:           ${this.stats.botsFailed}`);
    
    if (this.stats.errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      this.stats.errors.forEach(err => console.log(`   - ${err}`));
    }
    
    console.log('='.repeat(60));
    
    const successRate = this.stats.botsDeployed > 0 
      ? ((this.stats.botsDeployed / (this.stats.botsDeployed + this.stats.botsFailed)) * 100).toFixed(1)
      : '0';
    
    console.log(`\n📈 Success Rate: ${successRate}%`);
    
    if (this.stats.botsFailed === 0 && this.stats.errors.length === 0) {
      console.log('🎉 Deployment completed successfully!');
    } else {
      console.log('⚠️ Deployment completed with some issues.');
    }
  }
}

// Run the deployment
async function main() {
  const manager = new BotDeploymentManager();
  await manager.run();
}

main().catch(console.error);