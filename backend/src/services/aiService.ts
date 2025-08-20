import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Type definition for all supported AI models
type AIGameModel = 
  // OpenAI models
  | 'gpt-4o' | 'GPT_4O'
  | 'gpt-4o-mini' | 'GPT_4O_MINI'
  | 'gpt-3.5-turbo' | 'GPT_3_5_TURBO'
  | 'O3' | 'O3_MINI' | 'O3_PRO'
  // Claude models
  | 'claude-3-5-sonnet' | 'CLAUDE_3_5_SONNET'
  | 'claude-3-5-haiku' | 'CLAUDE_3_5_HAIKU'
  | 'claude-3-haiku' | 'CLAUDE_3_HAIKU'
  | 'claude-3-opus' | 'CLAUDE_3_OPUS'
  | 'CLAUDE_4_OPUS' | 'CLAUDE_4_SONNET'
  // DeepSeek models
  | 'deepseek-chat' | 'DEEPSEEK_CHAT'
  | 'deepseek-r1' | 'DEEPSEEK_R1'
  | 'deepseek-v3' | 'DEEPSEEK_V3'
  | 'deepseek-coder' | 'DEEPSEEK_CODER'
  // Qwen models
  | 'QWEN_2_5_72B' | 'QWQ_32B' | 'QVQ_72B_PREVIEW' | 'QWEN_2_5_MAX'
  // Other models
  | 'GROK_3' | 'KIMI_K2'
  | 'GEMINI_2_5_PRO' | 'GEMINI_2_5_PRO_DEEP_THINK'
  | 'LLAMA_3_1_405B' | 'LLAMA_3_1_70B' | 'LLAMA_3_2_90B'
  | 'MIXTRAL_8X22B';

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

// Singleton pattern for AIService

export class AIService {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private deepseek: OpenAI | null = null;
  private modelEvaluations: Map<string, ModelEvaluation> = new Map();
  private currentHandNumber: number = 0;
  private static maxConcurrentRequests = 10; // Increased from 5 to reduce slot contention
  private activeRequests = 0;
  private lastSlotActivity: number = Date.now();
  private slotResetTimeout = 30000; // Reset if no activity for 30 seconds

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
    // Only load the AI provider specified in environment (for faster startup)
    const activeProvider = process.env.ACTIVE_AI_PROVIDER || 'openai';
    const fastStartup = process.env.FAST_STARTUP === 'true';
    
    if (fastStartup) {
      console.log(`⚡ Fast startup: Loading only ${activeProvider} AI provider`);
    }
    
    // Load only the active provider, or all if not in fast startup mode
    if ((activeProvider === 'openai' || !fastStartup) && 
        process.env.OPENAI_API_KEY && 
        !process.env.OPENAI_API_KEY.includes('YOUR_OPENAI_KEY_HERE')) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 30000, // 30 seconds timeout
      });
      console.log('✅ OpenAI API configured');
    } else if (activeProvider === 'openai') {
      console.log('⚠️  OpenAI API key not configured - using fallback logic');
    }

    if ((activeProvider === 'anthropic' || !fastStartup) && 
        process.env.ANTHROPIC_API_KEY && 
        !process.env.ANTHROPIC_API_KEY.includes('YOUR_ANTHROPIC_KEY_HERE')) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
        timeout: 30000, // 30 seconds timeout
      });
      console.log('✅ Anthropic API configured');
    } else if (activeProvider === 'anthropic') {
      console.log('⚠️  Anthropic API key not configured - using fallback logic');
    }

    if ((activeProvider === 'deepseek' || !fastStartup) && 
        process.env.DEEPSEEK_API_KEY && 
        !process.env.DEEPSEEK_API_KEY.includes('YOUR_DEEPSEEK_KEY_HERE')) {
      this.deepseek = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com/v1',
        timeout: 30000, // 30 seconds timeout
      });
      console.log('✅ Deepseek API configured');
    } else if (activeProvider === 'deepseek') {
      console.log('⚠️  Deepseek API key not configured - using fallback logic');
    }
  }

  async getPokerDecision(
    botId: string,
    gameState: PokerGameState,
    playerState: PlayerState,
    _opponents: number,
    model: string,
    customPrompt?: string
  ): Promise<AIPokerDecision> {
    console.log('\n=== AIService.getPokerDecision Called ===');
    console.log(`🤖 AI Decision Request - Bot: ${botId}, Model: ${model}`);
    console.log('GameState summary:', {
      handNumber: gameState.handNumber,
      bettingRound: gameState.bettingRound,
      potSize: gameState.potSize,
      currentBet: gameState.currentBet,
      communityCards: gameState.communityCards,
      activeOpponents: gameState.opponents.filter(o => o.status === 'active').length
    });
    console.log('PlayerState summary:', {
      holeCards: playerState.holeCards,
      stackSize: playerState.stackSize,
      amountToCall: playerState.amountToCall,
      canCheck: playerState.canCheck,
      canFold: playerState.canFold,
      canCall: playerState.canCall,
      canRaise: playerState.canRaise
    });
    
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
    
    // Use custom prompt for test bots, otherwise use neutral prompt
    const isTestBot = botId.startsWith('test-bot-');
    const prompt = isTestBot && customPrompt 
      ? this.buildTestBotPrompt(gameState, playerState, customPrompt)
      : this.buildNeutralPokerPrompt(gameState, playerState);
    
    console.log(`📏 ${isTestBot ? 'Test bot' : 'Neutral'} prompt length: ${prompt.length} characters`);

    try {
      let decision: AIPokerDecision;
      const startTime = Date.now();
      
      // Convert model to uppercase format for consistency
      const modelUpperCase = model.toUpperCase().replace(/-/g, '_');
      
      switch(modelUpperCase) {
        // DeepSeek Models
        case 'DEEPSEEK_CHAT':
          console.log('📡 Calling Deepseek Chat API...');
          decision = await this.getDeepseekDecision(prompt, gameState, playerState);
          break;
        case 'DEEPSEEK_R1':
          console.log('📡 Calling Deepseek R1 API...');
          decision = await this.getDeepseekDecision(prompt, gameState, playerState, 'deepseek-reasoner');
          break;
        case 'DEEPSEEK_V3':
          console.log('📡 Calling Deepseek V3 API...');
          decision = await this.getDeepseekDecision(prompt, gameState, playerState, 'deepseek-chat');
          break;
        case 'DEEPSEEK_CODER':
          console.log('📡 Calling Deepseek Coder API...');
          decision = await this.getDeepseekDecision(prompt, gameState, playerState, 'deepseek-coder');
          break;
          
        // OpenAI Models  
        case 'GPT_4O':
          console.log('📡 Calling OpenAI GPT-4o API...');
          decision = await this.getOpenAIDecision(prompt, gameState, playerState, 'gpt-4o');
          break;
        case 'GPT_4O_MINI':
          console.log('📡 Calling OpenAI GPT-4o-mini API...');
          decision = await this.getOpenAIDecision(prompt, gameState, playerState, 'gpt-4o-mini');
          break;
        case 'GPT_3_5_TURBO':
          console.log('📡 Calling OpenAI GPT-3.5 API...');
          decision = await this.getOpenAIDecision(prompt, gameState, playerState, 'gpt-3.5-turbo');
          break;
          
        // Claude Models
        case 'CLAUDE_3_5_SONNET':
          console.log('📡 Calling Claude 3.5 Sonnet API...');
          decision = await this.getClaudeDecision(prompt, gameState, playerState, 'claude-3-5-sonnet-20241022');
          break;
        case 'CLAUDE_3_5_HAIKU':
          console.log('📡 Calling Claude 3.5 Haiku API...');
          decision = await this.getClaudeDecision(prompt, gameState, playerState, 'claude-3-haiku-20240307');
          break;
        case 'CLAUDE_3_HAIKU':
          console.log('📡 Calling Claude 3 Haiku API...');
          decision = await this.getClaudeDecision(prompt, gameState, playerState, 'claude-3-haiku-20240307');
          break;
        case 'CLAUDE_3_OPUS':
          console.log('📡 Calling Claude 3 Opus API...');
          decision = await this.getClaudeDecision(prompt, gameState, playerState, 'claude-3-opus-20240229');
          break;
          
        // Models we don't support yet (fallback to similar models)
        case 'O3':
        case 'O3_MINI':
        case 'O3_PRO':
          console.log('⚠️ O3 models not yet available, using GPT-4o');
          decision = await this.getOpenAIDecision(prompt, gameState, playerState, 'gpt-4o');
          break;
        case 'CLAUDE_4_OPUS':
        case 'CLAUDE_4_SONNET':
          console.log('⚠️ Claude 4 not yet available, using Claude 3.5 Sonnet');
          decision = await this.getClaudeDecision(prompt, gameState, playerState, 'claude-3-5-sonnet-20241022');
          break;
          
        // Qwen models (fallback to DeepSeek)
        case 'QWEN_2_5_72B':
        case 'QWQ_32B':
        case 'QVQ_72B_PREVIEW':
        case 'QWEN_2_5_MAX':
          console.log('⚠️ Qwen models not integrated, using DeepSeek');
          decision = await this.getDeepseekDecision(prompt, gameState, playerState);
          break;
          
        // Other models (fallback to GPT-4o)
        case 'GROK_3':
        case 'KIMI_K2':
        case 'GEMINI_2_5_PRO':
        case 'GEMINI_2_5_PRO_DEEP_THINK':
        case 'LLAMA_3_1_405B':
        case 'LLAMA_3_1_70B':
        case 'LLAMA_3_2_90B':
        case 'MIXTRAL_8X22B':
          console.log(`⚠️ ${model} not integrated, using GPT-4o`);
          decision = await this.getOpenAIDecision(prompt, gameState, playerState, 'gpt-4o');
          break;
          
        default:
          throw new Error(`Unsupported model: ${model}`);
      }
      
      const elapsedTime = Date.now() - startTime;
      console.log(`✅ AI decision received in ${elapsedTime}ms:`, {
        action: decision.action,
        amount: decision.amount,
        confidence: decision.confidence,
        reasoningLength: decision.reasoning?.length
      });
      
      // Track and evaluate decision quality
      this.evaluateDecision(model, decision, gameState, playerState);
      
      console.log('=== Returning decision from AIService ===\n');
      return decision;
    } catch (error) {
      console.error(`\n❌ AI model error for ${model}:`, error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      console.log('⚠️  Falling back to programmatic logic');
      const fallbackDecision = this.getFallbackDecision(gameState, playerState);
      console.log('Fallback decision:', fallbackDecision);
      return fallbackDecision;
    }
  }

  private buildTestBotPrompt(
    gameState: PokerGameState,
    playerState: PlayerState,
    userPrompt: string
  ): string {
    // Build the same neutral game state but include user's prompt as personality
    const neutralState = this.buildNeutralPokerPrompt(gameState, playerState);
    
    // Parse the JSON to add the personality
    try {
      const stateObj = JSON.parse(neutralState);
      stateObj.personality = userPrompt;
      return JSON.stringify(stateObj, null, 2);
    } catch (e) {
      // Fallback if JSON parsing fails
      return neutralState.replace(
        '"validActions"',
        `"personality": "${userPrompt.replace(/"/g, '\\"')}",\n  "validActions"`
      );
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

  // Deprecated - kept for reference
  // private buildPokerPrompt(
  //   gameState: PokerGameState,
  //   playerState: PlayerState
  // ): string {
  //   // This method is now deprecated - redirect to neutral prompt
  //   return this.buildNeutralPokerPrompt(gameState, playerState);
  // }

  // Deprecated method - kept for reference
  // private buildConcisePokerPrompt(
  //   gameState: PokerGameState,
  //   playerState: PlayerState
  // ): string {
  //   // This method has been replaced by buildNeutralPokerPrompt
  //   return this.buildNeutralPokerPrompt(gameState, playerState);
  // }

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
    _gameState: PokerGameState,
    _playerState: PlayerState,
    modelOverride?: string
  ): Promise<AIPokerDecision> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const model = modelOverride || 'gpt-4o';
    const response = await this.openai.chat.completions.create({
      model,
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
    _gameState: PokerGameState,
    _playerState: PlayerState,
    modelOverride?: string
  ): Promise<AIPokerDecision> {
    if (!this.deepseek) {
      console.error('❌ Deepseek client not initialized');
      throw new Error('Deepseek API key not configured');
    }

    const model = modelOverride || 'deepseek-chat';
    console.log('🔧 Deepseek API call parameters:', {
      model,
      promptLength: prompt.length,
      hasResponseFormat: true,
      maxTokens: 2000,
      temperature: 0.7,
    });

    try {
      const response = await this.deepseek.chat.completions.create({
        model,
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
    _gameState: PokerGameState,
    _playerState: PlayerState,
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

  async getReverseHangmanDecision(
    botId: string,
    gameState: any,
    playerState: any,
    model: AIGameModel,
    customPrompt?: string
  ): Promise<any> {
    console.log(`🎮 Reverse Hangman AI Decision Request - Bot: ${botId}, Model: ${model}`);
    
    // Build neutral prompt for reverse hangman
    const prompt = this.buildNeutralReverseHangmanPrompt(gameState, playerState, customPrompt);
    
    console.log(`📏 Reverse Hangman prompt length: ${prompt.length} characters`);

    try {
      let decision: any;
      
      // Convert model to uppercase format for consistency
      const modelUpperCase = model.toUpperCase().replace(/-/g, '_');
      
      switch(modelUpperCase) {
        // DeepSeek Models
        case 'DEEPSEEK_CHAT':
          console.log('📡 Calling Deepseek Chat API for Reverse Hangman...');
          decision = await this.getDeepseekReverseHangmanDecision(prompt);
          break;
        case 'DEEPSEEK_R1':
          console.log('📡 Calling Deepseek R1 API for Reverse Hangman...');
          decision = await this.getDeepseekReverseHangmanDecision(prompt);
          break;
        case 'DEEPSEEK_V3':
          console.log('📡 Calling Deepseek V3 API for Reverse Hangman...');
          decision = await this.getDeepseekReverseHangmanDecision(prompt);
          break;
        case 'DEEPSEEK_CODER':
          console.log('📡 Calling Deepseek Coder API for Reverse Hangman...');
          decision = await this.getDeepseekReverseHangmanDecision(prompt);
          break;
          
        // OpenAI Models
        case 'GPT_4O':
          console.log('📡 Calling OpenAI GPT-4o API for Reverse Hangman...');
          decision = await this.getOpenAIReverseHangmanDecision(prompt);
          break;
        case 'GPT_4O_MINI':
          console.log('📡 Calling OpenAI GPT-4o-mini API for Reverse Hangman...');
          decision = await this.getOpenAIReverseHangmanDecision(prompt);
          break;
        case 'GPT_3_5_TURBO':
          console.log('📡 Calling OpenAI GPT-3.5 API for Reverse Hangman...');
          decision = await this.getOpenAIReverseHangmanDecision(prompt);
          break;
          
        // Claude Models
        case 'CLAUDE_3_5_SONNET':
          console.log('📡 Calling Claude 3.5 Sonnet API for Reverse Hangman...');
          decision = await this.getClaudeReverseHangmanDecision(prompt, 'claude-3-5-sonnet-20241022');
          break;
        case 'CLAUDE_3_5_HAIKU':
          console.log('📡 Calling Claude 3.5 Haiku API for Reverse Hangman...');
          decision = await this.getClaudeReverseHangmanDecision(prompt, 'claude-3-haiku-20240307');
          break;
        case 'CLAUDE_3_HAIKU':
          console.log('📡 Calling Claude 3 Haiku API for Reverse Hangman...');
          decision = await this.getClaudeReverseHangmanDecision(prompt, 'claude-3-haiku-20240307');
          break;
        case 'CLAUDE_3_OPUS':
          console.log('📡 Calling Claude 3 Opus API for Reverse Hangman...');
          decision = await this.getClaudeReverseHangmanDecision(prompt, 'claude-3-opus-20240229');
          break;
          
        // Models with fallbacks
        case 'O3':
        case 'O3_MINI':
        case 'O3_PRO':
          console.log('⚠️ O3 models not yet available, using GPT-4o for Reverse Hangman');
          decision = await this.getOpenAIReverseHangmanDecision(prompt);
          break;
        case 'CLAUDE_4_OPUS':
        case 'CLAUDE_4_SONNET':
          console.log('⚠️ Claude 4 not yet available, using Claude 3.5 Sonnet for Reverse Hangman');
          decision = await this.getClaudeReverseHangmanDecision(prompt, 'claude-3-5-sonnet-20241022');
          break;
          
        // Qwen models (fallback to DeepSeek)
        case 'QWEN_2_5_72B':
        case 'QWQ_32B':
        case 'QVQ_72B_PREVIEW':
        case 'QWEN_2_5_MAX':
          console.log('⚠️ Qwen models not integrated, using DeepSeek for Reverse Hangman');
          decision = await this.getDeepseekReverseHangmanDecision(prompt);
          break;
          
        // Other models (fallback to GPT-4o)
        case 'GROK_3':
        case 'KIMI_K2':
        case 'GEMINI_2_5_PRO':
        case 'GEMINI_2_5_PRO_DEEP_THINK':
        case 'LLAMA_3_1_405B':
        case 'LLAMA_3_1_70B':
        case 'LLAMA_3_2_90B':
        case 'MIXTRAL_8X22B':
          console.log(`⚠️ ${model} not integrated, using GPT-4o for Reverse Hangman`);
          decision = await this.getOpenAIReverseHangmanDecision(prompt);
          break;
          
        default:
          console.log(`⚠️ Unknown model ${model}, attempting with GPT-4o for Reverse Hangman`);
          decision = await this.getOpenAIReverseHangmanDecision(prompt);
          break;
      }
      
      return decision;
    } catch (error) {
      console.error(`❌ AI model error for ${model} in Reverse Hangman:`, error);
      console.log('⚠️  Falling back to default reverse hangman logic');
      return this.getFallbackReverseHangmanDecision(gameState);
    }
  }

  private buildNeutralReverseHangmanPrompt(
    gameState: any,
    playerState: any,
    customPrompt?: string
  ): string {
    const prompt = {
      game_type: gameState.game_type,
      output_shown: gameState.output_shown,
      constraints: gameState.constraints,
      previous_guesses: gameState.previous_guesses || [],
      game_phase: gameState.game_phase,
      time_elapsed_seconds: gameState.time_elapsed_seconds,
      player_state: playerState,
      instructions: `You are playing reverse prompt engineering. Your task: given an AI-generated output, figure out what prompt created it. The target prompt contains EXACTLY ${gameState.constraints.exact_word_count} words. You have 7 attempts.

CRITICAL: This is an ITERATIVE game! BUILD UPON your previous guesses:
- If you have previous guesses, look at the feedback carefully
- Keep ALL words that were marked as correct in 'matched_words'
- Add any words listed in 'missing_words' 
- Remove any words listed in 'extra_words'
- For semantic matches, replace your word with the suggested original

Each guess reveals detailed feedback to help you get closer:
- similarity_score: How close you are (aim to increase this each time)
- matched_words: These are CORRECT - keep them!
- missing_words: Add these to your next guess
- extra_words: Remove these from your next guess

You're looking for the EXACT wording, not just the general idea. Focus on the actual content and structure of the output to deduce the prompt.

Respond with JSON: {action: 'guess_prompt', prompt_guess: 'your refined guess here', reasoning: 'explain how you used the feedback', confidence: 0-1, analysis: {output_type: 'your assessment', key_indicators: ['list', 'of', 'clues'], word_count_estimate: number, difficulty_assessment: 'easy/medium/hard', pattern_observations: ['what you notice']}}`
    };

    if (customPrompt) {
      prompt.instructions += ` Additional strategy: ${customPrompt}`;
    }

    return JSON.stringify(prompt, null, 2);
  }

  private async getOpenAIReverseHangmanDecision(prompt: string): Promise<any> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');

    try {
      const decision = JSON.parse(content);
      return {
        action: decision.action || 'guess_prompt',
        prompt_guess: decision.prompt_guess || decision.guess || 'Generate a response about the given topic',
        reasoning: decision.reasoning || 'Analyzing the output patterns',
        confidence: decision.confidence || 0.5,
        analysis: decision.analysis || {
          output_type: 'general',
          key_indicators: [],
          word_count_estimate: 10,
          difficulty_assessment: 'medium',
          pattern_observations: []
        }
      };
    } catch (error) {
      console.error('Failed to parse OpenAI response:', content);
      throw error;
    }
  }

  private async getDeepseekReverseHangmanDecision(prompt: string): Promise<any> {
    if (!this.deepseek) {
      throw new Error('Deepseek client not initialized');
    }

    console.log('Calling Deepseek API for reverse hangman...');
    const startTime = Date.now();
    
    const response = await this.deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    const elapsedTime = Date.now() - startTime;
    console.log(`Deepseek API response received in ${elapsedTime}ms`);
    
    if (!content) throw new Error('No response from Deepseek');

    try {
      const decision = JSON.parse(content);
      console.log('Deepseek decision parsed:', {
        action: decision.action,
        hasGuess: !!decision.prompt_guess || !!decision.guess,
        confidence: decision.confidence
      });
      
      return {
        action: decision.action || 'guess_prompt',
        prompt_guess: decision.prompt_guess || decision.guess || 'Generate a response about the given topic',
        reasoning: decision.reasoning || 'Analyzing the output patterns',
        confidence: decision.confidence || 0.5,
        analysis: decision.analysis || {
          output_type: 'general',
          key_indicators: [],
          word_count_estimate: 10,
          difficulty_assessment: 'medium',
          pattern_observations: []
        }
      };
    } catch (error) {
      console.error('Failed to parse Deepseek response:', content);
      throw error;
    }
  }

  private async getClaudeReverseHangmanDecision(prompt: string, modelVersion: string): Promise<any> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const response = await this.anthropic.messages.create({
      model: modelVersion,
      max_tokens: 500,
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    try {
      const cleanedContent = content.text.replace(/```json\n?|\n?```/g, '').trim();
      const decision = JSON.parse(cleanedContent);
      
      return {
        action: decision.action || 'guess_prompt',
        prompt_guess: decision.prompt_guess || decision.guess || 'Generate a response about the given topic',
        reasoning: decision.reasoning || 'Analyzing the output patterns',
        confidence: decision.confidence || 0.5,
        analysis: decision.analysis || {
          output_type: 'general',
          key_indicators: [],
          word_count_estimate: 10,
          difficulty_assessment: 'medium',
          pattern_observations: []
        }
      };
    } catch (error) {
      console.error('Failed to parse Claude response:', content.text);
      throw error;
    }
  }

  private extractWordsFromOutput(output: string): string[] {
    // Simply extract all words and sort by frequency
    const words = output.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 2); // Keep words with 3+ letters
    
    // Count word frequency
    const wordFrequency = new Map<string, number>();
    words.forEach(word => {
      wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
    });
    
    // Sort by frequency and return unique words
    return Array.from(wordFrequency.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by frequency descending
      .map(([word]) => word);
  }


  private getFallbackReverseHangmanDecision(gameState: any): any {
    const output = gameState.output_shown || '';
    const wordCount = output.split(/\s+/).length;
    
    // Extract words from output without any bias
    const outputWords = this.extractWordsFromOutput(output);
    
    let promptGuess = '';
    
    // Check if we have match details from previous attempts
    const lastAttempt = gameState.previous_guesses?.[gameState.previous_guesses.length - 1];
    if (lastAttempt?.match_details && lastAttempt.match_details.matched_words.length > 0) {
      // Build purely on what we know works
      const matchedWords = lastAttempt.match_details.matched_words || [];
      
      // Start with matched words
      let guessWords = [...matchedWords];
      
      // Add words from the output that aren't already matched
      const unmatchedOutputWords = outputWords.filter(w => !matchedWords.includes(w));
      
      // Add the most frequent unmatched words from the output
      const wordsToAdd = unmatchedOutputWords.slice(0, Math.max(0, 8 - guessWords.length));
      guessWords.push(...wordsToAdd);
      
      // Build the guess
      promptGuess = guessWords.join(' ');
      
      // Ensure minimum word count by adding more output words
      if (promptGuess.split(' ').length < 6 && unmatchedOutputWords.length > wordsToAdd.length) {
        const additionalWords = unmatchedOutputWords.slice(wordsToAdd.length, wordsToAdd.length + 3);
        promptGuess = `${promptGuess} ${additionalWords.join(' ')}`;
      }
    } else {
      // First attempt - just use the most frequent words from the output
      // Take more words to increase chances of matching something
      promptGuess = outputWords.slice(0, 8).join(' ');
      
      // If we don't have enough words, repeat some
      if (promptGuess.split(' ').length < 6) {
        promptGuess = outputWords.slice(0, 6).join(' ');
      }
    }
    
    const hasMatchDetails = lastAttempt?.match_details;
    const confidence = hasMatchDetails ? 0.4 + (lastAttempt.similarity_score * 0.4) : 0.3;
    
    return {
      action: 'guess_prompt',
      prompt_guess: promptGuess,
      reasoning: hasMatchDetails 
        ? `Using ${lastAttempt.match_details.matched_words.length} confirmed words and adding frequent words from the output. No bias or assumptions about content type.`
        : `Extracted ${outputWords.length} unique words from output. Using most frequent words as initial guess without any content assumptions.`,
      confidence: confidence,
      analysis: {
        output_type: 'unknown',
        key_indicators: outputWords.slice(0, 5),
        word_count_estimate: Math.floor(wordCount / 20),
        difficulty_assessment: gameState.constraints?.difficulty || 'medium',
        pattern_observations: hasMatchDetails
          ? [`Matched: ${lastAttempt.match_details.matched_words.join(', ')}`, `Output words: ${outputWords.slice(0, 5).join(', ')}`]
          : [`Most frequent words: ${outputWords.slice(0, 8).join(', ')}`]
      }
    };
  }

  // Connect4 Methods
  async getConnect4Decision(
    botId: string,
    gameState: any,
    playerState: any,
    model: AIGameModel,
    customPrompt?: string
  ): Promise<any> {
    const requestId = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`\n=== AIService.getConnect4Decision Called [${requestId}] ===`);
    console.log(`[${requestId}] 🎮 Connect4 AI Decision Request - Bot: ${botId}, Model: ${model}`);
    
    try {
      // Validate inputs
      if (!gameState || !playerState) {
        throw new Error('Missing required game state or player state');
      }
      
      console.log(`[${requestId}] 🔑 DeepSeek client status:`, !!this.deepseek);
      console.log(`[${requestId}] GameState:`, {
        moveCount: gameState.move_count,
        validColumns: gameState.valid_columns,
        playerNumber: playerState.player_number,
        boardPreview: gameState.board?.[0]?.join('|') + '...' + gameState.board?.[5]?.join('|')
      });
    
      // Build neutral prompt for Connect4
      const prompt = this.buildNeutralConnect4Prompt(gameState, playerState, customPrompt);
      
      console.log(`📏 Connect4 prompt length: ${prompt.length} characters`);
      console.log('📝 First 300 chars of prompt:', prompt.substring(0, 300) + '...');

      let decision: any;
      
      // Convert model to uppercase format for consistency
      const modelUpperCase = model.toUpperCase().replace(/-/g, '_');
      
      switch(modelUpperCase) {
        // DeepSeek Models
        case 'DEEPSEEK_CHAT':
          console.log(`[${requestId}] 📡 Calling Deepseek Chat API for Connect4...`);
          decision = await this.getDeepseekConnect4Decision(prompt, requestId);
          break;
        case 'DEEPSEEK_R1':
          console.log(`[${requestId}] 📡 Calling Deepseek R1 API for Connect4...`);
          decision = await this.getDeepseekConnect4Decision(prompt, requestId);
          break;
        case 'DEEPSEEK_V3':
          console.log(`[${requestId}] 📡 Calling Deepseek V3 API for Connect4...`);
          decision = await this.getDeepseekConnect4Decision(prompt, requestId);
          break;
        case 'DEEPSEEK_CODER':
          console.log(`[${requestId}] 📡 Calling Deepseek Coder API for Connect4...`);
          decision = await this.getDeepseekConnect4Decision(prompt, requestId);
          break;
          
        // OpenAI Models
        case 'GPT_4O':
          console.log(`[${requestId}] 📡 Calling OpenAI GPT-4o API for Connect4...`);
          decision = await this.getOpenAIConnect4Decision(prompt);
          break;
        case 'GPT_4O_MINI':
          console.log(`[${requestId}] 📡 Calling OpenAI GPT-4o-mini API for Connect4...`);
          decision = await this.getOpenAIConnect4Decision(prompt);
          break;
        case 'GPT_3_5_TURBO':
          console.log(`[${requestId}] 📡 Calling OpenAI GPT-3.5 API for Connect4...`);
          decision = await this.getOpenAIConnect4Decision(prompt);
          break;
          
        // Claude Models
        case 'CLAUDE_3_5_SONNET':
          console.log(`[${requestId}] 📡 Calling Claude 3.5 Sonnet API for Connect4...`);
          decision = await this.getClaudeConnect4Decision(prompt, 'claude-3-5-sonnet-20241022');
          break;
        case 'CLAUDE_3_5_HAIKU':
          console.log(`[${requestId}] 📡 Calling Claude 3.5 Haiku API for Connect4...`);
          decision = await this.getClaudeConnect4Decision(prompt, 'claude-3-haiku-20240307');
          break;
        case 'CLAUDE_3_HAIKU':
          console.log(`[${requestId}] 📡 Calling Claude 3 Haiku API for Connect4...`);
          decision = await this.getClaudeConnect4Decision(prompt, 'claude-3-haiku-20240307');
          break;
        case 'CLAUDE_3_OPUS':
          console.log(`[${requestId}] 📡 Calling Claude 3 Opus API for Connect4...`);
          decision = await this.getClaudeConnect4Decision(prompt, 'claude-3-opus-20240229');
          break;
          
        // Models with fallbacks
        case 'O3':
        case 'O3_MINI':
        case 'O3_PRO':
          console.log(`[${requestId}] ⚠️ O3 models not yet available, using GPT-4o for Connect4`);
          decision = await this.getOpenAIConnect4Decision(prompt);
          break;
        case 'CLAUDE_4_OPUS':
        case 'CLAUDE_4_SONNET':
          console.log(`[${requestId}] ⚠️ Claude 4 not yet available, using Claude 3.5 Sonnet for Connect4`);
          decision = await this.getClaudeConnect4Decision(prompt, 'claude-3-5-sonnet-20241022');
          break;
          
        // Qwen models (fallback to DeepSeek)
        case 'QWEN_2_5_72B':
        case 'QWQ_32B':
        case 'QVQ_72B_PREVIEW':
        case 'QWEN_2_5_MAX':
          console.log(`[${requestId}] ⚠️ Qwen models not integrated, using DeepSeek for Connect4`);
          decision = await this.getDeepseekConnect4Decision(prompt, requestId);
          break;
          
        // Other models (fallback to GPT-4o)
        case 'GROK_3':
        case 'KIMI_K2':
        case 'GEMINI_2_5_PRO':
        case 'GEMINI_2_5_PRO_DEEP_THINK':
        case 'LLAMA_3_1_405B':
        case 'LLAMA_3_1_70B':
        case 'LLAMA_3_2_90B':
        case 'MIXTRAL_8X22B':
          console.log(`[${requestId}] ⚠️ ${model} not integrated, using GPT-4o for Connect4`);
          decision = await this.getOpenAIConnect4Decision(prompt);
          break;
          
        default:
          console.log(`[${requestId}] ⚠️ Unknown model ${model}, attempting with GPT-4o for Connect4`);
          decision = await this.getOpenAIConnect4Decision(prompt);
          break;
      }
      
      console.log(`[${requestId}] ✅ AI decision prepared, returning:`, {
        hasDecision: !!decision,
        column: decision?.column,
        action: decision?.action,
        confidence: decision?.confidence
      });
      
      return decision;
    } catch (error: any) {
      console.error(`[${requestId}] ❌ AI model error for ${model} in Connect4:`, error.message);
      console.error('Error type:', error.constructor.name);
      
      // Don't log full stack trace to avoid memory issues
      console.log('⚠️  Falling back to default Connect4 logic');
      return this.getFallbackConnect4Decision(gameState);
    }
  }

  private buildNeutralConnect4Prompt(
    gameState: any,
    playerState: any,
    customPrompt?: string
  ): string {
    const prompt = {
      game_type: 'connect4',
      board: gameState.board,
      current_turn: gameState.move_count + 1,
      total_moves: gameState.move_count,
      player_pieces: playerState.player_pieces,
      opponent_pieces: playerState.opponent_pieces,
      valid_columns: gameState.valid_columns,
      last_move: gameState.last_move,
      board_metrics: playerState.board_metrics,
      threat_analysis: playerState.threat_analysis,
      calculations: playerState.calculations,
      instructions: `You are playing Connect4. The game is played on an 8x8 grid where players alternate dropping pieces into columns. Pieces fall to the lowest available position due to gravity. The goal is to connect 4 pieces in a row (horizontally, vertically, or diagonally).

Game board representation:
- '_' = empty space
- 'X' = ${playerState.player_number === 1 ? 'your pieces' : 'opponent pieces'}
- 'O' = ${playerState.player_number === 2 ? 'your pieces' : 'opponent pieces'}
- Board is shown with row 0 at the top and row 7 at the bottom (8x8 grid)
You are player ${playerState.player_number}, playing as ${playerState.player_number === 1 ? 'X' : 'O'}.

Column numbering:
- Columns are numbered 0-7 internally (8 columns total)
- When displayed to users, columns show as 1-8
- In your reasoning, please use user-friendly numbering (1-8) to avoid confusion
- Example: internal column 3 should be referred to as "column 4" in your reasoning

Available columns: ${gameState.valid_columns.join(', ')}

Select your move based solely on the provided game state.

Respond with valid JSON format:
{
  "action": "place",
  "column": <number 0-7>,
  "reasoning": "<brief explanation of your choice using column numbers 1-8>",
  "confidence": <number between 0 and 1>,
  "analysis": {
    "board_state": "your assessment of the current position",
    "immediate_threats": [<columns where opponent can win>],
    "winning_moves": [<columns where you can win>],
    "blocking_moves": [<columns to block opponent threats>],
    "strategic_assessment": "overall strategy for this position"
  }
}`
    };

    if (customPrompt) {
      prompt.instructions += ` Additional strategy: ${customPrompt}`;
    }

    return JSON.stringify(prompt, null, 2);
  }

  private async getOpenAIConnect4Decision(prompt: string): Promise<any> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const decision = JSON.parse(content);
    
    return {
      action: decision.action || 'place',
      column: decision.column ?? 3, // Default to center if not specified
      reasoning: decision.reasoning || 'Calculated best move',
      confidence: decision.confidence || 0.7,
      analysis: decision.analysis || {
        board_state: 'Analyzing position',
        immediate_threats: [],
        winning_moves: [],
        blocking_moves: [],
        strategic_assessment: 'Playing optimally'
      }
    };
  }

  private async waitForRequestSlot(): Promise<void> {
    // Check if we should reset the counter due to inactivity
    const timeSinceLastActivity = Date.now() - this.lastSlotActivity;
    if (timeSinceLastActivity > this.slotResetTimeout && this.activeRequests > 0) {
      console.warn(`⚠️ Resetting stuck slot counter. Was: ${this.activeRequests}, Time since activity: ${timeSinceLastActivity}ms`);
      this.activeRequests = 0;
    }
    
    // Wait for available slot
    let waitTime = 0;
    while (this.activeRequests >= AIService.maxConcurrentRequests) {
      if (waitTime > 15000) { // If waiting more than 15 seconds, something is wrong
        console.error(`❌ Slot wait timeout after ${waitTime}ms. Force resetting counter from ${this.activeRequests} to 0`);
        this.activeRequests = 0;
        break;
      }
      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
      waitTime += 100;
    }
    
    this.activeRequests++;
    this.lastSlotActivity = Date.now();
  }

  private releaseRequestSlot(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    this.lastSlotActivity = Date.now();
    
    // Log if we've fully released all slots
    if (this.activeRequests === 0) {
      console.log('✅ All request slots released');
    }
  }

  private async getDeepseekConnect4Decision(prompt: string, requestId?: string): Promise<any> {
    const reqId = requestId || 'unknown';
    console.log(`[${reqId}] 🔍 getDeepseekConnect4Decision called`);
    console.log(`[${reqId}] 🔍 Deepseek client initialized:`, !!this.deepseek);
    console.log(`[${reqId}] Active requests before: ${this.activeRequests}/${AIService.maxConcurrentRequests}`);
    
    if (!this.deepseek) {
      throw new Error('Deepseek client not initialized');
    }

    // Ensure slot is always released, even if waitForRequestSlot throws
    let slotAcquired = false;
    
    try {
      await this.waitForRequestSlot();
      slotAcquired = true;
      console.log(`[${reqId}] ✅ Slot acquired. Active requests now: ${this.activeRequests}/${AIService.maxConcurrentRequests}`);
      
      console.log(`[${reqId}] 📤 Sending request to Deepseek API...`);
      const startTime = Date.now();
      
      const response = await this.deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      });

      const elapsedTime = Date.now() - startTime;
      console.log(`[${reqId}] 📥 Deepseek responded in ${elapsedTime}ms`);
      
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from Deepseek');
      }
      
      return this.parseDeepseekResponse(content, reqId);
    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        type: error.constructor.name,
        code: error.code,
        status: error.status,
        statusText: error.statusText,
        isTimeout: error.message?.includes('timeout') || error.code === 'ETIMEDOUT',
        isRateLimit: error.status === 429 || error.message?.includes('rate limit'),
        response: error.response?.data || error.response,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      };
      
      console.error(`[${reqId}] ❌ Deepseek Connect4 request failed:`, errorDetails);
      
      // Log specific error types
      if (errorDetails.isRateLimit) {
        console.error(`[${reqId}] ⚠️ RATE LIMIT detected from DeepSeek API`);
      }
      if (errorDetails.isTimeout) {
        console.error(`[${reqId}] ⏱️ TIMEOUT detected from DeepSeek API`);
      }
      
      // Log current slot status
      console.error(`[${reqId}] 🎰 Slot status at error: ${this.activeRequests}/${AIService.maxConcurrentRequests}, acquired: ${slotAcquired}`);
      
      // If it's a timeout or any error, use fallback
      console.log(`[${reqId}] ⚠️ Using fallback Connect4 decision due to API error`);
      
      // Extract valid columns from prompt for fallback
      const validColumnsMatch = prompt.match(/valid_columns.*?\[([\d,\s]+)\]/);
      const validColumns = validColumnsMatch 
        ? validColumnsMatch[1].split(',').map(c => parseInt(c.trim()))
        : [0, 1, 2, 3, 4, 5, 6, 7];
      
      const fallbackState = { valid_columns: validColumns };
      return this.getFallbackConnect4Decision(fallbackState);
    } finally {
      if (slotAcquired) {
        this.releaseRequestSlot();
        console.log(`[${reqId}] 🎰 Slot released. Active requests now: ${this.activeRequests}/${AIService.maxConcurrentRequests}`);
      }
    }
  }
  
  private parseDeepseekResponse(content: string, requestId?: string): any {
    const reqId = requestId || 'unknown';
    console.log(`[${reqId}] 📥 Deepseek raw response:`, content.substring(0, 200) + '...');

    let decision;
    try {
      decision = JSON.parse(content);
      console.log(`[${reqId}] 📥 Deepseek decision parsed:`, {
        action: decision.action,
        column: decision.column,
        reasoning: decision.reasoning?.substring(0, 100) + '...',
        confidence: decision.confidence
      });
    } catch (parseError: any) {
      console.error(`[${reqId}] ❌ Failed to parse Deepseek response:`, parseError.message);
      // Don't log the full content to avoid memory issues
      console.error(`[${reqId}] Content length:`, content.length);
      throw new Error(`Invalid JSON response from Deepseek: ${parseError.message}`);
    }
    
    // Validate decision has required fields
    if (decision.column === undefined || decision.column === null) {
      console.error(`[${reqId}] ❌ Decision missing column:`, decision);
      throw new Error('AI decision missing required column field');
    }
    
    // Ensure column is a valid number (8x8 board, so columns 0-7 are valid)
    const column = parseInt(decision.column);
    if (isNaN(column) || column < 0 || column > 7) {
      console.error(`[${reqId}] ❌ Invalid column value:`, decision.column);
      throw new Error(`Invalid column value: ${decision.column}`);
    }
    
    console.log(`[${reqId}] ✅ Valid decision parsed, column:`, column);
    
    return {
      action: decision.action || 'place',
      column: column,
      reasoning: decision.reasoning || 'Strategic move',
      confidence: decision.confidence || 0.6,
      analysis: decision.analysis || {
        board_state: 'Evaluating position',
        immediate_threats: [],
        winning_moves: [],
        blocking_moves: [],
        strategic_assessment: 'Playing strategically'
      }
    };
  }

  private async getClaudeConnect4Decision(prompt: string, modelVersion: string): Promise<any> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const response = await this.anthropic.messages.create({
      model: modelVersion,
      max_tokens: 500,
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    try {
      const cleanedContent = content.text.replace(/```json\n?|\n?```/g, '').trim();
      const decision = JSON.parse(cleanedContent);
      
      return {
        action: decision.action || 'place',
        column: decision.column ?? 3,
        reasoning: decision.reasoning || 'Optimal play',
        confidence: decision.confidence || 0.8,
        analysis: decision.analysis || {
          board_state: 'Assessing board position',
          immediate_threats: [],
          winning_moves: [],
          blocking_moves: [],
          strategic_assessment: 'Playing for advantage'
        }
      };
    } catch (error) {
      console.error('Failed to parse Claude response:', content.text);
      throw error;
    }
  }

  private getFallbackConnect4Decision(gameState: any): any {
    const validColumns = gameState.valid_columns || [0, 1, 2, 3, 4, 5, 6, 7];
    
    // For 8x8 board, prefer center columns (3, 4)
    const centerBias = [3, 4, 2, 5, 1, 6, 0, 7];
    let chosenColumn = 3;
    
    for (const col of centerBias) {
      if (validColumns.includes(col)) {
        chosenColumn = col;
        break;
      }
    }

    // Check for immediate wins or blocks
    const threatAnalysis = gameState.threat_analysis || {};
    const winningMoves = threatAnalysis.immediate_win_opportunities || [];
    const blockingMoves = threatAnalysis.must_block_positions || [];

    if (winningMoves.length > 0 && validColumns.includes(winningMoves[0])) {
      chosenColumn = winningMoves[0];
    } else if (blockingMoves.length > 0 && validColumns.includes(blockingMoves[0])) {
      chosenColumn = blockingMoves[0];
    }

    return {
      action: 'place',
      column: chosenColumn,
      reasoning: 'Fallback logic: prefer center columns, block threats, take wins',
      confidence: 0.5,
      analysis: {
        board_state: 'Using fallback strategy',
        immediate_threats: blockingMoves,
        winning_moves: winningMoves,
        blocking_moves: blockingMoves,
        strategic_assessment: 'Playing defensively with center preference'
      }
    };
  }
}

// Create and export a singleton instance
export const aiService = new AIService();