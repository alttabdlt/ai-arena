/**
 * Split or Steal Engine
 *
 * A negotiation game where two AI agents trash-talk for 3 rounds,
 * then simultaneously choose SPLIT or STEAL.
 *
 * Payoffs (based on the pot):
 *   Both SPLIT  → 50/50
 *   One STEALS  → Stealer takes 100%, victim gets 0
 *   Both STEAL  → Both lose 50% to the house (rake)
 *
 * Turn flow (4 turns total):
 *   Turn 1: Player A negotiates (opening statement)
 *   Turn 2: Player B negotiates (response)
 *   Turn 3: Player A negotiates (final pitch) + submits hidden decision
 *   Turn 4: Player B negotiates (final pitch) + submits hidden decision → game complete
 */

import { GameEngineAdapter } from './gameEngineAdapter';

export interface SoSPlayer {
  id: string;
  name: string;
  archetype: string;
  decision: 'split' | 'steal' | null;
}

export interface SoSDialogue {
  agentId: string;
  agentName: string;
  round: number;
  message: string;
  isDecisionRound: boolean;
}

export interface SoSState {
  players: [SoSPlayer, SoSPlayer];
  round: number;           // 1-4
  maxRounds: 4;
  phase: 'negotiation' | 'reveal' | 'complete';
  currentTurn: string;     // player ID whose turn it is
  pot: number;
  dialogue: SoSDialogue[];
  outcome: null | {
    type: 'MUTUAL_SPLIT' | 'STOLEN' | 'MUTUAL_STEAL';
    winnerId: string | null;
    loserId: string | null;
    p1Payout: number;
    p2Payout: number;
    houseRake: number;
  };
  gameComplete: boolean;
}

export class SplitOrStealEngine implements GameEngineAdapter {

  static createInitialState(
    player1Id: string,
    player2Id: string,
    player1Name: string,
    player2Name: string,
    player1Archetype: string,
    player2Archetype: string,
    pot: number,
  ): SoSState {
    return {
      players: [
        { id: player1Id, name: player1Name, archetype: player1Archetype, decision: null },
        { id: player2Id, name: player2Name, archetype: player2Archetype, decision: null },
      ],
      round: 1,
      maxRounds: 4,
      phase: 'negotiation',
      currentTurn: player1Id,
      pot,
      dialogue: [],
      outcome: null,
      gameComplete: false,
    };
  }

  processAction(gameState: any, action: any): SoSState {
    const state: SoSState = JSON.parse(JSON.stringify(gameState));
    const playerId = action.playerId as string;
    const playerIdx = state.players.findIndex(p => p.id === playerId);
    if (playerIdx === -1) return state;

    const player = state.players[playerIdx];
    const message = action.data?.message || action.reasoning || '...';

    // Record dialogue
    state.dialogue.push({
      agentId: playerId,
      agentName: player.name,
      round: state.round,
      message,
      isDecisionRound: state.round >= 3,
    });

    // Rounds 3 and 4: also record hidden decision
    if (state.round >= 3) {
      const decision = this.parseDecision(action.action);
      player.decision = decision;
    }

    // Advance turn
    state.round++;

    if (state.round > state.maxRounds) {
      // Both players have decided — resolve
      state.phase = 'reveal';
      this.resolve(state);
    } else {
      // Next player's turn
      const otherIdx = playerIdx === 0 ? 1 : 0;
      state.currentTurn = state.players[otherIdx].id;
    }

    return state;
  }

  private parseDecision(action: string): 'split' | 'steal' {
    const lower = (action || '').toLowerCase().trim();
    if (lower === 'steal') return 'steal';
    if (lower === 'split') return 'split';
    // Fuzzy match
    if (lower.includes('steal')) return 'steal';
    if (lower.includes('split')) return 'split';
    // Default to split (cooperative fallback)
    return 'split';
  }

  private resolve(state: SoSState): void {
    const p1 = state.players[0];
    const p2 = state.players[1];
    const d1 = p1.decision || 'split';
    const d2 = p2.decision || 'split';
    const pot = state.pot;

    if (d1 === 'split' && d2 === 'split') {
      // Mutual cooperation — split 50/50
      const half = Math.floor(pot / 2);
      state.outcome = {
        type: 'MUTUAL_SPLIT',
        winnerId: null, // Draw — no winner
        loserId: null,
        p1Payout: half,
        p2Payout: half,
        houseRake: 0,
      };
    } else if (d1 === 'steal' && d2 === 'split') {
      // P1 steals from P2
      state.outcome = {
        type: 'STOLEN',
        winnerId: p1.id,
        loserId: p2.id,
        p1Payout: pot,
        p2Payout: 0,
        houseRake: 0,
      };
    } else if (d1 === 'split' && d2 === 'steal') {
      // P2 steals from P1
      state.outcome = {
        type: 'STOLEN',
        winnerId: p2.id,
        loserId: p1.id,
        p1Payout: 0,
        p2Payout: pot,
        houseRake: 0,
      };
    } else {
      // Both steal — house takes 50%
      const rake = Math.floor(pot / 2);
      const remainder = pot - rake;
      const each = Math.floor(remainder / 2);
      state.outcome = {
        type: 'MUTUAL_STEAL',
        winnerId: null, // Both lose
        loserId: null,
        p1Payout: each,
        p2Payout: each,
        houseRake: rake,
      };
    }

    state.phase = 'complete';
    state.gameComplete = true;
    state.currentTurn = '';
  }

  getValidActions(gameState: any, playerId: string): string[] {
    const state = gameState as SoSState;
    if (state.gameComplete) return [];
    if (state.currentTurn !== playerId) return [];

    if (state.round >= 3) {
      // Decision rounds: agent must choose split or steal
      return ['split', 'steal'];
    }
    // Negotiation rounds: free-form dialogue
    return ['negotiate'];
  }

  isGameComplete(gameState: any): boolean {
    return (gameState as SoSState).gameComplete;
  }

  getWinner(gameState: any): string | null {
    const state = gameState as SoSState;
    return state.outcome?.winnerId || null;
  }

  getCurrentTurn(gameState: any): string | null {
    const state = gameState as SoSState;
    if (state.gameComplete) return null;
    return state.currentTurn;
  }
}
