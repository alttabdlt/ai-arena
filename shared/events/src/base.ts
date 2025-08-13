/**
 * Base event interface that all events must implement
 */
export interface BaseEvent {
  eventId: string;
  eventType: string;
  timestamp: Date;
  source: 'arena' | 'metaverse' | 'gateway';
  version: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

/**
 * Event envelope for transport
 */
export interface EventEnvelope<T extends BaseEvent> {
  event: T;
  retryCount?: number;
  maxRetries?: number;
  deadLetterReason?: string;
}

/**
 * Event handler response
 */
export interface EventHandlerResponse {
  success: boolean;
  error?: string;
  shouldRetry?: boolean;
}

/**
 * Common data types used across events
 */
export enum BotPersonality {
  CRIMINAL = 'CRIMINAL',
  GAMBLER = 'GAMBLER',
  WORKER = 'WORKER'
}

export enum ItemRarity {
  COMMON = 'COMMON',
  UNCOMMON = 'UNCOMMON',
  RARE = 'RARE',
  EPIC = 'EPIC',
  LEGENDARY = 'LEGENDARY',
  GOD_TIER = 'GOD_TIER'
}

export enum EquipmentType {
  SWORD = 'SWORD',
  ARMOR = 'ARMOR',
  TOOL = 'TOOL',
  ACCESSORY = 'ACCESSORY',
  POTION = 'POTION',
  BOOTS = 'BOOTS',
  GUN = 'GUN',
  FURNITURE = 'FURNITURE'
}

export interface BotStats {
  level: number;
  experience: number;
  power: number;
  defense: number;
  speed: number;
  bloodTokens: number;
  diamonds: number;
  streetCred: number;
}

export interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  rarity: ItemRarity;
  powerBonus: number;
  defenseBonus: number;
  speedBonus?: number;
  agilityBonus?: number;
  rangeBonus?: number;
  healingPower?: number;
  consumable?: boolean;
  quantity?: number;
}