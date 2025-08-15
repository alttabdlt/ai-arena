import { v } from 'convex/values';
import { internalMutation, mutation, query } from '../_generated/server';
import { Id } from '../_generated/dataModel';
import { playerId } from './ids';
import { internal } from '../_generated/api';
import { insertInput } from './insertInput';

// Consume a potion to restore energy
export const consumeEnergyPotion = mutation({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
    itemId: v.id('items'),
  },
  handler: async (ctx, args) => {
    // Get the item
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      return { success: false, message: 'Item not found' };
    }
    
    // Verify ownership
    if (item.ownerId !== args.playerId) {
      return { success: false, message: 'You do not own this item' };
    }
    
    // Check if it's a potion
    if (item.type !== 'POTION') {
      return { success: false, message: 'This item is not a potion' };
    }
    
    // Check if it's an energy potion
    if (!item.healingPower || item.healingPower < 0) {
      // Energy potions are stored with energyRestore field in our item data
      // but in the schema they might be using healingPower as a general field
      // Let's check for any energy-related properties
      const hasEnergyRestore = item.speedBonus || item.powerBonus || item.defenseBonus;
      if (!hasEnergyRestore && !item.healingPower) {
        return { success: false, message: 'This potion does not restore energy' };
      }
    }
    
    // Get the world to access player data
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      return { success: false, message: 'World not found' };
    }
    
    // Find the player
    const playerIndex = world.players.findIndex(p => p.id === args.playerId);
    if (playerIndex === -1) {
      return { success: false, message: 'Player not found' };
    }
    
    const player = world.players[playerIndex];
    
    // Calculate energy to restore
    // Use healingPower as base, or calculate from other stats
    let energyToRestore = 0;
    if (item.healingPower && item.healingPower > 0) {
      // Convert healing power to energy (1:1 ratio for simplicity)
      energyToRestore = Math.min(item.healingPower, 30); // Cap at max energy
    } else {
      // For buff potions, restore a fixed amount based on rarity
      const rarityEnergy = {
        'COMMON': 5,
        'UNCOMMON': 10,
        'RARE': 15,
        'EPIC': 20,
        'LEGENDARY': 25,
        'GOD_TIER': 30,
      };
      energyToRestore = rarityEnergy[item.rarity as keyof typeof rarityEnergy] || 10;
    }
    
    // Update player's energy
    const currentEnergy = player.currentEnergy || 30;
    const maxEnergy = player.maxEnergy || 30;
    const newEnergy = Math.min(currentEnergy + energyToRestore, maxEnergy);
    const actualRestored = newEnergy - currentEnergy;
    
    // Update the player's energy in the world
    world.players[playerIndex].currentEnergy = newEnergy;
    world.players[playerIndex].lastEnergyRegen = Date.now();
    
    // Save the updated world
    await ctx.db.patch(args.worldId, {
      players: world.players,
    });
    
    // Handle consumable logic
    if (item.consumable) {
      const currentQuantity = item.quantity || 1;
      
      if (currentQuantity > 1) {
        // Reduce quantity by 1
        await ctx.db.patch(args.itemId, {
          quantity: currentQuantity - 1,
        });
      } else {
        // Delete the item if it's the last one
        await ctx.db.delete(args.itemId);
        
        // Update inventory slot count
        const inventory = await ctx.db
          .query('inventories')
          .withIndex('player', (q: any) => 
            q.eq('worldId', args.worldId).eq('playerId', args.playerId)
          )
          .first();
        
        if (inventory) {
          await ctx.db.patch(inventory._id, {
            usedSlots: Math.max(0, inventory.usedSlots - 1),
            lastUpdated: Date.now(),
          });
        }
      }
    } else {
      // Non-consumable potions shouldn't exist, but handle it anyway
      await ctx.db.delete(args.itemId);
    }
    
    // Log the consumption
    await ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
      worldId: args.worldId,
      playerId: args.playerId,
      type: 'item_collected', // Using existing type
      description: `Consumed ${item.name} and restored ${actualRestored} energy`,
      emoji: '🧪',
      details: {
        item: item.name,
        amount: actualRestored,
      },
    });
    
    return {
      success: true,
      energyRestored: actualRestored,
      newEnergy: newEnergy,
      maxEnergy: maxEnergy,
      message: `Consumed ${item.name} and restored ${actualRestored} energy`,
    };
  },
});

// Consume a potion for temporary buffs (power, defense, speed)
export const consumeBuffPotion = mutation({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
    itemId: v.id('items'),
  },
  handler: async (ctx, args) => {
    // Get the item
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      return { success: false, message: 'Item not found' };
    }
    
    // Verify ownership
    if (item.ownerId !== args.playerId) {
      return { success: false, message: 'You do not own this item' };
    }
    
    // Check if it's a potion
    if (item.type !== 'POTION') {
      return { success: false, message: 'This item is not a potion' };
    }
    
    // Check if it has buff effects
    const hasBuff = item.speedBonus || item.powerBonus || item.defenseBonus || item.agilityBonus;
    if (!hasBuff) {
      return { success: false, message: 'This potion does not provide buffs' };
    }
    
    // Get the world to access player data
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      return { success: false, message: 'World not found' };
    }
    
    // Find the player
    const playerIndex = world.players.findIndex(p => p.id === args.playerId);
    if (playerIndex === -1) {
      return { success: false, message: 'Player not found' };
    }
    
    // Apply temporary buffs as an activity
    const duration = item.duration || 60; // Default 60 seconds
    const buffDescription = [];
    
    if (item.powerBonus) buffDescription.push(`+${item.powerBonus} power`);
    if (item.defenseBonus) buffDescription.push(`+${item.defenseBonus} defense`);
    if (item.speedBonus) buffDescription.push(`+${item.speedBonus}% speed`);
    if (item.agilityBonus) buffDescription.push(`+${item.agilityBonus} agility`);
    
    const activity = {
      description: `Buffed: ${buffDescription.join(', ')}`,
      emoji: '💪',
      until: Date.now() + (duration * 1000),
    };
    
    // Set the activity on the player
    world.players[playerIndex].activity = activity;
    
    // Also apply immediate stat boosts to equipment
    // Note: These are temporary and should be tracked separately in production
    const currentEquipment = world.players[playerIndex].equipment || { powerBonus: 0, defenseBonus: 0 };
    world.players[playerIndex].equipment = {
      powerBonus: currentEquipment.powerBonus + (item.powerBonus || 0),
      defenseBonus: currentEquipment.defenseBonus + (item.defenseBonus || 0),
    };
    
    // Save the updated world
    await ctx.db.patch(args.worldId, {
      players: world.players,
    });
    
    // Handle consumable logic
    const currentQuantity = item.quantity || 1;
    
    if (currentQuantity > 1) {
      // Reduce quantity by 1
      await ctx.db.patch(args.itemId, {
        quantity: currentQuantity - 1,
      });
    } else {
      // Delete the item if it's the last one
      await ctx.db.delete(args.itemId);
      
      // Update inventory slot count
      const inventory = await ctx.db
        .query('inventories')
        .withIndex('player', (q: any) => 
          q.eq('worldId', args.worldId).eq('playerId', args.playerId)
        )
        .first();
      
      if (inventory) {
        await ctx.db.patch(inventory._id, {
          usedSlots: Math.max(0, inventory.usedSlots - 1),
          lastUpdated: Date.now(),
        });
      }
    }
    
    // Log the consumption
    await ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
      worldId: args.worldId,
      playerId: args.playerId,
      type: 'activity_start',
      description: `Consumed ${item.name} for ${duration} second buff`,
      emoji: '🧪',
      details: {
        item: item.name,
      },
    });
    
    // Schedule buff expiration
    await ctx.scheduler.runAfter(duration * 1000, internal.aiTown.potions.expireBuffs, {
      worldId: args.worldId,
      playerId: args.playerId,
      powerBonus: item.powerBonus || 0,
      defenseBonus: item.defenseBonus || 0,
    });
    
    return {
      success: true,
      buffs: buffDescription.join(', '),
      duration: duration,
      message: `Consumed ${item.name} - buffs active for ${duration} seconds`,
    };
  },
});

// Internal mutation to expire buffs
export const expireBuffs = internalMutation({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
    powerBonus: v.number(),
    defenseBonus: v.number(),
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) return;
    
    const playerIndex = world.players.findIndex(p => p.id === args.playerId);
    if (playerIndex === -1) return;
    
    // Remove the temporary buff bonuses
    const currentEquipment = world.players[playerIndex].equipment || { powerBonus: 0, defenseBonus: 0 };
    world.players[playerIndex].equipment = {
      powerBonus: Math.max(0, currentEquipment.powerBonus - args.powerBonus),
      defenseBonus: Math.max(0, currentEquipment.defenseBonus - args.defenseBonus),
    };
    
    // Clear activity if it's still the buff
    if (world.players[playerIndex].activity?.description?.startsWith('Buffed:')) {
      delete world.players[playerIndex].activity;
    }
    
    // Save the updated world
    await ctx.db.patch(args.worldId, {
      players: world.players,
    });
    
    // Recalculate actual equipment stats from equipped items
    await ctx.scheduler.runAfter(0, internal.aiTown.equipment.updatePlayerStats, {
      worldId: args.worldId,
      playerId: args.playerId,
    });
    
    // Log buff expiration
    await ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
      worldId: args.worldId,
      playerId: args.playerId,
      type: 'activity_end',
      description: 'Potion buffs expired',
      emoji: '⏰',
    });
  },
});

// Query to get consumable potions for a player
export const getPlayerPotions = query({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
  },
  handler: async (ctx, args) => {
    const potions = await ctx.db
      .query('items')
      .withIndex('owner', (q: any) => 
        q.eq('worldId', args.worldId).eq('ownerId', args.playerId)
      )
      .filter((q: any) => q.eq(q.field('type'), 'POTION'))
      .collect();
    
    // Categorize potions
    const energyPotions = potions.filter(p => 
      (p.healingPower && p.healingPower > 0) || p.name.toLowerCase().includes('energy')
    );
    
    const buffPotions = potions.filter(p => 
      p.speedBonus || p.powerBonus || p.defenseBonus || p.agilityBonus
    );
    
    const poisonPotions = potions.filter(p => 
      p.healingPower && p.healingPower < 0
    );
    
    return {
      all: potions,
      energy: energyPotions,
      buffs: buffPotions,
      poison: poisonPotions,
      total: potions.length,
    };
  },
});