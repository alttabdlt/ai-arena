// Export all item types
export * from './swords';
export * from './guns';
export * from './boots';
export * from './armor';
export * from './potions';

// Import all items for consolidated access
import { SWORDS, SwordItem } from './swords';
import { GUNS, GunItem } from './guns';
import { BOOTS, BootsItem } from './boots';
import { ARMOR, ArmorItem } from './armor';
import { POTIONS, PotionItem } from './potions';

// Union type for all items
export type GameItem = SwordItem | GunItem | BootsItem | ArmorItem | PotionItem;

// Combined item pool
export const ALL_ITEMS: GameItem[] = [
  ...SWORDS,
  ...GUNS,
  ...BOOTS,
  ...ARMOR,
  ...POTIONS,
];

// Rarity weights for random generation
export const RARITY_WEIGHTS = {
  COMMON: 50,      // 50% chance
  UNCOMMON: 30,    // 30% chance  
  RARE: 15,        // 15% chance
  EPIC: 4,         // 4% chance
  LEGENDARY: 0.9,  // 0.9% chance
  GOD_TIER: 0.1,   // 0.1% chance
};

// Zone-specific item preferences
export const ZONE_ITEM_PREFERENCES = {
  casino: {
    types: ['GUN', 'POTION'],
    rarityBonus: { RARE: 5, EPIC: 2 }, // Higher chance of rare items
    preferredItems: ['gun_desert_eagle', 'potion_speed_standard', 'gun_golden_plasma'],
  },
  darkAlley: {
    types: ['SWORD', 'GUN', 'POTION'],
    rarityBonus: { COMMON: -10, UNCOMMON: 5 }, // More uncommon, less common
    preferredItems: ['sword_rusty_iron', 'gun_revolver_basic', 'potion_poison_weak'],
  },
  suburb: {
    types: ['ARMOR', 'BOOTS', 'POTION'],
    rarityBonus: {}, // Standard rarity
    preferredItems: ['armor_leather_basic', 'boots_traveler', 'potion_health_small'],
  },
  downtown: {
    types: ['BOOTS', 'ARMOR', 'GUN'],
    rarityBonus: { UNCOMMON: 5 },
    preferredItems: ['boots_runner_blue', 'armor_tactical_cyan', 'gun_smg_basic'],
  },
  underground: {
    types: ['SWORD', 'ARMOR', 'POTION'],
    rarityBonus: { EPIC: 3, LEGENDARY: 1 }, // Fighting zone, better loot
    preferredItems: ['sword_steel', 'armor_knight_steel', 'potion_strength_standard'],
  },
};

// Get random rarity based on weights
export function rollRarity(zoneBonus?: Record<string, number>): string {
  const weights = { ...RARITY_WEIGHTS };
  
  // Apply zone bonuses if provided
  if (zoneBonus) {
    for (const [rarity, bonus] of Object.entries(zoneBonus)) {
      if (weights[rarity as keyof typeof weights]) {
        weights[rarity as keyof typeof weights] += bonus;
      }
    }
  }
  
  // Calculate total weight
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  const roll = Math.random() * totalWeight;
  
  let cumulative = 0;
  for (const [rarity, weight] of Object.entries(weights)) {
    cumulative += weight;
    if (roll <= cumulative) {
      return rarity;
    }
  }
  
  return 'COMMON'; // Fallback
}

// Get random item for a specific zone
export function getRandomItemForZone(zone: string, forceRarity?: string): GameItem | undefined {
  const prefs = ZONE_ITEM_PREFERENCES[zone as keyof typeof ZONE_ITEM_PREFERENCES];
  if (!prefs) {
    // No preference, return any item
    const rarity = forceRarity || rollRarity();
    const filtered = ALL_ITEMS.filter(item => item.rarity === rarity);
    return filtered[Math.floor(Math.random() * filtered.length)];
  }
  
  // Determine rarity
  const rarity = forceRarity || rollRarity(prefs.rarityBonus);
  
  // Filter items by zone preferences and rarity
  const filtered = ALL_ITEMS.filter(item => 
    prefs.types.includes(item.type) && item.rarity === rarity
  );
  
  if (filtered.length === 0) {
    // No items match, try without type restriction
    const anyRarity = ALL_ITEMS.filter(item => item.rarity === rarity);
    return anyRarity[Math.floor(Math.random() * anyRarity.length)];
  }
  
  // Check if we should use a preferred item
  if (Math.random() < 0.3) { // 30% chance to use preferred item
    const preferred = filtered.find(item => 
      prefs.preferredItems.includes(item.id)
    );
    if (preferred) return preferred;
  }
  
  // Return random from filtered
  return filtered[Math.floor(Math.random() * filtered.length)];
}

// Get item by ID from any category
export function getItemById(id: string): GameItem | undefined {
  return ALL_ITEMS.find(item => item.id === id);
}

// Get multiple random items (for lootboxes)
export function generateLootboxItems(rarity: string, count: number = 3): GameItem[] {
  const items: GameItem[] = [];
  const rarityOrder = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'GOD_TIER'];
  const baseRarityIndex = rarityOrder.indexOf(rarity);
  
  for (let i = 0; i < count; i++) {
    // First item guaranteed to be at least the lootbox rarity
    let itemRarity = rarity;
    
    if (i > 0) {
      // Other items can be lower rarity
      const rarityRoll = Math.random();
      if (rarityRoll < 0.5 && baseRarityIndex > 0) {
        // 50% chance of one tier lower
        itemRarity = rarityOrder[baseRarityIndex - 1];
      } else if (rarityRoll < 0.8) {
        // 30% chance of same tier
        itemRarity = rarity;
      } else if (baseRarityIndex < rarityOrder.length - 1) {
        // 20% chance of one tier higher
        itemRarity = rarityOrder[baseRarityIndex + 1];
      }
    }
    
    const filtered = ALL_ITEMS.filter(item => item.rarity === itemRarity);
    if (filtered.length > 0) {
      items.push(filtered[Math.floor(Math.random() * filtered.length)]);
    }
  }
  
  return items;
}

// Calculate total item value
export function calculateItemValue(item: GameItem): number {
  let baseValue = item.value;
  
  // Add bonuses for stats
  if ('powerBonus' in item && item.powerBonus) {
    baseValue += item.powerBonus * 2;
  }
  if ('defenseBonus' in item && item.defenseBonus) {
    baseValue += item.defenseBonus * 2;
  }
  if ('speedBonus' in item && item.speedBonus) {
    baseValue += item.speedBonus * 3;
  }
  if ('agilityBonus' in item && item.agilityBonus) {
    baseValue += item.agilityBonus * 2;
  }
  
  return baseValue;
}