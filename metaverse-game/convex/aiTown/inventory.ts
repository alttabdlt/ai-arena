import { v } from 'convex/values';
import { internalMutation, internalQuery, mutation, query } from '../_generated/server';
import { playerId } from './ids';
import { insertInput } from './insertInput';
import { internal } from '../_generated/api';

// Internal function to process lootbox
async function processLootboxFromQueueInternal(ctx: any, args: { worldId: any, lootboxQueueId: any }) {
    const lootboxEntry = await ctx.db.get(args.lootboxQueueId);
    if (!lootboxEntry || lootboxEntry.processed) {
      return { success: false, message: 'Lootbox already processed or not found' };
    }
    
    // Get player inventory
    const inventory = await ctx.db
      .query('inventories')
      .withIndex('player', (q: any) => q.eq('worldId', args.worldId).eq('playerId', lootboxEntry.playerId))
      .first();
      
    if (!inventory) {
      return { success: false, message: 'Player inventory not found' };
    }
    
    // Check if we have space
    const itemsToAdd = lootboxEntry.rewards.length;
    if (inventory.usedSlots + itemsToAdd > inventory.maxSlots) {
      return { success: false, message: 'Not enough inventory space' };
    }
    
    // Create items from rewards
    const createdItems = [];
    let totalValue = 0;
    
    for (const reward of lootboxEntry.rewards) {
      // Types should already be correctly mapped from backend
      // SWORD, GUN, ARMOR, BOOTS, POTION, TOOL, ACCESSORY, FURNITURE
      let mappedType = reward.type;
      
      // Only remap ACCESSORY to BOOTS if it's footwear
      if (reward.type === 'ACCESSORY' && 
          (reward.name.toLowerCase().includes('boot') || 
           reward.name.toLowerCase().includes('shoe') ||
           reward.stats.speedBonus > 0 || reward.stats.agilityBonus > 0)) {
        mappedType = 'BOOTS';
      }
      // All other types stay as-is
      
      const rarityMap = {
        'COMMON': 1,
        'UNCOMMON': 2,
        'RARE': 5,
        'EPIC': 10,
        'LEGENDARY': 25,
        'GOD_TIER': 100,
      };
      const rarityMultiplier = rarityMap[reward.rarity as keyof typeof rarityMap] || 1;
      
      const itemValue = (reward.stats.powerBonus + reward.stats.defenseBonus + (reward.stats.scoreBonus || 0)) * rarityMultiplier * 10;
      totalValue += itemValue;
      
      const itemId = await ctx.db.insert('items', {
        worldId: args.worldId,
        ownerId: lootboxEntry.playerId,
        itemId: reward.itemId,
        name: reward.name,
        type: mappedType as any,
        category: mappedType === 'FURNITURE' ? 'DECORATION' : undefined,
        rarity: reward.rarity as any,
        powerBonus: reward.stats.powerBonus || 0,
        defenseBonus: reward.stats.defenseBonus || 0,
        speedBonus: reward.stats.speedBonus || 0,
        agilityBonus: reward.stats.agilityBonus || 0,
        rangeBonus: reward.stats.rangeBonus || 0,
        healingPower: reward.stats.healingPower || 0,
        duration: reward.duration || undefined,
        scoreBonus: reward.stats.scoreBonus,
        // Handle consumables (potions)
        consumable: mappedType === 'POTION' || reward.consumable,
        quantity: reward.quantity || (mappedType === 'POTION' ? 1 : undefined),
        uses: reward.uses || (mappedType === 'POTION' ? 1 : undefined),
        maxUses: reward.maxUses || (mappedType === 'POTION' ? 1 : undefined),
        equipped: false,
        metadata: {
          description: `A ${reward.rarity.toLowerCase()} ${reward.name.toLowerCase()}`,
          tradeable: true,
          condition: 100,
          specialEffect: mappedType === 'POTION' ? 'Consumable on use' : undefined,
        },
        createdAt: Date.now(),
      });
      
      createdItems.push(itemId);
    }
    
    // Update inventory stats
    await ctx.db.patch(inventory._id, {
      usedSlots: inventory.usedSlots + itemsToAdd,
      totalValue: inventory.totalValue + totalValue,
      lastUpdated: Date.now(),
    });
    
    // Mark lootbox as processed
    await ctx.db.patch(args.lootboxQueueId, {
      processed: true,
      openedAt: Date.now(),
    });
    
    // Log the opening
    await ctx.db.insert('activityLogs', {
      worldId: args.worldId,
      playerId: lootboxEntry.playerId,
      aiArenaBotId: lootboxEntry.aiArenaBotId,
      timestamp: Date.now(),
      type: 'item_collected',
      description: `Opened ${lootboxEntry.rarity} lootbox containing ${itemsToAdd} items`,
      emoji: '🎁',
      details: {
        item: `${lootboxEntry.rarity} Lootbox`,
        amount: itemsToAdd,
      },
    });
    
    return { success: true, itemsCreated: createdItems.length, totalValue };
}

// Process lootbox from queue (exposed as public mutation for UI)
export const processLootboxFromQueue = mutation({
  args: {
    worldId: v.id('worlds'),
    lootboxQueueId: v.id('lootboxQueue'),
  },
  handler: async (ctx, args) => {
    return await processLootboxFromQueueInternal(ctx, args);
  },
});

// Equip an item (exposed as public mutation for UI) - delegates to equipment module
export const equipItem = mutation({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
    itemId: v.id('items'),
  },
  handler: async (ctx, args): Promise<any> => {
    // Use the new multi-slot equipment system
    const result: any = await ctx.runMutation(internal.aiTown.equipment.equipItem, {
      worldId: args.worldId,
      playerId: args.playerId,
      itemId: args.itemId,
    });
    
    if (result.success) {
      // Calculate new total equipment bonuses with all slots
      const equipmentStats: any = await ctx.runQuery(internal.aiTown.equipment.calculateEquipmentStats, {
        worldId: args.worldId,
        playerId: args.playerId,
      });
      
      // Update player equipment stats through the input system
      await insertInput(ctx, args.worldId, 'updatePlayerEquipment', {
        playerId: args.playerId as any, // Cast to handle type mismatch
        timestamp: Date.now(),
        powerBonus: equipmentStats.powerBonus,
        defenseBonus: equipmentStats.defenseBonus,
      });
      
      return { 
        success: true, 
        slot: result.slot,
        equipped: result.item,
        unequipped: result.unequipped,
        newStats: equipmentStats 
      };
    }
    
    return { success: false, message: 'Failed to equip item' };
  },
});

// Calculate total equipment bonuses for a player (exposed as public query for UI)
export const calculatePlayerEquipment = query({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
  },
  handler: async (ctx, args): Promise<any> => {
    // Use the new equipment module for multi-slot calculations
    const stats = await ctx.runQuery(internal.aiTown.equipment.calculateEquipmentStats, {
      worldId: args.worldId,
      playerId: args.playerId,
    });
    
    return {
      powerBonus: stats.powerBonus,
      defenseBonus: stats.defenseBonus,
      speedBonus: stats.speedBonus,
      agilityBonus: stats.agilityBonus,
      rangeBonus: stats.rangeBonus,
    };
  },
});

// Internal version for server-side usage
export const calculatePlayerEquipmentInternal = internalQuery({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
  },
  handler: async (ctx, args): Promise<any> => {
    // Use the new equipment module for multi-slot calculations
    const stats = await ctx.runQuery(internal.aiTown.equipment.calculateEquipmentStats, {
      worldId: args.worldId,
      playerId: args.playerId,
    });
    
    return {
      powerBonus: stats.powerBonus,
      defenseBonus: stats.defenseBonus,
      speedBonus: stats.speedBonus,
      agilityBonus: stats.agilityBonus,
      rangeBonus: stats.rangeBonus,
    };
  },
});

// Place furniture in house
// TEMPORARILY DISABLED: placeFurniture uses houses table which has been removed
// Will be re-enabled when houses are properly implemented
/*
export const placeFurniture = internalMutation({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
    itemId: v.id('items'),
    houseId: v.id('houses'),
    position: v.object({
      x: v.number(),
      y: v.number(),
      rotation: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item || item.ownerId !== args.playerId || item.type !== 'FURNITURE') {
      return { success: false, message: 'Invalid furniture item' };
    }
    
    const house = await ctx.db.get(args.houseId);
    if (!house || house.ownerId !== args.playerId) {
      return { success: false, message: 'House not found or not owned by player' };
    }
    
    // Update item placement
    await ctx.db.patch(args.itemId, {
      houseId: args.houseId,
      position: args.position,
      equipped: false, // Can't be equipped if placed
    });
    
    // Recalculate house score
    const allFurniture = await ctx.db
      .query('items')
      .withIndex('house', q => q.eq('worldId', args.worldId).eq('houseId', args.houseId))
      .collect();
      
    let totalScore = 100; // Base score
    let totalDefense = 1; // Base defense
    
    for (const furniture of allFurniture) {
      totalScore += furniture.scoreBonus || 0;
      totalDefense += furniture.defenseBonus;
    }
    
    // Update house stats
    await ctx.db.patch(args.houseId, {
      houseScore: totalScore,
      defenseLevel: totalDefense,
      updatedAt: Date.now(),
    });
    
    return { success: true, newScore: totalScore, newDefense: totalDefense };
  },
});
*/

// Get player inventory (exposed as public query for UI)
export const getPlayerInventory = query({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
  },
  handler: async (ctx, args) => {
    const inventory = await ctx.db
      .query('inventories')
      .withIndex('player', q => q.eq('worldId', args.worldId).eq('playerId', args.playerId))
      .first();
      
    if (!inventory) {
      return { items: [], inventory: null };
    }
    
    const items = await ctx.db
      .query('items')
      .withIndex('owner', q => q.eq('worldId', args.worldId).eq('ownerId', args.playerId))
      .collect();
      
    return { items, inventory };
  },
});

// Internal version for server-side usage
export const getPlayerInventoryInternal = internalQuery({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
  },
  handler: async (ctx, args) => {
    const inventory = await ctx.db
      .query('inventories')
      .withIndex('player', q => q.eq('worldId', args.worldId).eq('playerId', args.playerId))
      .first();
      
    if (!inventory) {
      return { items: [], inventory: null };
    }
    
    const items = await ctx.db
      .query('items')
      .withIndex('owner', q => q.eq('worldId', args.worldId).eq('ownerId', args.playerId))
      .collect();
      
    return { items, inventory };
  },
});

// Process all pending lootboxes for a player
export const processPendingLootboxes = internalMutation({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
  },
  handler: async (ctx, args) => {
    const pendingLootboxes = await ctx.db
      .query('lootboxQueue')
      .withIndex('player', q => 
        q.eq('worldId', args.worldId)
          .eq('playerId', args.playerId)
          .eq('processed', false)
      )
      .collect();
      
    let processedCount = 0;
    let totalItemsCreated = 0;
    
    for (const lootbox of pendingLootboxes) {
      const result = await processLootboxFromQueueInternal(ctx, {
        worldId: args.worldId,
        lootboxQueueId: lootbox._id,
      });
      
      if (result.success && result.itemsCreated) {
        processedCount++;
        totalItemsCreated += result.itemsCreated;
      }
    }
    
    return { processedCount, totalItemsCreated };
  },
});

// Get pending lootboxes for a player (exposed as query for UI)
export const getPendingLootboxes = query({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
  },
  handler: async (ctx, args) => {
    const pendingLootboxes = await ctx.db
      .query('lootboxQueue')
      .withIndex('player', q => 
        q.eq('worldId', args.worldId)
          .eq('playerId', args.playerId)
          .eq('processed', false)
      )
      .collect();
      
    return pendingLootboxes;
  },
});