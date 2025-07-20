import { PokerEngine, Player, ActionType, PlayerAction, Card, GamePhase } from '../engine/poker-engine';
import { aiApiService, AIModelConfig } from './ai-api-service';
import { convertCardsForAI } from '../engine/poker-helpers';
import { AIDataCollector } from './ai-data-collector';
import { AIDecisionInput, AIPlayerInfo, HandAction, PotOdds } from './ai-data-structures';

export interface AIDecision {
  action: PlayerAction;
  reasoning: string;
  confidence: number;
  details?: {
    handStrength: number;
    potOdds: number;
    isBluffing: boolean;
    personality: string;
    cardEvaluation: string;
    mathBreakdown: string;
    modelUsed?: string;
  };
  handMisread?: boolean;
  illogicalPlay?: boolean;
  misreadDetails?: {
    actual: string;
    aiThought: string;
    severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  };
}

export interface AIPersonality {
  aggressionLevel: number; // 0-1 (0 = passive, 1 = aggressive)
  bluffFrequency: number; // 0-1 (0 = never bluff, 1 = always bluff)
  tightness: number; // 0-1 (0 = plays all hands, 1 = only premium hands)
  riskTolerance: number; // 0-1 (0 = risk averse, 1 = risk seeking)
}

export abstract class BaseAIAgent {
  protected personality: AIPersonality;
  protected id: string;
  protected name: string;
  protected modelConfig?: AIModelConfig;
  
  constructor(id: string, name: string, personality: AIPersonality, modelConfig?: AIModelConfig) {
    this.id = id;
    this.name = name;
    this.personality = personality;
    this.modelConfig = modelConfig;
  }

  abstract makeDecision(
    player: Player,
    gameState: ReturnType<PokerEngine['getState']>,
    validActions: ActionType[],
    actionHistory?: { player: string; action: string; amount?: number; round: GamePhase }[],
    handNumber?: number
  ): Promise<AIDecision>;


  protected async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Transform snake_case AI data structures to camelCase for GraphQL
  protected transformPlayerInfo(player: AIPlayerInfo) {
    return {
      seat: player.seat,
      id: player.id,
      name: player.name,
      stackSize: player.stack_size,
      position: player.position,
      positionType: player.position_type,
      status: player.status,
      amountInPot: player.amount_in_pot,
      amountInRound: player.amount_in_round,
      isAllIn: player.is_all_in,
      holeCardsKnown: player.hole_cards_known,
      holeCards: player.hole_cards,
      lastAction: player.last_action ? {
        action: player.last_action.action,
        amount: player.last_action.amount,
        timestamp: player.last_action.timestamp
      } : undefined
    };
  }

  protected transformHandAction(action: HandAction) {
    return {
      player: action.player,
      playerId: action.player_id,
      seat: action.seat,
      action: action.action,
      amount: action.amount,
      stackBefore: action.stack_before,
      stackAfter: action.stack_after,
      potAfter: action.pot_after
    };
  }

  protected transformPotOdds(potOdds: PotOdds) {
    return {
      toCall: potOdds.to_call,
      potSize: potOdds.pot_size,
      oddsRatio: potOdds.odds_ratio,
      percentage: potOdds.percentage,
      breakEvenPercentage: potOdds.break_even_percentage
    };
  }

  protected transformActionHistory(history: { preflop: HandAction[], flop: HandAction[], turn: HandAction[], river: HandAction[] }) {
    // Limit to last 10 actions per phase to reduce payload size
    const limitActions = (actions: HandAction[]) => actions.slice(-10).map(a => this.transformHandAction(a));
    
    return {
      preflop: limitActions(history.preflop),
      flop: limitActions(history.flop),
      turn: limitActions(history.turn),
      river: limitActions(history.river)
    };
  }
}

export class GamblerAI extends BaseAIAgent {
  private dataCollector: AIDataCollector;

  constructor(modelConfig?: AIModelConfig) {
    super('gambler', 'The Gambler', {
      aggressionLevel: 0.85,
      bluffFrequency: 0.4,
      tightness: 0.2,
      riskTolerance: 0.9
    }, modelConfig || {
      botId: 'gambler-gpt-4o',
      model: 'gpt-4o',
      personality: 'Aggressive risk-taker who loves to gamble'
    });
    this.dataCollector = new AIDataCollector();
  }

  async makeDecision(
    player: Player,
    gameState: ReturnType<PokerEngine['getState']>,
    validActions: ActionType[],
    actionHistory?: { player: string; action: string; amount?: number; round: GamePhase }[],
    handNumber: number = 1
  ): Promise<AIDecision> {
    // Simulate thinking time
    await this.delay(1000 + Math.random() * 2000);

    try {
      if (this.modelConfig) {
        // Use real AI model with comprehensive data
        console.log(`🎰 ${this.name} attempting AI decision via API...`);
        
        // Collect comprehensive AI data
        const aiData = this.dataCollector.collectAIData(
          player,
          gameState,
          validActions,
          handNumber,
          actionHistory || []
        );
        
        // Convert to backend format
        const apiGameState = {
          gameType: aiData.table.game_type,
          bettingStructure: aiData.table.betting_structure,
          maxPlayers: aiData.table.max_players,
          currentPlayers: aiData.table.current_players,
          activePlayers: aiData.table.active_players,
          smallBlind: aiData.table.small_blind,
          bigBlind: aiData.table.big_blind,
          ante: aiData.table.ante,
          level: aiData.table.level,
          handNumber: aiData.table.hand_number,
          dealerPosition: aiData.table.dealer_position,
          smallBlindPosition: aiData.table.small_blind_position,
          bigBlindPosition: aiData.table.big_blind_position,
          bettingRound: aiData.table.betting_round,
          communityCards: aiData.table.community_cards,
          potSize: aiData.table.pot_size,
          sidePots: aiData.table.side_pots.map(pot => ({
            amount: pot.amount,
            eligiblePlayers: pot.eligible_players,
            createdByPlayer: pot.created_by_player
          })),
          currentBet: aiData.table.current_bet,
          minRaise: aiData.table.min_raise,
          opponents: aiData.players
            .filter(p => p.id !== player.id && p.status !== 'folded') // Only include active players
            .map(p => this.transformPlayerInfo(p)),
          actionHistory: this.transformActionHistory(aiData.current_hand_history),
          mainPot: aiData.pot_breakdown.main_pot,
          totalPot: aiData.pot_breakdown.total_pot,
          effectiveStackSize: aiData.pot_breakdown.effective_stack_size,
          potOdds: this.transformPotOdds(aiData.pot_breakdown.pot_odds)
        };
        
        const apiPlayerState = {
          holeCards: aiData.personal.hole_cards,
          stackSize: aiData.personal.stack_size,
          position: aiData.personal.position,
          positionType: aiData.personal.position_type,
          seatNumber: aiData.personal.seat_number,
          isAllIn: aiData.personal.is_all_in,
          amountInvestedThisHand: aiData.personal.amount_invested_this_hand,
          amountInvestedThisRound: aiData.personal.amount_invested_this_round,
          amountToCall: aiData.personal.amount_to_call,
          canCheck: aiData.personal.can_check,
          canFold: aiData.personal.can_fold,
          canCall: aiData.personal.can_call,
          canRaise: aiData.personal.can_raise,
          minRaiseAmount: aiData.personal.min_raise_amount,
          maxRaiseAmount: aiData.personal.max_raise_amount,
          seatsToActAfter: aiData.position_data.seats_to_act_after,
          relativePosition: aiData.position_data.relative_position,
          playersLeftToAct: aiData.position_data.players_left_to_act,
          isClosingAction: aiData.position_data.is_closing_action,
          isOpenAction: aiData.position_data.is_open_action,
          effectiveStacks: JSON.stringify({ min: aiData.pot_breakdown.effective_stack_size }), // Only send min effective stack
          stackToPoRatio: aiData.stack_dynamics.stack_to_pot_ratio.current_spr,
          commitmentLevel: aiData.stack_dynamics.commitment_levels[player.id] || 0,
          handEvaluation: aiData.personal.hand_evaluation
        };
        
        const aiDecision = await aiApiService.getAIDecision(
          this.modelConfig,
          apiGameState,
          apiPlayerState,
          gameState.players.filter(p => !p.folded).length - 1
        );
        
        // Convert API response to game action
        const actionType = aiDecision.action;
        let gameAction: PlayerAction;
        
        if (actionType === 'all-in') {
          gameAction = { type: 'all-in' };
        } else if (actionType === 'raise' && aiDecision.amount) {
          gameAction = { type: 'raise', amount: aiDecision.amount };
        } else if (actionType === 'call') {
          const callAmount = gameState.currentBet - player.bet;
          gameAction = { type: 'call', amount: callAmount };
        } else if (actionType === 'check') {
          gameAction = { type: 'check' };
        } else if (actionType === 'fold') {
          gameAction = { type: 'fold' };
        } else {
          // Fallback
          gameAction = validActions.includes('check') ? { type: 'check' } : { type: 'fold' };
        }
        
        return {
          action: gameAction,
          reasoning: aiDecision.reasoning,
          confidence: aiDecision.confidence,
          details: {
            handStrength: 0, // No longer calculated
            potOdds: 0, // No longer calculated
            isBluffing: false, // Let AI express this in reasoning
            personality: `${this.name} powered by ${aiDecision.details.modelUsed}`,
            cardEvaluation: aiDecision.reasoning, // Use the reasoning as evaluation
            mathBreakdown: 'AI decision',
            modelUsed: aiDecision.details.modelUsed
          },
          handMisread: aiDecision.handMisread,
          illogicalPlay: aiDecision.illogicalPlay
        };
      }
    } catch (error) {
      console.error(`❌ ${this.name} AI API error, falling back to programmatic logic:`, error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        modelConfig: this.modelConfig,
      });
    }

    // Simple personality-based fallback
    const random = Math.random();
    
    // Gambler loves to take risks
    if (validActions.includes('all-in') && random < this.personality.riskTolerance * 0.2) {
      return {
        action: { type: 'all-in' },
        reasoning: "Fortune favors the bold! Let's gamble!",
        confidence: 0.8,
        details: {
          handStrength: 0,
          potOdds: 0,
          isBluffing: random < 0.5,
          personality: 'Gambler - All or nothing!',
          cardEvaluation: 'Playing by feel',
          mathBreakdown: 'Who needs math when you have luck?'
        }
      };
    }
    
    if (validActions.includes('raise') && random < this.personality.aggressionLevel) {
      const bigBlind = gameState.minRaise;
      const potSize = gameState.pot;
      const raiseAmount = Math.floor(potSize * (0.5 + random * 0.5));
      return {
        action: { type: 'raise', amount: Math.max(raiseAmount, bigBlind * 3) },
        reasoning: "Time to build a bigger pot!",
        confidence: 0.7,
        details: {
          handStrength: 0,
          potOdds: 0,
          isBluffing: random < this.personality.bluffFrequency,
          personality: 'Gambler - Aggressive',
          cardEvaluation: 'Feeling lucky',
          mathBreakdown: 'Raise it up!'
        }
      };
    }
    
    if (validActions.includes('call') && random < 0.7) {
      return {
        action: { type: 'call', amount: gameState.currentBet - player.bet },
        reasoning: "Can't win if you don't play!",
        confidence: 0.6,
        details: {
          handStrength: 0,
          potOdds: 0,
          isBluffing: false,
          personality: 'Gambler - Staying in',
          cardEvaluation: 'Worth a shot',
          mathBreakdown: 'Calling to see'
        }
      };
    }
    
    if (validActions.includes('check')) {
      return {
        action: { type: 'check' },
        reasoning: "Free card? Yes please!",
        confidence: 0.5,
        details: {
          handStrength: 0,
          potOdds: 0,
          isBluffing: false,
          personality: 'Gambler - Taking it easy',
          cardEvaluation: 'Waiting for action',
          mathBreakdown: 'Check and see'
        }
      };
    }

    return {
      action: { type: 'fold' },
      reasoning: "Live to gamble another hand!",
      confidence: 0.3,
      details: {
        handStrength: 0,
        potOdds: 0,
        isBluffing: false,
        personality: 'Gambler - Strategic fold',
        cardEvaluation: 'Not this time',
        mathBreakdown: 'Folding to fight again'
      }
    };
  }
}

export class TerminatorAI extends BaseAIAgent {
  private dataCollector: AIDataCollector;

  constructor(modelConfig?: AIModelConfig) {
    super('terminator', 'Terminator', {
      aggressionLevel: 0.7,
      bluffFrequency: 0.2,
      tightness: 0.6,
      riskTolerance: 0.5
    }, modelConfig || {
      botId: 'terminator-gpt-4o',
      model: 'gpt-4o',
      personality: 'Calculated, analytical player who maximizes expected value'
    });
    this.dataCollector = new AIDataCollector();
  }

  async makeDecision(
    player: Player,
    gameState: ReturnType<PokerEngine['getState']>,
    validActions: ActionType[],
    actionHistory?: { player: string; action: string; amount?: number; round: GamePhase }[],
    handNumber: number = 1
  ): Promise<AIDecision> {
    // Calculate optimal play
    await this.delay(2000 + Math.random() * 1000);

    try {
      if (this.modelConfig) {
        // Use real AI model
        // Collect comprehensive AI data
        const aiData = this.dataCollector.collectAIData(
          player,
          gameState,
          validActions,
          handNumber,
          actionHistory || []
        );
        
        // Convert to backend format
        const apiGameState = {
          gameType: aiData.table.game_type,
          bettingStructure: aiData.table.betting_structure,
          maxPlayers: aiData.table.max_players,
          currentPlayers: aiData.table.current_players,
          activePlayers: aiData.table.active_players,
          smallBlind: aiData.table.small_blind,
          bigBlind: aiData.table.big_blind,
          ante: aiData.table.ante,
          level: aiData.table.level,
          handNumber: aiData.table.hand_number,
          dealerPosition: aiData.table.dealer_position,
          smallBlindPosition: aiData.table.small_blind_position,
          bigBlindPosition: aiData.table.big_blind_position,
          bettingRound: aiData.table.betting_round,
          communityCards: aiData.table.community_cards,
          potSize: aiData.table.pot_size,
          sidePots: aiData.table.side_pots.map(pot => ({
            amount: pot.amount,
            eligiblePlayers: pot.eligible_players,
            createdByPlayer: pot.created_by_player
          })),
          currentBet: aiData.table.current_bet,
          minRaise: aiData.table.min_raise,
          opponents: aiData.players
            .filter(p => p.id !== player.id && p.status !== 'folded') // Only include active players
            .map(p => this.transformPlayerInfo(p)),
          actionHistory: this.transformActionHistory(aiData.current_hand_history),
          mainPot: aiData.pot_breakdown.main_pot,
          totalPot: aiData.pot_breakdown.total_pot,
          effectiveStackSize: aiData.pot_breakdown.effective_stack_size,
          potOdds: this.transformPotOdds(aiData.pot_breakdown.pot_odds)
        };
        
        const apiPlayerState = {
          holeCards: aiData.personal.hole_cards,
          stackSize: aiData.personal.stack_size,
          position: aiData.personal.position,
          positionType: aiData.personal.position_type,
          seatNumber: aiData.personal.seat_number,
          isAllIn: aiData.personal.is_all_in,
          amountInvestedThisHand: aiData.personal.amount_invested_this_hand,
          amountInvestedThisRound: aiData.personal.amount_invested_this_round,
          amountToCall: aiData.personal.amount_to_call,
          canCheck: aiData.personal.can_check,
          canFold: aiData.personal.can_fold,
          canCall: aiData.personal.can_call,
          canRaise: aiData.personal.can_raise,
          minRaiseAmount: aiData.personal.min_raise_amount,
          maxRaiseAmount: aiData.personal.max_raise_amount,
          seatsToActAfter: aiData.position_data.seats_to_act_after,
          relativePosition: aiData.position_data.relative_position,
          playersLeftToAct: aiData.position_data.players_left_to_act,
          isClosingAction: aiData.position_data.is_closing_action,
          isOpenAction: aiData.position_data.is_open_action,
          effectiveStacks: JSON.stringify({ min: aiData.pot_breakdown.effective_stack_size }), // Only send min effective stack
          stackToPoRatio: aiData.stack_dynamics.stack_to_pot_ratio.current_spr,
          commitmentLevel: aiData.stack_dynamics.commitment_levels[player.id] || 0,
          handEvaluation: aiData.personal.hand_evaluation
        };
        
        const aiDecision = await aiApiService.getAIDecision(
          this.modelConfig,
          apiGameState,
          apiPlayerState,
          gameState.players.filter(p => !p.folded).length - 1
        );
        
        // Convert API response to game action
        const actionType = aiDecision.action;
        let gameAction: PlayerAction;
        
        if (actionType === 'all-in') {
          gameAction = { type: 'all-in' };
        } else if (actionType === 'raise' && aiDecision.amount) {
          gameAction = { type: 'raise', amount: aiDecision.amount };
        } else if (actionType === 'call') {
          const callAmount = gameState.currentBet - player.bet;
          gameAction = { type: 'call', amount: callAmount };
        } else if (actionType === 'check') {
          gameAction = { type: 'check' };
        } else if (actionType === 'fold') {
          gameAction = { type: 'fold' };
        } else {
          // Fallback
          gameAction = validActions.includes('check') ? { type: 'check' } : { type: 'fold' };
        }
        
        return {
          action: gameAction,
          reasoning: aiDecision.reasoning,
          confidence: aiDecision.confidence,
          details: {
            handStrength: 0, // No longer calculated
            potOdds: 0, // No longer calculated
            isBluffing: false, // Let AI express this in reasoning
            personality: `${this.name} powered by ${aiDecision.details.modelUsed}`,
            cardEvaluation: aiDecision.reasoning, // Use the reasoning as evaluation
            mathBreakdown: 'AI decision',
            modelUsed: aiDecision.details.modelUsed
          },
          handMisread: aiDecision.handMisread,
          illogicalPlay: aiDecision.illogicalPlay
        };
      }
    } catch (error) {
      console.error(`❌ ${this.name} AI API error, falling back to programmatic logic:`, error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        modelConfig: this.modelConfig,
      });
    }

    // Simple personality-based fallback
    const random = Math.random();
    
    // Terminator is calculated but aggressive
    if (validActions.includes('raise') && random < this.personality.aggressionLevel) {
      const bigBlind = gameState.minRaise;
      const potSize = gameState.pot;
      const raiseAmount = Math.floor(potSize * (0.6 + random * 0.4));
      return {
        action: { type: 'raise', amount: Math.max(raiseAmount, bigBlind * 3) },
        reasoning: "Target acquired. Applying pressure.",
        confidence: 0.7,
        details: {
          handStrength: 0,
          potOdds: 0,
          isBluffing: random < this.personality.bluffFrequency,
          personality: 'Terminator - Calculated aggression',
          cardEvaluation: 'Processing situation',
          mathBreakdown: 'Optimal play calculated'
        }
      };
    }
    
    if (validActions.includes('call') && random < 0.6) {
      return {
        action: { type: 'call', amount: gameState.currentBet - player.bet },
        reasoning: "Continuing mission. Acceptable risk.",
        confidence: 0.6,
        details: {
          handStrength: 0,
          potOdds: 0,
          isBluffing: false,
          personality: 'Terminator - Strategic call',
          cardEvaluation: 'Analyzing patterns',
          mathBreakdown: 'EV calculation in progress'
        }
      };
    }
    
    if (validActions.includes('check')) {
      return {
        action: { type: 'check' },
        reasoning: "Gathering information. No threat detected.",
        confidence: 0.5,
        details: {
          handStrength: 0,
          potOdds: 0,
          isBluffing: false,
          personality: 'Terminator - Information gathering',
          cardEvaluation: 'Observing opponents',
          mathBreakdown: 'Waiting for better spot'
        }
      };
    }

    return {
      action: { type: 'fold' },
      reasoning: "Strategic retreat. Preserving resources.",
      confidence: 0.3,
      details: {
        handStrength: 0,
        potOdds: 0,
        isBluffing: false,
        personality: 'Terminator - Tactical fold',
        cardEvaluation: 'Unfavorable conditions',
        mathBreakdown: 'Negative expected value'
      }
    };
  }
}

export class ZenMasterAI extends BaseAIAgent {
  private dataCollector: AIDataCollector;

  constructor(modelConfig?: AIModelConfig) {
    super('zenmaster', 'Zen Master', {
      aggressionLevel: 0.4,
      bluffFrequency: 0.1,
      tightness: 0.8,
      riskTolerance: 0.3
    }, modelConfig || {
      botId: 'zenmaster-gpt-4o',
      model: 'gpt-4o',
      personality: 'Patient, disciplined player who waits for premium hands'
    });
    this.dataCollector = new AIDataCollector();
  }

  async makeDecision(
    player: Player,
    gameState: ReturnType<PokerEngine['getState']>,
    validActions: ActionType[],
    actionHistory?: { player: string; action: string; amount?: number; round: GamePhase }[],
    handNumber: number = 1
  ): Promise<AIDecision> {
    // Patient, thoughtful play
    await this.delay(3000 + Math.random() * 2000);

    try {
      if (this.modelConfig) {
        // Use real AI model
        // Collect comprehensive AI data
        const aiData = this.dataCollector.collectAIData(
          player,
          gameState,
          validActions,
          handNumber,
          actionHistory || []
        );
        
        // Convert to backend format
        const apiGameState = {
          gameType: aiData.table.game_type,
          bettingStructure: aiData.table.betting_structure,
          maxPlayers: aiData.table.max_players,
          currentPlayers: aiData.table.current_players,
          activePlayers: aiData.table.active_players,
          smallBlind: aiData.table.small_blind,
          bigBlind: aiData.table.big_blind,
          ante: aiData.table.ante,
          level: aiData.table.level,
          handNumber: aiData.table.hand_number,
          dealerPosition: aiData.table.dealer_position,
          smallBlindPosition: aiData.table.small_blind_position,
          bigBlindPosition: aiData.table.big_blind_position,
          bettingRound: aiData.table.betting_round,
          communityCards: aiData.table.community_cards,
          potSize: aiData.table.pot_size,
          sidePots: aiData.table.side_pots.map(pot => ({
            amount: pot.amount,
            eligiblePlayers: pot.eligible_players,
            createdByPlayer: pot.created_by_player
          })),
          currentBet: aiData.table.current_bet,
          minRaise: aiData.table.min_raise,
          opponents: aiData.players
            .filter(p => p.id !== player.id && p.status !== 'folded') // Only include active players
            .map(p => this.transformPlayerInfo(p)),
          actionHistory: this.transformActionHistory(aiData.current_hand_history),
          mainPot: aiData.pot_breakdown.main_pot,
          totalPot: aiData.pot_breakdown.total_pot,
          effectiveStackSize: aiData.pot_breakdown.effective_stack_size,
          potOdds: this.transformPotOdds(aiData.pot_breakdown.pot_odds)
        };
        
        const apiPlayerState = {
          holeCards: aiData.personal.hole_cards,
          stackSize: aiData.personal.stack_size,
          position: aiData.personal.position,
          positionType: aiData.personal.position_type,
          seatNumber: aiData.personal.seat_number,
          isAllIn: aiData.personal.is_all_in,
          amountInvestedThisHand: aiData.personal.amount_invested_this_hand,
          amountInvestedThisRound: aiData.personal.amount_invested_this_round,
          amountToCall: aiData.personal.amount_to_call,
          canCheck: aiData.personal.can_check,
          canFold: aiData.personal.can_fold,
          canCall: aiData.personal.can_call,
          canRaise: aiData.personal.can_raise,
          minRaiseAmount: aiData.personal.min_raise_amount,
          maxRaiseAmount: aiData.personal.max_raise_amount,
          seatsToActAfter: aiData.position_data.seats_to_act_after,
          relativePosition: aiData.position_data.relative_position,
          playersLeftToAct: aiData.position_data.players_left_to_act,
          isClosingAction: aiData.position_data.is_closing_action,
          isOpenAction: aiData.position_data.is_open_action,
          effectiveStacks: JSON.stringify({ min: aiData.pot_breakdown.effective_stack_size }), // Only send min effective stack
          stackToPoRatio: aiData.stack_dynamics.stack_to_pot_ratio.current_spr,
          commitmentLevel: aiData.stack_dynamics.commitment_levels[player.id] || 0,
          handEvaluation: aiData.personal.hand_evaluation
        };
        
        const aiDecision = await aiApiService.getAIDecision(
          this.modelConfig,
          apiGameState,
          apiPlayerState,
          gameState.players.filter(p => !p.folded).length - 1
        );
        
        // Convert API response to game action
        const actionType = aiDecision.action;
        let gameAction: PlayerAction;
        
        if (actionType === 'all-in') {
          gameAction = { type: 'all-in' };
        } else if (actionType === 'raise' && aiDecision.amount) {
          gameAction = { type: 'raise', amount: aiDecision.amount };
        } else if (actionType === 'call') {
          const callAmount = gameState.currentBet - player.bet;
          gameAction = { type: 'call', amount: callAmount };
        } else if (actionType === 'check') {
          gameAction = { type: 'check' };
        } else if (actionType === 'fold') {
          gameAction = { type: 'fold' };
        } else {
          // Fallback
          gameAction = validActions.includes('check') ? { type: 'check' } : { type: 'fold' };
        }
        
        return {
          action: gameAction,
          reasoning: aiDecision.reasoning,
          confidence: aiDecision.confidence,
          details: {
            handStrength: 0, // No longer calculated
            potOdds: 0, // No longer calculated
            isBluffing: false, // Let AI express this in reasoning
            personality: `${this.name} powered by ${aiDecision.details.modelUsed}`,
            cardEvaluation: aiDecision.reasoning, // Use the reasoning as evaluation
            mathBreakdown: 'AI decision',
            modelUsed: aiDecision.details.modelUsed
          },
          handMisread: aiDecision.handMisread,
          illogicalPlay: aiDecision.illogicalPlay
        };
      }
    } catch (error) {
      console.error(`❌ ${this.name} AI API error, falling back to programmatic logic:`, error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        modelConfig: this.modelConfig,
      });
    }

    // Simple personality-based fallback
    const random = Math.random();
    
    // Zen Master is patient and rarely aggressive
    if (validActions.includes('raise') && random < this.personality.aggressionLevel * 0.5) {
      const bigBlind = gameState.minRaise;
      const potSize = gameState.pot;
      const raiseAmount = Math.floor(potSize * 0.5); // Smaller raises
      return {
        action: { type: 'raise', amount: Math.max(raiseAmount, bigBlind * 2) },
        reasoning: "The moment is right. Strike with purpose.",
        confidence: 0.8,
        details: {
          handStrength: 0,
          potOdds: 0,
          isBluffing: random < this.personality.bluffFrequency,
          personality: 'Zen Master - Selective aggression',
          cardEvaluation: 'Reading the flow',
          mathBreakdown: 'Harmonious play'
        }
      };
    }
    
    // Zen Master is very selective about calling
    if (validActions.includes('call') && random < (1 - this.personality.tightness) * 0.3) {
      return {
        action: { type: 'call', amount: gameState.currentBet - player.bet },
        reasoning: "The river flows where it must.",
        confidence: 0.5,
        details: {
          handStrength: 0,
          potOdds: 0,
          isBluffing: false,
          personality: 'Zen Master - Mindful call',
          cardEvaluation: 'Sensing opportunity',
          mathBreakdown: 'Following the path'
        }
      };
    }
    
    // Zen Master prefers to check and observe
    if (validActions.includes('check')) {
      return {
        action: { type: 'check' },
        reasoning: "Observe and wait. All is revealed in time.",
        confidence: 0.6,
        details: {
          handStrength: 0,
          potOdds: 0,
          isBluffing: false,
          personality: 'Zen Master - Patient observer',
          cardEvaluation: 'Watching the patterns',
          mathBreakdown: 'Waiting for clarity'
        }
      };
    }

    return {
      action: { type: 'fold' },
      reasoning: "Wisdom lies in knowing when to retreat.",
      confidence: 0.4,
      details: {
        handStrength: 0,
        potOdds: 0,
        isBluffing: false,
        personality: 'Zen Master - Disciplined fold',
        cardEvaluation: 'Not the right moment',
        mathBreakdown: 'Preserving balance'
      }
    };
  }
}

// Generic AI Agent for custom bots
export class GenericAIAgent extends BaseAIAgent {
  private dataCollector: AIDataCollector;

  constructor(id: string, name: string, personality: AIPersonality, modelConfig?: AIModelConfig) {
    super(id, name, personality, modelConfig);
    this.dataCollector = new AIDataCollector();
  }

  async makeDecision(
    player: Player,
    gameState: ReturnType<PokerEngine['getState']>,
    validActions: ActionType[],
    actionHistory?: { player: string; action: string; amount?: number; round: GamePhase }[],
    handNumber: number = 1
  ): Promise<AIDecision> {
    // Simulate thinking time
    await this.delay(1000 + Math.random() * 2000);
    
    return this.getAIDecision(player, gameState, validActions, actionHistory, handNumber);
  }

  protected async getAIDecision(
    player: Player,
    gameState: ReturnType<PokerEngine['getState']>,
    validActions: ActionType[],
    actionHistory?: { player: string; action: string; amount?: number; round: GamePhase }[],
    handNumber: number = 1
  ): Promise<AIDecision> {
    // Use the same API-based decision logic as other AI agents
    if (this.modelConfig) {
      const aiData = this.dataCollector.collectAIData(
        player,
        gameState,
        validActions,
        handNumber,
        actionHistory || []
      );
      
      const apiGameState = {
        gameType: aiData.table.game_type,
        bettingStructure: aiData.table.betting_structure,
        maxPlayers: aiData.table.max_players,
        currentPlayers: aiData.table.current_players,
        activePlayers: aiData.table.active_players,
        smallBlind: aiData.table.small_blind,
        bigBlind: aiData.table.big_blind,
        ante: aiData.table.ante,
        level: aiData.table.level,
        handNumber: aiData.table.hand_number,
        dealerPosition: aiData.table.dealer_position,
        smallBlindPosition: aiData.table.small_blind_position,
        bigBlindPosition: aiData.table.big_blind_position,
        bettingRound: aiData.table.betting_round,
        communityCards: aiData.table.community_cards,
        potSize: aiData.table.pot_size,
        sidePots: aiData.table.side_pots.map(pot => ({
          amount: pot.amount,
          eligiblePlayers: pot.eligible_players,
          createdByPlayer: pot.created_by_player
        })),
        currentBet: aiData.table.current_bet,
        minRaise: aiData.table.min_raise,
        opponents: aiData.players
          .filter(p => p.id !== player.id && p.status !== 'folded')
          .map(p => this.transformPlayerInfo(p)),
        actionHistory: this.transformActionHistory(aiData.current_hand_history),
        mainPot: aiData.pot_breakdown.main_pot,
        totalPot: aiData.pot_breakdown.total_pot,
        effectiveStackSize: aiData.pot_breakdown.effective_stack_size,
        potOdds: this.transformPotOdds(aiData.pot_breakdown.pot_odds)
      };
      
      const apiPlayerState = {
        holeCards: aiData.personal.hole_cards,
        stackSize: aiData.personal.stack_size,
        position: aiData.personal.position,
        positionType: aiData.personal.position_type,
        seatNumber: aiData.personal.seat_number,
        isAllIn: aiData.personal.is_all_in,
        amountInvestedThisHand: aiData.personal.amount_invested_this_hand,
        amountInvestedThisRound: aiData.personal.amount_invested_this_round,
        amountToCall: aiData.personal.amount_to_call,
        canCheck: aiData.personal.can_check,
        canFold: aiData.personal.can_fold,
        canCall: aiData.personal.can_call,
        canRaise: aiData.personal.can_raise,
        minRaiseAmount: aiData.personal.min_raise_amount,
        maxRaiseAmount: aiData.personal.max_raise_amount,
        seatsToActAfter: aiData.position_data.seats_to_act_after,
        relativePosition: aiData.position_data.relative_position,
        playersLeftToAct: aiData.position_data.players_left_to_act,
        isClosingAction: aiData.position_data.is_closing_action,
        isOpenAction: aiData.position_data.is_open_action,
        effectiveStacks: JSON.stringify({ min: aiData.pot_breakdown.effective_stack_size }),
        stackToPoRatio: aiData.stack_dynamics.stack_to_pot_ratio.current_spr,
        commitmentLevel: aiData.stack_dynamics.commitment_levels[player.id] || 0,
        handEvaluation: aiData.personal.hand_evaluation
      };
      
      const aiDecision = await aiApiService.getAIDecision(
        this.modelConfig,
        apiGameState,
        apiPlayerState,
        gameState.players.filter(p => !p.folded).length - 1
      );
      
      const actionType = aiDecision.action;
      let gameAction: PlayerAction;
      
      switch (actionType) {
        case 'fold':
          gameAction = { type: 'fold' };
          break;
        case 'check':
          gameAction = { type: 'check' };
          break;
        case 'call':
          gameAction = { type: 'call', amount: aiData.personal.amount_to_call };
          break;
        case 'raise':
          gameAction = { type: 'raise', amount: aiDecision.amount || aiData.personal.min_raise_amount };
          break;
        case 'all-in':
          gameAction = { type: 'all-in', amount: player.chips };
          break;
        default:
          gameAction = { type: 'fold' };
      }
      
      return {
        action: gameAction,
        reasoning: aiDecision.reasoning,
        confidence: aiDecision.confidence,
        details: {
          handStrength: 0.5,
          potOdds: 0,
          isBluffing: false,
          personality: `${this.name} - AI-driven decision`,
          cardEvaluation: aiDecision.details?.handEvaluation || 'Unknown',
          mathBreakdown: aiDecision.details?.expectedValue || 'Not calculated'
        },
        handMisread: aiDecision.handMisread,
        illogicalPlay: aiDecision.illogicalPlay
      };
    }
    
    // Fallback to personality-based logic
    return this.getFallbackDecision(player, gameState, validActions);
  }

  protected getFallbackDecision(
    player: Player,
    gameState: ReturnType<PokerEngine['getState']>,
    validActions: ActionType[]
  ): AIDecision {
    // Simple fallback logic based on personality
    const canCheck = validActions.includes('check');
    const canCall = validActions.includes('call');
    const canRaise = validActions.includes('raise');
    const canBet = validActions.includes('bet');
    
    // Decide based on personality aggressiveness
    let action: PlayerAction;
    let reasoning: string;
    
    if (this.personality.aggressionLevel > 0.7 && (canRaise || canBet)) {
      // Aggressive personality - raise or bet
      action = canRaise ? { type: 'raise', amount: gameState.minRaise } : { type: 'bet', amount: gameState.minRaise };
      reasoning = `${this.name} makes an aggressive move based on personality`;
    } else if (canCheck) {
      // Check if possible
      action = { type: 'check' };
      reasoning = `${this.name} checks to see more cards`;
    } else if (canCall && this.personality.tightness < 0.5) {
      // Loose player - more likely to call
      action = { type: 'call' };
      reasoning = `${this.name} calls based on loose playing style`;
    } else {
      // Default to fold
      action = { type: 'fold' };
      reasoning = `${this.name} folds - waiting for better opportunity`;
    }
    
    return {
      action,
      reasoning,
      confidence: 0.5,
      details: {
        handStrength: 0.5,
        potOdds: 0,
        isBluffing: false,
        personality: `${this.name} - Fallback decision`,
        cardEvaluation: 'Unable to evaluate',
        mathBreakdown: 'No calculation available'
      }
    };
  }
}

export class AIAgentManager {
  private agents: Map<string, BaseAIAgent> = new Map();

  constructor() {
    // Don't initialize agents in constructor anymore
    // They will be initialized with configurations
  }

  initializeWithConfigs(playerInfos: Array<{
    id: string;
    name: string;
    aiModel?: 'deepseek-chat' | 'gpt-4o' | 'claude-3-5-sonnet' | 'claude-3-opus';
  }>): void {
    // Clear existing agents
    this.agents.clear();
    
    playerInfos.forEach(playerInfo => {
      const personality = this.getPersonalityForBot(playerInfo.id);
      const modelConfig = playerInfo.aiModel ? {
        botId: `${playerInfo.id}-${playerInfo.aiModel}`,
        model: playerInfo.aiModel,
        useRealAPI: true
      } : undefined;
      
      let agent: BaseAIAgent;
      
      // Create specific agent based on ID
      if (playerInfo.id === 'gambler') {
        agent = new GamblerAI(modelConfig);
      } else if (playerInfo.id === 'terminator') {
        agent = new TerminatorAI(modelConfig);
      } else if (playerInfo.id === 'zenmaster') {
        agent = new ZenMasterAI(modelConfig);
      } else {
        // Create generic agent with personality
        agent = new GenericAIAgent(playerInfo.id, playerInfo.name, personality, modelConfig);
      }
      
      this.agents.set(playerInfo.id, agent);
    });
  }
  
  private getPersonalityForBot(botId: string): AIPersonality {
    // Return personality based on bot ID or name
    if (botId.includes('gambler')) {
      return {
        aggressionLevel: 0.8,
        bluffFrequency: 0.6,
        tightness: 0.3,
        riskTolerance: 0.9
      };
    } else if (botId.includes('terminator')) {
      return {
        aggressionLevel: 0.9,
        bluffFrequency: 0.2,
        tightness: 0.7,
        riskTolerance: 0.5
      };
    } else if (botId.includes('zen')) {
      return {
        aggressionLevel: 0.3,
        bluffFrequency: 0.4,
        tightness: 0.8,
        riskTolerance: 0.2
      };
    } else if (botId.includes('shark')) {
      return {
        aggressionLevel: 0.7,
        bluffFrequency: 0.3,
        tightness: 0.6,
        riskTolerance: 0.5
      };
    } else if (botId.includes('bluffer')) {
      return {
        aggressionLevel: 0.7,
        bluffFrequency: 0.8,
        tightness: 0.4,
        riskTolerance: 0.6
      };
    } else {
      // Default balanced personality
      return {
        aggressionLevel: 0.5,
        bluffFrequency: 0.4,
        tightness: 0.5,
        riskTolerance: 0.5
      };
    }
  }

  getAgent(id: string): BaseAIAgent | undefined {
    // If agent doesn't exist, create a generic one
    if (!this.agents.has(id)) {
      // Create additional bots with varied personalities
      const personalities = [
        { aggression: 0.6, bluff: 0.3, tight: 0.5, risk: 0.6 }, // Balanced
        { aggression: 0.8, bluff: 0.5, tight: 0.3, risk: 0.8 }, // Aggressive
        { aggression: 0.3, bluff: 0.1, tight: 0.7, risk: 0.3 }, // Tight
        { aggression: 0.7, bluff: 0.6, tight: 0.4, risk: 0.7 }, // Bluffer
        { aggression: 0.5, bluff: 0.2, tight: 0.6, risk: 0.4 }, // Cautious
        { aggression: 0.9, bluff: 0.4, tight: 0.2, risk: 0.9 }  // Maniac
      ];
      
      // Pick a personality based on the ID
      const index = id.includes('bot-') ? parseInt(id.split('-')[1]) % personalities.length : 0;
      const personality = personalities[index];
      
      const newAgent = new class extends BaseAIAgent {
        async makeDecision(
          player: Player,
          gameState: ReturnType<PokerEngine['getState']>,
          validActions: ActionType[],
          actionHistory?: { player: string; action: string; amount?: number; round: GamePhase }[],
          handNumber: number = 1
        ): Promise<AIDecision> {
          // Simulate thinking
          await this.delay(1500 + Math.random() * 1500);
          
          const random = Math.random();
          
          // Personality-based decisions
          if (validActions.includes('raise') && random < this.personality.aggressionLevel) {
            const bigBlind = gameState.minRaise;
            const potSize = gameState.pot;
            const raiseAmount = Math.floor(potSize * (0.5 + random * 0.5));
            return {
              action: { type: 'raise', amount: Math.max(raiseAmount, bigBlind * 2) },
              reasoning: "Taking control of the pot.",
              confidence: 0.6 + this.personality.aggressionLevel * 0.2,
              details: {
                handStrength: 0,
                potOdds: 0,
                isBluffing: random < this.personality.bluffFrequency,
                personality: `${player.name} - Playing their style`,
                cardEvaluation: 'Reading the table',
                mathBreakdown: 'Following instincts'
              }
            };
          }
          
          if (validActions.includes('call') && random < (1 - this.personality.tightness)) {
            return {
              action: { type: 'call', amount: gameState.currentBet - player.bet },
              reasoning: "Staying in the hand.",
              confidence: 0.5,
              details: {
                handStrength: 0,
                potOdds: 0,
                isBluffing: false,
                personality: `${player.name} - Continuing`,
                cardEvaluation: 'Worth seeing',
                mathBreakdown: 'Pot committed'
              }
            };
          }
          
          if (validActions.includes('check')) {
            return {
              action: { type: 'check' },
              reasoning: "Checking to see what develops.",
              confidence: 0.5,
              details: {
                handStrength: 0,
                potOdds: 0,
                isBluffing: false,
                personality: `${player.name} - Passive line`,
                cardEvaluation: 'Waiting for information',
                mathBreakdown: 'Free card'
              }
            };
          }
          
          return {
            action: { type: 'fold' },
            reasoning: "Not worth continuing.",
            confidence: 0.2,
            details: {
              handStrength: 0,
              potOdds: 0,
              isBluffing: false,
              personality: `${player.name} - Saving chips`,
              cardEvaluation: 'Unfavorable spot',
              mathBreakdown: 'Cut losses'
            }
          };
        }
      }(
        id,
        id,
        {
          aggressionLevel: personality.aggression,
          bluffFrequency: personality.bluff,
          tightness: personality.tight,
          riskTolerance: personality.risk
        }
      );
      
      this.agents.set(id, newAgent);
    }
    
    return this.agents.get(id);
  }

  getAllAgents(): BaseAIAgent[] {
    return Array.from(this.agents.values());
  }
}