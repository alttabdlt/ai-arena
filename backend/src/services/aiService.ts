import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface SidePot {
  amount: number;
  eligiblePlayers: string[];
  createdByPlayer?: string;
}

export interface LastAction {
  action: string;
  amount?: number;
  timestamp: number;
}

export interface OpponentInfo {
  seat: number;
  id: string;
  name: string;
  stackSize: number;
  position: string;
  positionType: 'EP' | 'MP' | 'LP' | 'SB' | 'BB';
  status: 'active' | 'folded' | 'all_in' | 'sitting_out';
  amountInPot: number;
  amountInRound: number;
  isAllIn: boolean;
  holeCardsKnown: boolean;
  holeCards?: string[];
  lastAction?: LastAction;
}

export interface HandAction {
  player: string;
  playerId: string;
  seat: number;
  action: string;
  amount?: number;
  stackBefore: number;
  stackAfter: number;
  potAfter: number;
}

export interface ActionHistory {
  preflop: HandAction[];
  flop: HandAction[];
  turn: HandAction[];
  river: HandAction[];
}

export interface PotOdds {
  toCall: number;
  potSize: number;
  oddsRatio: string;
  percentage: number;
  breakEvenPercentage: number;
}

export interface PokerGameState {
  // Table info
  gameType: 'no_limit_holdem';
  bettingStructure: 'tournament' | 'cash_game';
  maxPlayers: number;
  currentPlayers: number;
  activePlayers: number;
  
  // Blinds
  smallBlind: number;
  bigBlind: number;
  ante: number;
  level: number;
  
  // Current hand
  handNumber: number;
  dealerPosition: number;
  smallBlindPosition: number;
  bigBlindPosition: number;
  bettingRound: 'preflop' | 'flop' | 'turn' | 'river';
  communityCards: string[];
  potSize: number;
  sidePots: SidePot[];
  currentBet: number;
  minRaise: number;
  
  // Players
  opponents: OpponentInfo[];
  
  // Action history
  actionHistory: ActionHistory;
  
  // Pot breakdown
  mainPot: number;
  totalPot: number;
  effectiveStackSize: number;
  potOdds: PotOdds;
}

export interface PlayerState {
  // Personal data
  holeCards: string[];
  stackSize: number;
  position: string;
  positionType: 'EP' | 'MP' | 'LP' | 'SB' | 'BB';
  seatNumber: number;
  isAllIn: boolean;
  amountInvestedThisHand: number;
  amountInvestedThisRound: number;
  amountToCall: number;
  
  // Available actions
  canCheck: boolean;
  canFold: boolean;
  canCall: boolean;
  canRaise: boolean;
  minRaiseAmount: number;
  maxRaiseAmount: number;
  
  // Position data
  seatsToActAfter: number;
  relativePosition: string;
  playersLeftToAct: string[];
  isClosingAction: boolean;
  isOpenAction: boolean;
  
  // Stack dynamics
  effectiveStacks: string | { [key: string]: number }; // Can be JSON string from GraphQL
  stackToPoRatio: number;
  commitmentLevel: number;
  
  // Hand evaluation
  handEvaluation?: string; // Current hand strength (e.g., "Straight (9 high)")
}

export interface AIPokerDecision {
  action: 'fold' | 'check' | 'call' | 'raise' | 'all-in';
  amount?: number;
  reasoning: string;
  confidence: number;
  details: {
    handEvaluation: string;
    potOdds: string;
    expectedValue: string;
    bluffProbability: number;
    modelUsed: string;
  };
}

export interface HandMisread {
  handNumber: number;
  actual: string;
  aiThought: string;
  holeCards: string[];
  boardCards: string[];
  phase: string;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
}

export interface IllogicalDecision {
  handNumber: number;
  decision: string;
  reason: string;
  gameState: {
    pot: number;
    toCall: number;
    canCheck: boolean;
  };
}

export interface ModelEvaluation {
  modelName: string;
  handsPlayed: number;
  handMisreads: HandMisread[];
  illogicalDecisions: IllogicalDecision[];
  misreadRate: number;
  illogicalRate: number;
}

export class AIService {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private deepseek: OpenAI | null = null;
  private modelEvaluations: Map<string, ModelEvaluation> = new Map();
  private currentHandNumber: number = 0;

  private extractJSON(content: string): any {
    // Try direct parsing first
    try {
      return JSON.parse(content);
    } catch (e) {
      console.log('Direct JSON parsing failed, attempting extraction...');
      
      // Try to extract from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
      if (jsonMatch) {
        console.log('Found JSON in markdown code block');
        return JSON.parse(jsonMatch[1]);
      }
      
      // Try to find JSON object in the content
      const objectMatch = content.match(/{[\s\S]*}/);
      if (objectMatch) {
        console.log('Found JSON object in content');
        return JSON.parse(objectMatch[0]);
      }
      
      console.error('Failed to extract JSON from content:', content.substring(0, 200) + '...');
      throw new Error('No valid JSON found in response');
    }
  }

  constructor() {
    if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('YOUR_OPENAI_KEY_HERE')) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      console.log('✅ OpenAI API configured');
    } else {
      console.log('⚠️  OpenAI API key not configured - using fallback logic');
    }

    if (process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.includes('YOUR_ANTHROPIC_KEY_HERE')) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      console.log('✅ Anthropic API configured');
    } else {
      console.log('⚠️  Anthropic API key not configured - using fallback logic');
    }

    if (process.env.DEEPSEEK_API_KEY && !process.env.DEEPSEEK_API_KEY.includes('YOUR_DEEPSEEK_KEY_HERE')) {
      this.deepseek = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com/v1',
      });
      console.log('✅ Deepseek API configured with key:', process.env.DEEPSEEK_API_KEY.substring(0, 10) + '...');
    } else {
      console.log('⚠️  Deepseek API key not configured - using fallback logic');
      console.log('   Current DEEPSEEK_API_KEY value:', process.env.DEEPSEEK_API_KEY);
    }
  }

  async getPokerDecision(
    botId: string,
    gameState: PokerGameState,
    playerState: PlayerState,
    opponents: number,
    model: 'gpt-4o' | 'deepseek-chat' | 'claude-3-5-sonnet' | 'claude-3-opus'
  ): Promise<AIPokerDecision> {
    console.log(`🤖 AI Decision Request - Bot: ${botId}, Model: ${model}`);
    
    // Track hand number for evaluation
    this.currentHandNumber = gameState.handNumber;
    
    // Initialize model evaluation if needed
    if (!this.modelEvaluations.has(model)) {
      this.modelEvaluations.set(model, {
        modelName: model,
        handsPlayed: 0,
        handMisreads: [],
        illogicalDecisions: [],
        misreadRate: 0,
        illogicalRate: 0
      });
    }
    
    // Use neutral prompt for all models
    const prompt = this.buildNeutralPokerPrompt(gameState, playerState);
    
    console.log(`📏 Neutral prompt length: ${prompt.length} characters`);

    try {
      let decision: AIPokerDecision;
      
      switch(model) {
        case 'deepseek-chat':
          console.log('📡 Calling Deepseek API...');
          decision = await this.getDeepseekDecision(prompt, gameState, playerState);
          break;
        case 'gpt-4o':
          console.log('📡 Calling OpenAI API...');
          decision = await this.getOpenAIDecision(prompt, gameState, playerState);
          break;
        case 'claude-3-5-sonnet':
          console.log('📡 Calling Claude 3.5 Sonnet API...');
          decision = await this.getClaudeDecision(prompt, gameState, playerState, 'claude-3-5-sonnet-20241022');
          break;
        case 'claude-3-opus':
          console.log('📡 Calling Claude 3 Opus API...');
          decision = await this.getClaudeDecision(prompt, gameState, playerState, 'claude-3-opus-20240229');
          break;
        default:
          throw new Error(`Unsupported model: ${model}`);
      }
      
      // Track and evaluate decision quality
      this.evaluateDecision(model, decision, gameState, playerState);
      
      return decision;
    } catch (error) {
      console.error(`❌ AI model error for ${model}:`, error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      console.log('⚠️  Falling back to programmatic logic');
      return this.getFallbackDecision(gameState, playerState);
    }
  }

  private buildNeutralPokerPrompt(
    gameState: PokerGameState,
    playerState: PlayerState
  ): string {
    // Just the facts - no coaching, no hints, no explanations
    const bb = gameState.bigBlind || 50; // Default to 50 if not set
    const opponents = gameState.opponents
      .filter(o => o.status === 'active')
      .map(o => ({
        position: o.seat,
        chips: o.stackSize,
        chipsInBB: parseFloat((o.stackSize / bb).toFixed(1)),
        currentBet: o.amountInRound,
        status: o.status
      }));

    // Simple action history - just what happened
    const formatActions = (actions: HandAction[]) => {
      if (actions.length === 0) return [];
      return actions.slice(-5).map(a => ({ // Last 5 actions only
        player: `Seat ${a.seat}`,
        action: a.action,
        amount: a.amount
      }));
    };

    // Calculate percentage-based information
    const callCostPercent = playerState.amountToCall > 0 && playerState.stackSize > 0
      ? (playerState.amountToCall / playerState.stackSize * 100).toFixed(1)
      : "0";
    
    const potAfterCall = gameState.totalPot + playerState.amountToCall;
    const potOddsPercent = playerState.amountToCall > 0
      ? (playerState.amountToCall / potAfterCall * 100).toFixed(1)
      : "0";
    
    const stackToPotRatio = gameState.totalPot > 0
      ? (playerState.stackSize / gameState.totalPot).toFixed(2)
      : "0";
    
    const remainingStackAfterCall = playerState.stackSize - playerState.amountToCall;
    const committedAfterCall = remainingStackAfterCall < potAfterCall;
    const wouldBeAllIn = playerState.amountToCall >= playerState.stackSize;
    
    // Big blind context (bb already declared above)
    const potInBB = (gameState.totalPot / bb).toFixed(1);
    const toCallInBB = (playerState.amountToCall / bb).toFixed(1);
    const stackInBB = (playerState.stackSize / bb).toFixed(1);

    const gameData = {
      round: gameState.bettingRound,
      yourCards: playerState.holeCards,
      boardCards: gameState.communityCards,
      pot: gameState.totalPot,
      toCall: playerState.amountToCall,
      yourChips: playerState.stackSize,
      opponents: opponents,
      recentActions: {
        preflop: formatActions(gameState.actionHistory.preflop),
        flop: formatActions(gameState.actionHistory.flop),
        turn: formatActions(gameState.actionHistory.turn),
        river: formatActions(gameState.actionHistory.river)
      },
      validActions: this.getValidActionsList(playerState),
      // New percentage-based context
      stackAnalysis: {
        callCostPercent: parseFloat(callCostPercent),
        potOddsPercent: parseFloat(potOddsPercent),
        stackToPotRatio: parseFloat(stackToPotRatio),
        committedAfterCall: committedAfterCall,
        wouldBeAllIn: wouldBeAllIn
      },
      blindContext: {
        bigBlind: bb,
        potInBB: parseFloat(potInBB),
        toCallInBB: parseFloat(toCallInBB),
        stackInBB: parseFloat(stackInBB)
      }
    };

    return `You are playing poker.

Game state:
${JSON.stringify(gameData, null, 2)}

Key percentages:
- Calling costs ${callCostPercent}% of your stack${wouldBeAllIn ? ' (ALL-IN)' : ''}
- You need to call ${potOddsPercent}% of the final pot
- Your stack-to-pot ratio is ${stackToPotRatio}${committedAfterCall && !wouldBeAllIn ? '\n- You would be POT-COMMITTED after calling' : ''}

Respond with JSON:
{"action": "<your_action>", "amount": <if_applicable>, "reasoning": "<your_explanation>"}`;
  }

  private buildPokerPrompt(
    gameState: PokerGameState,
    playerState: PlayerState
  ): string {
    // This method is now deprecated - redirect to neutral prompt
    return this.buildNeutralPokerPrompt(gameState, playerState);
  }

  private buildConcisePokerPrompt(
    gameState: PokerGameState,
    playerState: PlayerState
  ): string {
    // Active opponents only
    const activeOpps = gameState.opponents.filter(o => o.status === 'active');
    const oppSummary = activeOpps
      .map(o => `S${o.seat}:$${o.stackSize},${o.amountInRound > 0 ? `bet$${o.amountInRound}` : o.lastAction?.action || 'waiting'}`)
      .join(' | ');

    // Last 3 actions per round only
    const recentActions = (actions: HandAction[], limit = 3) => {
      if (!actions.length) return 'None';
      return actions.slice(-limit).map(a => 
        `${a.player}:${a.action}${a.amount ? `$${a.amount}` : ''}`
      ).join(', ');
    };

    // Parse effective stacks
    const effStacks = typeof playerState.effectiveStacks === 'string' 
      ? JSON.parse(playerState.effectiveStacks) 
      : playerState.effectiveStacks;
    const minStack = effStacks.min || gameState.effectiveStackSize || playerState.stackSize;
    
    // Add context when player can check for free
    const gameContext = playerState.canCheck && playerState.amountToCall === 0 
      ? ' [No bets - all checking/calling]' 
      : '';

    // Calculate percentage-based information
    const callCostPercent = playerState.amountToCall > 0 && playerState.stackSize > 0
      ? (playerState.amountToCall / playerState.stackSize * 100).toFixed(1)
      : "0";
    
    const potAfterCall = gameState.totalPot + playerState.amountToCall;
    const potOddsPercent = playerState.amountToCall > 0
      ? (playerState.amountToCall / potAfterCall * 100).toFixed(1)
      : "0";
    
    const stackToPotRatio = gameState.totalPot > 0
      ? (playerState.stackSize / gameState.totalPot).toFixed(2)
      : "0";
    
    const remainingStackAfterCall = playerState.stackSize - playerState.amountToCall;
    const committedAfterCall = remainingStackAfterCall < potAfterCall;
    const wouldBeAllIn = playerState.amountToCall >= playerState.stackSize;

    return `HAND #${gameState.handNumber} | ${gameState.bettingRound} | Pot:$${gameState.totalPot}${gameContext}
TOURNAMENT: Final score = Chips × Style bonus (diverse wins +25%, bluffs +15%, comebacks +30%)
Cards: YOU[${playerState.holeCards.join(' ')}] BOARD[${gameState.communityCards.join(' ') || '-'}]
Position: ${playerState.position} | Stack:$${playerState.stackSize} | SPR:${stackToPotRatio}

OPPONENTS(${activeOpps.length}): ${oppSummary}

ACTIONS:
Pre: ${recentActions(gameState.actionHistory.preflop)}${gameState.actionHistory.flop.length > 0 ? `
Flop: ${recentActions(gameState.actionHistory.flop)}` : ''}${gameState.actionHistory.turn.length > 0 ? `
Turn: ${recentActions(gameState.actionHistory.turn)}` : ''}${gameState.actionHistory.river.length > 0 ? `
River: ${recentActions(gameState.actionHistory.river)}` : ''}

INVESTED:$${playerState.amountInvestedThisRound} ADDITIONAL:$${playerState.amountToCall}${playerState.canCheck ? '(FREE)' : ''} [${callCostPercent}% of stack]${wouldBeAllIn ? ' *ALL-IN*' : ''}
POT ODDS: ${potOddsPercent}% | ${committedAfterCall && !wouldBeAllIn ? 'POT-COMMITTED AFTER CALL' : wouldBeAllIn ? 'ALL-IN DECISION' : 'Not committed'}
${playerState.handEvaluation ? `HAND: ${playerState.handEvaluation}\n` : ''}ACTIONS: ${playerState.canCheck ? 'CHECK(FREE)' : ''}${playerState.canCall ? ` CALL(+$${playerState.amountToCall})` : ''}${playerState.canRaise ? ` RAISE($${playerState.minRaiseAmount}-$${playerState.maxRaiseAmount})` : ''} FOLD

What do you do? JSON: {"action": "...", "amount": (if raise), "reasoning": "..."}`;
  }

  private getValidActionsList(playerState: PlayerState): string[] {
    const actions: string[] = [];
    if (playerState.canFold) actions.push('fold');
    if (playerState.canCheck) actions.push('check');
    if (playerState.canCall) actions.push('call');
    if (playerState.canRaise) actions.push('raise');
    if (playerState.isAllIn || (playerState.stackSize <= playerState.amountToCall)) {
      actions.push('all-in');
    }
    return actions;
  }

  private evaluateDecision(
    model: string,
    decision: AIPokerDecision,
    gameState: PokerGameState,
    playerState: PlayerState
  ): void {
    const evaluation = this.modelEvaluations.get(model)!;
    evaluation.handsPlayed++;

    // Check for illogical decisions
    if (decision.action === 'fold' && playerState.canCheck && playerState.amountToCall === 0) {
      const illogical: IllogicalDecision = {
        handNumber: this.currentHandNumber,
        decision: 'fold',
        reason: 'Folded when CHECK was available for free',
        gameState: {
          pot: gameState.totalPot,
          toCall: playerState.amountToCall,
          canCheck: playerState.canCheck
        }
      };
      evaluation.illogicalDecisions.push(illogical);
      console.warn(`⚠️ ILLOGICAL: ${model} folded when CHECK was free!`);
      console.warn(`  Reasoning: ${decision.reasoning}`);
    }

    // Check for hand misreads on turn and river when we have actual hand evaluation
    if (playerState.handEvaluation && (gameState.bettingRound === 'turn' || gameState.bettingRound === 'river')) {
      const actualHandLower = playerState.handEvaluation.toLowerCase();
      const reasoningLower = decision.reasoning.toLowerCase();
      
      // Straight misread - enhanced detection
      if (actualHandLower.includes('straight') && !actualHandLower.includes('draw')) {
        // Check for various misread patterns
        const missedStraight = 
            reasoningLower.includes('straight draw') || 
            reasoningLower.includes('open-ended') ||
            reasoningLower.includes('gutshot') ||
            reasoningLower.includes('no made hand') ||
            reasoningLower.includes('no hand') ||
            reasoningLower.includes('nothing') ||
            reasoningLower.includes('high card') ||
            reasoningLower.includes('9 high') || // Common for wheel misreads
            reasoningLower.includes('9-high') ||
            reasoningLower.includes('does not improve') ||
            !reasoningLower.includes('straight');
            
        if (missedStraight) {
          // Critical misread if it's the nuts
          const isNuts = this.isNutsHand(actualHandLower, gameState.communityCards);
          const severity: 'CRITICAL' | 'MAJOR' | 'MINOR' = isNuts ? 'CRITICAL' : 'MAJOR';
          
          const misread: HandMisread = {
            handNumber: this.currentHandNumber,
            actual: playerState.handEvaluation,
            aiThought: this.extractHandFromReasoning(decision.reasoning) || 'Did not recognize straight',
            holeCards: playerState.holeCards,
            boardCards: gameState.communityCards,
            phase: gameState.bettingRound,
            severity: severity
          };
          evaluation.handMisreads.push(misread);
          
          console.warn(`🚨 ${severity} HAND MISREAD: ${model} missed a made straight!`);
          console.warn(`  Actual: ${playerState.handEvaluation}`);
          console.warn(`  AI reasoning: ${decision.reasoning}`);
          
          // Extra penalty for missing the nuts
          if (isNuts && decision.action === 'check' && playerState.amountToCall === 0) {
            console.warn(`  💀 CRITICAL: Checked the NUTS!`);
          }
        }
      }
      
      // Flush misread
      if (actualHandLower.includes('flush') && !actualHandLower.includes('draw')) {
        if (reasoningLower.includes('flush draw') || !reasoningLower.includes('flush')) {
          const isNuts = this.isNutsHand(actualHandLower, gameState.communityCards);
          const severity: 'CRITICAL' | 'MAJOR' | 'MINOR' = isNuts ? 'CRITICAL' : 'MAJOR';
          
          const misread: HandMisread = {
            handNumber: this.currentHandNumber,
            actual: playerState.handEvaluation,
            aiThought: this.extractHandFromReasoning(decision.reasoning) || 'Did not recognize flush',
            holeCards: playerState.holeCards,
            boardCards: gameState.communityCards,
            phase: gameState.bettingRound,
            severity: severity
          };
          evaluation.handMisreads.push(misread);
          console.warn(`🚨 ${severity} HAND MISREAD: ${model} missed a made flush!`);
        }
      }
      
      // Full house misread
      if (actualHandLower.includes('full house')) {
        if (!reasoningLower.includes('full house') && !reasoningLower.includes('boat')) {
          const isNuts = this.isNutsHand(actualHandLower, gameState.communityCards);
          const severity: 'CRITICAL' | 'MAJOR' | 'MINOR' = isNuts ? 'CRITICAL' : 'MAJOR';
          
          const misread: HandMisread = {
            handNumber: this.currentHandNumber,
            actual: playerState.handEvaluation,
            aiThought: this.extractHandFromReasoning(decision.reasoning) || 'Did not recognize full house',
            holeCards: playerState.holeCards,
            boardCards: gameState.communityCards,
            phase: gameState.bettingRound,
            severity: severity
          };
          evaluation.handMisreads.push(misread);
          console.warn(`🚨 ${severity} HAND MISREAD: ${model} missed a full house!`);
        }
      }
    }

    // Update rates
    evaluation.misreadRate = evaluation.handMisreads.length / evaluation.handsPlayed;
    evaluation.illogicalRate = evaluation.illogicalDecisions.length / evaluation.handsPlayed;
  }

  private isNutsHand(handDescription: string, communityCards: string[]): boolean {
    // Simple nuts detection - can be enhanced
    const handLower = handDescription.toLowerCase();
    
    // Check for wheel straight (A-2-3-4-5) on appropriate boards
    if (handLower.includes('straight') && handLower.includes('5 high')) {
      // Check if there's no flush possible
      const suits = communityCards.map(card => card[card.length - 1]);
      const suitCounts = suits.reduce((acc, suit) => {
        acc[suit] = (acc[suit] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const hasFlushPossible = Object.values(suitCounts).some(count => count >= 3);
      if (!hasFlushPossible) {
        return true; // Wheel is nuts if no flush possible
      }
    }
    
    // Royal flush is always nuts
    if (handLower.includes('royal flush')) return true;
    
    // Straight flush is usually nuts (unless board has higher straight flush)
    if (handLower.includes('straight flush')) return true;
    
    // Four of a kind is often nuts
    if (handLower.includes('four of a kind') || handLower.includes('quads')) return true;
    
    return false;
  }

  private extractHandFromReasoning(reasoning: string): string | null {
    const reasoningLower = reasoning.toLowerCase();
    
    // Look for hand mentions
    if (reasoningLower.includes('straight draw')) return 'straight draw';
    if (reasoningLower.includes('flush draw')) return 'flush draw';
    if (reasoningLower.includes('pair')) return 'pair';
    if (reasoningLower.includes('two pair')) return 'two pair';
    if (reasoningLower.includes('trips') || reasoningLower.includes('three of a kind')) return 'three of a kind';
    if (reasoningLower.includes('high card')) return 'high card';
    if (reasoningLower.includes('nothing')) return 'nothing';
    
    return null;
  }

  public getModelEvaluations(): Map<string, ModelEvaluation> {
    return this.modelEvaluations;
  }

  private async getOpenAIDecision(
    prompt: string,
    gameState: PokerGameState,
    playerState: PlayerState
  ): Promise<AIPokerDecision> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are playing poker. Consider the percentage information provided - callCostPercent shows what portion of your stack you're risking, potOddsPercent shows the price you're getting, and stackToPotRatio indicates how many pots you have behind. Respond with JSON containing your action and reasoning.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1000,
    });

    const decision = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      action: decision.action || 'check',
      amount: decision.amount,
      reasoning: decision.reasoning || 'Analyzing the situation',
      confidence: 0.7, // Default confidence for simplified responses
      details: {
        handEvaluation: 'AI reasoning',
        potOdds: 'Not calculated',
        expectedValue: 'Not calculated',
        bluffProbability: 0,
        modelUsed: 'GPT-4o',
      },
    };
  }

  private async getDeepseekDecision(
    prompt: string,
    gameState: PokerGameState,
    playerState: PlayerState
  ): Promise<AIPokerDecision> {
    if (!this.deepseek) {
      console.error('❌ Deepseek client not initialized');
      throw new Error('Deepseek API key not configured');
    }

    console.log('🔧 Deepseek API call parameters:', {
      model: 'deepseek-chat',
      promptLength: prompt.length,
      hasResponseFormat: true,
      maxTokens: 2000,
      temperature: 0.7,
    });

    try {
      const response = await this.deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `You are playing poker. Consider the percentage information provided - callCostPercent shows what portion of your stack you're risking, potOddsPercent shows the price you're getting, and stackToPotRatio indicates how many pots you have behind. Respond with JSON containing your action and reasoning.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
        temperature: 0.7,
      });

      console.log('✅ Deepseek API response received');
      
      // Extract the content from the response
      const message = response.choices[0].message;
      
      console.log('📦 Response structure:', {
        hasChoices: !!response.choices,
        choicesLength: response.choices?.length,
        messageKeys: message ? Object.keys(message) : [],
      });
      let rawContent = message.content || '';
      
      // Some Deepseek models might return content in a different field
      if (!rawContent && (message as any).reasoning_content) {
        console.log('🔄 Using reasoning_content field instead');
        rawContent = (message as any).reasoning_content;
      }
      
      console.log('📝 Raw Deepseek response length:', rawContent.length);
      console.log('📝 Raw Deepseek response preview:', rawContent.substring(0, 200) + '...');
      
      const decision = this.extractJSON(rawContent);
      
      console.log('📊 Parsed decision:', {
        action: decision.action,
        hasReasoning: !!decision.reasoning,
        hasAmount: decision.amount !== undefined,
      });
    
      return {
        action: decision.action || 'check',
        amount: decision.amount,
        reasoning: decision.reasoning || 'Analyzing the situation',
        confidence: 0.7, // Default confidence for simplified responses
        details: {
          handEvaluation: 'AI reasoning',
          potOdds: 'Not calculated',
          expectedValue: 'Not calculated',
          bluffProbability: 0,
          modelUsed: 'Deepseek Chat',
        },
      };
    } catch (apiError) {
      console.error('❌ Deepseek API call failed:', apiError);
      if (apiError instanceof Error) {
        console.error('Error name:', apiError.name);
        console.error('Error message:', apiError.message);
        
        // If it's a JSON parsing error, provide more context
        if (apiError.message.includes('JSON')) {
          console.error('JSON Parsing Error - this usually means Deepseek returned non-JSON content');
          console.error('Check the raw response preview above for the actual content');
        }
        
        if ('response' in apiError) {
          console.error('API Response:', (apiError as any).response);
        }
      }
      throw apiError;
    }
  }

  private async getClaudeDecision(
    prompt: string,
    gameState: PokerGameState,
    playerState: PlayerState,
    modelVersion: string
  ): Promise<AIPokerDecision> {
    if (!this.anthropic) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await this.anthropic.messages.create({
      model: modelVersion,
      messages: [
        {
          role: 'user',
          content: `You are playing poker. Consider the percentage information provided - callCostPercent shows what portion of your stack you're risking, potOddsPercent shows the price you're getting, and stackToPotRatio indicates how many pots you have behind.\n\n${prompt}`,
        },
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    
    try {
      const decision = JSON.parse(content);
      
      return {
        action: decision.action || 'check',
        amount: decision.amount,
        reasoning: decision.reasoning || 'Analyzing the situation',
        confidence: 0.7, // Default confidence for simplified responses
        details: {
          handEvaluation: 'AI reasoning',
          potOdds: 'Not calculated',
          expectedValue: 'Not calculated',
          bluffProbability: 0,
          modelUsed: modelVersion.includes('3-5') ? 'Claude 3.5 Sonnet' : 'Claude 3.7 Sonnet',
        },
      };
    } catch (error) {
      console.error('Failed to parse Claude response:', content);
      throw error;
    }
  }

  private getFallbackDecision(
    gameState: PokerGameState,
    playerState: PlayerState
  ): AIPokerDecision {
    const canAffordCall = playerState.stackSize >= playerState.amountToCall;
    const potOdds = playerState.amountToCall > 0 ? 
      playerState.amountToCall / (gameState.potSize + playerState.amountToCall) : 0;
    
    let action: AIPokerDecision['action'] = 'fold';
    let reasoning = 'Using fallback logic due to API error';

    if (playerState.canCheck) {
      action = 'check';
      reasoning = 'Checking to see more cards';
    } else if (canAffordCall && potOdds < 0.3 && playerState.canCall) {
      action = 'call';
      reasoning = 'Pot odds favorable for a call';
    }

    return {
      action,
      reasoning,
      confidence: 0.3,
      details: {
        handEvaluation: 'Fallback evaluation',
        potOdds: `${(potOdds * 100).toFixed(1)}%`,
        expectedValue: 'Unable to calculate',
        bluffProbability: 0,
        modelUsed: 'Fallback Logic',
      },
    };
  }
}