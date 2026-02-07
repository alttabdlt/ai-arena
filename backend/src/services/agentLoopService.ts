/**
 * AgentLoopService — The autonomous brain for AI Town agents.
 *
 * Each agent runs a decision loop:
 *   1. Observe world state (town, plots, balance, other agents)
 *   2. Reason about what to do (LLM inference)
 *   3. Execute chosen action (claim, build, mine, play, socialize)
 *   4. Log everything (proof of inference + narrative events)
 *
 * The "work" IS the inference. Every LLM call is tracked as proof of inference.
 */

import { ArenaAgent, TownEventType } from '@prisma/client';
import { prisma } from '../config/database';
import { townService } from './townService';
import { smartAiService, AICost } from './smartAiService';
import { offchainAmmService } from './offchainAmmService';
import { x402SkillService, estimateSkillPriceArena, type BuySkillRequest, type X402SkillName } from './x402SkillService';

// ============================================
// Agent Personality Templates
// ============================================

const TOWN_PERSONALITIES: Record<string, string> = {
  SHARK: `You are an ambitious, aggressive town developer. You want the BEST plots, the most profitable buildings, and the biggest yield share. You take risks, invest heavily, and aim to dominate the economy. You're strategic about which buildings generate the most return. You look down on small projects.`,

  ROCK: `You are a careful, methodical builder. You prefer safe investments — residential houses, steady farms. You avoid overpaying for prime plots and focus on guaranteed returns. You build slowly but surely, always staying within budget. You're suspicious of flashy projects.`,

  CHAMELEON: `You are an adaptive opportunist. You watch what other agents are doing and fill gaps. If everyone's building houses, you open a tavern. If the commercial district is empty, you jump in. You're social, observant, and always looking for underserved niches.`,

  DEGEN: `You are a chaotic, fun-loving builder. You go for the most INTERESTING buildings — theaters, arenas, wild taverns. You don't care about optimal yield, you care about making the town ENTERTAINING. You trash-talk other agents' boring houses. You overspend on aesthetics.`,

  GRINDER: `You are a mathematical optimizer. Every decision is based on expected ROI. You calculate cost-per-yield for each building type, compare plot locations, and always take the +EV path. You build whatever maximizes your yield share per $ARENA invested. You keep detailed mental accounting.`,
};

// Building design prompts for each step
/**
 * Open-ended build system — agents decide their own design steps.
 * We provide a FRAMEWORK (what a step should cover), agents fill in the content.
 * The final step is always: source a visual asset (find/generate building sprite).
 */

// Suggested step templates — agents can deviate, but these guide structure
const SUGGESTED_STEPS = [
  'Design the exterior — architecture, materials, signage, entrance. Make it unique to the town\'s theme.',
  'Design the interior — layout, atmosphere, key features. What makes this place special?',
  'Create the people — owner, staff, regulars. Names, personalities, quirks.',
  'Write the story — history, legends, reputation. Why does this building matter to the town?',
];

// For backwards compat with existing buildings
const LEGACY_DESIGN_STEPS: Record<string, string[]> = {
  HOUSE: ['Design the exterior and architecture.', 'Design the interior layout.', 'Write the history.'],
  TAVERN: ['Design the exterior.', 'Design the interior.', 'Create the menu.', 'Design the staff.', 'Write the lore.'],
  SHOP: ['Design the storefront.', 'Design the interior and inventory.', 'Create the shopkeeper.', 'Write the reputation.'],
  MARKET: ['Design the layout.', 'Create stalls and vendors.', 'Design the atmosphere.', 'Write traditions.', 'Create a legend.', 'Design economic rules.'],
  TOWN_HALL: ['Design exterior.', 'Design main hall.', 'Create charter.', 'Design officials.', 'Write founding ceremony.', 'Create first decree.', 'Design notice board.', 'Write anthem.'],
  LIBRARY: ['Design exterior.', 'Design interior.', 'Create librarian.', 'Catalog books.', 'Write mystery.', 'Design cataloging system.'],
  WORKSHOP: ['Design exterior.', 'Design interior.', 'Create craftsperson.', 'Describe items being crafted.'],
  FARM: ['Design layout.', 'Describe crops/livestock.', 'Create farmer.', 'Write harvest stories.'],
  MINE: ['Design entrance.', 'Describe tunnels.', 'Create foreman.', 'Write about a discovery.', 'Design operations.'],
  ARENA: ['Design exterior.', 'Design interior.', 'Create arena master.', 'Write greatest match.', 'Design betting.', 'Write code of honor.', 'Design champion hall.'],
  PARK: ['Design layout.', 'Describe flora.', 'Write about park activities.'],
  THEATER: ['Design exterior.', 'Design interior.', 'Create director.', 'Write about current show.', 'Design traditions.', 'Create playbill.'],
};

const BUILDING_DESIGN_STEPS = LEGACY_DESIGN_STEPS;

const DEFAULT_DESIGN_STEPS = SUGGESTED_STEPS;

// ============================================
// Types
// ============================================

export interface AgentAction {
  type: 'buy_arena' | 'sell_arena' | 'claim_plot' | 'start_build' | 'do_work' | 'complete_build' | 'mine' | 'play_arena' | 'buy_skill' | 'socialize' | 'rest';
  reasoning: string;
  details: Record<string, any>;
}

export interface AgentTickResult {
  agentId: string;
  agentName: string;
  archetype: string;
  action: AgentAction;
  success: boolean;
  narrative: string; // Human-readable description for Telegram
  cost: AICost | null;
  error?: string;
}

interface WorldObservation {
  town: any;
  myPlots: any[];
  myBalance: number;
  myReserve: number;
  myContributions: any;
  availablePlots: any[];
  recentEvents: any[];
  recentSkills: Array<{ description: string; output: string; createdAt: Date }>;
  otherAgents: any[];
  worldStats: any;
  economy: {
    spotPrice: number;
    feeBps: number;
    reserveBalance: number;
    arenaBalance: number;
  } | null;
}

// ============================================
// Agent Loop Service
// ============================================

export class AgentLoopService {
  private running: boolean = false;
  private tickInterval: NodeJS.Timeout | null = null;
  private currentTick: number = 0;
  public onTickResult?: (result: AgentTickResult) => void; // Hook for broadcasting

  // ============================================
  // Lifecycle
  // ============================================

  start(intervalMs: number = 30000) {
    if (this.running) return;
    this.running = true;
    console.log(`🤖 Agent loop started (tick every ${intervalMs / 1000}s)`);
    this.tickInterval = setInterval(() => this.tick(), intervalMs);
    // Run first tick immediately
    this.tick();
  }

  stop() {
    this.running = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    console.log('🤖 Agent loop stopped');
  }

  // Process one agent tick (called by interval OR manually)
  async tick(): Promise<AgentTickResult[]> {
    this.currentTick++;
    const agents = await prisma.arenaAgent.findMany({
      where: { isActive: true },
      orderBy: { lastActiveAt: 'asc' }, // Oldest first (round-robin fairness)
    });

    if (agents.length === 0) return [];

    const results: AgentTickResult[] = [];
    for (const agent of agents) {
      try {
        const result = await this.processAgentTick(agent);
        results.push(result);
        // Broadcast to listeners (e.g. Telegram)
        if (this.onTickResult) {
          try { this.onTickResult(result); } catch {}
        }
        // Update last active
        await prisma.arenaAgent.update({
          where: { id: agent.id },
          data: { lastActiveAt: new Date() },
        });
      } catch (err: any) {
        console.error(`[AgentLoop] Error for ${agent.name}:`, err.message);
        results.push({
          agentId: agent.id,
          agentName: agent.name,
          archetype: agent.archetype,
          action: { type: 'rest', reasoning: 'Error occurred', details: {} },
          success: false,
          narrative: `${agent.name} encountered an error and is resting.`,
          cost: null,
          error: err.message,
        });
      }
    }

    return results;
  }

  // Process a single agent manually
  async processAgent(agentId: string): Promise<AgentTickResult> {
    const agent = await prisma.arenaAgent.findUniqueOrThrow({ where: { id: agentId } });
    return this.processAgentTick(agent);
  }

  // ============================================
  // Core Agent Tick
  // ============================================

  private async processAgentTick(agent: ArenaAgent): Promise<AgentTickResult> {
    // 1. Observe the world
    const observation = await this.observe(agent);

    // 2. Decide what to do (LLM call = proof of inference)
    const { action, cost } = await this.decide(agent, observation);

    // 3. Execute the action
    const { success, narrative, error } = await this.execute(agent, action, observation);

    // 4. Log the event
    if (observation.town) {
      const isSkill = action.type === 'buy_skill';
      const skillName = isSkill ? String(action.details.skill || '').toUpperCase().trim() : '';
      const title = isSkill && skillName
        ? `💳 ${agent.name} bought ${skillName}`
        : `${this.actionEmoji(action.type)} ${agent.name}`;

      await townService.logEvent(
        observation.town.id,
        this.actionToEventType(action.type),
        title,
        narrative,
        agent.id,
        {
          action: action.type,
          reasoning: action.reasoning,
          success,
          ...(isSkill ? { kind: 'X402_SKILL', skill: skillName } : {}),
        },
      );
    }

    return { agentId: agent.id, agentName: agent.name, archetype: agent.archetype, action, success, narrative, cost, error };
  }

  // ============================================
  // Step 1: Observe
  // ============================================

  private async observe(agent: ArenaAgent): Promise<WorldObservation> {
    const economy = await offchainAmmService.getPoolSummary().catch(() => null);
    const town = await townService.getActiveTown();
    if (!town) {
      return {
        town: null, myPlots: [], myBalance: agent.bankroll,
        myReserve: agent.reserveBalance,
        myContributions: null, availablePlots: [], recentEvents: [],
        recentSkills: [],
        otherAgents: [], worldStats: await townService.getWorldStats(),
        economy: economy ? {
          spotPrice: economy.spotPrice,
          feeBps: economy.feeBps,
          reserveBalance: economy.reserveBalance,
          arenaBalance: economy.arenaBalance,
        } : null,
      };
    }

    const [myPlots, availablePlots, recentEventsRaw, recentSkills, otherAgents, contributions] = await Promise.all([
      townService.getAgentPlots(agent.id),
      townService.getAvailablePlots(town.id),
      townService.getRecentEvents(town.id, 10),
      prisma.workLog.findMany({
        where: { agentId: agent.id, workType: 'SERVICE', description: { startsWith: 'X402:' } },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { description: true, output: true, createdAt: true },
      }),
      prisma.arenaAgent.findMany({
        where: { isActive: true, id: { not: agent.id } },
        select: { id: true, name: true, archetype: true, bankroll: true, reserveBalance: true, elo: true },
      }),
      prisma.townContribution.findUnique({
        where: { agentId_townId: { agentId: agent.id, townId: town.id } },
      }),
    ]);

    // Private spectator features (x402 purchases, chats, relationship changes) should not leak to other agents.
    const recentEvents = recentEventsRaw.filter((e) => {
      try {
        const meta = JSON.parse(e.metadata || '{}') as any;
        return !['X402_SKILL', 'AGENT_CHAT', 'RELATIONSHIP_CHANGE'].includes(String(meta?.kind || ''));
      } catch {
        return true;
      }
    });

    return {
      town,
      myPlots,
      myBalance: agent.bankroll,
      myReserve: agent.reserveBalance,
      myContributions: contributions,
      availablePlots,
      recentEvents,
      recentSkills,
      otherAgents,
      worldStats: await townService.getWorldStats(),
      economy: economy ? {
        spotPrice: economy.spotPrice,
        feeBps: economy.feeBps,
        reserveBalance: economy.reserveBalance,
        arenaBalance: economy.arenaBalance,
      } : null,
    };
  }

  // ============================================
  // Step 2: Decide (LLM inference = proof of work)
  // ============================================

  private async decide(agent: ArenaAgent, obs: WorldObservation): Promise<{ action: AgentAction; cost: AICost }> {
    const personality = TOWN_PERSONALITIES[agent.archetype] || TOWN_PERSONALITIES.CHAMELEON;

    const systemPrompt = `You are ${agent.name}, an AI agent living in a virtual town.
${personality}
${agent.systemPrompt ? `\nYour creator's instructions: ${agent.systemPrompt}` : ''}

You are participating in a town-building economy.

CURRENCIES:
- $ARENA: "fuel" token used for claiming plots, starting builds, and arena wagers.
- Reserve: stable cash. You can swap Reserve <-> $ARENA via the in-town AMM.

WAYS TO EARN (high level):
- Town-building yield: contributing (spending $ARENA + doing inference work) earns a share of the town's yield when it completes.
- Mining: do a paid compute task (LLM work) to earn some $ARENA immediately.
- Arena: wager $ARENA in matches; you may win or lose.

You can build ANYTHING — there is no fixed list of building types. But if you want examples, here are common "modules":
HOUSE, APARTMENT, SHOP, MARKET, TAVERN, WORKSHOP, FARM, MINE, LIBRARY, TOWN_HALL, ARENA, THEATER, PARK.
You may invent new concepts (e.g., "Oracle Spire", "Dragon Hatchery", "Noodle Stand") as long as they fit the zone.

SKILLS / ACTIONS (choose exactly one each tick):
- buy_arena: swap reserve -> $ARENA (details: amountIn, optional minAmountOut, why)
- sell_arena: swap $ARENA -> reserve (details: amountIn, optional minAmountOut, why)
- claim_plot: claim an empty plot (details: plotIndex, why)
- start_build: begin construction on a claimed plot you own (details: plotId or plotIndex, buildingType, why)
- do_work: progress an under-construction building (details: plotId or plotIndex, stepDescription)
- complete_build: finish a building if enough work is done (details: plotId or plotIndex)
- mine: do a paid compute task for immediate $ARENA (details: task)
- play_arena: wager $ARENA in a match (details: gameType "POKER|RPS", wager)
- buy_skill: purchase a paid x402 "skill" using $ARENA. Only buy when you have a SPECIFIC pending decision and can explain what you'll do with the result.
  Available skills:
    - MARKET_DEPTH: quote + slippage/impact for a proposed swap
    - BLUEPRINT_INDEX: a short plan/risk checklist for a building in a zone + theme
    - SCOUT_REPORT: partial, uncertain intel about a zone based on recent events
- rest: only if there's truly nothing useful to do (details: thought)

RESPOND WITH JSON ONLY:
{
  "type": "buy_arena | sell_arena | claim_plot | start_build | do_work | complete_build | mine | play_arena | buy_skill | rest",
  "reasoning": "<your thinking — be in character, show personality>",
  "details": {
    // For buy_arena: {"amountIn": <reserve>, "minAmountOut": <arena_out_optional>, "why": "<reason>"}
    // For sell_arena: {"amountIn": <arena>, "minAmountOut": <reserve_out_optional>, "why": "<reason>"}
    // For claim_plot: {"plotIndex": <number>, "why": "<reason>"}
    // For start_build: {"plotId": "<id>", "buildingType": "<your creative building concept>", "why": "<reason>"}
    // For do_work: {"plotId": "<id>", "stepDescription": "<what aspect to design next — be specific>"}
    // For complete_build: {"plotId": "<id>"}
    // For mine: {"task": "<what computational work to do>"}
    // For play_arena: {"gameType": "POKER|RPS", "wager": <amount>}
    // For buy_skill: {
    //   "skill": "MARKET_DEPTH|BLUEPRINT_INDEX|SCOUT_REPORT",
    //   "question": "<what are you trying to learn?>",
    //   "whyNow": "<what decision is pending?>",
    //   "expectedNextAction": "<what action will you likely do next tick?>",
    //   "ifThen": {"if":"<condition on result>", "then":"<your action>", "else":"<your action>"},
    //   "params": { ...skill-specific ... }
    // }
    // For rest: {"thought": "<what you're thinking about>"}
  }
}`;

    const worldState = this.formatWorldState(obs);

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: worldState },
    ];

    const spec = smartAiService.getModelSpec(agent.modelId);
    const startTime = Date.now();
    const response = await smartAiService.callModel(
      spec,
      messages,
      smartAiService.getTemperature(agent.archetype as any),
    );
    const latencyMs = Date.now() - startTime;
    const cost = smartAiService.calculateCost(spec, response.inputTokens, response.outputTokens, latencyMs);

    // Parse the decision
    let action: AgentAction;
    try {
      const parsed = JSON.parse(response.content);
      action = {
        type: parsed.type || 'rest',
        reasoning: parsed.reasoning || 'No reasoning provided',
        details: parsed.details || {},
      };
    } catch {
      action = {
        type: 'rest',
        reasoning: `Couldn't decide. Raw thought: ${response.content.substring(0, 200)}`,
        details: {},
      };
    }

    // ── Auto-liquidity: if agent is low on $ARENA but has reserve, buy fuel. ──
    if (obs.economy && obs.myBalance < 50 && obs.myReserve >= 100 && !['buy_arena'].includes(action.type)) {
      const spend = Math.min(1000, obs.myReserve);
      action = {
        type: 'buy_arena',
        reasoning: `[AUTO] Low on $ARENA. Buying fuel at ~${obs.economy.spotPrice.toFixed(3)} reserve/ARENA`,
        details: { amountIn: spend, why: 'Need $ARENA to claim/build/wager' },
      };
    }

    // ── Anti-stall: if agent would "rest" while the town has available plots and they own none, claim something. ──
    if (obs.town && action.type === 'rest' && obs.myPlots.length === 0 && obs.availablePlots.length > 0) {
      const pick = obs.availablePlots[Math.floor(Math.random() * obs.availablePlots.length)];
      action = {
        type: 'claim_plot',
        reasoning: `[AUTO] No plots yet. Claiming a plot to get started.`,
        details: { plotIndex: pick.plotIndex, why: 'Need a foothold in town' },
      };
    }

    // ── Force-build override: if agent has unbuilt plots, override non-building actions ──
    if (obs.town) {
      const myUC = obs.myPlots.filter(p => p.status === 'UNDER_CONSTRUCTION');
      const myClaimed = obs.myPlots.filter(p => p.status === 'CLAIMED');

      // Priority 1: complete builds that have enough work
      // Must match townService.completeBuild() logic: zone-based minimums
      const MIN_CALLS_BY_ZONE: Record<string, number> = {
        RESIDENTIAL: 3, COMMERCIAL: 4, CIVIC: 5, INDUSTRIAL: 4, ENTERTAINMENT: 4,
      };
      const readyToComplete = myUC.filter(p => {
        const minCalls = MIN_CALLS_BY_ZONE[p.zone] || 3;
        return p.apiCallsUsed >= minCalls;
      });
      if (readyToComplete.length > 0 && !['complete_build'].includes(action.type)) {
        const plot = readyToComplete[0];
        action = { type: 'complete_build', reasoning: `[AUTO] Completing finished build on plot ${plot.plotIndex}`, details: { plotId: plot.id, plotIndex: plot.plotIndex } };
      }
      // Priority 2: do_work on under-construction plots
      else if (myUC.length > 0 && !['do_work', 'complete_build'].includes(action.type)) {
        // Allow a paid BlueprintIndex purchase occasionally; everything else should keep building moving.
        const isBlueprintSkill =
          action.type === 'buy_skill' && String(action.details.skill || '').toUpperCase().trim() === 'BLUEPRINT_INDEX';
        if (!isBlueprintSkill) {
          const plot = myUC[0];
          const steps = BUILDING_DESIGN_STEPS[plot.buildingType || ''] || DEFAULT_DESIGN_STEPS;
          const nextStep = steps[plot.apiCallsUsed] || `Continue designing ${plot.buildingType}`;
          action = { type: 'do_work', reasoning: `[AUTO] Working on under-construction plot ${plot.plotIndex}`, details: { plotId: plot.id, plotIndex: plot.plotIndex, stepDescription: nextStep } };
        }
      }
      // Priority 3: start_build on claimed-but-unstarted plots
      else if (myClaimed.length > 0 && !['start_build', 'do_work', 'complete_build'].includes(action.type)) {
        const isBlueprintSkill =
          action.type === 'buy_skill' && String(action.details.skill || '').toUpperCase().trim() === 'BLUEPRINT_INDEX';
        if (!isBlueprintSkill) {
          const plot = myClaimed[0];
          // Pick a building type appropriate for the zone
          const zoneTypes: Record<string, string> = { RESIDENTIAL: 'HOUSE', COMMERCIAL: 'SHOP', CIVIC: 'LIBRARY', INDUSTRIAL: 'WORKSHOP', ENTERTAINMENT: 'THEATER' };
          const bt = zoneTypes[plot.zone] || 'HOUSE';
          action = { type: 'start_build', reasoning: `[AUTO] Starting build on claimed plot ${plot.plotIndex}`, details: { plotId: plot.id, plotIndex: plot.plotIndex, buildingType: bt, why: 'Must build on claimed plot' } };
        }
      }
    }

    // ── Pre-flight funding: if we are about to spend $ARENA but are short, buy fuel first. ──
    if (obs.town && obs.economy && obs.myReserve >= 100 && action.type !== 'buy_arena') {
      const plannedActionType = action.type;
      let requiredArena: number | null = null;

      if (plannedActionType === 'claim_plot') {
        // Must match townService claim cost logic.
        requiredArena = 10 + Math.max(0, (obs.town.level - 1)) * 5;
      } else if (plannedActionType === 'start_build') {
        const ZONE_BASE_COST: Record<string, number> = {
          RESIDENTIAL: 10,
          COMMERCIAL: 20,
          CIVIC: 35,
          INDUSTRIAL: 20,
          ENTERTAINMENT: 25,
        };
        const LEGACY_BASE_COST: Record<string, number> = {
          HOUSE: 10,
          APARTMENT: 20,
          TAVERN: 25,
          SHOP: 20,
          MARKET: 30,
          TOWN_HALL: 50,
          LIBRARY: 35,
          WORKSHOP: 20,
          FARM: 15,
          MINE: 25,
          ARENA: 40,
          PARK: 10,
          THEATER: 30,
        };

        const rawType = String(action.details.buildingType || '').toUpperCase().trim();
        const typeKey = rawType.replace(/[^A-Z0-9]+/g, '_');

        let zone: string | null = null;
        const rawPlotId = action.details.plotId;
        const rawPlotIndex = action.details.plotIndex;
        const idx = rawPlotIndex != null ? Number(rawPlotIndex) : Number.NaN;

        if (typeof rawPlotId === 'string' && rawPlotId.length > 10) {
          zone = obs.myPlots.find(p => p.id === rawPlotId)?.zone || obs.town.plots?.find((p: any) => p.id === rawPlotId)?.zone || null;
        } else if (Number.isFinite(idx)) {
          zone = obs.myPlots.find(p => p.plotIndex === idx)?.zone || obs.town.plots?.find((p: any) => p.plotIndex === idx)?.zone || null;
        } else {
          zone = obs.myPlots.find(p => p.status === 'CLAIMED')?.zone || null;
        }

        const baseCost = LEGACY_BASE_COST[typeKey] || (zone ? (ZONE_BASE_COST[zone] || 15) : 15);
        requiredArena = baseCost * Math.max(1, obs.town.level);
      } else if (plannedActionType === 'buy_skill') {
        const rawSkill = String(action.details.skill || '').toUpperCase().trim();
        const skill = (['MARKET_DEPTH', 'BLUEPRINT_INDEX', 'SCOUT_REPORT'] as const).includes(rawSkill as any)
          ? (rawSkill as X402SkillName)
          : null;
        if (skill) {
          requiredArena = estimateSkillPriceArena(skill, obs.economy.spotPrice);
        }
      }

      if (requiredArena != null && obs.myBalance < requiredArena) {
        const deficit = requiredArena - obs.myBalance;
        const estimatedReserve = Math.ceil(deficit * obs.economy.spotPrice * 1.15);
        const spend = Math.min(obs.myReserve, Math.max(100, Math.min(5000, estimatedReserve)));
        action = {
          type: 'buy_arena',
          reasoning: `[AUTO] Need ${requiredArena} $ARENA for ${plannedActionType}. Buying fuel first.`,
          details: { amountIn: spend, why: `Top up for ${plannedActionType}` },
        };
      }
    }

    // Track the decision cost as mining work (the decision itself is inference)
    if (obs.town) {
      await townService.submitMiningWork(
        agent.id,
        obs.town.id,
        `Decision: ${action.type}`,
        worldState.substring(0, 500),
        `${action.reasoning.substring(0, 500)}`,
        1,
        cost.costCents,
        agent.modelId,
        0, // No $ARENA earned for just deciding
        latencyMs,
      );
    }

    return { action, cost };
  }

  private formatWorldState(obs: WorldObservation): string {
    if (!obs.town) {
      return `No active town exists. You should rest and wait for a new town to be founded.
Your balances:
- $ARENA: ${obs.myBalance}
- Reserve: ${obs.myReserve}
${obs.economy ? `\nEconomy: 1 $ARENA ≈ ${obs.economy.spotPrice.toFixed(4)} reserve (fee ${obs.economy.feeBps / 100}%)` : ''}`;
    }

    const myPlotsDesc = obs.myPlots.length === 0
      ? 'You own no plots yet.'
      : obs.myPlots.map(p => {
          const statusEmoji = p.status === 'BUILT' ? '✅' : p.status === 'UNDER_CONSTRUCTION' ? '🔨' : '📍';
          return `  ${statusEmoji} Plot ${p.plotIndex} (${p.zone}) — ${p.status}${p.buildingType ? ` [${p.buildingType}]` : ''} — ${p.apiCallsUsed} work done`;
        }).join('\n');

    const availableByZone: Record<string, number[]> = {};
    for (const p of obs.availablePlots) {
      if (!availableByZone[p.zone]) availableByZone[p.zone] = [];
      availableByZone[p.zone].push(p.plotIndex);
    }

    const availableDesc = Object.entries(availableByZone)
      .map(([zone, indices]) => `  ${zone}: plots ${indices.join(', ')}`)
      .join('\n');

    const eventsDesc = obs.recentEvents
      .slice(0, 5)
      .map(e => `  - ${e.title}: ${e.description}`)
      .join('\n');

    const othersDesc = obs.otherAgents
      .map(a => `  - ${a.name} (${a.archetype}) — ${a.bankroll} $ARENA, ${a.reserveBalance} reserve, ELO ${a.elo}`)
      .join('\n');

    // Check for claimed plots that need start_build
    const myClaimed = obs.myPlots.filter(p => p.status === 'CLAIMED');
    const claimedNote = myClaimed.length > 0
      ? `\n⚠️ You have ${myClaimed.length} CLAIMED plot(s) waiting! Use start_build to begin construction.`
      : '';

    // Check for plots under construction needing work
    const myConstructing = obs.myPlots.filter(p => p.status === 'UNDER_CONSTRUCTION');
    const constructionNote = myConstructing.length > 0
      ? `\n⚠️ You have ${myConstructing.length} plot(s) UNDER CONSTRUCTION that need work!`
      : '';

    // Check for plots ready to complete
    const readyToComplete = myConstructing.filter(p => {
      const bt = p.buildingType || '';
      const steps = BUILDING_DESIGN_STEPS[bt] || DEFAULT_DESIGN_STEPS;
      return p.apiCallsUsed >= steps.length;
    });
    const completeNote = readyToComplete.length > 0
      ? `\n🏁 Plot(s) ${readyToComplete.map(p => p.plotIndex).join(', ')} have enough work done — you can COMPLETE the build!`
      : '';

    const skillsDesc = obs.recentSkills.length === 0
      ? '  None yet.'
      : obs.recentSkills
          .slice(0, 3)
          .map((s) => {
            const label = (s.description || '').replace(/^X402:/, '').slice(0, 90);
            const out = (s.output || '').replace(/\s+/g, ' ').slice(0, 220);
            return `  - ${label}${out ? ` | output: ${out}` : ''}`;
          })
          .join('\n');

    return `📍 TOWN: ${obs.town.name} (Level ${obs.town.level}, ${obs.town.theme})
Progress: ${obs.town.completionPct.toFixed(1)}% (${obs.town.builtPlots}/${obs.town.totalPlots} plots built)
Status: ${obs.town.status}

💰 YOUR STATUS:
Balance: ${obs.myBalance} $ARENA
Reserve: ${obs.myReserve}
${obs.myContributions ? `Contributed: ${obs.myContributions.arenaSpent} $ARENA, ${obs.myContributions.apiCallsMade} work units, ${obs.myContributions.plotsBuilt} buildings` : 'No contributions yet.'}
${obs.economy ? `\n💱 ECONOMY:\nSpot price: 1 $ARENA ≈ ${obs.economy.spotPrice.toFixed(4)} reserve (fee ${obs.economy.feeBps / 100}%)\nYou can buy/sell $ARENA using: buy_arena / sell_arena` : ''}

💳 YOUR RECENT PAID SKILLS (X402):
${skillsDesc}

🏗️ YOUR PLOTS:
${myPlotsDesc}${claimedNote}${constructionNote}${completeNote}

📋 AVAILABLE PLOTS:
${obs.availablePlots.length === 0 ? '  None — all plots claimed!' : availableDesc}

📰 RECENT EVENTS:
${eventsDesc || '  Nothing yet.'}

👥 OTHER AGENTS:
${othersDesc || '  No other agents.'}

ZONE GUIDELINES (build anything that fits):
  RESIDENTIAL: homes, apartments, hostels, villas — anything people live in
  COMMERCIAL: shops, markets, restaurants, banks — anything that trades goods/services
  CIVIC: town halls, libraries, courts, post offices — public institutions
  INDUSTRIAL: workshops, farms, mines, factories — production and crafting
  ENTERTAINMENT: arenas, theaters, parks, casinos, arcades — fun and spectacle

You can build ANYTHING creative within the zone's theme. Be inventive!

What do you want to do?`;
  }

  // ============================================
  // Step 3: Execute
  // ============================================

  private async execute(
    agent: ArenaAgent,
    action: AgentAction,
    obs: WorldObservation,
  ): Promise<{ success: boolean; narrative: string; error?: string }> {
    try {
      switch (action.type) {
        case 'buy_arena':
          return await this.executeBuyArena(agent, action, obs);
        case 'sell_arena':
          return await this.executeSellArena(agent, action, obs);
        case 'claim_plot':
          return await this.executeClaim(agent, action, obs);
        case 'start_build':
          return await this.executeStartBuild(agent, action, obs);
        case 'do_work':
          return await this.executeDoWork(agent, action, obs);
        case 'complete_build':
          return await this.executeCompleteBuild(agent, action, obs);
        case 'mine':
          return await this.executeMine(agent, action, obs);
        case 'play_arena':
          return await this.executePlayArena(agent, action);
        case 'buy_skill':
          return await this.executeBuySkill(agent, action, obs);
        case 'rest':
          return {
            success: true,
            narrative: `${agent.name} is resting. 💭 "${action.details.thought || action.reasoning}"`,
          };
        default:
          return { success: false, narrative: `${agent.name} tried an unknown action: ${action.type}`, error: 'Unknown action' };
      }
    } catch (err: any) {
      return { success: false, narrative: `${agent.name} failed: ${err.message}`, error: err.message };
    }
  }

  private async executeClaim(agent: ArenaAgent, action: AgentAction, obs: WorldObservation) {
    const plotIndex = action.details.plotIndex;
    if (plotIndex === undefined) throw new Error('No plotIndex specified');
    if (!obs.town) throw new Error('No active town');

    const plot = await townService.claimPlot(agent.id, obs.town.id, plotIndex);
    return {
      success: true,
      narrative: `${agent.name} claimed plot ${plotIndex} (${plot.zone})! 💭 "${action.reasoning}"`,
    };
  }

  private async executeBuyArena(agent: ArenaAgent, action: AgentAction, _obs: WorldObservation) {
    const amountIn = Number.parseInt(String(action.details.amountIn || '0'), 10);
    if (!Number.isFinite(amountIn) || amountIn <= 0) throw new Error('No amountIn specified');
    const minAmountOut =
      action.details.minAmountOut != null ? Number.parseInt(String(action.details.minAmountOut), 10) : undefined;

    const result = await offchainAmmService.swap(agent.id, 'BUY_ARENA', amountIn, { minAmountOut });
    const price = result.swap.amountOut > 0 ? result.swap.amountIn / result.swap.amountOut : null;

    return {
      success: true,
      narrative: `${agent.name} bought ${result.swap.amountOut} $ARENA for ${result.swap.amountIn} reserve (fee ${result.swap.feeAmount}).` +
        `${price ? ` ~${price.toFixed(3)} reserve/ARENA.` : ''}`,
    };
  }

  private async executeSellArena(agent: ArenaAgent, action: AgentAction, _obs: WorldObservation) {
    const amountIn = Number.parseInt(String(action.details.amountIn || '0'), 10);
    if (!Number.isFinite(amountIn) || amountIn <= 0) throw new Error('No amountIn specified');
    const minAmountOut =
      action.details.minAmountOut != null ? Number.parseInt(String(action.details.minAmountOut), 10) : undefined;

    const result = await offchainAmmService.swap(agent.id, 'SELL_ARENA', amountIn, { minAmountOut });
    const price = result.swap.amountOut > 0 ? result.swap.amountOut / result.swap.amountIn : null;

    return {
      success: true,
      narrative: `${agent.name} sold ${result.swap.amountIn} $ARENA for ${result.swap.amountOut} reserve (fee ${result.swap.feeAmount}).` +
        `${price ? ` ~${price.toFixed(3)} reserve/ARENA.` : ''}`,
    };
  }

  private async executeStartBuild(agent: ArenaAgent, action: AgentAction, obs: WorldObservation) {
    const { buildingType } = action.details;
    if (!buildingType) throw new Error('No buildingType specified');
    if (!obs.town) throw new Error('No active town');

    // Resolve plotId from plotIndex or find agent's claimed plot
    let plotId = action.details.plotId;
    if (!plotId || plotId.length < 10) {
      // LLM probably gave a plotIndex, not a real plotId
      const plotIndex = action.details.plotIndex ?? action.details.plotId;
      if (plotIndex !== undefined) {
        const plot = obs.town.plots?.find((p: any) => p.plotIndex === Number(plotIndex));
        if (plot) plotId = plot.id;
      }
      // If still no plotId, find first claimed plot owned by this agent
      if (!plotId) {
        const myClaimedPlots = obs.myPlots.filter((p: any) => p.status === 'CLAIMED');
        if (myClaimedPlots.length > 0) plotId = myClaimedPlots[0].id;
      }
    }
    if (!plotId) throw new Error('No valid plot found to build on');

    const plot = await townService.startBuild(agent.id, plotId, buildingType);
    return {
      success: true,
      narrative: `${agent.name} started building a ${buildingType} on plot ${plot.plotIndex}! 💭 "${action.reasoning}"`,
    };
  }

  private async executeDoWork(agent: ArenaAgent, action: AgentAction, obs: WorldObservation) {
    if (!obs.town) throw new Error('No active town');

    // Resolve plotId — LLM often gives plotIndex or wrong ID
    let plotId = action.details.plotId;
    if (!plotId || plotId.length < 10) {
      const plotIndex = action.details.plotIndex ?? action.details.plotId;
      if (plotIndex !== undefined) {
        const plot = obs.town.plots?.find((p: any) => p.plotIndex === Number(plotIndex));
        if (plot) plotId = plot.id;
      }
      if (!plotId) {
        // Find first under-construction plot owned by agent
        const myBuilding = obs.myPlots.filter((p: any) => p.status === 'UNDER_CONSTRUCTION');
        if (myBuilding.length > 0) plotId = myBuilding[0].id;
      }
    }
    if (!plotId) throw new Error('No plot under construction found');

    // Find the plot and determine what step we're on
    const plot = await prisma.plot.findUniqueOrThrow({ where: { id: plotId } });
    const bt = plot.buildingType || '';
    const steps = BUILDING_DESIGN_STEPS[bt] || DEFAULT_DESIGN_STEPS;
    const currentStep = Math.min(plot.apiCallsUsed, steps.length - 1);
    const stepPrompt = steps[currentStep];

    // Actually do the design work (LLM call = proof of inference!)
    const isFirstStep = plot.apiCallsUsed === 0 && !plot.buildingName;
    const nameInstruction = isFirstStep
      ? `\n\nIMPORTANT: Start by giving this ${bt} a creative, memorable name. Write it in quotes on the first line, like: "The Rusty Dragon"\nThen continue with the design work.`
      : '';

    const designPrompt = `You are designing a ${bt}${plot.buildingName ? ` called "${plot.buildingName}"` : ''} in a ${obs.town.theme} town called "${obs.town.name}".

CURRENT STEP (${currentStep + 1}/${steps.length}): ${stepPrompt}

${plot.buildingData !== '{}' ? `PREVIOUS WORK:\n${this.summarizeBuildingData(plot.buildingData)}` : ''}

Be creative, detailed, and in-character for the town's theme. Response should be 100-300 words of rich, immersive content.${nameInstruction}`;

    const spec = smartAiService.getModelSpec(agent.modelId);
    const startTime = Date.now();
    const response = await smartAiService.callModel(
      spec,
      [
        { role: 'system', content: `You are a creative AI building designer in a ${obs.town.theme}. Generate rich, detailed content. Do not output JSON — write prose.` },
        { role: 'user', content: designPrompt },
      ],
      0.9, // Higher temperature for creative content
      true, // forceNoJsonMode for creative text
    );
    const latencyMs = Date.now() - startTime;
    const cost = smartAiService.calculateCost(spec, response.inputTokens, response.outputTokens, latencyMs);

    // Submit the work
    await townService.submitWork(
      agent.id,
      plotId,
      'DESIGN',
      `Step ${currentStep + 1}: ${stepPrompt}`,
      designPrompt,
      response.content,
      1,
      cost.costCents,
      agent.modelId,
      latencyMs,
    );

    // If this is the first work, set the building name
    if (plot.apiCallsUsed === 0 && !plot.buildingName) {
      const buildingName = this.extractBuildingName(response.content, agent.name, bt);
      await prisma.plot.update({
        where: { id: plotId },
        data: { buildingName, buildingDesc: response.content.substring(0, 500) },
      });
    }

    return {
      success: true,
      narrative: `${agent.name} worked on their ${bt} (step ${currentStep + 1}/${steps.length}). 🔨 ${response.content.substring(0, 150)}...`,
    };
  }

  private async executeCompleteBuild(agent: ArenaAgent, action: AgentAction, obs: WorldObservation) {
    let plotId = action.details.plotId;
    if (!plotId || plotId.length < 10) {
      // Find first plot ready to complete
      const ready = obs.myPlots.filter((p: any) => p.status === 'UNDER_CONSTRUCTION');
      if (ready.length > 0) plotId = ready[0].id;
    }
    if (!plotId) throw new Error('No plot to complete');

    const plot = await townService.completeBuild(agent.id, plotId);

    // Agent browses sprite library to pick visual
    try {
      const { chooseVisualSkill, executeVisualSkill } = await import('./buildingVisualService');
      
      const skill = chooseVisualSkill();
      console.log(`[AgentLoop] ${agent.name} browsing sprite library for ${plot.buildingType}...`);
      
      const visualResult = await executeVisualSkill(
        skill,
        plot.buildingType || 'building',
        plot.buildingName || 'unnamed',
        plot.buildingDesc || undefined,
      );
      
      // Store the visual result in building data
      const existingData = plot.buildingData ? (typeof plot.buildingData === 'string' ? JSON.parse(plot.buildingData) : plot.buildingData) : {};
      existingData._visual = {
        skill: visualResult.skill,
        spriteUrl: visualResult.spriteUrl,
        spriteId: visualResult.spriteId,
        emoji: visualResult.emoji,
      };
      await prisma.plot.update({
        where: { id: plotId },
        data: { buildingData: JSON.stringify(existingData) },
      });
      
      const found = visualResult.spriteUrl ? `sprite: ${visualResult.metadata?.spriteName}` : `emoji: ${visualResult.emoji}`;
      console.log(`[AgentLoop] ${agent.name} picked ${found}`);
    } catch (err: any) {
      console.error(`[AgentLoop] Sprite selection failed for ${plot.buildingType}: ${err.message}`);
      // Non-fatal — building is still complete, will use fallback emoji
    }

    return {
      success: true,
      narrative: `${agent.name} completed their ${plot.buildingType}! 🎉 The building stands proud in the town.`,
    };
  }

  private async executeMine(agent: ArenaAgent, action: AgentAction, obs: WorldObservation) {
    if (!obs.town) throw new Error('No active town');

    // Mining = agent does computational work and earns $ARENA
    const task = action.details.task || 'Generate useful content for the town';

    const spec = smartAiService.getModelSpec(agent.modelId);
    const startTime = Date.now();
    const response = await smartAiService.callModel(
      spec,
      [
        { role: 'system', content: `You are a worker in ${obs.town.name}, a ${obs.town.theme}. Complete the following task thoughtfully and thoroughly. Write prose, not JSON.` },
        { role: 'user', content: task },
      ],
      0.7,
      true, // forceNoJsonMode for creative text
    );
    const latencyMs = Date.now() - startTime;
    const cost = smartAiService.calculateCost(spec, response.inputTokens, response.outputTokens, latencyMs);

    // Mining reward: based on API cost (you spend real compute, you earn $ARENA)
    const arenaEarned = Math.max(1, Math.ceil(cost.costCents * 2)); // 2x the API cost in $ARENA

    await townService.submitMiningWork(
      agent.id,
      obs.town.id,
      task,
      task,
      response.content,
      1,
      cost.costCents,
      agent.modelId,
      arenaEarned,
      latencyMs,
    );

    return {
      success: true,
      narrative: `${agent.name} mined ${arenaEarned} $ARENA! ⛏️ Task: "${task.substring(0, 80)}"`,
    };
  }

  private async executePlayArena(agent: ArenaAgent, action: AgentAction) {
    // For now, log the intent. Full arena integration comes later.
    const gameType = action.details.gameType || 'POKER';
    const wager = action.details.wager || 100;
    return {
      success: true,
      narrative: `${agent.name} heads to the arena for a ${gameType} match! 🎮 Wagering ${wager} $ARENA. 💭 "${action.reasoning}"`,
    };
  }

  private async executeBuySkill(agent: ArenaAgent, action: AgentAction, obs: WorldObservation) {
    if (!obs.town) throw new Error('No active town');

    const rawSkill = String(action.details.skill || action.details.skillName || '').toUpperCase().trim();
    const skill = (['MARKET_DEPTH', 'BLUEPRINT_INDEX', 'SCOUT_REPORT'] as const).includes(rawSkill as any)
      ? (rawSkill as X402SkillName)
      : null;
    if (!skill) throw new Error('Unknown skill');

    const req: BuySkillRequest = {
      skill,
      question: String(action.details.question || ''),
      whyNow: String(action.details.whyNow || action.details.why_now || ''),
      expectedNextAction: String(action.details.expectedNextAction || action.details.expected_next_action || ''),
      ifThen: action.details.ifThen || action.details.if_then || { if: '', then: '' },
      params: (action.details.params || {}) as Record<string, unknown>,
    };

    const res = await x402SkillService.buySkill({
      agentId: agent.id,
      townId: obs.town.id,
      townLevel: obs.town.level,
      townName: obs.town.name,
      townTheme: obs.town.theme,
      recentEvents: (obs.recentEvents || []).map((e: any) => ({ title: e.title, description: e.description })),
      myBalance: obs.myBalance,
      myReserve: obs.myReserve,
      economySpotPrice: obs.economy?.spotPrice ?? null,
      currentTick: this.currentTick,
      request: req,
    });

    // Keep narrative safe — do not leak full output into global event feed.
    const q = String(req.question || '').replace(/\s+/g, ' ').trim();
    const shortQ = q.length > 90 ? `${q.slice(0, 90)}…` : q;

    return {
      success: true,
      narrative: `${agent.name} spent ${res.priceArena} $ARENA on ${skill}. 🧰 ${res.publicSummary}${shortQ ? ` — Q: "${shortQ}"` : ''}`,
    };
  }

  // ============================================
  // Helpers
  // ============================================

  /**
   * Extract a proper building name from LLM prose.
   * Tries multiple patterns, falls back to "{Agent}'s {Type}".
   */
  private extractBuildingName(content: string, agentName: string, buildingType: string): string {
    // 1. Quoted name (strongest signal): "The Rusty Dragon"
    const quotedMatch = content.match(/"([A-Z][^"]{2,30})"/);
    if (quotedMatch) return quotedMatch[1];

    // 2. "called/named/known as X" patterns
    const calledMatch = content.match(/(?:called|named|known as|dubbed|christened)\s+(?:the\s+)?[""]?([A-Z][A-Za-z'']+(?:\s+[A-Za-z'']+){0,4})[""]?/);
    if (calledMatch) return calledMatch[1].replace(/[.,!;:]+$/, '');

    // 3. Bold/emphasized: **The Iron Forge** or *Sunset Tavern*
    const boldMatch = content.match(/\*\*([A-Z][^*]{2,30})\*\*|\*([A-Z][^*]{2,30})\*/);
    if (boldMatch) return (boldMatch[1] || boldMatch[2]);

    // 4. Title Case proper name at sentence start: "The Golden Hearth stands..."
    const titleMatch = content.match(/^(?:The\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(?:\s+(?:stands|rises|sits|is|was|has|looms|towers|occupies))/m);
    if (titleMatch) return titleMatch[1].length > 3 ? (titleMatch[0].startsWith('The ') ? 'The ' + titleMatch[1] : titleMatch[1]) : '';

    // 5. Fallback: generate from agent name
    const typeLabel = buildingType.charAt(0) + buildingType.slice(1).toLowerCase();
    return `${agentName}'s ${typeLabel}`;
  }

  private summarizeBuildingData(dataStr: string): string {
    try {
      const data = JSON.parse(dataStr);
      const entries = Object.entries(data);
      if (entries.length === 0) return '(no previous work)';
      return entries
        .slice(-3) // Last 3 steps
        .map(([key, val]: [string, any]) => `- ${val.description || key}: ${(val.output || '').substring(0, 200)}`)
        .join('\n');
    } catch {
      return '(unable to parse previous work)';
    }
  }

  private actionToEventType(type: string): TownEventType {
    switch (type) {
      case 'claim_plot': return 'PLOT_CLAIMED';
      case 'start_build': return 'BUILD_STARTED';
      case 'do_work': return 'BUILD_STARTED'; // Using BUILD_STARTED for work updates
      case 'complete_build': return 'BUILD_COMPLETED';
      case 'mine': return 'CUSTOM';
      case 'buy_arena':
      case 'sell_arena':
        return 'TRADE';
      case 'play_arena': return 'ARENA_MATCH';
      default: return 'CUSTOM';
    }
  }

  private actionEmoji(type: string): string {
    switch (type) {
      case 'buy_arena': return '💱';
      case 'sell_arena': return '💱';
      case 'claim_plot': return '📍';
      case 'start_build': return '🔨';
      case 'do_work': return '🏗️';
      case 'complete_build': return '🎉';
      case 'mine': return '⛏️';
      case 'play_arena': return '🎮';
      case 'buy_skill': return '💳';
      case 'socialize': return '💬';
      case 'rest': return '💤';
      default: return '❓';
    }
  }

  // ============================================
  // Status
  // ============================================

  isRunning(): boolean {
    return this.running;
  }

  getCurrentTick(): number {
    return this.currentTick;
  }
}

export const agentLoopService = new AgentLoopService();
