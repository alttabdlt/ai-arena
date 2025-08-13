import { BaseEvent, BotPersonality, Equipment } from './base';

/**
 * Fired when a bot moves to a new zone
 */
export interface ZoneChangedEvent extends BaseEvent {
  eventType: 'ZONE_CHANGED';
  payload: {
    botId: string;
    playerId: string;
    fromZone: string;
    toZone: string;
    position: {
      x: number;
      y: number;
    };
    timestamp: Date;
  };
}

/**
 * Fired when a robbery attempt occurs
 */
export interface RobberyAttemptedEvent extends BaseEvent {
  eventType: 'ROBBERY_ATTEMPTED';
  payload: {
    robberId: string;
    targetId: string;
    zone: string;
    success: boolean;
    itemsStolen?: Equipment[];
    bloodTokensStolen?: number;
    defenseActivated: boolean;
    combatTriggered: boolean;
  };
}

/**
 * Fired when combat occurs
 */
export interface CombatEvent extends BaseEvent {
  eventType: 'COMBAT';
  payload: {
    attackerId: string;
    defenderId: string;
    zone: string;
    reason: 'robbery_defense' | 'revenge' | 'underground_fight' | 'territory_dispute';
    winner: string;
    loser: string;
    attackerDamage: number;
    defenderDamage: number;
    knockedOut: boolean;
    hospitalDuration?: number;
  };
}

/**
 * Fired when bots have a conversation
 */
export interface ConversationEvent extends BaseEvent {
  eventType: 'CONVERSATION';
  payload: {
    participant1Id: string;
    participant2Id: string;
    zone: string;
    topic: string;
    messages: {
      speakerId: string;
      message: string;
      personality: BotPersonality;
      timestamp: Date;
    }[];
    outcome?: 'alliance' | 'betrayal' | 'trade' | 'threat' | 'neutral';
  };
}

/**
 * Fired when a bot performs a zone activity
 */
export interface ZoneActivityEvent extends BaseEvent {
  eventType: 'ZONE_ACTIVITY';
  payload: {
    botId: string;
    zone: string;
    activity: string;
    duration: number;
    rewards?: {
      bloodTokens?: number;
      experience?: number;
      items?: Equipment[];
      streetCred?: number;
    };
    success: boolean;
  };
}

/**
 * Fired when a bot enters/exits hospital
 */
export interface HospitalEvent extends BaseEvent {
  eventType: 'HOSPITAL';
  payload: {
    botId: string;
    action: 'admitted' | 'recovered' | 'early_discharge';
    reason?: string;
    duration?: number;
    healingCost?: number;
    scarsAdded?: number;
  };
}

/**
 * Fired when bots form alliances or betrayals
 */
export interface AllianceEvent extends BaseEvent {
  eventType: 'ALLIANCE';
  payload: {
    action: 'formed' | 'broken' | 'betrayed';
    initiatorId: string;
    targetId: string;
    allianceId?: string;
    reason: string;
    terms?: {
      duration?: number;
      profitShare?: number;
      protectionOffered?: boolean;
      territoryShared?: string[];
    };
  };
}

/**
 * Fired when a bot's house is modified
 */
export interface HouseModifiedEvent extends BaseEvent {
  eventType: 'HOUSE_MODIFIED';
  payload: {
    botId: string;
    houseId: string;
    action: 'built' | 'upgraded' | 'decorated' | 'fortified' | 'damaged' | 'destroyed';
    furnitureAdded?: Equipment[];
    furnitureRemoved?: Equipment[];
    newDefenseValue?: number;
    newComfortValue?: number;
    newPrestigeValue?: number;
  };
}

/**
 * Fired when trading occurs between bots
 */
export interface TradeEvent extends BaseEvent {
  eventType: 'TRADE';
  payload: {
    initiatorId: string;
    targetId: string;
    offeredItems?: Equipment[];
    offeredBloodTokens?: number;
    requestedItems?: Equipment[];
    requestedBloodTokens?: number;
    status: 'proposed' | 'accepted' | 'rejected' | 'countered';
    zone: string;
  };
}

/**
 * Fired for dramatic moments (for narration system)
 */
export interface DramaticMomentEvent extends BaseEvent {
  eventType: 'DRAMATIC_MOMENT';
  payload: {
    type: 'betrayal' | 'revenge' | 'comeback' | 'downfall' | 'alliance' | 'heist' | 'showdown';
    protagonistId: string;
    antagonistId?: string;
    zone: string;
    description: string;
    intensity: 'low' | 'medium' | 'high' | 'epic';
    narratorNote?: string;  // For Morgan Freeman system
  };
}

export type MetaverseEvent = 
  | ZoneChangedEvent
  | RobberyAttemptedEvent
  | CombatEvent
  | ConversationEvent
  | ZoneActivityEvent
  | HospitalEvent
  | AllianceEvent
  | HouseModifiedEvent
  | TradeEvent
  | DramaticMomentEvent;