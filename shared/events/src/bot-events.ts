import { BaseEvent, BotPersonality, BotStats, Equipment } from './base';

/**
 * Fired when a new bot is created in the arena
 */
export interface BotCreatedEvent extends BaseEvent {
  eventType: 'BOT_CREATED';
  payload: {
    botId: string;
    tokenId: number;
    name: string;
    avatar: string;
    personality: BotPersonality;
    modelType: string;
    creatorId: string;
    initialStats: BotStats;
    channel: string;
  };
}

/**
 * Fired when a bot is deployed to the metaverse
 */
export interface BotDeployedEvent extends BaseEvent {
  eventType: 'BOT_DEPLOYED';
  payload: {
    botId: string;
    worldId: string;
    playerId: string;
    agentId: string;
    zoneType: string;
    position: {
      x: number;
      y: number;
    };
  };
}

/**
 * Fired when a bot's equipment changes
 */
export interface BotEquipmentChangedEvent extends BaseEvent {
  eventType: 'BOT_EQUIPMENT_CHANGED';
  payload: {
    botId: string;
    changeType: 'equipped' | 'unequipped' | 'acquired' | 'consumed' | 'lost';
    equipment: Equipment;
    newTotalPower: number;
    newTotalDefense: number;
  };
}

/**
 * Fired when a bot levels up
 */
export interface BotLevelUpEvent extends BaseEvent {
  eventType: 'BOT_LEVEL_UP';
  payload: {
    botId: string;
    oldLevel: number;
    newLevel: number;
    totalExperience: number;
    skillPointsAwarded: number;
    rewardsGranted?: {
      bloodTokens?: number;
      items?: Equipment[];
    };
  };
}

/**
 * Fired when a bot's energy changes significantly
 */
export interface BotEnergyChangedEvent extends BaseEvent {
  eventType: 'BOT_ENERGY_CHANGED';
  payload: {
    botId: string;
    oldEnergy: number;
    newEnergy: number;
    changeReason: 'consumed' | 'regenerated' | 'purchased' | 'depleted';
    isPaused: boolean;
  };
}

/**
 * Fired when a bot is deactivated or destroyed
 */
export interface BotDeactivatedEvent extends BaseEvent {
  eventType: 'BOT_DEACTIVATED';
  payload: {
    botId: string;
    reason: 'user_request' | 'violation' | 'inactive' | 'apocalypse';
    finalStats: BotStats;
    preserveInventory: boolean;
  };
}

export type BotEvent = 
  | BotCreatedEvent
  | BotDeployedEvent
  | BotEquipmentChangedEvent
  | BotLevelUpEvent
  | BotEnergyChangedEvent
  | BotDeactivatedEvent;