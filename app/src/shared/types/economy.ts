// Equipment types and interfaces
export enum EquipmentType {
  WEAPON = 'WEAPON',
  ARMOR = 'ARMOR',
  TOOL = 'TOOL',
  ACCESSORY = 'ACCESSORY'
}

export enum ItemRarity {
  COMMON = 'COMMON',
  UNCOMMON = 'UNCOMMON',
  RARE = 'RARE',
  EPIC = 'EPIC',
  LEGENDARY = 'LEGENDARY'
}

export enum FurnitureType {
  DECORATION = 'DECORATION',
  FUNCTIONAL = 'FUNCTIONAL',
  DEFENSIVE = 'DEFENSIVE',
  TROPHY = 'TROPHY'
}

export interface BotEquipment {
  id: string;
  botId: string;
  name: string;
  equipmentType: EquipmentType;
  rarity: ItemRarity;
  powerBonus: number;
  defenseBonus: number;
  equipped: boolean;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface BotHouse {
  id: string;
  botId: string;
  houseScore: number;
  defenseLevel: number;
  lastRobbed?: string;
  robberyCooldown?: string;
  worldPosition: {
    x: number;
    y: number;
  };
  furniture?: Furniture[];
  createdAt: string;
  updatedAt: string;
}

export interface Furniture {
  id: string;
  houseId: string;
  name: string;
  furnitureType: FurnitureType;
  rarity: ItemRarity;
  scoreBonus: number;
  defenseBonus: number;
  position: {
    x: number;
    y: number;
    rotation: number;
  };
  metadata: Record<string, any>;
  createdAt: string;
}

export interface RobberyLog {
  id: string;
  robberBotId: string;
  victimBotId: string;
  success: boolean;
  powerUsed: number;
  defenseFaced: number;
  lootValue: number;
  itemsStolen: Array<{
    type: 'equipment' | 'furniture' | 'currency';
    itemId?: string;
    name: string;
    value: number;
  }>;
  timestamp: string;
}

export interface BotActivityScore {
  id: string;
  botId: string;
  matchesPlayed: number;
  lootboxesOpened: number;
  socialInteractions: number;
  successfulRobberies: number;
  defenseSuccesses: number;
  tradesCompleted: number;
  lastActive: string;
  createdAt: string;
  updatedAt: string;
}

export interface LootboxReward {
  id: string;
  matchId: string;
  botId: string;
  lootboxRarity: ItemRarity;
  equipmentRewards: BotEquipment[];
  furnitureRewards: Furniture[];
  currencyReward: number;
  opened: boolean;
  openedAt?: string;
  createdAt: string;
}

export interface Trade {
  id: string;
  initiatorBotId: string;
  receiverBotId: string;
  offeredItems: TradeItem[];
  requestedItems: TradeItem[];
  status: TradeStatus;
  completedAt?: string;
  createdAt: string;
}

export interface TradeItem {
  type: 'equipment' | 'furniture' | 'currency';
  itemId?: string;
  name: string;
  quantity: number;
}

export enum TradeStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

// Rarity configurations
export const RARITY_COLORS: Record<ItemRarity, string> = {
  [ItemRarity.COMMON]: '#9CA3AF',    // gray-400
  [ItemRarity.UNCOMMON]: '#10B981',  // emerald-500
  [ItemRarity.RARE]: '#3B82F6',      // blue-500
  [ItemRarity.EPIC]: '#A855F7',      // purple-500
  [ItemRarity.LEGENDARY]: '#F59E0B'  // amber-500
};

export const RARITY_DROP_RATES: Record<ItemRarity, number> = {
  [ItemRarity.COMMON]: 0.50,      // 50%
  [ItemRarity.UNCOMMON]: 0.30,    // 30%
  [ItemRarity.RARE]: 0.15,        // 15%
  [ItemRarity.EPIC]: 0.04,        // 4%
  [ItemRarity.LEGENDARY]: 0.01    // 1%
};

// Equipment configurations
export const EQUIPMENT_POWER_BONUS: Record<ItemRarity, { min: number; max: number }> = {
  [ItemRarity.COMMON]: { min: 1, max: 5 },
  [ItemRarity.UNCOMMON]: { min: 5, max: 15 },
  [ItemRarity.RARE]: { min: 15, max: 30 },
  [ItemRarity.EPIC]: { min: 30, max: 50 },
  [ItemRarity.LEGENDARY]: { min: 50, max: 100 }
};

// Furniture configurations
export const FURNITURE_SCORE_BONUS: Record<ItemRarity, { min: number; max: number }> = {
  [ItemRarity.COMMON]: { min: 5, max: 10 },
  [ItemRarity.UNCOMMON]: { min: 10, max: 25 },
  [ItemRarity.RARE]: { min: 25, max: 50 },
  [ItemRarity.EPIC]: { min: 50, max: 100 },
  [ItemRarity.LEGENDARY]: { min: 100, max: 200 }
};

// House score calculation factors
export interface HouseScoreFactors {
  furnitureValue: number;      // Sum of all furniture bonuses
  activityScore: number;       // Bot's activity in the simulation
  matchParticipation: number;  // Number of AI Arena matches played
  lootboxesOpened: number;     // Number of lootboxes opened
  socialInteractions: number;  // AI Town conversations
  defenseSuccesses: number;    // Successful robbery defenses
}

// Robbing mechanics
export interface RobbingAttempt {
  robberId: string;
  victimId: string;
  robberPower: number;
  victimDefense: number;
  successChance: number;
  timestamp: string;
}

export const ROBBERY_COOLDOWN_HOURS = 4;
export const ROBBERY_VICTIM_PROTECTION_HOURS = 2;
export const ROBBERY_BASE_SUCCESS_RATE = 0.3;