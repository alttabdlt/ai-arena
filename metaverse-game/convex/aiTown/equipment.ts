import { v } from 'convex/values';
import { internalMutation, internalQuery, mutation, query } from '../_generated/server';
import { Id } from '../_generated/dataModel';
import { playerId } from './ids';
import { internal } from '../_generated/api';

// Equipment slot types
export type EquipmentSlot = 'SWORD' | 'GUN' | 'ARMOR' | 'BOOTS';

// Equipment stats interface
export interface EquipmentStats {
  powerBonus: number;
  defenseBonus: number;
  speedBonus: number;
  agilityBonus: number;
  rangeBonus: number;
}

// Get all equipped items for a player
export const getPlayerEquipment = internalQuery({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
  },
  handler: async (ctx, args) => {
    // Get all equipped items for this player
    // @ts-ignore - Type instantiation depth issue with Convex types
    const equippedItems = await ctx.db
      .query('items')
      .withIndex('equipped', (q: any) => 
        q.eq('worldId', args.worldId)
         .eq('ownerId', args.playerId)
         .eq('equipped', true)
      )
      .collect();
    
    // Organize by slot type
    const equipment: Record<EquipmentSlot, any> = {
      SWORD: null,
      GUN: null,
      ARMOR: null,
      BOOTS: null,
    };
    
    for (const item of equippedItems) {
      const slot = item.type as EquipmentSlot;
      if (slot in equipment) {
        equipment[slot] = item;
      }
    }
    
    return equipment;
  },
});

// Calculate total stats from all equipped items
export const calculateEquipmentStats = internalQuery({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
  },
  handler: async (ctx, args) => {
    const equipment = await ctx.runQuery(internal.aiTown.equipment.getPlayerEquipment, {
      worldId: args.worldId,
      playerId: args.playerId,
    });
    
    // Initialize stats
    const stats: EquipmentStats = {
      powerBonus: 0,
      defenseBonus: 0,
      speedBonus: 0,
      agilityBonus: 0,
      rangeBonus: 0,
    };
    
    // Sum up stats from all equipped items
    for (const item of Object.values(equipment)) {
      if (item) {
        stats.powerBonus += (item as any).powerBonus || 0;
        stats.defenseBonus += (item as any).defenseBonus || 0;
        stats.speedBonus += (item as any).speedBonus || 0;
        stats.agilityBonus += (item as any).agilityBonus || 0;
        stats.rangeBonus += (item as any).rangeBonus || 0;
      }
    }
    
    return stats;
  },
});

// Equip an item to a specific slot
export const equipItem = internalMutation({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
    itemId: v.id('items'),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error('Item not found');
    }
    
    if (item.ownerId !== args.playerId) {
      throw new Error('Item does not belong to this player');
    }
    
    // Consumables cannot be equipped
    if (item.type === 'POTION' || item.consumable) {
      throw new Error('Consumable items cannot be equipped');
    }
    
    // Check if this is an equippable type
    const equipSlots: EquipmentSlot[] = ['SWORD', 'GUN', 'ARMOR', 'BOOTS'];
    const itemSlot = item.type as EquipmentSlot;
    
    if (!equipSlots.includes(itemSlot)) {
      throw new Error(`Item type ${item.type} cannot be equipped`);
    }
    
    // Unequip any item currently in this slot
    // @ts-ignore - Type instantiation depth issue with Convex types
    const currentlyEquipped = await ctx.db
      .query('items')
      .withIndex('equipped', (q: any) => 
        q.eq('worldId', args.worldId)
         .eq('ownerId', args.playerId)
         .eq('equipped', true)
      )
      .filter((q: any) => q.eq(q.field('type'), item.type))
      .first();
    
    if (currentlyEquipped) {
      await ctx.db.patch(currentlyEquipped._id, { equipped: false });
    }
    
    // Equip the new item
    await ctx.db.patch(args.itemId, { equipped: true });
    
    // Update player equipment stats
    await ctx.scheduler.runAfter(0, internal.aiTown.equipment.updatePlayerStats, {
      worldId: args.worldId,
      playerId: args.playerId,
    });
    
    return {
      success: true,
      slot: itemSlot,
      item: item.name,
      unequipped: currentlyEquipped?.name || null,
    };
  },
});

// Unequip an item
export const unequipItem = internalMutation({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
    itemId: v.id('items'),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error('Item not found');
    }
    
    if (item.ownerId !== args.playerId) {
      throw new Error('Item does not belong to this player');
    }
    
    if (!item.equipped) {
      throw new Error('Item is not equipped');
    }
    
    // Unequip the item
    await ctx.db.patch(args.itemId, { equipped: false });
    
    // Update player equipment stats
    await ctx.scheduler.runAfter(0, internal.aiTown.equipment.updatePlayerStats, {
      worldId: args.worldId,
      playerId: args.playerId,
    });
    
    return {
      success: true,
      slot: item.type,
      item: item.name,
    };
  },
});

// Unequip item by slot type
export const unequipSlot = internalMutation({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
    slot: v.union(
      v.literal('SWORD'),
      v.literal('GUN'),
      v.literal('ARMOR'),
      v.literal('BOOTS')
    ),
  },
  handler: async (ctx, args) => {
    // Find equipped item in this slot
    // @ts-ignore - Type instantiation depth issue with Convex types
    const equippedItem = await ctx.db
      .query('items')
      .withIndex('equipped', (q: any) => 
        q.eq('worldId', args.worldId)
         .eq('ownerId', args.playerId)
         .eq('equipped', true)
      )
      .filter((q: any) => q.eq(q.field('type'), args.slot))
      .first();
    
    if (!equippedItem) {
      return {
        success: false,
        message: `No item equipped in ${args.slot} slot`,
      };
    }
    
    // Unequip the item
    await ctx.db.patch(equippedItem._id, { equipped: false });
    
    // Update player equipment stats
    await ctx.scheduler.runAfter(0, internal.aiTown.equipment.updatePlayerStats, {
      worldId: args.worldId,
      playerId: args.playerId,
    });
    
    return {
      success: true,
      slot: args.slot,
      item: equippedItem.name,
    };
  },
});

// Auto-equip best items for a player
export const autoEquipBestItems = internalMutation({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
  },
  handler: async (ctx, args) => {
    // Get all items owned by player
    // @ts-ignore - Type instantiation depth issue with Convex types
    const allItems = await ctx.db
      .query('items')
      .withIndex('owner', (q: any) => 
        q.eq('worldId', args.worldId)
         .eq('ownerId', args.playerId)
      )
      .collect();
    
    // Group items by slot type
    const itemsBySlot: Record<EquipmentSlot, any[]> = {
      SWORD: [],
      GUN: [],
      ARMOR: [],
      BOOTS: [],
    };
    
    for (const item of allItems) {
      if (item.type in itemsBySlot && !item.consumable) {
        itemsBySlot[item.type as EquipmentSlot].push(item);
      }
    }
    
    const equipped: any[] = [];
    
    // For each slot, equip the best item
    for (const [slot, items] of Object.entries(itemsBySlot)) {
      if (items.length === 0) continue;
      
      // Sort by value (higher is better)
      items.sort((a, b) => {
        // Calculate total value based on stats
        const aValue = (a.powerBonus || 0) * 2 + 
                      (a.defenseBonus || 0) * 2 + 
                      (a.speedBonus || 0) * 3 + 
                      (a.agilityBonus || 0) * 2 +
                      (a.rangeBonus || 0) * 2 +
                      (a.value || 0);
        const bValue = (b.powerBonus || 0) * 2 + 
                      (b.defenseBonus || 0) * 2 + 
                      (b.speedBonus || 0) * 3 + 
                      (b.agilityBonus || 0) * 2 +
                      (b.rangeBonus || 0) * 2 +
                      (b.value || 0);
        return bValue - aValue;
      });
      
      // Equip the best item
      const bestItem = items[0];
      
      // Unequip all other items in this slot
      for (const item of items) {
        if (item.equipped && item._id !== bestItem._id) {
          await ctx.db.patch(item._id, { equipped: false });
        }
      }
      
      // Equip the best item
      if (!bestItem.equipped) {
        await ctx.db.patch(bestItem._id, { equipped: true });
        equipped.push({
          slot,
          name: bestItem.name,
          rarity: bestItem.rarity,
        });
      }
    }
    
    // Update player equipment stats
    await ctx.scheduler.runAfter(0, internal.aiTown.equipment.updatePlayerStats, {
      worldId: args.worldId,
      playerId: args.playerId,
    });
    
    return {
      success: true,
      equipped,
    };
  },
});

// Update player's cached equipment stats
export const updatePlayerStats = internalMutation({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
  },
  handler: async (ctx, args) => {
    // Calculate total stats from equipped items
    const stats: any = await ctx.runQuery(internal.aiTown.equipment.calculateEquipmentStats, {
      worldId: args.worldId,
      playerId: args.playerId,
    });
    
    // Get the world and update player's equipment stats
    const world = await ctx.db.get(args.worldId);
    if (!world) return;
    
    const playerIndex = world.players.findIndex(p => p.id === args.playerId);
    if (playerIndex === -1) return;
    
    // Update the player's equipment stats
    world.players[playerIndex].equipment = {
      powerBonus: stats.powerBonus,
      defenseBonus: stats.defenseBonus,
    };
    
    // Save the updated world
    await ctx.db.patch(args.worldId, {
      players: world.players,
    });
    
    // Log equipment change
    await ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
      worldId: args.worldId,
      playerId: args.playerId,
      type: 'trade',
      description: `Updated equipment: +${stats.powerBonus} power, +${stats.defenseBonus} defense, +${stats.speedBonus} speed`,
      emoji: '⚔️',
      details: {
        message: 'Equipment stats updated',
      },
    });
    
    return stats;
  },
});

// Public query to get player's equipment
export const getPlayerEquipmentPublic = query({
  args: {
    worldId: v.optional(v.id('worlds')),
    playerId: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    // Get default world if not specified
    let worldId = args.worldId;
    if (!worldId) {
      const worldStatus = await ctx.db
        .query('worldStatus')
        .filter((q) => q.eq(q.field('isDefault'), true))
        .first();
      
      if (!worldStatus) {
        throw new Error('No default world found');
      }
      worldId = worldStatus.worldId;
    }
    
    return await ctx.runQuery(internal.aiTown.equipment.getPlayerEquipment, {
      worldId,
      playerId: args.playerId as any,
    });
  },
});

// Public mutation to equip item
export const equipItemPublic = mutation({
  args: {
    worldId: v.optional(v.id('worlds')),
    playerId: v.string(),
    itemId: v.id('items'),
  },
  handler: async (ctx, args): Promise<any> => {
    // Get default world if not specified
    let worldId = args.worldId;
    if (!worldId) {
      const worldStatus = await ctx.db
        .query('worldStatus')
        .filter((q) => q.eq(q.field('isDefault'), true))
        .first();
      
      if (!worldStatus) {
        throw new Error('No default world found');
      }
      worldId = worldStatus.worldId;
    }
    
    return await ctx.runMutation(internal.aiTown.equipment.equipItem, {
      worldId,
      playerId: args.playerId as any,
      itemId: args.itemId,
    });
  },
});