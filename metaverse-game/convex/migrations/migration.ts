import { v } from 'convex/values';
import { mutation, internalMutation } from '../_generated/server';
import { generateAvatarRarity, generateInitialStats } from '../aiTown/experience';
import { Id } from '../_generated/dataModel';

// Migration to add idle game fields to existing players
export const migratePlayersIdleFields = mutation({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, { worldId }) => {
    const world = await ctx.db.get(worldId);
    if (!world) {
      throw new Error('World not found');
    }

    const now = Date.now();
    let updatedCount = 0;
    
    // Update each player in the world
    const updatedPlayers = world.players.map((player: any) => {
      // Check if player already has the idle game fields
      if (player.stepsTaken === undefined) {
        updatedCount++;
        return {
          ...player,
          stepsTaken: 0,
          lastStepTime: now,
          stepStreak: 0,
          currentEnergy: player.currentEnergy ?? 30,
          maxEnergy: player.maxEnergy ?? 30,
          lastEnergyRegen: now,
          lastLootRoll: 0,
        };
      }
      return player;
    });

    // Update the world with migrated players
    if (updatedCount > 0) {
      await ctx.db.patch(worldId, { players: updatedPlayers });
      console.log(`Migrated ${updatedCount} players with idle game fields`);
    }

    return {
      message: `Successfully migrated ${updatedCount} players`,
      totalPlayers: world.players.length,
      updatedPlayers: updatedCount,
    };
  },
});

// Migration to create missing player descriptions
export const createMissingPlayerDescriptions = mutation({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, { worldId }) => {
    const world = await ctx.db.get(worldId);
    if (!world) {
      throw new Error('World not found');
    }

    let createdCount = 0;
    let updatedCount = 0;
    
    // Check each player in the world
    for (const player of world.players) {
      const existingDesc = await ctx.db
        .query('playerDescriptions')
        .withIndex('worldId', (q) => 
          q.eq('worldId', worldId).eq('playerId', player.id)
        )
        .first();
      
      if (!existingDesc) {
        // Find the agent for this player to get more info
        const agent = world.agents.find((a: any) => a.playerId === player.id);
        const agentDesc = agent ? await ctx.db
          .query('agentDescriptions')
          .withIndex('worldId', (q) => 
            q.eq('worldId', worldId).eq('agentId', agent.id)
          )
          .first() : null;
        
        // Create a default player description
        const name = agentDesc?.aiArenaBotId ? 
          `Bot-${agentDesc.aiArenaBotId.slice(-4)}` : 
          `Player-${player.id.slice(-4)}`;
        
        // Default character - f1 is a valid character from the character list
        const character = 'f1';
        const description = agentDesc?.identity ? 
          agentDesc.identity.slice(0, 200) : 
          `A mysterious figure in the metaverse`;
        
        await ctx.db.insert('playerDescriptions', {
          worldId,
          playerId: player.id,
          name,
          character,
          description,
        });
        
        createdCount++;
        console.log(`Created player description for ${player.id}: ${name}`);
      }
    }
    
    return {
      message: `Successfully created ${createdCount} missing player descriptions`,
      totalPlayers: world.players.length,
      createdDescriptions: createdCount,
    };
  },
});

// Migration to add avatar rarity to existing agent descriptions
export const migrateAgentDescriptions = mutation({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, { worldId }) => {
    // Get all agent descriptions for this world
    const agentDescriptions = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect();

    let updatedCount = 0;

    for (const agentDesc of agentDescriptions) {
      // Check if already has rarity
      if (!agentDesc.avatarRarity) {
        // Find the agent to get personality
        const world = await ctx.db.get(worldId);
        if (!world) continue;
        
        const agent = world.agents.find((a: any) => a.id === agentDesc.agentId);
        
        // Generate rarity
        const avatarRarity = generateAvatarRarity();
        
        // Determine personality if not set
        let personality = agentDesc.personality || agent?.personality;
        if (!personality) {
          const identityLower = agentDesc.identity.toLowerCase();
          if (identityLower.includes('criminal') || identityLower.includes('thief') || identityLower.includes('robber')) {
            personality = 'CRIMINAL';
          } else if (identityLower.includes('gambler') || identityLower.includes('risk') || identityLower.includes('casino')) {
            personality = 'GAMBLER';
          } else {
            personality = 'WORKER';
          }
        }

        // Update the agent description
        await ctx.db.patch(agentDesc._id, {
          avatarRarity: avatarRarity as 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY',
          personality: personality as 'CRIMINAL' | 'GAMBLER' | 'WORKER',
        });
        
        updatedCount++;
        console.log(`Updated agent ${agentDesc.agentId} with ${avatarRarity} rarity and ${personality} personality`);
      }
    }

    return {
      message: `Successfully migrated ${updatedCount} agent descriptions`,
      totalAgents: agentDescriptions.length,
      updatedAgents: updatedCount,
    };
  },
});

// Migration to initialize bot experience for existing bots
export const migrateBotExperience = mutation({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, { worldId }) => {
    const world = await ctx.db.get(worldId);
    if (!world) {
      throw new Error('World not found');
    }

    let createdCount = 0;
    
    // Get all agents with AI Arena bot IDs
    for (const agent of world.agents) {
      if (agent.aiArenaBotId) {
        // Check if experience record exists
        const existing = await ctx.db
          .query('botExperience')
          .withIndex('aiArenaBotId', (q) => 
            q.eq('worldId', worldId).eq('aiArenaBotId', agent.aiArenaBotId!)
          )
          .first();
        
        if (!existing) {
          // Get agent description to get rarity and personality
          const agentDesc = await ctx.db
            .query('agentDescriptions')
            .withIndex('worldId', (q) => 
              q.eq('worldId', worldId).eq('agentId', agent.id)
            )
            .first();
          
          const avatarRarity = agentDesc?.avatarRarity || generateAvatarRarity();
          const personality = agentDesc?.personality || agent.personality || 'WORKER';
          const initialStats = generateInitialStats(avatarRarity || 'COMMON', personality);
          
          // Create experience record
          await ctx.db.insert('botExperience', {
            worldId,
            playerId: agent.playerId,
            aiArenaBotId: agent.aiArenaBotId,
            avatarRarity: avatarRarity as 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY',
            level: 1,
            currentXP: 0,
            totalXP: 0,
            xpToNextLevel: 100,
            combatXP: 0,
            socialXP: 0,
            criminalXP: 0,
            gamblingXP: 0,
            tradingXP: 0,
            prestigeLevel: 0,
            prestigeTokens: 0,
            skillPoints: 0,
            allocatedSkills: initialStats,
            lastXPGain: Date.now(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          
          createdCount++;
          console.log(`Created experience record for bot ${agent.aiArenaBotId} with ${avatarRarity} rarity`);
        }
      }
    }

    return {
      message: `Successfully created ${createdCount} bot experience records`,
      totalAgents: world.agents.length,
      createdRecords: createdCount,
    };
  },
});

// Auto-detect and clean up ghost bots (for manual execution)
export const autoCleanupGhostBots = mutation({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error('World not found');
    }
    
    // Get all agent descriptions to find potential ghost bots
    const agentDescriptions = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    
    const botsToCheck: any[] = [];
    
    // Look for bots with suspicious names/IDs that shouldn't exist
    for (const agentDesc of agentDescriptions) {
      if (agentDesc.aiArenaBotId) {
        // Check if the bot name looks like a ghost (e.g., bot1358, bot1494)
        const name = agentDesc.identity || '';
        if (name.match(/bot\d{4}/i) || name.includes('Bot #')) {
          const agent = world.agents.find((a: any) => a.id === agentDesc.agentId);
          if (agent) {
            botsToCheck.push({
              agentId: agent.id,
              playerId: agent.playerId,
              aiArenaBotId: agentDesc.aiArenaBotId,
              name: name,
            });
          }
        }
      }
    }
    
    console.log(`Found ${botsToCheck.length} suspicious bots to verify`);
    
    // For now, return the list for manual review
    // In production, you'd verify against the AI Arena backend
    return {
      message: `Found ${botsToCheck.length} suspicious bots that may be ghosts`,
      botsToCheck: botsToCheck.map(b => ({
        aiArenaBotId: b.aiArenaBotId,
        name: b.name,
      })),
      totalFound: botsToCheck.length,
      hint: 'Run cleanupGhostBots with the aiArenaBotIds that should be kept',
    };
  },
});

// Clean up ghost bots that no longer exist in AI Arena
export const cleanupGhostBots = mutation({
  args: {
    worldId: v.id('worlds'),
    aiArenaBotIds: v.array(v.string()), // List of valid bot IDs from AI Arena
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error('World not found');
    }
    
    const validBotIds = new Set(args.aiArenaBotIds);
    const ghostBots: any[] = [];
    
    // Find all agents with aiArenaBotId that don't exist in the valid list
    for (const agent of world.agents) {
      if (agent.aiArenaBotId && !validBotIds.has(agent.aiArenaBotId)) {
        ghostBots.push({
          agentId: agent.id,
          playerId: agent.playerId,
          aiArenaBotId: agent.aiArenaBotId,
        });
      }
    }
    
    console.log(`Found ${ghostBots.length} ghost bots to clean up`);
    
    // Clean up each ghost bot
    const cleanupResults = [];
    for (const ghost of ghostBots) {
      try {
        console.log(`Cleaning up ghost bot: ${ghost.aiArenaBotId}`);
        
        // Import the cleanup helper
        const { comprehensivePlayerCleanupHelper } = await import('../cleanup/orphanCleanup');
        
        // Perform comprehensive cleanup
        const cleanupResult = await comprehensivePlayerCleanupHelper(
          ctx,
          args.worldId,
          ghost.playerId,
          false // Don't keep activity logs for ghost bots
        );
        
        // Delete agent description
        const agentDesc = await ctx.db
          .query('agentDescriptions')
          .withIndex('worldId', (q) => 
            q.eq('worldId', args.worldId).eq('agentId', ghost.agentId)
          )
          .first();
        if (agentDesc) {
          await ctx.db.delete(agentDesc._id);
        }
        
        // Delete bot experience
        const botExp = await ctx.db
          .query('botExperience')
          .withIndex('aiArenaBotId', (q) => 
            q.eq('worldId', args.worldId).eq('aiArenaBotId', ghost.aiArenaBotId)
          )
          .first();
        if (botExp) {
          await ctx.db.delete(botExp._id);
        }
        
        // Remove from world arrays
        const updatedWorld = await ctx.db.get(args.worldId);
        if (updatedWorld) {
          const updatedAgents = updatedWorld.agents.filter((a: any) => a.id !== ghost.agentId);
          const updatedPlayers = updatedWorld.players.filter((p: any) => p.id !== ghost.playerId);
          
          await ctx.db.patch(args.worldId, {
            agents: updatedAgents,
            players: updatedPlayers,
          });
        }
        
        cleanupResults.push({
          aiArenaBotId: ghost.aiArenaBotId,
          success: true,
          cleanup: cleanupResult,
        });
      } catch (error: any) {
        console.error(`Failed to cleanup ghost bot ${ghost.aiArenaBotId}:`, error);
        cleanupResults.push({
          aiArenaBotId: ghost.aiArenaBotId,
          success: false,
          error: error.message,
        });
      }
    }
    
    return {
      message: `Cleaned up ${cleanupResults.filter(r => r.success).length} out of ${ghostBots.length} ghost bots`,
      totalGhostBots: ghostBots.length,
      successfulCleanups: cleanupResults.filter(r => r.success).length,
      failedCleanups: cleanupResults.filter(r => !r.success).length,
      details: cleanupResults,
    };
  },
});

// Clean up all ghost bots that don't have valid AI Arena IDs
export const cleanupAllGhostBots = mutation({
  args: {
    worldId: v.id('worlds'),
    dryRun: v.optional(v.boolean()), // If true, only report what would be deleted
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error('World not found');
    }
    
    // Get the known valid bot IDs
    const validBotIds = new Set(['bot0001', 'bot0002', 'bot0003']); // Louis, Axel, ZY
    
    // Also check agent descriptions for any other valid bots
    const agentDescriptions = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    
    // Add any bots that have valid agent descriptions with proper names
    for (const desc of agentDescriptions) {
      if (desc.aiArenaBotId && desc.identity && 
          (desc.identity.includes('Axel') || 
           desc.identity.includes('Louis') || 
           desc.identity.includes('ZY'))) {
        validBotIds.add(desc.aiArenaBotId);
      }
    }
    
    const ghostBots: any[] = [];
    const validAgents: any[] = [];
    const validPlayers: any[] = [];
    
    // Check all agents
    for (const agent of world.agents) {
      if (!agent.aiArenaBotId || !validBotIds.has(agent.aiArenaBotId)) {
        ghostBots.push({
          agentId: agent.id,
          playerId: agent.playerId,
          aiArenaBotId: agent.aiArenaBotId || 'unknown',
        });
      } else {
        validAgents.push(agent);
      }
    }
    
    // Build valid player IDs from valid agents
    const validPlayerIds = new Set(validAgents.map(a => a.playerId));
    
    // Filter players
    for (const player of world.players) {
      if (validPlayerIds.has(player.id)) {
        validPlayers.push(player);
      }
    }
    
    console.log(`Found ${ghostBots.length} ghost bots out of ${world.agents.length} total agents`);
    console.log(`Valid agents: ${validAgents.length}, Valid players: ${validPlayers.length}`);
    
    if (args.dryRun) {
      return {
        message: 'DRY RUN - No changes made',
        ghostBots: ghostBots.map(b => ({
          agentId: b.agentId,
          playerId: b.playerId,
          aiArenaBotId: b.aiArenaBotId,
        })),
        totalGhostBots: ghostBots.length,
        validAgents: validAgents.length,
        validPlayers: validPlayers.length,
      };
    }
    
    // Clean up each ghost bot
    const cleanupResults = [];
    for (const ghost of ghostBots) {
      try {
        // Import the cleanup helper
        const { comprehensivePlayerCleanupHelper } = await import('../cleanup/orphanCleanup');
        
        // Perform comprehensive cleanup
        const cleanupResult = await comprehensivePlayerCleanupHelper(
          ctx,
          args.worldId,
          ghost.playerId,
          false // Don't keep activity logs for ghost bots
        );
        
        // Delete agent description if exists
        const agentDesc = await ctx.db
          .query('agentDescriptions')
          .withIndex('worldId', (q) => 
            q.eq('worldId', args.worldId).eq('agentId', ghost.agentId)
          )
          .first();
        if (agentDesc) {
          await ctx.db.delete(agentDesc._id);
        }
        
        // Delete bot experience if exists
        if (ghost.aiArenaBotId && ghost.aiArenaBotId !== 'unknown') {
          const botExp = await ctx.db
            .query('botExperience')
            .withIndex('aiArenaBotId', (q) => 
              q.eq('worldId', args.worldId).eq('aiArenaBotId', ghost.aiArenaBotId)
            )
            .first();
          if (botExp) {
            await ctx.db.delete(botExp._id);
          }
        }
        
        cleanupResults.push({
          agentId: ghost.agentId,
          success: true,
        });
      } catch (error: any) {
        console.error(`Failed to cleanup ghost bot ${ghost.agentId}:`, error);
        cleanupResults.push({
          agentId: ghost.agentId,
          success: false,
          error: error.message,
        });
      }
    }
    
    // Update world with only valid agents and players
    await ctx.db.patch(args.worldId, {
      agents: validAgents,
      players: validPlayers,
    });
    
    // Clean up orphaned conversations
    const conversations = world.conversations || [];
    const validConversations = conversations.filter((conv: any) => {
      // Keep conversation only if all participants are valid
      for (const [playerId] of conv.participants) {
        if (!validPlayerIds.has(playerId)) {
          return false;
        }
      }
      return true;
    });
    
    await ctx.db.patch(args.worldId, {
      conversations: validConversations,
    });
    
    return {
      message: `Cleaned up ${cleanupResults.filter(r => r.success).length} ghost bots`,
      totalGhostBots: ghostBots.length,
      successfulCleanups: cleanupResults.filter(r => r.success).length,
      failedCleanups: cleanupResults.filter(r => !r.success).length,
      remainingAgents: validAgents.length,
      remainingPlayers: validPlayers.length,
      details: cleanupResults,
    };
  },
});

// Master migration runner - runs all migrations in sequence
export const runAllMigrations = mutation({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, { worldId }) => {
    console.log('Starting migration for world:', worldId);
    
    // Step 1: Migrate player idle fields
    const playerResult = await ctx.db.get(worldId).then(async (world) => {
      if (!world) throw new Error('World not found');
      
      const now = Date.now();
      let updatedCount = 0;
      
      const updatedPlayers = world.players.map((player: any) => {
        if (player.stepsTaken === undefined) {
          updatedCount++;
          return {
            ...player,
            stepsTaken: 0,
            lastStepTime: now,
            stepStreak: 0,
            currentEnergy: player.currentEnergy ?? 30,
            maxEnergy: player.maxEnergy ?? 30,
            lastEnergyRegen: now,
            lastLootRoll: 0,
          };
        }
        return player;
      });

      if (updatedCount > 0) {
        await ctx.db.patch(worldId, { players: updatedPlayers });
      }
      
      return { updated: updatedCount, total: world.players.length };
    });
    
    // Step 2: Migrate agent descriptions
    const agentDescResult = await (async () => {
      const agentDescriptions = await ctx.db
        .query('agentDescriptions')
        .withIndex('worldId', (q) => q.eq('worldId', worldId))
        .collect();

      let updatedCount = 0;
      for (const agentDesc of agentDescriptions) {
        if (!agentDesc.avatarRarity) {
          const world = await ctx.db.get(worldId);
          if (!world) continue;
          
          const agent = world.agents.find((a: any) => a.id === agentDesc.agentId);
          const avatarRarity = generateAvatarRarity();
          
          let personality = agentDesc.personality || agent?.personality;
          if (!personality) {
            const identityLower = agentDesc.identity.toLowerCase();
            if (identityLower.includes('criminal') || identityLower.includes('thief')) {
              personality = 'CRIMINAL';
            } else if (identityLower.includes('gambler') || identityLower.includes('risk')) {
              personality = 'GAMBLER';
            } else {
              personality = 'WORKER';
            }
          }

          await ctx.db.patch(agentDesc._id, {
            avatarRarity: avatarRarity as any,
            personality: personality as any,
          });
          updatedCount++;
        }
      }
      
      return { updated: updatedCount, total: agentDescriptions.length };
    })();
    
    // Step 3: Initialize bot experience
    const experienceResult = await (async () => {
      const world = await ctx.db.get(worldId);
      if (!world) throw new Error('World not found');

      let createdCount = 0;
      for (const agent of world.agents) {
        if (agent.aiArenaBotId) {
          const existing = await ctx.db
            .query('botExperience')
            .withIndex('aiArenaBotId', (q) => 
              q.eq('worldId', worldId).eq('aiArenaBotId', agent.aiArenaBotId!)
            )
            .first();
          
          if (!existing) {
            const agentDesc = await ctx.db
              .query('agentDescriptions')
              .withIndex('worldId', (q) => 
                q.eq('worldId', worldId).eq('agentId', agent.id)
              )
              .first();
            
            const avatarRarity = agentDesc?.avatarRarity || generateAvatarRarity();
            const personality = agentDesc?.personality || agent.personality || 'WORKER';
            const initialStats = generateInitialStats(avatarRarity, personality);
            
            await ctx.db.insert('botExperience', {
              worldId,
              playerId: agent.playerId,
              aiArenaBotId: agent.aiArenaBotId,
              avatarRarity: avatarRarity as any,
              level: 1,
              currentXP: 0,
              totalXP: 0,
              xpToNextLevel: 100,
              combatXP: 0,
              socialXP: 0,
              criminalXP: 0,
              gamblingXP: 0,
              tradingXP: 0,
              prestigeLevel: 0,
              prestigeTokens: 0,
              skillPoints: 0,
              allocatedSkills: initialStats,
              lastXPGain: Date.now(),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
            createdCount++;
          }
        }
      }
      
      return { created: createdCount, total: world.agents.length };
    })();
    
    return {
      success: true,
      summary: {
        players: playerResult,
        agentDescriptions: agentDescResult,
        botExperience: experienceResult,
      },
      message: `Migration complete! Updated ${playerResult.updated} players, ${agentDescResult.updated} agent descriptions, and created ${experienceResult.created} experience records.`,
    };
  },
});