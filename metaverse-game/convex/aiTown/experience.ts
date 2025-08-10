import { v } from 'convex/values';
import { mutation, query, internalMutation, internalQuery } from '../_generated/server';
import { playerId } from './ids';

// XP configuration matching backend
const XP_CONFIG = {
  BASE_XP_PER_LEVEL: 100,
  LEVEL_SCALING_FACTOR: 1.5,
  MAX_LEVEL: 50,
  PRESTIGE_UNLOCK_LEVEL: 50,
  SKILL_POINTS_PER_LEVEL: 3,
};

// Avatar rarity tiers and their stat bonuses
const AVATAR_RARITY = {
  COMMON: {
    statRange: { min: 1, max: 3 },
    statPoints: 2,
    xpMultiplier: 1.0,
    energyBonus: 0,
    luckBonus: 0,
  },
  UNCOMMON: {
    statRange: { min: 2, max: 5 },
    statPoints: 3,
    xpMultiplier: 1.1,
    energyBonus: 10,
    luckBonus: 5,
  },
  RARE: {
    statRange: { min: 3, max: 7 },
    statPoints: 4,
    xpMultiplier: 1.25,
    energyBonus: 20,
    luckBonus: 10,
  },
  EPIC: {
    statRange: { min: 5, max: 10 },
    statPoints: 5,
    xpMultiplier: 1.5,
    energyBonus: 30,
    luckBonus: 15,
  },
  LEGENDARY: {
    statRange: { min: 8, max: 15 },
    statPoints: 7,
    xpMultiplier: 2.0,
    energyBonus: 50,
    luckBonus: 25,
  },
};

// Personality-based stat preferences
const PERSONALITY_STAT_BIAS = {
  CRIMINAL: {
    strength: 1.5,
    agility: 1.2,
    intelligence: 0.8,
    charisma: 0.7,
    luck: 1.3,
  },
  GAMBLER: {
    strength: 0.8,
    agility: 1.0,
    intelligence: 1.2,
    charisma: 1.3,
    luck: 1.7,
  },
  WORKER: {
    strength: 1.3,
    agility: 0.9,
    intelligence: 1.4,
    charisma: 1.1,
    luck: 0.8,
  },
};

// Activity XP rewards - Reduced by ~60% for slower leveling
const XP_REWARDS: Record<string, { category: string; amount: number }> = {
  'idle': { category: 'criminal', amount: 2 }, // Reduced idle XP gain
  'zone_activity': { category: 'criminal', amount: 8 },
  'robbery_success': { category: 'criminal', amount: 30 },
  'robbery_fail': { category: 'criminal', amount: 6 },
  'defense_success': { category: 'combat', amount: 25 },
  'combat_win': { category: 'combat', amount: 35 },
  'combat_loss': { category: 'combat', amount: 8 },
  'conversation': { category: 'social', amount: 6 },
  'friendship_formed': { category: 'social', amount: 40 },
  'rivalry_formed': { category: 'social', amount: 40 },
  'marriage': { category: 'social', amount: 200 },
  'trade_complete': { category: 'trading', amount: 12 },
  'casino_win': { category: 'gambling', amount: 16 },
  'casino_loss': { category: 'gambling', amount: 4 },
};

function calculateXPToNextLevel(level: number): number {
  return Math.floor(
    XP_CONFIG.BASE_XP_PER_LEVEL * Math.pow(XP_CONFIG.LEVEL_SCALING_FACTOR, level - 1)
  );
}

// Generate random avatar rarity based on deployment
export function generateAvatarRarity(): string {
  const roll = Math.random();
  if (roll < 0.5) return 'COMMON';        // 50%
  if (roll < 0.75) return 'UNCOMMON';     // 25%
  if (roll < 0.9) return 'RARE';          // 15%
  if (roll < 0.98) return 'EPIC';         // 8%
  return 'LEGENDARY';                      // 2%
}

// Generate initial stats based on avatar rarity and personality
export function generateInitialStats(rarity: string, personality: string) {
  const rarityConfig = AVATAR_RARITY[rarity as keyof typeof AVATAR_RARITY] || AVATAR_RARITY.COMMON;
  const personalityBias = PERSONALITY_STAT_BIAS[personality as keyof typeof PERSONALITY_STAT_BIAS] || PERSONALITY_STAT_BIAS.WORKER;
  
  const stats = {
    strength: 0,
    agility: 0,
    intelligence: 0,
    charisma: 0,
    luck: 0,
    defense: 0,
    stealth: 0,
  };
  
  // Generate base stats within rarity range
  Object.keys(stats).forEach(stat => {
    const baseValue = Math.floor(
      Math.random() * (rarityConfig.statRange.max - rarityConfig.statRange.min + 1) + 
      rarityConfig.statRange.min
    );
    
    // Apply personality bias if applicable
    const bias = personalityBias[stat as keyof typeof personalityBias] || 1.0;
    stats[stat as keyof typeof stats] = Math.floor(baseValue * bias);
  });
  
  // Add luck bonus from rarity
  stats.luck += rarityConfig.luckBonus;
  
  return stats;
}

// Calculate stat increases on level up based on rarity
export function calculateLevelUpStats(rarity: string, personality: string, level: number) {
  const rarityConfig = AVATAR_RARITY[rarity as keyof typeof AVATAR_RARITY] || AVATAR_RARITY.COMMON;
  const personalityBias = PERSONALITY_STAT_BIAS[personality as keyof typeof PERSONALITY_STAT_BIAS] || PERSONALITY_STAT_BIAS.WORKER;
  
  const statIncreases = {
    strength: 0,
    agility: 0,
    intelligence: 0,
    charisma: 0,
    luck: 0,
    defense: 0,
    stealth: 0,
  };
  
  // Distribute stat points based on rarity
  let pointsToDistribute = rarityConfig.statPoints;
  
  // Every 5 levels, get bonus points
  if (level % 5 === 0) {
    pointsToDistribute += Math.floor(rarityConfig.statPoints / 2);
  }
  
  // Weighted random distribution based on personality
  const statWeights = Object.entries(personalityBias);
  const totalWeight = statWeights.reduce((sum, [_, weight]) => sum + weight, 0);
  
  while (pointsToDistribute > 0) {
    const roll = Math.random() * totalWeight;
    let cumulative = 0;
    
    for (const [stat, weight] of statWeights) {
      cumulative += weight;
      if (roll <= cumulative) {
        statIncreases[stat as keyof typeof statIncreases]++;
        pointsToDistribute--;
        break;
      }
    }
  }
  
  // Guaranteed minimum increases for rarer avatars
  if (rarity === 'EPIC' || rarity === 'LEGENDARY') {
    Object.keys(statIncreases).forEach(stat => {
      statIncreases[stat as keyof typeof statIncreases] += 1;
    });
  }
  
  return statIncreases;
}

export const grantExperience = internalMutation({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
    aiArenaBotId: v.string(),
    activity: v.string(),
  },
  handler: async (ctx, args) => {
    const xpReward = XP_REWARDS[args.activity];
    if (!xpReward) {
      console.warn(`Unknown activity for XP: ${args.activity}`);
      return null;
    }

    // Get or create bot experience record
    let experience = await ctx.db
      .query('botExperience')
      .withIndex('aiArenaBotId', (q) => 
        q.eq('worldId', args.worldId).eq('aiArenaBotId', args.aiArenaBotId)
      )
      .first();

    if (!experience) {
      // Get agent to determine personality and rarity
      const agentDesc = await ctx.db
        .query('agentDescriptions')
        .withIndex('worldId', (q) => 
          q.eq('worldId', args.worldId).eq('agentId', args.playerId)
        )
        .first();
      
      const personality = agentDesc?.personality || 'WORKER';
      const avatarRarity = agentDesc?.avatarRarity || generateAvatarRarity();
      const initialStats = generateInitialStats(avatarRarity, personality);
      
      // Create new experience record with avatar rarity
      await ctx.db.insert('botExperience', {
        avatarRarity: avatarRarity as 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY',
        worldId: args.worldId,
        playerId: args.playerId,
        aiArenaBotId: args.aiArenaBotId,
        level: 1,
        currentXP: xpReward.amount,
        totalXP: xpReward.amount,
        xpToNextLevel: calculateXPToNextLevel(1),
        combatXP: xpReward.category === 'combat' ? xpReward.amount : 0,
        socialXP: xpReward.category === 'social' ? xpReward.amount : 0,
        criminalXP: xpReward.category === 'criminal' ? xpReward.amount : 0,
        gamblingXP: xpReward.category === 'gambling' ? xpReward.amount : 0,
        tradingXP: xpReward.category === 'trading' ? xpReward.amount : 0,
        prestigeLevel: 0,
        prestigeTokens: 0,
        skillPoints: 0,
        allocatedSkills: initialStats,
        lastXPGain: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return null;
    }

    // Calculate prestige multiplier
    const prestigeMultiplier = 1 + (experience.prestigeLevel * 0.2);
    const adjustedXP = Math.floor(xpReward.amount * prestigeMultiplier);

    // Update category XP
    const categoryUpdate: any = {};
    switch (xpReward.category) {
      case 'combat':
        categoryUpdate.combatXP = experience.combatXP + adjustedXP;
        break;
      case 'social':
        categoryUpdate.socialXP = experience.socialXP + adjustedXP;
        break;
      case 'criminal':
        categoryUpdate.criminalXP = experience.criminalXP + adjustedXP;
        break;
      case 'gambling':
        categoryUpdate.gamblingXP = experience.gamblingXP + adjustedXP;
        break;
      case 'trading':
        categoryUpdate.tradingXP = experience.tradingXP + adjustedXP;
        break;
    }

    // Apply rarity XP multiplier if available
    const avatarRarity = experience.avatarRarity || 'COMMON';
    const rarityMultiplierBonus = AVATAR_RARITY[avatarRarity as keyof typeof AVATAR_RARITY]?.xpMultiplier || 1.0;
    const finalAdjustedXP = Math.floor(adjustedXP * rarityMultiplierBonus);
    
    // Check for level up
    let newCurrentXP = experience.currentXP + finalAdjustedXP;
    let newTotalXP = experience.totalXP + finalAdjustedXP;
    let newLevel = experience.level;
    let skillPointsGained = 0;
    const unlocked: string[] = [];
    let leveledUp = false;
    let statIncreases: any = {};
    let energyGained = 0;
    let currentLevelXPNeeded = experience.xpToNextLevel;

    while (newCurrentXP >= currentLevelXPNeeded && newLevel < XP_CONFIG.MAX_LEVEL) {
      newCurrentXP -= currentLevelXPNeeded;
      newLevel++;
      skillPointsGained += XP_CONFIG.SKILL_POINTS_PER_LEVEL;
      energyGained += 2; // +2 max energy per level
      leveledUp = true;
      // Calculate XP needed for the next level
      currentLevelXPNeeded = calculateXPToNextLevel(newLevel);
      
      // Get agent to determine personality
      const agentDesc = await ctx.db
        .query('agentDescriptions')
        .withIndex('worldId', (q) => 
          q.eq('worldId', args.worldId).eq('agentId', args.playerId)
        )
        .first();
      
      const personality = agentDesc?.personality || 'WORKER';
      
      // Calculate and apply stat increases
      const levelStatIncreases = calculateLevelUpStats(avatarRarity, personality, newLevel);
      Object.entries(levelStatIncreases).forEach(([stat, increase]) => {
        statIncreases[stat] = (statIncreases[stat] || 0) + increase;
      });

      // Check for milestone unlocks
      if (newLevel === 10) unlocked.push('Advanced Equipment Slots');
      if (newLevel === 20) unlocked.push('House Expansion');
      if (newLevel === 30) unlocked.push('Elite Zone Access');
      if (newLevel === 40) unlocked.push('Gang Leadership');
      if (newLevel === 50) unlocked.push('Prestige System');
    }

    // Update allocated skills if leveled up
    let updatedSkills = experience.allocatedSkills || {};
    if (leveledUp && Object.keys(statIncreases).length > 0) {
      Object.entries(statIncreases).forEach(([stat, increase]) => {
        const key = stat as keyof typeof updatedSkills;
        updatedSkills[key] = (updatedSkills[key] || 0) + (increase as number);
      });
    }
    
    // Update experience record
    await ctx.db.patch(experience._id, {
      currentXP: newCurrentXP,
      totalXP: newTotalXP,
      ...categoryUpdate,
      level: newLevel,
      xpToNextLevel: calculateXPToNextLevel(newLevel),
      skillPoints: experience.skillPoints + skillPointsGained,
      allocatedSkills: updatedSkills,
      lastXPGain: Date.now(),
      lastLevelUp: leveledUp ? Date.now() : experience.lastLevelUp,
      updatedAt: Date.now(),
    });

    if (leveledUp) {
      // Update player's max energy in the world
      const world = await ctx.db.get(args.worldId);
      if (world) {
        const updatedPlayers = world.players.map((p: any) => {
          if (p.id === args.playerId) {
            const newMaxEnergy = (p.maxEnergy || 30) + energyGained;
            return {
              ...p,
              maxEnergy: newMaxEnergy,
              currentEnergy: p.currentEnergy + energyGained, // Also restore energy on level up
            };
          }
          return p;
        });
        await ctx.db.patch(args.worldId, { players: updatedPlayers });
      }
      
      // Log level up activity
      await ctx.db.insert('activityLogs', {
        worldId: args.worldId,
        playerId: args.playerId,
        aiArenaBotId: args.aiArenaBotId,
        timestamp: Date.now(),
        type: 'level_up',
        description: `Reached level ${newLevel} (${avatarRarity} avatar, +${energyGained} max energy)`,
        emoji: '⬆️',
        details: {
          newLevel,
          rarity: avatarRarity,
        },
      });
      
      return {
        newLevel,
        skillPointsGained,
        statIncreases,
        energyGained,
        unlocked,
        avatarRarity,
        prestigeEligible: newLevel >= XP_CONFIG.PRESTIGE_UNLOCK_LEVEL,
      };
    }

    return null;
  },
});

export const getBotExperience = query({
  args: {
    worldId: v.id('worlds'),
    aiArenaBotId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('botExperience')
      .withIndex('aiArenaBotId', (q) => 
        q.eq('worldId', args.worldId).eq('aiArenaBotId', args.aiArenaBotId)
      )
      .first();
  },
});

export const getExperienceLeaderboard = query({
  args: {
    worldId: v.id('worlds'),
    category: v.union(
      v.literal('level'),
      v.literal('totalXP'),
      v.literal('combat'),
      v.literal('social'),
      v.literal('criminal'),
      v.literal('gambling'),
      v.literal('trading'),
      v.literal('prestige')
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    
    // Get all experiences for this world
    const experiences = await ctx.db
      .query('botExperience')
      .withIndex('level', (q) => q.eq('worldId', args.worldId))
      .collect();

    // Sort by category
    let sorted = experiences;
    switch (args.category) {
      case 'level':
        sorted = experiences.sort((a, b) => b.level - a.level);
        break;
      case 'totalXP':
        sorted = experiences.sort((a, b) => b.totalXP - a.totalXP);
        break;
      case 'combat':
        sorted = experiences.sort((a, b) => b.combatXP - a.combatXP);
        break;
      case 'social':
        sorted = experiences.sort((a, b) => b.socialXP - a.socialXP);
        break;
      case 'criminal':
        sorted = experiences.sort((a, b) => b.criminalXP - a.criminalXP);
        break;
      case 'gambling':
        sorted = experiences.sort((a, b) => b.gamblingXP - a.gamblingXP);
        break;
      case 'trading':
        sorted = experiences.sort((a, b) => b.tradingXP - a.tradingXP);
        break;
      case 'prestige':
        sorted = experiences.sort((a, b) => b.prestigeLevel - a.prestigeLevel);
        break;
    }

    // Get top entries with player info
    const topEntries = sorted.slice(0, limit);
    const results = [];

    for (const exp of topEntries) {
      const playerDesc = await ctx.db
        .query('playerDescriptions')
        .withIndex('worldId', (q) => 
          q.eq('worldId', args.worldId).eq('playerId', exp.playerId)
        )
        .first();

      results.push({
        ...exp,
        playerName: playerDesc?.name || `Bot-${exp.playerId.slice(-4)}`,
      });
    }

    return results;
  },
});

// Calculate combat power based on level and skills
export function calculateCombatPower(experience: any): number {
  if (!experience) return 100;
  
  const skills = experience.allocatedSkills || {};
  const baseMultiplier = 1 + (experience.prestigeLevel || 0) * 0.1;
  const strengthBonus = (skills.strength || 0) * 0.05;
  const defenseBonus = (skills.defense || 0) * 0.05;
  
  return Math.floor(100 * baseMultiplier * (1 + strengthBonus + defenseBonus / 2));
}

// Calculate robbery success chance based on experience
export function calculateRobberySuccess(experience: any): number {
  if (!experience) return 0.3;
  
  const skills = experience.allocatedSkills || {};
  const baseChance = 0.3 + (experience.level || 1) * 0.01;
  const stealthBonus = (skills.stealth || 0) * 0.05;
  const luckBonus = (skills.luck || 0) * 0.05;
  const criminalExperience = Math.min((experience.criminalXP || 0) / 10000, 0.2);
  
  return Math.min(baseChance + stealthBonus + luckBonus / 2 + criminalExperience, 0.9);
}