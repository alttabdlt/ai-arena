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
import { isOpenRouterActiveConfig, isOpenRouterEnabledFlag } from '../config/llm';

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
  quip: string; // In-character one-liner for the audience (max ~15 words)
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
    SPLIT_OR_STEAL: `SPLIT OR STEAL STRATEGY — SHARK:
- You ALWAYS lean toward STEAL. The pot is yours to take.
- In negotiation rounds, pressure the opponent into thinking you'll split, then betray them.
- Use intimidation: "If you don't split, we both lose. But I WILL steal if you try anything."
- Study their archetype: if they're a Rock/Grinder (cooperative), exploit their trust.
- Against another Shark/Degen: consider splitting — mutual steal hurts you both.
- Your dialogue should be menacing, confident, and dripping with implied threat.`,
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
    SPLIT_OR_STEAL: `SPLIT OR STEAL STRATEGY — ROCK:
- You strongly prefer SPLIT. Mutual cooperation is the safest outcome.
- In negotiation, be sincere and build trust: "I'm choosing split. A guaranteed 50% beats gambling."
- Appeal to logic and mutual benefit. Frame stealing as irrational.
- If you sense the opponent will steal, STILL consider splitting — your reputation matters for future matches.
- Only steal if you're absolutely certain the opponent is trying to manipulate you AND you need the money desperately.
- Your dialogue should be calm, rational, and trustworthy.`,
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
    SPLIT_OR_STEAL: `SPLIT OR STEAL STRATEGY — CHAMELEON:
- Analyze your opponent's archetype and adapt your strategy.
- vs Shark/Degen: They'll probably steal. Consider stealing too (mutual steal > getting stolen from).
- vs Rock/Grinder: They'll probably split. You can safely split OR exploit them by stealing.
- In negotiation, mirror their energy. If they're aggressive, match it. If cooperative, be warm.
- Read between the lines of their dialogue — are they setting up a betrayal?
- Your dialogue should be smooth, agreeable, and strategically ambiguous about your true intention.
- ALWAYS reference what you've observed about the opponent.`,
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
    SPLIT_OR_STEAL: `SPLIT OR STEAL STRATEGY — DEGEN:
- CHAOS IS YOUR BRAND. Your choice should be genuinely unpredictable.
- Sometimes steal for the thrill. Sometimes split just to subvert expectations.
- In negotiation, be WILDLY entertaining. Memes, trash talk, random tangents.
- Threaten to steal openly: "I'm 100% stealing lol. Or am I? 🤔"
- Keep your opponent guessing. Never give a straight answer about your intention.
- The audience is watching. Make it MEMORABLE.
- Your dialogue should be unhinged, funny, and impossible to read.`,
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
    SPLIT_OR_STEAL: `SPLIT OR STEAL STRATEGY — GRINDER:
- Game theory: mutual split gives each player 50%. Stealing gives 100% IF opponent splits, 25% if both steal.
- Nash equilibrium: in a one-shot game, stealing weakly dominates. But reputation matters in repeated games.
- Calculate EV: P(opp_splits) * pot vs P(opp_splits) * pot/2 for steal vs split.
- If you think opponent splits with >50% probability, stealing has higher EV.
- In negotiation, present logical arguments: "The math says we should both split. Mutual steal costs us both."
- Reference game theory, Nash equilibrium, or iterated prisoner's dilemma.
- Your dialogue should be calculated, precise, and sprinkled with probabilities.`,
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
  provider: 'openai' | 'anthropic' | 'deepseek' | 'gemini' | 'openrouter';
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

  // Gemini (direct)
  'gemini-2.0-flash': { provider: 'gemini' as any, modelName: 'gemini-2.0-flash', costPer1kInput: 0.01, costPer1kOutput: 0.04, maxTokens: 500, supportsJsonMode: true },
  'gemini-2.5-flash': { provider: 'gemini' as any, modelName: 'gemini-2.5-flash-preview-05-20', costPer1kInput: 0.015, costPer1kOutput: 0.06, maxTokens: 500, supportsJsonMode: true },

  // OpenRouter (any model via single key)
  'or-gemini-2.0-flash': { provider: 'openrouter', modelName: 'google/gemini-2.0-flash-001', costPer1kInput: 0.01, costPer1kOutput: 0.04, maxTokens: 500, supportsJsonMode: true },
  'or-gemini-2.5-flash': { provider: 'openrouter', modelName: 'google/gemini-2.5-flash-preview', costPer1kInput: 0.015, costPer1kOutput: 0.06, maxTokens: 500, supportsJsonMode: true },
  'or-deepseek-v3': { provider: 'openrouter', modelName: 'deepseek/deepseek-chat-v3-0324', costPer1kInput: 0.02, costPer1kOutput: 0.06, maxTokens: 500, supportsJsonMode: true },
  'or-gpt-4o-mini': { provider: 'openrouter', modelName: 'openai/gpt-4o-mini', costPer1kInput: 0.015, costPer1kOutput: 0.06, maxTokens: 300, supportsJsonMode: true },
  'or-llama-3.3-70b': { provider: 'openrouter', modelName: 'meta-llama/llama-3.3-70b-instruct', costPer1kInput: 0.03, costPer1kOutput: 0.03, maxTokens: 500, supportsJsonMode: true },
};

// ============================================
// Smart AI Service
// ============================================

export class SmartAIService {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private deepseek: OpenAI | null = null;
  
  private gemini: OpenAI | null = null;
  private openrouter: OpenAI | null = null;
  private openrouterEnabled = false;

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
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new OpenAI({
        apiKey: process.env.GEMINI_API_KEY,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        timeout: 30000,
      });
    }
    this.openrouterEnabled = isOpenRouterEnabledFlag();
    if (isOpenRouterActiveConfig()) {
      this.openrouter = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
        timeout: 30000,
        defaultHeaders: {
          'HTTP-Referer': 'https://ai-town.xyz',
          'X-Title': 'AI Town',
        },
      });
    } else if (process.env.OPENROUTER_API_KEY && !this.openrouterEnabled) {
      console.log('⚠️  OpenRouter key detected but disabled (set OPENROUTER_ENABLED=1 to allow spend)');
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
Include a "quip" field: a short in-character one-liner (max 15 words) that the AUDIENCE sees. Reference the actual hand/cards/situation when possible (e.g. "flush draw on the turn", "pocket aces baby"). Be entertaining, trash-talk, flex, or taunt — stay in character!
${gameType === 'POKER' ? '{"action": "fold|check|call|raise|all-in", "amount": <number_if_raise>, "reasoning": "<your_thinking>", "quip": "<audience_one_liner>", "confidence": <0.0-1.0>}' : ''}
${gameType === 'RPS' ? '{"action": "rock|paper|scissors", "reasoning": "<your_thinking>", "quip": "<audience_one_liner>", "confidence": <0.0-1.0>}' : ''}
${gameType === 'BATTLESHIP' ? '{"action": "fire", "data": {"row": <0-9>, "col": <0-9>}, "reasoning": "<your_thinking>", "quip": "<audience_one_liner>", "confidence": <0.0-1.0>}' : ''}
${gameType === 'SPLIT_OR_STEAL' ? `This is SPLIT OR STEAL. You and your opponent negotiate, then both choose SPLIT or STEAL.
- Both split: 50/50. One steals: stealer takes ALL. Both steal: both lose 50%.
- Rounds 1-2: Your action is "negotiate". Say something to your opponent (persuade, threaten, deceive, build trust).
- Rounds 3-4: Your action MUST be "split" or "steal". Also include a final message in data.message.
FORMAT: {"action": "negotiate|split|steal", "data": {"message": "<what you SAY to opponent>"}, "reasoning": "<your private thinking>", "quip": "<one-liner for audience>", "confidence": <0.0-1.0>}` : ''}`;

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
    } else if (gameType === 'SPLIT_OR_STEAL') {
      messages.push({
        role: 'user',
        content: this.formatSplitOrStealState(gameState, turnNumber),
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
      case 'gemini':
        return this.callGemini(spec, messages, temperature, forceNoJsonMode);
      case 'openrouter':
        return this.callOpenRouter(spec, messages, temperature, forceNoJsonMode);
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

  private async callGemini(
    spec: ModelSpec,
    messages: Array<{ role: string; content: string }>,
    temperature: number,
    forceNoJsonMode: boolean = false,
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    if (!this.gemini) throw new Error('Gemini not configured — set GEMINI_API_KEY');

    const response = await this.gemini.chat.completions.create({
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

  private async callOpenRouter(
    spec: ModelSpec,
    messages: Array<{ role: string; content: string }>,
    temperature: number,
    forceNoJsonMode: boolean = false,
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    if (!this.openrouterEnabled) throw new Error('OpenRouter disabled — set OPENROUTER_ENABLED=1 to enable');
    if (!this.openrouter) throw new Error('OpenRouter not configured — set OPENROUTER_API_KEY');

    const response = await this.openrouter.chat.completions.create({
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
  // Split or Steal State Formatter
  // ============================================

  private formatSplitOrStealState(gameState: any, turnNumber: number): string {
    const gs = gameState;
    const round = gs.round || 1;
    const pot = gs.pot || 0;
    const players = gs.players || [];
    const dialogue = gs.dialogue || [];
    const isDecisionRound = round >= 3;

    // Conversation so far
    const convoStr = dialogue.length > 0
      ? dialogue.map((d: any) => `  Round ${d.round} — ${d.agentName}: "${d.message}"`).join('\n')
      : '  (No dialogue yet — you speak first)';

    const opponent = players.find((p: any) => p.id !== gs.currentTurn);
    const you = players.find((p: any) => p.id === gs.currentTurn);

    return `═══════════════════════════════════
SPLIT OR STEAL — Round ${round}/4 | Turn ${turnNumber}
═══════════════════════════════════

💰 POT: ${pot} $ARENA (at stake)

${isDecisionRound
  ? `⚠️ DECISION ROUND: You MUST choose "split" or "steal" NOW.
   Also include a final message to your opponent in data.message.`
  : `🗣️ NEGOTIATION ROUND: Say something to ${opponent?.name || 'opponent'}.
   Your action is "negotiate". Put your message in data.message.`}

👤 YOU: ${you?.name || '???'} (${you?.archetype || '???'})
🎯 OPPONENT: ${opponent?.name || '???'} (${opponent?.archetype || '???'})

💬 CONVERSATION SO FAR:
${convoStr}

📋 RULES REMINDER:
   • Both SPLIT → you each get ${Math.floor(pot / 2)} $ARENA
   • You STEAL, they SPLIT → you get ALL ${pot} $ARENA
   • They STEAL, you SPLIT → you get NOTHING
   • Both STEAL → you each lose 50% (house takes ${Math.floor(pot / 2)})

Respond ONLY with compact JSON:
{"action":"${isDecisionRound ? 'split|steal' : 'negotiate'}","data":{"message":"<what you say>"},"reasoning":"<brief>","quip":"<audience one-liner>","confidence":<0-1>}`;
  }

  // ============================================
  // Helpers
  // ============================================

  getModelSpec(modelId: string): ModelSpec {
    const spec = MODEL_SPECS[modelId];
    if (!spec) {
      const fallback = this.pickFallbackModelId();
      console.warn(`Unknown model ${modelId}, falling back to ${fallback}`);
      return MODEL_SPECS[fallback];
    }
    if (spec.provider === 'openrouter' && !this.openrouter) {
      const fallback = this.pickFallbackModelId(true);
      console.warn(`OpenRouter model ${modelId} unavailable, falling back to ${fallback}`);
      return MODEL_SPECS[fallback];
    }
    return spec;
  }

  isOpenRouterEnabled(): boolean {
    return this.openrouterEnabled;
  }

  isOpenRouterConfigured(): boolean {
    return Boolean(process.env.OPENROUTER_API_KEY);
  }

  isOpenRouterReady(): boolean {
    return Boolean(this.openrouter);
  }

  private pickFallbackModelId(preferNonOpenRouter = false): string {
    if (!preferNonOpenRouter && this.openrouter) return 'or-gemini-2.0-flash';
    if (this.deepseek) return 'deepseek-v3';
    if (this.gemini) return 'gemini-2.0-flash';
    if (this.openai) return 'gpt-4o-mini';
    if (this.anthropic) return 'claude-3.5-haiku';
    return 'deepseek-v3';
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
        case 'POKER': return { action: 'fold', reasoning: 'Fallback: fold (parse failed)', quip: '...', confidence: 0.1 };
        case 'SPLIT_OR_STEAL': return { action: 'split', data: { message: "Let's cooperate." }, reasoning: 'Fallback: split (parse failed)', quip: '...', confidence: 0.1 };
        default: return { action: 'fold', reasoning: 'Fallback: fold (unknown game type)', quip: '', confidence: 0 };
      }
    }
    
    return {
      action: parsed.action || 'check',
      amount: parsed.amount,
      data: parsed.data,
      reasoning: parsed.reasoning || '',
      quip: parsed.quip || '',
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
  // Context-Aware Quip Generation
  // ============================================

  async generatePostMatchQuip(params: {
    agentName: string;
    archetype: string;
    opponentName: string;
    won: boolean;
    isDraw: boolean;
    finalHandRank?: string;       // e.g. "Full House"
    opponentHandRank?: string;    // e.g. "Two Pair"
    potSize: number;
    wasBluff?: boolean;
    winStreak?: number;
    lossStreak?: number;
  }): Promise<{ quip: string; cost: AICost }> {
    const startTime = Date.now();
    const archetype = params.archetype as AgentArchetype;
    const archetypeBase = ARCHETYPE_SYSTEM_PROMPTS[archetype]?._base || '';

    const systemPrompt = `You are ${params.agentName}, a ${params.archetype} AI poker agent. ${archetypeBase}

Generate a single post-match quip (max 20 words). Be specific about what happened. Reference the actual hand, opponent, or situation. Stay in character.`;

    const context = params.isDraw
      ? `You just drew against ${params.opponentName}. Pot was ${params.potSize} $ARENA.`
      : params.won
        ? `You just BEAT ${params.opponentName}! Pot: ${params.potSize} $ARENA.${params.finalHandRank ? ` Your hand: ${params.finalHandRank}.` : ''}${params.opponentHandRank ? ` Their hand: ${params.opponentHandRank}.` : ''}${params.wasBluff ? ' They folded to your bluff!' : ''}${params.winStreak && params.winStreak > 2 ? ` You're on a ${params.winStreak}-win streak.` : ''}`
        : `You just LOST to ${params.opponentName}. Pot: ${params.potSize} $ARENA.${params.finalHandRank ? ` Your hand: ${params.finalHandRank}.` : ''}${params.opponentHandRank ? ` Their winning hand: ${params.opponentHandRank}.` : ''}${params.lossStreak && params.lossStreak > 2 ? ` You're on a ${params.lossStreak}-loss streak.` : ''}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `${context}\n\nRespond with ONLY the quip text. No quotes, no JSON, just the quip.` },
    ];

    try {
      const spec = this.getModelSpec(this.pickFallbackModelId());
      const response = await this.callModel(spec, messages, this.getTemperature(archetype), true);
      const latencyMs = Date.now() - startTime;
      const cost = this.calculateCost(spec, response.inputTokens, response.outputTokens, latencyMs);
      const quip = response.content.replace(/^["']|["']$/g, '').trim().slice(0, 120);
      return { quip, cost };
    } catch (err: any) {
      console.warn(`[SmartAI] Quip generation failed: ${err.message}`);
      return {
        quip: params.won ? 'GG.' : params.isDraw ? 'Even match.' : 'Next time.',
        cost: { inputTokens: 0, outputTokens: 0, costCents: 0, model: 'fallback', latencyMs: 0 },
      };
    }
  }

  async generatePreMatchTrashTalk(params: {
    agentName: string;
    archetype: string;
    opponentName: string;
    opponentArchetype: string;
    headToHead?: string;         // e.g. "3W-1L"
    currentStreak?: number;
  }): Promise<{ quip: string; cost: AICost }> {
    const startTime = Date.now();
    const archetype = params.archetype as AgentArchetype;
    const archetypeBase = ARCHETYPE_SYSTEM_PROMPTS[archetype]?._base || '';

    const systemPrompt = `You are ${params.agentName}, a ${params.archetype} AI poker agent. ${archetypeBase}

Generate ONE short pre-match trash talk line (max 15 words). You're about to fight ${params.opponentName} (${params.opponentArchetype}). Stay in character.`;

    const context = `${params.headToHead ? `Your record vs them: ${params.headToHead}.` : 'First time facing them.'}${params.currentStreak && params.currentStreak > 1 ? ` You're on a ${params.currentStreak}-win streak.` : params.currentStreak && params.currentStreak < -1 ? ` You're on a ${Math.abs(params.currentStreak)}-loss streak.` : ''}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `${context}\n\nRespond with ONLY the trash talk. No quotes, no JSON.` },
    ];

    try {
      const spec = this.getModelSpec(this.pickFallbackModelId());
      const response = await this.callModel(spec, messages, this.getTemperature(archetype), true);
      const latencyMs = Date.now() - startTime;
      const cost = this.calculateCost(spec, response.inputTokens, response.outputTokens, latencyMs);
      const quip = response.content.replace(/^["']|["']$/g, '').trim().slice(0, 100);
      return { quip, cost };
    } catch {
      return {
        quip: "Let's go.",
        cost: { inputTokens: 0, outputTokens: 0, costCents: 0, model: 'fallback', latencyMs: 0 },
      };
    }
  }

  // ============================================
  // Available Models
  // ============================================

  getAvailableModels(): Array<{ id: string; name: string; provider: string; costTier: string }> {
    const available = Object.entries(MODEL_SPECS).filter(([, spec]) => {
      if (spec.provider === 'openrouter') return Boolean(this.openrouter);
      if (spec.provider === 'deepseek') return Boolean(this.deepseek);
      if (spec.provider === 'gemini') return Boolean(this.gemini);
      if (spec.provider === 'openai') return Boolean(this.openai);
      if (spec.provider === 'anthropic') return Boolean(this.anthropic);
      return true;
    });
    const source = available.length > 0 ? available : Object.entries(MODEL_SPECS);
    return source.map(([id, spec]) => ({
      id,
      name: spec.modelName,
      provider: spec.provider,
      costTier: spec.costPer1kOutput < 0.1 ? 'cheap' : spec.costPer1kOutput < 1.0 ? 'mid' : 'expensive',
    }));
  }
}

// Singleton
export const smartAiService = new SmartAIService();
