import { v } from 'convex/values';
import { internalMutation, mutation, query } from '../_generated/server';
import { Doc, Id } from '../_generated/dataModel';

// Track when a player was last viewed
export const updateLastViewed = internalMutation({
  args: {
    worldId: v.id('worlds'),
    playerId: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, { worldId, playerId, timestamp }) => {
    // Store or update last viewed timestamp
    const existing = await ctx.db
      .query('playerLastViewed')
      .filter(q => q.eq(q.field('worldId'), worldId))
      .filter(q => q.eq(q.field('playerId'), playerId))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, { timestamp });
    } else {
      await ctx.db.insert('playerLastViewed', {
        worldId,
        playerId,
        timestamp,
      });
    }
  },
});

// Calculate idle gains since last viewed
export const calculateIdleGains = query({
  args: {
    worldId: v.id('worlds'),
    playerId: v.string(),
    currentTime: v.number(),
  },
  handler: async (ctx, { worldId, playerId, currentTime }) => {
    // Get last viewed timestamp
    const lastViewed = await ctx.db
      .query('playerLastViewed')
      .filter(q => q.eq(q.field('worldId'), worldId))
      .filter(q => q.eq(q.field('playerId'), playerId))
      .first();
    
    const lastViewedTime = lastViewed?.timestamp || currentTime - 60000; // Default to 1 minute ago
    const timeAway = currentTime - lastViewedTime;
    
    // If less than 30 seconds, don't show notification
    if (timeAway < 30000) {
      return null;
    }
    
    // Get activity logs since last viewed
    const activityLogs = await ctx.db
      .query('activityLogs')
      .withIndex('player', q => q.eq('worldId', worldId).eq('playerId', playerId).gte('timestamp', lastViewedTime))
      .filter(q => q.lte(q.field('timestamp'), currentTime))
      .collect();
    
    // Get bot experience data
    const experience = await ctx.db
      .query('botExperience')
      .withIndex('player', q => q.eq('worldId', worldId).eq('playerId', playerId))
      .first();
    
    // Get player movement data from world
    const world = await ctx.db.get(worldId);
    const player = world?.players.find(p => p.id === playerId);
    
    // Calculate various gains from activity logs
    let xpGained = 0;
    let levelsGained = 0;
    let stepsWalked = 0;
    let energyConsumed = 0;
    const lootCollected = {
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 0,
      legendary: 0,
      total: 0,
    };
    const combatResults = {
      wins: 0,
      losses: 0,
    };
    const robberyResults = {
      successful: 0,
      failed: 0,
      moneyStolen: 0,
    };
    const socialEvents = {
      conversations: 0,
      newAlliances: 0,
      newEnemies: 0,
    };
    const achievements: string[] = [];
    
    // Parse activity logs
    for (const log of activityLogs) {
      switch (log.type) {
        case 'xp_gained':
          if (log.details?.amount) {
            xpGained += log.details.amount;
          }
          break;
          
        case 'level_up':
          levelsGained++;
          if (log.details?.newLevel) {
            achievements.push(`Reached Level ${log.details.newLevel}`);
          }
          break;
          
        case 'item_collected':
          if (log.details?.rarity) {
            const rarity = log.details.rarity.toLowerCase();
            if (rarity in lootCollected) {
              lootCollected[rarity as keyof typeof lootCollected]++;
            }
            lootCollected.total++;
          }
          break;
          
        case 'combat':
          if (log.details?.success !== undefined) {
            if (log.details.success) {
              combatResults.wins++;
            } else {
              combatResults.losses++;
            }
          }
          break;
          
        case 'robbery_attempt':
          if (log.details?.success !== undefined) {
            if (log.details.success) {
              robberyResults.successful++;
              if (log.details.amount) {
                robberyResults.moneyStolen += log.details.amount;
              }
            } else {
              robberyResults.failed++;
            }
          }
          break;
          
        case 'conversation_start':
          socialEvents.conversations++;
          break;
          
        case 'friendship_formed':
          socialEvents.newAlliances++;
          break;
          
        case 'rivalry_formed':
          socialEvents.newEnemies++;
          break;
      }
    }
    
    // Calculate movement stats from player data
    if (player) {
      stepsWalked = player.stepsTaken || 0;
      energyConsumed = player.stepsTaken || 0; // 1 energy per step
    }
    
    // Check for special achievements
    if (xpGained >= 1000) {
      achievements.push('XP Grinder - Earned 1000+ XP');
    }
    if (lootCollected.legendary > 0) {
      achievements.push('Legendary Finder');
    }
    if (combatResults.wins >= 5) {
      achievements.push('Combat Master - 5+ Wins');
    }
    if (robberyResults.successful >= 3) {
      achievements.push('Master Thief - 3+ Successful Robberies');
    }
    if (socialEvents.conversations >= 10) {
      achievements.push('Social Butterfly - 10+ Conversations');
    }
    
    return {
      timeAway,
      xpGained,
      levelsGained,
      stepsWalked,
      energyConsumed,
      lootCollected,
      combatResults,
      robberyResults,
      socialEvents,
      achievements: achievements.length > 0 ? achievements : undefined,
    };
  },
});

// Track idle progress for a player
export const trackIdleProgress = internalMutation({
  args: {
    worldId: v.id('worlds'),
    playerId: v.string(),
    progressType: v.union(
      v.literal('xp_gained'),
      v.literal('level_up'),
      v.literal('item_collected'),
      v.literal('combat'),
      v.literal('robbery_attempt'),
      v.literal('conversation_start'),
      v.literal('friendship_formed'),
      v.literal('rivalry_formed')
    ),
    details: v.optional(v.any()),
  },
  handler: async (ctx, { worldId, playerId, progressType, details }) => {
    // Get player name for description
    const world = await ctx.db.get(worldId);
    const player = world?.players.find(p => p.id === playerId);
    
    // Use player ID for name since player objects don't have names
    const playerName = `Player ${playerId.slice(0, 4)}`;
    // Create appropriate description and emoji
    let description = '';
    let emoji = '🎮';
    
    switch (progressType) {
      case 'xp_gained':
        description = `${playerName} gained ${details?.amount || 0} XP`;
        emoji = '✨';
        break;
      case 'level_up':
        description = `${playerName} reached Level ${details?.newLevel || 0}!`;
        emoji = '🎉';
        break;
      case 'item_collected':
        description = `${playerName} found a ${details?.rarity || 'common'} item`;
        emoji = '📦';
        break;
      case 'combat':
        description = details?.success 
          ? `${playerName} won a combat!`
          : `${playerName} lost a combat`;
        emoji = details?.success ? '⚔️' : '💀';
        break;
      case 'robbery_attempt':
        description = details?.success
          ? `${playerName} successfully robbed someone`
          : `${playerName}'s robbery attempt failed`;
        emoji = details?.success ? '💰' : '🚫';
        break;
      case 'conversation_start':
        description = `${playerName} started a conversation`;
        emoji = '💬';
        break;
      case 'friendship_formed':
        description = `${playerName} made a new friend`;
        emoji = '🤝';
        break;
      case 'rivalry_formed':
        description = `${playerName} made a new enemy`;
        emoji = '⚔️';
        break;
    }
    
    // Log to activity logs
    await ctx.db.insert('activityLogs', {
      worldId,
      playerId,
      timestamp: Date.now(),
      type: progressType,
      description,
      emoji,
      details,
    });
  },
});

// Get summary stats for a player
export const getPlayerIdleStats = query({
  args: {
    worldId: v.id('worlds'),
    playerId: v.string(),
  },
  handler: async (ctx, { worldId, playerId }) => {
    // Get bot experience
    const experience = await ctx.db
      .query('botExperience')
      .withIndex('player', q => q.eq('worldId', worldId).eq('playerId', playerId))
      .first();
    
    // Get player data
    const world = await ctx.db.get(worldId);
    if (!world) return null;
    
    const player = world.players.find(p => p.id === playerId);
    if (!player) return null;
    
    // Get recent activity count
    const recentActivities = await ctx.db
      .query('activityLogs')
      .withIndex('player', q => q.eq('worldId', worldId).eq('playerId', playerId).gte('timestamp', Date.now() - 3600000))
      .collect();
    
    return {
      level: experience?.level || 1,
      currentXP: experience?.currentXP || 0,
      totalXP: experience?.totalXP || 0,
      xpToNextLevel: experience?.xpToNextLevel || 100,
      prestige: experience?.prestigeLevel || 0,
      // Category XP breakdown
      combatXP: experience?.combatXP || 0,
      socialXP: experience?.socialXP || 0,
      criminalXP: experience?.criminalXP || 0,
      gamblingXP: experience?.gamblingXP || 0,
      tradingXP: experience?.tradingXP || 0,
      // Skills
      skillPoints: experience?.skillPoints || 0,
      allocatedSkills: experience?.allocatedSkills || {},
      // Movement and energy
      stepsTaken: player?.stepsTaken || 0,
      currentEnergy: player?.currentEnergy || 30,
      maxEnergy: player?.maxEnergy || 30,
      // Loot and activities
      totalLootDrops: 0,  // Will be tracked in future
      recentActivityCount: recentActivities.length,
      isActive: (player?.currentEnergy || 0) > 0,
      // Timestamps
      lastXPGain: experience?.lastXPGain || 0,
      createdAt: experience?.createdAt || Date.now(),
      updatedAt: experience?.updatedAt || Date.now(),
    };
  },
});

// Initialize bot experience when a new bot is created
export const initializeBotExperience = internalMutation({
  args: {
    worldId: v.id('worlds'),
    playerId: v.string(),
    aiArenaBotId: v.string(),
  },
  handler: async (ctx, { worldId, playerId, aiArenaBotId }) => {
    // Check if experience record already exists
    const existing = await ctx.db
      .query('botExperience')
      .withIndex('player', q => q.eq('worldId', worldId).eq('playerId', playerId))
      .first();
    
    if (existing) {
      console.log(`Bot experience already exists for ${playerId}`);
      return existing._id;
    }
    
    // Create new experience record with starting values
    const experienceId = await ctx.db.insert('botExperience', {
      worldId,
      playerId,
      aiArenaBotId,
      level: 1,
      currentXP: 0,
      totalXP: 0,
      xpToNextLevel: 100, // Start with 100 XP needed for level 2
      avatarRarity: 'COMMON', // Default rarity if not specified
      combatXP: 0,
      socialXP: 0,
      criminalXP: 0,
      gamblingXP: 0,
      tradingXP: 0,
      prestigeLevel: 0,
      prestigeTokens: 0,
      skillPoints: 0,
      allocatedSkills: {},
      lastXPGain: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    console.log(`Initialized bot experience for ${playerId} at level 1`);
    return experienceId;
  },
});

// Migration: Initialize experience for all existing bots
export const initializeAllBotExperience = mutation({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, { worldId }) => {
    // Get the world
    const world = await ctx.db.get(worldId);
    if (!world) {
      throw new Error('World not found');
    }
    
    // Get all agents in the world
    const agents = world.agents || [];
    let initialized = 0;
    let skipped = 0;
    
    for (const agent of agents) {
      if (!agent.aiArenaBotId || !agent.playerId) {
        skipped++;
        continue;
      }
      
      // Check if experience already exists
      const existing = await ctx.db
        .query('botExperience')
        .withIndex('player', q => q.eq('worldId', worldId).eq('playerId', agent.playerId))
        .first();
      
      if (existing) {
        skipped++;
        continue;
      }
      
      // Initialize experience for this bot
      await ctx.db.insert('botExperience', {
        worldId,
        playerId: agent.playerId,
        aiArenaBotId: agent.aiArenaBotId,
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
        allocatedSkills: {},
        lastXPGain: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      
      initialized++;
    }
    
    console.log(`Migration complete: initialized ${initialized} bots, skipped ${skipped}`);
    return { initialized, skipped, total: agents.length };
  },
});

// Initialize experience for all worlds (run once)
export const initializeAllWorldsExperience = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all worlds
    const worldStatuses = await ctx.db
      .query('worldStatus')
      .collect();
    
    const results = [];
    
    for (const worldStatus of worldStatuses) {
      try {
        // @ts-ignore - TypeScript depth issue
        const result = await ctx.runMutation(internal.aiTown.idleGains.initializeAllBotExperience, {
          worldId: worldStatus.worldId,
        });
        results.push({ worldId: worldStatus.worldId, ...result });
      } catch (error) {
        console.error(`Failed to initialize experience for world ${worldStatus.worldId}:`, error);
        results.push({ worldId: worldStatus.worldId, error: String(error) });
      }
    }
    
    return { worldsProcessed: worldStatuses.length, results };
  },
});