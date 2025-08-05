import { v } from 'convex/values';
import { mutation } from '../_generated/server';
import { playerId } from './ids';

// Test mutation for creating lootboxes (DEVELOPMENT ONLY)
export const createTestLootbox = mutation({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
    aiArenaBotId: v.string(),
  },
  handler: async (ctx, args) => {
    // Random rarity
    const rarities = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const;
    const rarity = rarities[Math.floor(Math.random() * rarities.length)];
    
    // Generate rewards based on rarity
    const rewardCount = {
      'COMMON': 1,
      'UNCOMMON': 2,
      'RARE': 2,
      'EPIC': 3,
      'LEGENDARY': 4,
    }[rarity];
    
    const itemTypes = ['WEAPON', 'ARMOR', 'TOOL', 'ACCESSORY', 'FURNITURE'] as const;
    const rewards = [];
    
    for (let i = 0; i < rewardCount; i++) {
      const type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
      const baseStats = {
        'COMMON': { power: [5, 10], defense: [3, 7] },
        'UNCOMMON': { power: [10, 20], defense: [7, 15] },
        'RARE': { power: [20, 35], defense: [15, 25] },
        'EPIC': { power: [35, 50], defense: [25, 40] },
        'LEGENDARY': { power: [50, 100], defense: [40, 80] },
      }[rarity];
      
      const powerBonus = Math.floor(Math.random() * (baseStats.power[1] - baseStats.power[0]) + baseStats.power[0]);
      const defenseBonus = Math.floor(Math.random() * (baseStats.defense[1] - baseStats.defense[0]) + baseStats.defense[0]);
      
      const prefixes = {
        'WEAPON': ['Crimson', 'Shadow', 'Thunder', 'Venom', 'Fury'],
        'ARMOR': ['Obsidian', 'Steel', 'Diamond', 'Kevlar', 'Titanium'],
        'TOOL': ['Master', 'Expert', 'Pro', 'Elite', 'Supreme'],
        'ACCESSORY': ['Lucky', 'Blessed', 'Cursed', 'Ancient', 'Mystic'],
        'FURNITURE': ['Royal', 'Luxury', 'Antique', 'Modern', 'Classic'],
      }[type];
      
      const names = {
        'WEAPON': ['Blade', 'Gun', 'Bat', 'Knife', 'Brass Knuckles'],
        'ARMOR': ['Vest', 'Jacket', 'Suit', 'Shield', 'Helmet'],
        'TOOL': ['Lockpick', 'Scanner', 'Jammer', 'Decoder', 'Hacker'],
        'ACCESSORY': ['Ring', 'Chain', 'Watch', 'Pendant', 'Bracelet'],
        'FURNITURE': ['Safe', 'Desk', 'Chair', 'Lamp', 'Painting'],
      }[type];
      
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const name = names[Math.floor(Math.random() * names.length)];
      
      rewards.push({
        itemId: `test-${Date.now()}-${i}`,
        name: `${prefix} ${name}`,
        type,
        rarity,
        stats: {
          powerBonus: type === 'WEAPON' ? powerBonus : Math.floor(powerBonus * 0.3),
          defenseBonus: type === 'ARMOR' ? defenseBonus : Math.floor(defenseBonus * 0.3),
          scoreBonus: type === 'FURNITURE' ? Math.floor((powerBonus + defenseBonus) * 2) : 0,
        },
      });
    }
    
    // Create the lootbox
    const lootboxId = await ctx.db.insert('lootboxQueue', {
      worldId: args.worldId,
      playerId: args.playerId,
      aiArenaBotId: args.aiArenaBotId,
      lootboxId: `test-lootbox-${Date.now()}`,
      rarity,
      rewards,
      processed: false,
      createdAt: Date.now(),
    });
    
    // Log the creation
    await ctx.db.insert('activityLogs', {
      worldId: args.worldId,
      playerId: args.playerId,
      aiArenaBotId: args.aiArenaBotId,
      timestamp: Date.now(),
      type: 'item_collected',
      description: `Received ${rarity} test lootbox`,
      emoji: '🎁',
      details: {
        item: `${rarity} Test Lootbox`,
      },
    });
    
    return { success: true, lootboxId, rarity, rewardCount };
  },
});