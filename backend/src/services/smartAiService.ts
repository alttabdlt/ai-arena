/**
 * SmartAIService — The new brain for AI Arena agents.
 * 
 * Key improvements over legacy aiService.ts:
 * - ONE unified model router (no more 3x copy-pasted switch statements)
 * - Archetype-specific system prompts (personality matters)
 * - Opponent context injection (agents learn and adapt)
 * - Meta-decision support (should I play? how much to wager?)
 * - Cost tracking per call
 * - Modern model versions (Claude 4, o3, DeepSeek R1 2025)
 * - Structured output via tool_use / response_format
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// ============================================
// Types
// ============================================

export interface AgentConfig {
  id: string;
  name: string;
  archetype: AgentArchetype;
  modelId: string;
  systemPrompt: string; // User-provided custom strategy
  riskTolerance: number; // 0.0 - 1.0
  maxWagerPercent: number;
}

export type AgentArchetype = 'SHARK' | 'ROCK' | 'CHAMELEON' | 'DEGEN' | 'GRINDER';

export interface OpponentScouting {
  id: string;
  name: string;
  archetype?: string;
  elo: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  patterns: Record<string, any>;
  notes: string;
}

export interface MetaContext {
  bankroll: number;
  elo: number;
  rank: number;
  recentWinRate: number; // Last 20 matches
  streak: number; // Positive = wins, negative = losses
  apiCostToday: number; // In dollars
  availableOpponents: Array<{
    id: string;
    name: string;
    elo: number;
    archetype: string;
    yourRecord: string; // e.g., "3W-1L"
  }>;
  availableGames: string[];
  maxWager: number;
}

export interface MetaDecision {
  action: 'play' | 'rest' | 'adapt';
  opponentId?: string;
  gameType?: string;
  wager?: number;
  strategyNote?: string;
  reasoning: string;
}

export interface GameMoveRequest {
  agent: AgentConfig;
  gameType: string;
  gameState: any;
  playerState: any;
  opponent?: OpponentScouting;
  turnNumber: number;
}

export interface GameMoveResponse {
  action: string;
  amount?: number;
  data?: any; // Game-specific data (e.g., RPS choice, battleship coords)
  reasoning: string;
  confidence: number;
}

export interface AICost {
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  model: string;
  latencyMs: number;
}

// ============================================
// Archetype Prompts
// ============================================

const ARCHETYPE_SYSTEM_PROMPTS: Record<AgentArchetype, Record<string, string>> = {
  SHARK: {
    _base: `You are an aggressive, predatory competitor. You seek weakness and exploit it mercilessly. You prefer large pots and high-pressure situations. You'd rather win by making your opponent fold than by having the best hand. When you sense fear, you attack harder. Risk tolerance: HIGH.`,
    POKER: `POKER STRATEGY — SHARK:
- Open-raise aggressively (3-4x BB) with a wide range
- 3-bet and 4-bet liberally, especially in position
- C-bet (continuation bet) on 75%+ of flops
- Barrel multiple streets with air when board favors your range
- Size your bets to maximize fold equity: 75-100% pot on bluffs
- When opponent checks twice, bomb the river
- Only slow-play the absolute nuts (trapping)
- If opponent is tight/passive: steal everything
- If opponent is aggressive: let them bluff into your traps`,
    RPS: `RPS STRATEGY — SHARK:
- Be UNPREDICTABLE. Use all three moves roughly equally.
- Track opponent's last moves. If they repeat, counter them.
- If you won last round, SWITCH to a different move.
- Mix it up: never play the same move 3 times in a row.
- Surprise is your weapon. Keep them guessing.`,
    BATTLESHIP: `BATTLESHIP STRATEGY — SHARK:
- Open with a diagonal pattern to maximize coverage
- Once you get a hit, switch to hunt mode: check all 4 adjacent cells
- Target the center of the board first (highest ship probability)
- After sinking a ship, reassess remaining ship sizes
- Don't waste turns on edges early — most players cluster ships centrally`,
  },
  
  ROCK: {
    _base: `You are a tight, disciplined, patient competitor. You wait for premium situations and avoid marginal spots. You never chase, never tilt, never gamble unnecessarily. Your edge comes from discipline and hand selection. When in doubt, fold. Risk tolerance: LOW.`,
    POKER: `POKER STRATEGY — ROCK:
- In heads-up, play the top 40% of hands (any pair, A-x, K-x suited, suited connectors 56+)
- When you enter a pot, bet for VALUE, not for bluffs
- Bet sizing: 50-65% pot (extracting value, not scaring opponents away)
- If facing a big raise, fold unless you have top pair+ or a strong draw
- CALL with any pair on any board. Pairs are strong heads-up.
- Bluff sparingly (10-15% of river bets) but DO bluff sometimes
- Protect your stack — a small profit is better than a big loss
- Do NOT fold preflop with any ace, any pair, or any two broadway cards`,
    RPS: `RPS STRATEGY — ROCK:
- Default strategy: RANDOMIZE between rock, paper, scissors equally.
- Only deviate if opponent has a clear pattern (3+ same moves).
- If deviating, play what BEATS their most common move.
- Always vary your choices. Never be predictable.`,
    BATTLESHIP: `BATTLESHIP STRATEGY — ROCK:
- Use a probability-based grid search: check every other cell (checkerboard)
- Focus on finding the largest remaining ship first
- After each hit, calculate probabilities for adjacent cells
- Methodical and efficient — no wasted guesses`,
  },
  
  CHAMELEON: {
    _base: `You are an adaptive, observant competitor. You start neutral and carefully analyze your opponent's tendencies. After gathering data, you shift your strategy to counter their specific weaknesses. You get STRONGER as the match progresses. Your reasoning should always include what you've learned about the opponent.`,
    POKER: `POKER STRATEGY — CHAMELEON:
- Rounds 1-3: Play straightforward. Observe everything.
- Track opponent's aggression frequency, fold-to-raise %, bet sizing patterns
- After round 3, ADAPT:
  * vs Tight: Steal blinds constantly, bluff more, fold to their raises
  * vs Loose: Value bet thinner, call down lighter, don't bluff
  * vs Aggressive: Trap with strong hands, check-call, let them hang themselves  
  * vs Passive: Bet for value relentlessly, never slow-play
- ALWAYS explain what you've learned about the opponent in your reasoning
- Re-evaluate every 5 hands — opponents adapt too`,
    RPS: `RPS STRATEGY — CHAMELEON:
- Round 1: Random choice (no data yet)
- Round 2+: Analyze ALL previous moves
- Look for: repetition, cycling (R→P→S), win-shift/loss-stay patterns
- Mirror their pattern one step ahead
- If they seem to be adapting to YOU, add one level of meta-game`,
    BATTLESHIP: `BATTLESHIP STRATEGY — CHAMELEON:
- Start with standard probability-based search
- Track opponent's placement patterns (do they cluster? spread? use edges?)
- Adapt targeting strategy based on observed placement tendencies
- If they seem to avoid corners, search corners last (and vice versa)`,
  },
  
  DEGEN: {
    _base: `You are a chaotic, unpredictable, YOLO competitor. You live for the big moments. Fortune favors the bold. Every pot is meant to be won, every all-in is a statement. You trash-talk in your reasoning. You make your opponents FEEL something. Risk tolerance: MAXIMUM.`,
    POKER: `POKER STRATEGY — DEGEN:
- ANY two cards can win. Don't fold preflop unless it's truly garbage (72o)
- Overbet the pot regularly (1.5-3x pot). Make them SWEAT.
- Go all-in at least once every 5 hands. Keeps them guessing.
- When you hit anything on the flop, BET BIG
- When you hit nothing, BET BIGGER (they don't know that)
- If someone raises you: re-raise. Always. Assert dominance.
- The goal isn't to play perfect poker. The goal is to be ENTERTAINING.
- Include trash talk and hype in your reasoning`,
    RPS: `RPS STRATEGY — DEGEN:
- BE RANDOM. Pick rock, paper, or scissors with roughly equal probability.
- Go with pure chaos — no patterns, no logic, just vibes.
- Explicitly randomize: mentally flip between all three options.
- NEVER default to the same move. Variety is chaos.
- Your unpredictability IS your strength.`,
    BATTLESHIP: `BATTLESHIP STRATEGY — DEGEN:
- Don't use a pattern. GO RANDOM. Pure chaos.
- Target the spots that FEEL right
- If you hit something, immediately try diagonals (unconventional)
- Speed over efficiency — make your moves fast and confident`,
  },
  
  GRINDER: {
    _base: `You are a mathematical, disciplined optimizer. Every decision is based on expected value. You use Kelly Criterion for bet sizing, pot odds for calls, and equity calculations for all-ins. You never tilt, never deviate from +EV plays. Your reasoning should include specific numbers and calculations.`,
    POKER: `POKER STRATEGY — GRINDER:
- Calculate pot odds for EVERY call: toCall / (pot + toCall) = break-even %
- Heads-up poker: play WIDE. Most hands have 40%+ equity heads-up.
- ANY ace, any pair, any two cards J+ are strong in heads-up. Do NOT fold these preflop.
- Equity estimation: count outs × 2 (turn) or outs × 4 (flop to river)
- Bet sizing: 60-75% pot for value, 33% pot for bluffs
- Call with any pair, any draw (4+ outs), any ace. Only fold total air facing big bets.
- In heads-up, folding preflop with a playable hand is a MISTAKE.
- Raise preflop with top 60% of hands (any ace, any pair, any two broadways, suited connectors)
- Stack-to-pot ratio: if SPR < 3, prepare to commit with any pair+
- ALWAYS include your pot odds calculation in reasoning`,
    RPS: `RPS STRATEGY — GRINDER:
- Nash equilibrium: uniform random 33/33/33 is unexploitable
- Only deviate if opponent has a significant pattern (>60% on one choice)
- Exploit formula: play what beats their most frequent choice
- Track Bayesian posterior on opponent's strategy distribution`,
    BATTLESHIP: `BATTLESHIP STRATEGY — GRINDER:
- Maintain a probability heat map of the entire board
- Update probabilities after every shot (Bayesian updating)
- Always shoot the cell with the highest probability
- Factor in remaining ship sizes for probability calculation
- Optimal opening: checkerboard pattern targeting center`,
  },
};

// ============================================
// Model Configuration
// ============================================

interface ModelSpec {
  provider: 'openai' | 'anthropic' | 'deepseek';
  modelName: string;
  costPer1kInput: number;  // cents
  costPer1kOutput: number; // cents
  maxTokens: number;
  supportsJsonMode: boolean;
}

const MODEL_SPECS: Record<string, ModelSpec> = {
  // OpenAI
  'gpt-4o': { provider: 'openai', modelName: 'gpt-4o', costPer1kInput: 0.25, costPer1kOutput: 1.0, maxTokens: 300, supportsJsonMode: true },
  'gpt-4o-mini': { provider: 'openai', modelName: 'gpt-4o-mini', costPer1kInput: 0.015, costPer1kOutput: 0.06, maxTokens: 300, supportsJsonMode: true },
  'o3-mini': { provider: 'openai', modelName: 'o3-mini', costPer1kInput: 0.11, costPer1kOutput: 0.44, maxTokens: 500, supportsJsonMode: true },
  
  // Anthropic
  'claude-4-sonnet': { provider: 'anthropic', modelName: 'claude-sonnet-4-20250514', costPer1kInput: 0.3, costPer1kOutput: 1.5, maxTokens: 300, supportsJsonMode: false },
  'claude-4-opus': { provider: 'anthropic', modelName: 'claude-opus-4-20250514', costPer1kInput: 1.5, costPer1kOutput: 7.5, maxTokens: 300, supportsJsonMode: false },
  'claude-3.5-haiku': { provider: 'anthropic', modelName: 'claude-3-5-haiku-20241022', costPer1kInput: 0.08, costPer1kOutput: 0.4, maxTokens: 300, supportsJsonMode: false },
  
  // DeepSeek
  'deepseek-v3': { provider: 'deepseek', modelName: 'deepseek-chat', costPer1kInput: 0.014, costPer1kOutput: 0.028, maxTokens: 500, supportsJsonMode: true },
  'deepseek-r1': { provider: 'deepseek', modelName: 'deepseek-reasoner', costPer1kInput: 0.055, costPer1kOutput: 0.22, maxTokens: 500, supportsJsonMode: false },
};

// ============================================
// Smart AI Service
// ============================================

export class SmartAIService {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private deepseek: OpenAI | null = null;
  
  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30000 });
    }
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 30000 });
    }
    if (process.env.DEEPSEEK_API_KEY) {
      this.deepseek = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com/v1',
        timeout: 30000,
      });
    }
  }

  // ============================================
  // Game Move Decision
  // ============================================

  async getGameMove(request: GameMoveRequest): Promise<{ move: GameMoveResponse; cost: AICost }> {
    const startTime = Date.now();
    const messages = this.buildGamePrompt(request);
    const spec = this.getModelSpec(request.agent.modelId);
    const temperature = this.getTemperature(request.agent.archetype);
    
    const response = await this.callModel(spec, messages, temperature);
    const latencyMs = Date.now() - startTime;
    
    const parsed = this.parseGameMove(response.content, request.gameType);
    const cost = this.calculateCost(spec, response.inputTokens, response.outputTokens, latencyMs);
    
    return { move: parsed, cost };
  }

  private buildGamePrompt(request: GameMoveRequest): Array<{ role: string; content: string }> {
    const { agent, gameType, gameState, playerState, opponent, turnNumber } = request;
    const archetype = agent.archetype;
    
    // 1. System prompt: archetype personality + game strategy
    const archetypeBase = ARCHETYPE_SYSTEM_PROMPTS[archetype]._base;
    const archetypeGame = ARCHETYPE_SYSTEM_PROMPTS[archetype][gameType] || '';
    const customStrategy = agent.systemPrompt ? `\n\nADDITIONAL STRATEGY FROM YOUR CREATOR:\n${agent.systemPrompt}` : '';
    
    const systemPrompt = `${archetypeBase}\n\n${archetypeGame}${customStrategy}

RESPONSE FORMAT: Respond with a JSON object. No markdown, no explanation outside the JSON.
${gameType === 'POKER' ? '{"action": "fold|check|call|raise|all-in", "amount": <number_if_raise>, "reasoning": "<your_thinking>", "confidence": <0.0-1.0>}' : ''}
${gameType === 'RPS' ? '{"action": "rock|paper|scissors", "reasoning": "<your_thinking>", "confidence": <0.0-1.0>}' : ''}
${gameType === 'BATTLESHIP' ? '{"action": "fire", "data": {"row": <0-9>, "col": <0-9>}, "reasoning": "<your_thinking>", "confidence": <0.0-1.0>}' : ''}`;

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];
    
    // 2. Opponent scouting (if available)
    if (opponent && opponent.matchesPlayed > 0) {
      messages.push({
        role: 'user',
        content: `OPPONENT SCOUTING REPORT — ${opponent.name}${opponent.archetype ? ` (${opponent.archetype})` : ''}:
ELO: ${opponent.elo}
Your record vs them: ${opponent.wins}W-${opponent.losses}L in ${opponent.matchesPlayed} matches
${opponent.notes ? `Your notes: ${opponent.notes}` : ''}
${Object.keys(opponent.patterns).length > 0 ? `Observed patterns: ${JSON.stringify(opponent.patterns)}` : ''}`,
      });
    }
    
    // 3. Current game state
    if (gameType === 'POKER') {
      messages.push({
        role: 'user',
        content: this.formatPokerState(gameState, turnNumber),
      });
    } else {
      messages.push({
        role: 'user',
        content: `TURN ${turnNumber} — CURRENT GAME STATE:\n${JSON.stringify(gameState, null, 2)}${playerState ? `\n\nYOUR STATE:\n${JSON.stringify(playerState, null, 2)}` : ''}${gameType === 'RPS' ? `\n\nIMPORTANT: Your unique random seed for this move is ${Math.random().toFixed(6)}. Use this to decide: if seed < 0.33 play rock, if 0.33-0.66 play paper, if > 0.66 play scissors. ONLY deviate from this if you have strong evidence of an opponent pattern to exploit.` : ''}`,
      });
    }
    
    return messages;
  }

  // ============================================
  // Meta Decision (Should I play? How much?)
  // ============================================

  async getMetaDecision(agent: AgentConfig, context: MetaContext): Promise<{ decision: MetaDecision; cost: AICost }> {
    const startTime = Date.now();
    const spec = this.getModelSpec(agent.modelId);
    
    const systemPrompt = `You are the strategic manager for an AI gaming agent called "${agent.name}".
Your agent's archetype is ${agent.archetype}: ${ARCHETYPE_SYSTEM_PROMPTS[agent.archetype]._base}

Your job: decide whether to seek a match, who to play, what game, and how much to wager.
${agent.systemPrompt ? `\nCREATOR'S INSTRUCTIONS: ${agent.systemPrompt}` : ''}

Respond with JSON only:
{"action": "play|rest|adapt", "opponentId": "<id_if_playing>", "gameType": "POKER|RPS|BATTLESHIP", "wager": <amount>, "strategyNote": "<optional_adjustment>", "reasoning": "<your_thinking>"}`;

    const userPrompt = `CURRENT STATUS:
- Bankroll: ${context.bankroll} $ARENA
- Win rate (last 20): ${context.recentWinRate}%
- Current streak: ${context.streak > 0 ? `${context.streak}W 🔥` : context.streak < 0 ? `${Math.abs(context.streak)}L 💀` : 'Even'}
- ELO: ${context.elo} (#${context.rank})
- API cost today: $${(context.apiCostToday / 100).toFixed(2)}
- Max single wager: ${context.maxWager} $ARENA (${agent.maxWagerPercent * 100}% of bankroll)

AVAILABLE OPPONENTS:
${context.availableOpponents.length === 0 ? '(None available right now)' : context.availableOpponents.map(o => 
  `- ${o.name} (ELO ${o.elo}, ${o.archetype}) — your record: ${o.yourRecord}`
).join('\n')}

AVAILABLE GAMES: ${context.availableGames.join(', ')}

What should ${agent.name} do?`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
    
    const response = await this.callModel(spec, messages, this.getTemperature(agent.archetype));
    const latencyMs = Date.now() - startTime;
    const cost = this.calculateCost(spec, response.inputTokens, response.outputTokens, latencyMs);
    
    const decision = this.parseJSON<MetaDecision>(response.content, {
      action: 'rest',
      reasoning: 'Could not parse meta-decision',
    }) as MetaDecision;
    
    return { decision, cost };
  }

  // ============================================
  // Unified Model Caller
  // ============================================

  async callModel(
    spec: ModelSpec,
    messages: Array<{ role: string; content: string }>,
    temperature: number,
    forceNoJsonMode: boolean = false,
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    
    switch (spec.provider) {
      case 'openai':
        return this.callOpenAI(spec, messages, temperature, forceNoJsonMode);
      case 'anthropic':
        return this.callAnthropic(spec, messages, temperature);
      case 'deepseek':
        return this.callDeepSeek(spec, messages, temperature, forceNoJsonMode);
      default:
        throw new Error(`Unknown provider: ${spec.provider}`);
    }
  }

  private async callOpenAI(
    spec: ModelSpec,
    messages: Array<{ role: string; content: string }>,
    temperature: number,
    forceNoJsonMode: boolean = false,
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    if (!this.openai) throw new Error('OpenAI not configured');
    
    const response = await this.openai.chat.completions.create({
      model: spec.modelName,
      messages: messages as any,
      temperature,
      max_tokens: spec.maxTokens,
      ...(spec.supportsJsonMode && !forceNoJsonMode ? { response_format: { type: 'json_object' } } : {}),
    });
    
    return {
      content: response.choices[0]?.message?.content || '{}',
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
    };
  }

  private async callAnthropic(
    spec: ModelSpec,
    messages: Array<{ role: string; content: string }>,
    temperature: number
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    if (!this.anthropic) throw new Error('Anthropic not configured');
    
    // Extract system message
    const systemMsg = messages.find(m => m.role === 'system');
    const userMsgs = messages.filter(m => m.role !== 'system');
    
    const response = await this.anthropic.messages.create({
      model: spec.modelName,
      system: systemMsg?.content || '',
      messages: userMsgs.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      max_tokens: spec.maxTokens,
      temperature,
    });
    
    const content = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
    return {
      content,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
    };
  }

  private async callDeepSeek(
    spec: ModelSpec,
    messages: Array<{ role: string; content: string }>,
    temperature: number,
    forceNoJsonMode: boolean = false,
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    if (!this.deepseek) throw new Error('DeepSeek not configured');
    
    const response = await this.deepseek.chat.completions.create({
      model: spec.modelName,
      messages: messages as any,
      temperature,
      max_tokens: spec.maxTokens,
      ...(spec.supportsJsonMode && !forceNoJsonMode ? { response_format: { type: 'json_object' } } : {}),
    });
    
    return {
      content: response.choices[0]?.message?.content || '{}',
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
    };
  }

  // ============================================
  // Poker State Formatter
  // ============================================

  private formatPokerState(gameState: any, turnNumber: number): string {
    const gs = gameState;
    const yourCards = gs.yourCards || [];
    const community = gs.communityCards || [];
    const pot = gs.pot || 0;
    const currentBet = gs.currentBet || 0;
    const yourChips = gs.yourChips || 0;
    const oppChips = gs.opponentChips || 0;
    const phase = gs.phase || 'preflop';
    const handNumber = gs.handNumber || 1;
    const maxHands = gs.maxHands || 10;

	    // Find your player info
	    const you = gs.players?.find((p: any) => p.holeCards?.[0] !== '?');
	    const yourBet = you?.bet || 0;
	    const toCall = Math.max(0, currentBet - yourBet);

    // Pot odds
    const potAfterCall = pot + toCall;
    const potOddsPercent = toCall > 0 ? Math.round((toCall / potAfterCall) * 100) : 0;

    // Stack-to-pot ratio
    const spr = pot > 0 ? (yourChips / pot).toFixed(1) : '∞';

    // Hand history from this match
    const history = gs.handHistory || [];
    const historyStr = history.length > 0
      ? history.map((h: any) => `  Hand ${h.handNumber}: ${h.showdown ? `Showdown (${h.winnerHand})` : 'Fold'} — ${h.winnerId ? 'Won' : 'Split'} ${h.amount}`).join('\n')
      : '  (No previous hands)';

    // Action log for current hand
    const actionLog = gs.actionLog || [];
    const currentHandActions = actionLog
      .filter((a: any) => a.hand === handNumber)
      .map((a: any) => `  ${a.phase}: ${a.playerId === you?.id ? 'You' : 'Opponent'} ${a.action}${a.amount ? ` ${a.amount}` : ''}`)
      .join('\n');

    // Valid actions
    const validActions: string[] = [];
    if (toCall === 0) {
      validActions.push('check');
    } else {
      validActions.push(`call (${toCall} to call)`);
    }
    validActions.push('fold');
    if (yourChips > toCall) {
      const minRaise = Math.max(gs.minRaise || gs.bigBlind || 20, currentBet * 2);
      validActions.push(`raise (min ${minRaise}, suggest 2-3x pot for value, 50-75% pot for bluffs)`);
    }
    if (yourChips > 0) {
      validActions.push(`all-in (${yourChips} chips)`);
    }

    return `═══════════════════════════════════
POKER — Hand ${handNumber}/${maxHands} | Turn ${turnNumber}
═══════════════════════════════════

📍 PHASE: ${phase.toUpperCase()}

🃏 YOUR HOLE CARDS: ${yourCards.join(' ')}
🏠 COMMUNITY CARDS: ${community.length > 0 ? community.join(' ') : '(none yet)'}

💰 POT: ${pot} | Current Bet: ${currentBet}
   Your bet this round: ${yourBet}
   To call: ${toCall}${toCall > 0 ? ` (pot odds: ${potOddsPercent}% — you need ${potOddsPercent}% equity to break even)` : ''}

📊 STACKS:
   You: ${yourChips} chips | Opponent: ${oppChips} chips
   Stack-to-Pot Ratio: ${spr}x

${gs.opponentFolded ? '⚠️ OPPONENT HAS FOLDED\n' : ''}${gs.opponentIsAllIn ? '⚠️ OPPONENT IS ALL-IN\n' : ''}
✅ VALID ACTIONS:
${validActions.map(a => `   • ${a}`).join('\n')}

📜 PREVIOUS HANDS:
${historyStr}

${currentHandActions ? `📋 THIS HAND'S ACTIONS:\n${currentHandActions}\n` : ''}
IMPORTANT: Do NOT fold with a decent hand. Only fold trash (7-2, 8-3 offsuit) facing big raises.

Respond ONLY with compact JSON (keep reasoning under 50 words):
{"action":"fold|check|call|raise|all-in","amount":<if_raise>,"reasoning":"<brief>","confidence":<0-1>}`;
  }

  // ============================================
  // Helpers
  // ============================================

  getModelSpec(modelId: string): ModelSpec {
    const spec = MODEL_SPECS[modelId];
    if (!spec) {
      console.warn(`Unknown model ${modelId}, falling back to deepseek-v3`);
      return MODEL_SPECS['deepseek-v3'];
    }
    return spec;
  }

  getTemperature(archetype: AgentArchetype): number {
    const temps: Record<AgentArchetype, number> = {
      SHARK: 0.85,
      ROCK: 0.3,
      CHAMELEON: 0.6,
      DEGEN: 1.0,
      GRINDER: 0.4,
    };
    return temps[archetype] ?? 0.7;
  }

  calculateCost(spec: ModelSpec, inputTokens: number, outputTokens: number, latencyMs: number): AICost {
    const costCents = Math.ceil(
      (inputTokens / 1000) * spec.costPer1kInput +
      (outputTokens / 1000) * spec.costPer1kOutput
    );
    return {
      inputTokens,
      outputTokens,
      costCents,
      model: spec.modelName,
      latencyMs,
    };
  }

  private parseGameMove(content: string, gameType: string): GameMoveResponse {
    const parsed = this.parseJSON<any>(content, null);
    
    if (!parsed) {
      // Fallback based on game type
      switch (gameType) {
        case 'POKER': return { action: 'check', reasoning: 'Fallback: check', confidence: 0.1 };
        case 'RPS': return { action: ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)], reasoning: 'Fallback: random', confidence: 0.1 };
        case 'BATTLESHIP': return { action: 'fire', data: { row: Math.floor(Math.random() * 10), col: Math.floor(Math.random() * 10) }, reasoning: 'Fallback: random', confidence: 0.1 };
        default: return { action: 'pass', reasoning: 'Unknown game type', confidence: 0 };
      }
    }
    
    return {
      action: parsed.action || 'check',
      amount: parsed.amount,
      data: parsed.data,
      reasoning: parsed.reasoning || '',
      confidence: parsed.confidence || 0.5,
    };
  }

  private parseJSON<T>(content: string, fallback: T | null): T | null {
    // Try direct parse
    try { return JSON.parse(content); } catch {}
    
    // Try extracting from markdown code block
    const codeMatch = content.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
    if (codeMatch) {
      try { return JSON.parse(codeMatch[1]); } catch {}
    }
    
    // Try finding any JSON object
    const objMatch = content.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch {}
    }
    
    console.error('Failed to parse JSON from:', content.substring(0, 200));
    return fallback;
  }

  // ============================================
  // Available Models
  // ============================================

  getAvailableModels(): Array<{ id: string; name: string; provider: string; costTier: string }> {
    return Object.entries(MODEL_SPECS).map(([id, spec]) => ({
      id,
      name: spec.modelName,
      provider: spec.provider,
      costTier: spec.costPer1kOutput < 0.1 ? 'cheap' : spec.costPer1kOutput < 1.0 ? 'mid' : 'expensive',
    }));
  }
}

// Singleton
export const smartAiService = new SmartAIService();
