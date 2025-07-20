// Comprehensive data structures for AI decision making
import { Card } from '../engine/poker-engine';

export interface AIPersonalData {
  hole_cards: string[];                // Private cards in AI format (e.g., ["As", "Kh"])
  stack_size: number;                  // Current chip count
  position: string;                    // Position name (e.g., "big_blind", "button")
  position_type: 'EP' | 'MP' | 'LP' | 'SB' | 'BB';  // Position classification
  seat_number: number;                 // Physical table position
  is_all_in: boolean;                  // Whether player is all-in
  amount_invested_this_hand: number;   // Total put in this hand
  amount_invested_this_round: number;  // Amount in current betting round
  amount_to_call: number;              // Amount needed to call
  can_check: boolean;                  // Whether check is available
  can_fold: boolean;                   // Whether fold is available
  can_call: boolean;                   // Whether call is available
  can_raise: boolean;                  // Whether raise is available
  min_raise_amount: number;            // Minimum raise size
  max_raise_amount: number;            // Maximum raise (stack size)
  hand_evaluation?: string;            // Current hand strength (e.g., "Straight (9 high)")
}

export interface AITableData {
  // Game Format
  game_type: 'no_limit_holdem';       // Game variant
  betting_structure: 'tournament' | 'cash_game';
  max_players: number;                 // Table size
  current_players: number;             // Players still seated
  active_players: number;              // Players not folded
  
  // Blinds and Structure
  small_blind: number;
  big_blind: number;
  ante: number;                        // Tournament antes
  level: number;                       // Tournament level
  time_left_in_level?: number;         // Seconds remaining
  next_blind_increase?: {
    sb: number;
    bb: number;
  };
  
  // Current Hand Info
  hand_number: number;                 // Running hand count
  dealer_position: number;             // Button position
  small_blind_position: number;
  big_blind_position: number;
  betting_round: 'preflop' | 'flop' | 'turn' | 'river';
  community_cards: string[];           // Board cards in AI format
  pot_size: number;                    // Total pot
  side_pots: SidePot[];               // If multiple all-ins
  current_bet: number;                 // Current bet to call
  min_raise: number;                   // Minimum raise amount
}

export interface SidePot {
  amount: number;
  eligible_players: string[];          // Player IDs eligible for this pot
  created_by_player?: string;          // Player who went all-in to create it
}

export interface LastAction {
  action: string;
  amount?: number;
  timestamp: number;
}

export interface AIPlayerInfo {
  seat: number;
  id: string;
  name: string;
  stack_size: number;
  position: string;                    // e.g., "button", "small_blind"
  position_type: 'EP' | 'MP' | 'LP' | 'SB' | 'BB';
  status: 'active' | 'folded' | 'all_in' | 'sitting_out';
  amount_in_pot: number;              // Amount invested this hand
  amount_in_round: number;            // Amount in current betting round
  is_all_in: boolean;
  hole_cards_known: boolean;          // Whether we've seen their cards
  hole_cards?: string[];              // Cards if known (showdown)
  last_action?: LastAction;
}

export interface HandAction {
  player: string;
  player_id: string;
  seat: number;
  action: string;
  amount?: number;
  stack_before: number;
  stack_after: number;
  pot_after: number;
}

export interface AIHandHistory {
  preflop: HandAction[];
  flop: HandAction[];
  turn: HandAction[];
  river: HandAction[];
}

export interface PotOdds {
  to_call: number;
  pot_size: number;
  odds_ratio: string;                  // e.g., "6.8:1"
  percentage: number;                  // % of pot you need to call
  break_even_percentage: number;       // Win % needed to break even
}

export interface AIPotBreakdown {
  main_pot: number;
  side_pots: SidePot[];
  total_pot: number;
  effective_stack_size: number;        // Smallest relevant stack
  pot_odds: PotOdds;
}

export interface AIPositionData {
  seats_to_act_after: number;          // How many players act after you
  position_type: 'EP' | 'MP' | 'LP' | 'SB' | 'BB';
  relative_position: string;           // e.g., "first_to_act", "last_to_act"
  players_left_to_act: string[];       // Player IDs who still need to act
  action_order: number[];              // Seat order for this round
  
  // Position advantages
  has_position_on: number[];           // Seats you act after post-flop
  out_of_position_to: number[];        // Seats that act after you post-flop
  is_closing_action: boolean;          // Whether you're last to act this round
  is_open_action: boolean;             // No raises before you
}

export interface SPRData {
  current_spr: number;                 // Stack to pot ratio
  projected_spr_if_call: number;       // SPR after calling
  projected_spr_if_min_raise: number;  // SPR after min raising
  commitment_threshold: number;        // SPR where you're pot committed
}

export interface AIStackDynamics {
  effective_stacks: {
    [key: string]: number;             // Effective stack vs each player
  };
  
  stack_rankings: {
    position: number;                  // Your stack rank (1 = chip leader)
    percentile: number;                // Top X% of stacks
  };
  
  stack_to_pot_ratio: SPRData;
  
  commitment_levels: {
    [key: string]: number;             // Each player's pot commitment %
  };
  
  // ICM considerations for tournaments
  icm_pressure?: {
    bubble_factor: number;             // 0-1, proximity to money bubble
    pay_jump_factor: number;           // 0-1, significance of next pay jump
  };
}

export interface AIMetaGame {
  // Recent history with opponents
  recent_showdowns: {
    player_id: string;
    hand_shown: string[];
    action_line: string;               // e.g., "check-raised flop"
    hands_ago: number;
  }[];
  
  // Table dynamics
  aggression_level: number;            // 0-1, table aggression
  average_vpip: number;                // Voluntarily put in pot %
  hands_since_last_big_pot: number;
  
  // Your image
  your_recent_actions: {
    aggressive_plays: number;
    passive_plays: number;
    bluffs_shown: number;
    hands_played: number;
  };
}

// Complete AI decision input
export interface AIDecisionInput {
  personal: AIPersonalData;
  table: AITableData;
  players: AIPlayerInfo[];
  current_hand_history: AIHandHistory;
  pot_breakdown: AIPotBreakdown;
  position_data: AIPositionData;
  stack_dynamics: AIStackDynamics;
  meta_game?: AIMetaGame;
  
  // Additional context
  timestamp: number;
  thinking_time_available: number;
}

// Enhanced AI decision output
export interface AIDecisionOutput {
  action: 'fold' | 'check' | 'call' | 'raise' | 'all-in';
  amount?: number;
  reasoning: string;
  confidence: number;
  
  details: {
    hand_strength: number;
    hand_evaluation: string;
    pot_odds_analysis: string;
    expected_value: number;
    bluff_percentage: number;
    
    // Advanced considerations
    range_analysis?: string;
    opponent_modeling?: string;
    meta_game_adjustments?: string;
    
    // Decision factors
    primary_factors: string[];
    risk_assessment: 'low' | 'medium' | 'high';
  };
  
  // Alternative actions considered
  alternatives: {
    action: string;
    ev: number;
    reasoning: string;
  }[];
}