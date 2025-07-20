import { PokerEngine, Player, GamePhase, Card } from '../engine/poker-engine';
import { PokerGameManager } from '../game/poker-game-manager';
import { PositionEvaluator } from './position-evaluator';
import { convertCardsForAI } from '../engine/poker-helpers';
import { evaluatePokerHand, getSimpleHandDescription } from '../engine/hand-evaluator';
import {
  AIDecisionInput,
  AIPersonalData,
  AITableData,
  AIPlayerInfo,
  AIHandHistory,
  AIPotBreakdown,
  AIPositionData,
  AIStackDynamics,
  PotOdds,
  SPRData,
  HandAction,
  SidePot
} from './ai-data-structures';

export class AIDataCollector {
  private readonly SMALL_BLIND = 50;  // TODO: Make configurable
  private readonly BIG_BLIND = 100;   // TODO: Make configurable

  collectAIData(
    player: Player,
    engineState: ReturnType<PokerEngine['getState']>,
    validActions: string[],
    handNumber: number,
    actionHistory: { player: string; action: string; amount?: number; round: GamePhase }[]
  ): AIDecisionInput {
    const personal = this.collectPersonalData(player, engineState, validActions);
    const table = this.collectTableData(engineState, handNumber);
    const players = this.collectPlayersData(engineState, player.id);
    const handHistory = this.organizeHandHistory(actionHistory, engineState.players);
    const potBreakdown = this.calculatePotBreakdown(engineState, player);
    const positionData = this.calculatePositionData(player, engineState);
    const stackDynamics = this.calculateStackDynamics(player, engineState);

    return {
      personal,
      table,
      players,
      current_hand_history: handHistory,
      pot_breakdown: potBreakdown,
      position_data: positionData,
      stack_dynamics: stackDynamics,
      timestamp: Date.now(),
      thinking_time_available: 60000 // 1 minute default
    };
  }

  private collectPersonalData(
    player: Player,
    state: ReturnType<PokerEngine['getState']>,
    validActions: string[]
  ): AIPersonalData {
    const positionInfo = PositionEvaluator.getPositionType(
      player.position,
      state.dealerPosition,
      state.players.length
    );
    
    const amountToCall = Math.max(0, state.currentBet - player.bet);
    const canRaise = player.chips > amountToCall && validActions.includes('raise');
    
    // Evaluate hand strength if community cards are present
    let handEvaluation: string | undefined;
    if (state.communityCards.length > 0 && player.cards.length === 2) {
      try {
        const evaluation = evaluatePokerHand(player.cards, state.communityCards);
        handEvaluation = getSimpleHandDescription(evaluation);
      } catch (error) {
        console.error('Error evaluating hand:', error);
      }
    }
    
    return {
      hole_cards: convertCardsForAI(player.cards),
      stack_size: player.chips,
      position: this.getPositionName(player.position, state),
      position_type: positionInfo.type,
      seat_number: player.position,
      is_all_in: player.allIn,
      amount_invested_this_hand: this.calculateAmountInvested(player, state),
      amount_invested_this_round: player.bet,
      amount_to_call: amountToCall,
      can_check: validActions.includes('check'),
      can_fold: validActions.includes('fold'),
      can_call: validActions.includes('call'),
      can_raise: canRaise,
      min_raise_amount: canRaise ? state.minRaise : 0,
      max_raise_amount: player.chips,
      hand_evaluation: handEvaluation
    };
  }

  private collectTableData(
    state: ReturnType<PokerEngine['getState']>,
    handNumber: number
  ): AITableData {
    const activePlayers = state.players.filter(p => !p.folded).length;
    
    return {
      game_type: 'no_limit_holdem',
      betting_structure: 'tournament', // TODO: Make configurable
      max_players: state.players.length,
      current_players: state.players.length,
      active_players: activePlayers,
      small_blind: this.SMALL_BLIND,
      big_blind: this.BIG_BLIND,
      ante: 0, // TODO: Add ante support
      level: 1, // TODO: Track tournament levels
      hand_number: handNumber,
      dealer_position: state.dealerPosition,
      small_blind_position: state.smallBlindPosition,
      big_blind_position: state.bigBlindPosition,
      betting_round: this.mapPhaseToRound(state.phase),
      community_cards: convertCardsForAI(state.communityCards),
      pot_size: state.pot,
      side_pots: this.formatSidePots(state.sidePots),
      current_bet: state.currentBet,
      min_raise: state.minRaise
    };
  }

  private collectPlayersData(
    state: ReturnType<PokerEngine['getState']>,
    currentPlayerId: string
  ): AIPlayerInfo[] {
    return state.players.map(player => {
      const positionInfo = PositionEvaluator.getPositionType(
        player.position,
        state.dealerPosition,
        state.players.length
      );
      
      return {
        seat: player.position,
        id: player.id,
        name: player.name,
        stack_size: player.chips,
        position: this.getPositionName(player.position, state),
        position_type: positionInfo.type,
        status: this.getPlayerStatus(player),
        amount_in_pot: this.calculateAmountInvested(player, state),
        amount_in_round: player.bet,
        is_all_in: player.allIn,
        hole_cards_known: player.id === currentPlayerId || state.phase === 'showdown',
        hole_cards: player.id === currentPlayerId ? convertCardsForAI(player.cards) : undefined,
        // last_action would need to be tracked separately
      };
    });
  }

  private organizeHandHistory(
    actionHistory: { player: string; action: string; amount?: number; round: GamePhase }[],
    players: Player[]
  ): AIHandHistory {
    const history: AIHandHistory = {
      preflop: [],
      flop: [],
      turn: [],
      river: []
    };

    let runningPot = 0;
    const playerStacks = new Map(players.map(p => [p.name, p.chips + p.bet]));

    actionHistory.forEach(action => {
      const player = players.find(p => p.name === action.player);
      if (!player) return;

      const stackBefore = playerStacks.get(action.player) || 0;
      const stackAfter = stackBefore - (action.amount || 0);
      runningPot += action.amount || 0;
      
      playerStacks.set(action.player, stackAfter);

      const handAction: HandAction = {
        player: action.player,
        player_id: player.id,
        seat: player.position,
        action: action.action,
        amount: action.amount,
        stack_before: stackBefore,
        stack_after: stackAfter,
        pot_after: runningPot
      };

      const round = this.mapPhaseToRound(action.round);
      if (round in history) {
        history[round].push(handAction);
      }
    });

    return history;
  }

  private calculatePotBreakdown(
    state: ReturnType<PokerEngine['getState']>,
    player: Player
  ): AIPotBreakdown {
    const callAmount = Math.max(0, state.currentBet - player.bet);
    const potAfterCall = state.pot + callAmount;
    
    const potOdds: PotOdds = {
      to_call: callAmount,
      pot_size: state.pot,
      odds_ratio: callAmount > 0 ? `${(state.pot / callAmount).toFixed(1)}:1` : 'N/A',
      percentage: callAmount > 0 ? (callAmount / (state.pot + callAmount)) * 100 : 0,
      break_even_percentage: callAmount > 0 ? (callAmount / potAfterCall) * 100 : 0
    };

    // Find effective stack (smallest stack among active players)
    const activePlayers = state.players.filter(p => !p.folded);
    const effectiveStack = Math.min(...activePlayers.map(p => p.chips + p.bet));

    return {
      main_pot: state.pot,
      side_pots: this.formatSidePots(state.sidePots),
      total_pot: state.pot + state.sidePots.reduce((sum, sp) => sum + sp.amount, 0),
      effective_stack_size: effectiveStack,
      pot_odds: potOdds
    };
  }

  private calculatePositionData(
    player: Player,
    state: ReturnType<PokerEngine['getState']>
  ): AIPositionData {
    const activePlayers = state.players.filter(p => !p.folded && !p.allIn);
    const playerIndex = activePlayers.findIndex(p => p.id === player.id);
    const playersAfter = activePlayers.slice(playerIndex + 1);
    
    const positionInfo = PositionEvaluator.getPositionType(
      player.position,
      state.dealerPosition,
      state.players.length
    );

    // Determine who has position on whom post-flop
    const hasPositionOn: number[] = [];
    const outOfPositionTo: number[] = [];
    
    state.players.forEach(p => {
      if (p.id === player.id || p.folded) return;
      
      // In post-flop, earlier positions act first
      const relativePosition = (p.position - state.dealerPosition + state.players.length) % state.players.length;
      const myRelativePosition = (player.position - state.dealerPosition + state.players.length) % state.players.length;
      
      if (myRelativePosition > relativePosition) {
        hasPositionOn.push(p.position);
      } else {
        outOfPositionTo.push(p.position);
      }
    });

    return {
      seats_to_act_after: playersAfter.length,
      position_type: positionInfo.type,
      relative_position: playerIndex === 0 ? 'first_to_act' : 
                        playerIndex === activePlayers.length - 1 ? 'last_to_act' : 
                        'middle_position',
      players_left_to_act: playersAfter.map(p => p.id),
      action_order: activePlayers.map(p => p.position),
      has_position_on: hasPositionOn,
      out_of_position_to: outOfPositionTo,
      is_closing_action: playerIndex === activePlayers.length - 1,
      is_open_action: state.currentBet === this.BIG_BLIND
    };
  }

  private calculateStackDynamics(
    player: Player,
    state: ReturnType<PokerEngine['getState']>
  ): AIStackDynamics {
    const effectiveStacks: { [key: string]: number } = {};
    const commitmentLevels: { [key: string]: number } = {};
    
    // Calculate effective stacks and commitment
    state.players.forEach(p => {
      if (p.id === player.id || p.folded) return;
      
      effectiveStacks[`vs_${p.id}`] = Math.min(player.chips, p.chips);
      
      const totalInvested = this.calculateAmountInvested(p, state);
      const startingStack = p.chips + totalInvested;
      commitmentLevels[p.id] = startingStack > 0 ? (totalInvested / startingStack) * 100 : 0;
    });
    
    // Add self commitment
    const playerInvested = this.calculateAmountInvested(player, state);
    const playerStartingStack = player.chips + playerInvested;
    commitmentLevels[player.id] = playerStartingStack > 0 ? 
      (playerInvested / playerStartingStack) * 100 : 0;

    // Calculate SPR
    const spr = this.calculateSPR(player.chips, state.pot);
    const potAfterCall = state.pot + Math.max(0, state.currentBet - player.bet);
    const stackAfterCall = player.chips - Math.max(0, state.currentBet - player.bet);
    const sprAfterCall = this.calculateSPR(stackAfterCall, potAfterCall);
    
    const potAfterMinRaise = state.pot + state.minRaise + state.currentBet;
    const stackAfterMinRaise = player.chips - state.minRaise - (state.currentBet - player.bet);
    const sprAfterMinRaise = this.calculateSPR(stackAfterMinRaise, potAfterMinRaise);

    // Calculate stack rankings
    const sortedStacks = state.players
      .filter(p => !p.folded)
      .map(p => p.chips)
      .sort((a, b) => b - a);
    
    const stackRank = sortedStacks.indexOf(player.chips) + 1;
    const percentile = ((sortedStacks.length - stackRank) / sortedStacks.length) * 100;

    return {
      effective_stacks: effectiveStacks,
      stack_rankings: {
        position: stackRank,
        percentile: percentile
      },
      stack_to_pot_ratio: {
        current_spr: spr,
        projected_spr_if_call: sprAfterCall,
        projected_spr_if_min_raise: sprAfterMinRaise,
        commitment_threshold: 0.33 // Generally pot committed at SPR < 0.33
      },
      commitment_levels: commitmentLevels
    };
  }

  // Helper methods
  private getPositionName(position: number, state: ReturnType<PokerEngine['getState']>): string {
    if (position === state.dealerPosition) return 'button';
    if (position === state.smallBlindPosition) return 'small_blind';
    if (position === state.bigBlindPosition) return 'big_blind';
    
    const positionInfo = PositionEvaluator.getPositionType(
      position,
      state.dealerPosition,
      state.players.length
    );
    
    return positionInfo.type.toLowerCase();
  }

  private mapPhaseToRound(phase: GamePhase): 'preflop' | 'flop' | 'turn' | 'river' {
    switch (phase) {
      case 'preflop': return 'preflop';
      case 'flop': return 'flop';
      case 'turn': return 'turn';
      case 'river': return 'river';
      default: return 'preflop';
    }
  }

  private getPlayerStatus(player: Player): 'active' | 'folded' | 'all_in' | 'sitting_out' {
    if (player.folded) return 'folded';
    if (player.allIn) return 'all_in';
    return 'active';
  }

  private calculateAmountInvested(player: Player, state: ReturnType<PokerEngine['getState']>): number {
    // This would need to be tracked throughout the hand
    // For now, estimate based on current bet and pot contribution
    // TODO: Properly track this in poker engine
    return player.bet + (player.position === state.bigBlindPosition ? this.BIG_BLIND : 0) +
           (player.position === state.smallBlindPosition ? this.SMALL_BLIND : 0);
  }

  private formatSidePots(sidePots: { amount: number; eligiblePlayers: string[] }[]): SidePot[] {
    return sidePots.map(sp => ({
      amount: sp.amount,
      eligible_players: sp.eligiblePlayers,
      created_by_player: sp.eligiblePlayers[0] // TODO: Track who created each side pot
    }));
  }

  private calculateSPR(stack: number, pot: number): number {
    return pot > 0 ? stack / pot : stack / this.BIG_BLIND;
  }
}