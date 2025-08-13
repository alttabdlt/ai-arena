import { BaseEvent, BotStats, Equipment } from './base';

/**
 * Fired when a tournament is created
 */
export interface TournamentCreatedEvent extends BaseEvent {
  eventType: 'TOURNAMENT_CREATED';
  payload: {
    tournamentId: string;
    gameType: 'POKER' | 'CONNECT4' | 'REVERSE_HANGMAN';
    buyIn: number;
    maxPlayers: number;
    minPlayers: number;
    currency: 'BLOOD_TOKENS' | 'DIAMONDS';
    startTime?: Date;
    prizes: {
      position: number;
      bloodTokens?: number;
      lootboxRarity?: string;
      items?: Equipment[];
    }[];
  };
}

/**
 * Fired when a bot joins a tournament queue
 */
export interface TournamentQueueJoinedEvent extends BaseEvent {
  eventType: 'TOURNAMENT_QUEUE_JOINED';
  payload: {
    queueId: string;
    botId: string;
    tournamentId?: string;
    gameType: string;
    position: number;
    estimatedWaitTime?: number;
  };
}

/**
 * Fired when a match starts
 */
export interface MatchStartedEvent extends BaseEvent {
  eventType: 'MATCH_STARTED';
  payload: {
    matchId: string;
    tournamentId?: string;
    gameType: string;
    participants: {
      botId: string;
      position: number;
      modelType: string;
      personality: string;
    }[];
    roomCode: string;
    startedAt: Date;
  };
}

/**
 * Fired when a match completes
 */
export interface MatchCompletedEvent extends BaseEvent {
  eventType: 'MATCH_COMPLETED';
  payload: {
    matchId: string;
    tournamentId?: string;
    gameType: string;
    winnerId: string;
    loserId?: string;
    duration: number;
    finalState: any;
    participants: {
      botId: string;
      placement: number;
      score: number;
      bloodTokensWon?: number;
      experienceGained?: number;
    }[];
  };
}

/**
 * Fired when a tournament completes
 */
export interface TournamentCompletedEvent extends BaseEvent {
  eventType: 'TOURNAMENT_COMPLETED';
  payload: {
    tournamentId: string;
    gameType: string;
    totalParticipants: number;
    totalPrizePool: number;
    winners: {
      position: number;
      botId: string;
      bloodTokensWon: number;
      lootboxesWon?: {
        rarity: string;
        count: number;
      }[];
      itemsWon?: Equipment[];
    }[];
    completedAt: Date;
  };
}

/**
 * Fired when a lootbox is awarded
 */
export interface LootboxAwardedEvent extends BaseEvent {
  eventType: 'LOOTBOX_AWARDED';
  payload: {
    lootboxId: string;
    botId: string;
    source: 'tournament' | 'achievement' | 'purchase' | 'daily_reward';
    rarity: string;
    rewards: {
      type: string;
      name: string;
      rarity: string;
      quantity?: number;
    }[];
    autoOpen: boolean;
  };
}

/**
 * Fired when a lootbox is opened
 */
export interface LootboxOpenedEvent extends BaseEvent {
  eventType: 'LOOTBOX_OPENED';
  payload: {
    lootboxId: string;
    botId: string;
    rarity: string;
    itemsReceived: Equipment[];
    bloodTokensReceived?: number;
    diamondsReceived?: number;
    openedAt: Date;
  };
}

export type TournamentEvent = 
  | TournamentCreatedEvent
  | TournamentQueueJoinedEvent
  | MatchStartedEvent
  | MatchCompletedEvent
  | TournamentCompletedEvent
  | LootboxAwardedEvent
  | LootboxOpenedEvent;