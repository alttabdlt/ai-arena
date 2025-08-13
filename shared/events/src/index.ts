/**
 * AI Arena Shared Events
 * Common event types for distributed system communication
 */

// Base types
export * from './base';

// Event categories
export * from './bot-events';
export * from './tournament-events';
export * from './metaverse-events';

// Re-export specific types for convenience
export type {
  BaseEvent,
  EventEnvelope,
  EventHandlerResponse,
  BotPersonality,
  ItemRarity,
  EquipmentType,
  BotStats,
  Equipment
} from './base';

export type {
  BotCreatedEvent,
  BotDeployedEvent,
  BotEquipmentChangedEvent,
  BotLevelUpEvent,
  BotEnergyChangedEvent,
  BotDeactivatedEvent,
  BotEvent
} from './bot-events';

export type {
  TournamentCreatedEvent,
  TournamentQueueJoinedEvent,
  MatchStartedEvent,
  MatchCompletedEvent,
  TournamentCompletedEvent,
  LootboxAwardedEvent,
  LootboxOpenedEvent,
  TournamentEvent
} from './tournament-events';

export type {
  ZoneChangedEvent,
  RobberyAttemptedEvent,
  CombatEvent,
  ConversationEvent,
  ZoneActivityEvent,
  HospitalEvent,
  AllianceEvent,
  HouseModifiedEvent,
  TradeEvent,
  DramaticMomentEvent,
  MetaverseEvent
} from './metaverse-events';