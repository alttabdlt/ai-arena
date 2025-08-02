import { useState, useCallback } from 'react';
import { 
  LootboxReward, 
  LootboxItem, 
  ItemRarity, 
  ItemType,
  RARITY_CHANCES, 
  ITEM_POOLS 
} from '@/types/lootbox';

interface UseLootboxOptions {
  winnerId: string;
  gameType: 'poker' | 'connect4' | 'reverse-hangman';
  onRewardReceived?: (reward: LootboxReward) => void;
}

interface UseLootboxReturn {
  isOpen: boolean;
  openLootbox: () => void;
  closeLootbox: () => void;
  generateReward: () => Promise<LootboxReward>;
}

// Generate a random item based on rarity chances
const generateRandomItem = (): LootboxItem => {
  // Determine rarity
  const rarityRoll = Math.random();
  let cumulativeChance = 0;
  let selectedRarity: ItemRarity = 'common';
  
  for (const [rarity, chance] of Object.entries(RARITY_CHANCES)) {
    cumulativeChance += chance;
    if (rarityRoll <= cumulativeChance) {
      selectedRarity = rarity as ItemRarity;
      break;
    }
  }
  
  // Determine item type
  const itemTypes: ItemType[] = ['equipment', 'furniture', 'cosmetic'];
  const selectedType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
  
  // Get items of selected rarity from the pool
  const typePool = ITEM_POOLS[selectedType];
  const rarityItems = typePool.filter(item => item.rarity === selectedRarity);
  
  if (rarityItems.length === 0) {
    // Fallback to any item of that rarity
    const allItems = Object.values(ITEM_POOLS).flat();
    const fallbackItems = allItems.filter(item => item.rarity === selectedRarity);
    if (fallbackItems.length > 0) {
      const selectedItem = fallbackItems[Math.floor(Math.random() * fallbackItems.length)];
      return createFullItem(selectedItem, selectedType);
    }
  }
  
  // Select random item from filtered pool
  const selectedItem = rarityItems[Math.floor(Math.random() * rarityItems.length)];
  return createFullItem(selectedItem, selectedType);
};

// Create a full item object from partial data
const createFullItem = (partial: Partial<LootboxItem>, type: ItemType): LootboxItem => {
  const rarityValues: Record<ItemRarity, number> = {
    common: 50,
    rare: 150,
    epic: 500,
    legendary: 2000
  };
  
  return {
    id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: partial.name || 'Unknown Item',
    description: partial.description || 'A mysterious item',
    type,
    rarity: partial.rarity || 'common',
    iconUrl: `/assets/lootbox/icons/${type}_${partial.rarity}.png`,
    value: rarityValues[partial.rarity || 'common'],
    ...partial
  };
};

export const useLootbox = ({ 
  winnerId, 
  gameType, 
  onRewardReceived 
}: UseLootboxOptions): UseLootboxReturn => {
  const [isOpen, setIsOpen] = useState(false);
  
  const openLootbox = useCallback(() => {
    setIsOpen(true);
  }, []);
  
  const closeLootbox = useCallback(() => {
    setIsOpen(false);
  }, []);
  
  const generateReward = useCallback(async (): Promise<LootboxReward> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Generate random item
    const item = generateRandomItem();
    
    // Check if item is new (mock - in real implementation, check user inventory)
    const isNew = Math.random() > 0.3; // 70% chance of being new
    
    const reward: LootboxReward = {
      item,
      isNew,
      timestamp: new Date()
    };
    
    // Notify parent component
    if (onRewardReceived) {
      onRewardReceived(reward);
    }
    
    // In a real implementation, you would:
    // 1. Call GraphQL mutation to generate reward server-side
    // 2. Save to user inventory
    // 3. Update user statistics
    
    return reward;
  }, [onRewardReceived]);
  
  return {
    isOpen,
    openLootbox,
    closeLootbox,
    generateReward
  };
};