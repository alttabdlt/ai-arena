/**
 * This file contains only TYPE DEFINITIONS needed by the frontend.
 * All game logic and implementations exist on the backend.
 */

import { IGameAction } from './interfaces';

// ============================================================================
// Poker Types
// ============================================================================

/**
 * Poker action type - sent to backend for processing
 * Extends IGameAction but with specific poker action types
 */
export interface PokerAction extends Omit<IGameAction, 'type'> {
  type: 'fold' | 'check' | 'call' | 'raise' | 'bet' | 'all-in';
  amount?: number;
}

/**
 * Poker style bonus for scoring display
 * Includes all bonus types actually used in the app
 */
export interface PokerStyleBonus {
  type: 'aggressive_bluff' | 'calculated_fold' | 'value_bet' | 'check_raise' | 
        'slow_play' | 'pot_control' | 'thin_value' | 'hero_call' | 
        'soul_read' | 'monster_pot' | 'david-goliath' | 'bluff-master' |
        'unconventional' | 'comeback' | 'action-player';
  description: string;
  points: number;
  playerId?: string;  // Optional since sometimes created without it
  handNumber?: number;  // Optional since sometimes created without it
  timestamp?: Date | number;  // Can be either Date or number
}

/**
 * Decision history entry for poker AI display
 */
export interface DecisionHistoryEntry {
  handNumber: number;
  phase: string;
  playerId: string;
  playerName: string;
  action: string;
  amount?: number;
  reasoning?: string;
  confidence?: number;
  pot: number;
  playerChips: number;
  communityCards: unknown[];
  timestamp: Date | number;  // Can be either Date or number
}

// ============================================================================
// Achievement Types
// ============================================================================

/**
 * Achievement unlock event for display
 */
export interface AchievementUnlockEvent {
  achievementId: string;
  playerId: string;
  playerName: string;
  achievementName: string;
  achievementDescription: string;
  points: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  timestamp: Date;
}

// ============================================================================
// Score Types
// ============================================================================

/**
 * Score breakdown for display
 */
export interface IScoreBreakdown {
  playerId: string;
  basePoints: number;
  bonusPoints: number;
  penaltyPoints: number;
  totalPoints: number;
  breakdown: Array<{
    category: string;
    points: number;
    description: string;
  }>;
}

/**
 * Game event for logging
 */
export interface IGameEvent {
  type: string;
  playerId?: string;
  data: unknown;
  timestamp: Date;
}
