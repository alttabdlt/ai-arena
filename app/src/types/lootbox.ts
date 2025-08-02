export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type ItemType = 'equipment' | 'furniture' | 'cosmetic';

export interface LootboxItem {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  rarity: ItemRarity;
  modelUrl?: string;
  iconUrl: string;
  value: number;
}

export interface LootboxReward {
  item: LootboxItem;
  isNew: boolean;
  timestamp: Date;
}

export interface LootboxState {
  isOpen: boolean;
  isOpening: boolean;
  stage: 'idle' | 'appearing' | 'shaking' | 'opening' | 'revealing' | 'complete';
  reward: LootboxReward | null;
}

export const RARITY_COLORS: Record<ItemRarity, string> = {
  common: '#9CA3AF',    // gray-400
  rare: '#3B82F6',      // blue-500
  epic: '#8B5CF6',      // purple-500
  legendary: '#F59E0B'  // amber-500
};

export const RARITY_CHANCES: Record<ItemRarity, number> = {
  common: 0.60,
  rare: 0.25,
  epic: 0.12,
  legendary: 0.03
};

export const ITEM_POOLS: Record<ItemType, Partial<LootboxItem>[]> = {
  equipment: [
    { name: 'Wooden Sword', description: 'A basic training sword', rarity: 'common' },
    { name: 'Iron Shield', description: 'Sturdy protection', rarity: 'common' },
    { name: 'Enchanted Blade', description: 'Glows with magical energy', rarity: 'rare' },
    { name: 'Dragon Scale Armor', description: 'Forged from ancient scales', rarity: 'epic' },
    { name: 'Excalibur', description: 'The legendary sword of kings', rarity: 'legendary' }
  ],
  furniture: [
    { name: 'Wooden Chair', description: 'Simple but comfortable', rarity: 'common' },
    { name: 'Crystal Chandelier', description: 'Sparkles with inner light', rarity: 'rare' },
    { name: 'Royal Throne', description: 'Fit for a champion', rarity: 'epic' },
    { name: 'Phoenix Statue', description: 'Radiates eternal flame', rarity: 'legendary' }
  ],
  cosmetic: [
    { name: 'Victory Sparkles', description: 'Celebrate in style', rarity: 'common' },
    { name: 'Lightning Aura', description: 'Crackling energy surrounds you', rarity: 'rare' },
    { name: 'Galaxy Trail', description: 'Leave stardust in your wake', rarity: 'epic' },
    { name: 'Divine Radiance', description: 'Blessed by the gods', rarity: 'legendary' }
  ]
};