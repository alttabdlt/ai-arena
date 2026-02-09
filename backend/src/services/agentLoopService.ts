/**
 * AgentLoopService — The autonomous brain for AI Town agents.
 *
 * Each agent runs a decision loop:
 *   1. Observe world state (town, plots, balance, other agents)
 *   2. Reason about what to do (LLM inference)
 *   3. Execute chosen action (claim, build, work, play)
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
import { socialGraphService } from './socialGraphService';
import { agentGoalService, type AgentGoalView } from './agentGoalService';
import { worldEventService } from './worldEventService';

function safeTrim(s: unknown, maxLen: number): string {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

type LiveObjective =
  | {
      objectiveId: string;
      objectiveType: 'RACE_CLAIM';
      participants: string[];
      plotIndex: number;
      zone: string;
      stakeArena: number;
      expiresAtMs: number;
    }
  | {
      objectiveId: string;
      objectiveType: 'PACT_CLAIM';
      participants: string[];
      assignments: Record<string, number>;
      zone: string;
      expiresAtMs: number;
    };

function safeParseJsonObject(raw: unknown): Record<string, any> | null {
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, any>) : null;
  } catch {
    return null;
  }
}

function formatTimeLeft(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${s}s`;
}

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
  type: 'buy_arena' | 'sell_arena' | 'claim_plot' | 'start_build' | 'do_work' | 'complete_build' | 'mine' | 'play_arena' | 'buy_skill' | 'transfer_arena' | 'rest'; // mine kept for backward compat but removed from prompt
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
  relationships: {
    maxFriends: number;
    friends: Array<{ agentId: string; name: string; archetype: string; score: number; since: string | null }>;
    rivals: Array<{ agentId: string; name: string; archetype: string; score: number; since: string | null }>;
  } | null;
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
  private tickInFlight: boolean = false;
  private currentTick: number = 0;
  public onTickResult?: (result: AgentTickResult) => void; // Hook for broadcasting
  private lastTradeTickByAgentId: Map<string, number> = new Map();

  // ============================================
  // Lifecycle
  // ============================================

  start(intervalMs: number = 30000) {
    if (this.running) return;
    this.running = true;
    console.log(`🤖 Agent loop started (tick every ${intervalMs / 1000}s)`);
    this.tickInterval = setInterval(() => {
      void this.tick().catch((err) => console.error('[AgentLoop] Tick failed:', err?.message || err));
    }, intervalMs);
    // Run first tick immediately
    void this.tick().catch((err) => console.error('[AgentLoop] Tick failed:', err?.message || err));
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
    if (!this.running) return [];
    if (this.tickInFlight) return [];
    this.tickInFlight = true;

    try {
      this.currentTick++;
      const agents = await prisma.arenaAgent.findMany({
        where: { isActive: true },
        orderBy: { lastActiveAt: 'asc' }, // Oldest first (round-robin fairness)
      });

      if (agents.length === 0) return [];

      // === WORLD EVENTS: tick the event system ===
      try {
        const newEvent = await worldEventService.tick(this.currentTick);
        if (newEvent) {
          // Log event to all active towns
          const eventTowns = newEvent.targetTownId
            ? [{ id: newEvent.targetTownId }]
            : await prisma.town.findMany({ where: { status: { in: ['BUILDING', 'COMPLETE'] } }, select: { id: true } });
          for (const t of eventTowns) {
            try {
              await townService.logEvent(t.id, 'CUSTOM' as any, `${newEvent.emoji} ${newEvent.name}`, newEvent.description, undefined, { kind: 'WORLD_EVENT', eventType: newEvent.type, eventId: newEvent.id });
            } catch {}
          }
        }
      } catch (e: any) {
        console.error(`[AgentLoop] World event tick failed: ${e.message}`);
      }

      // === UPKEEP: deduct survival cost from all agents ===
      const upkeepCost = Math.max(1, Math.round(1 * worldEventService.getUpkeepMultiplier()));
      for (const agent of agents) {
        try {
          if (agent.bankroll >= upkeepCost) {
            await prisma.arenaAgent.update({ where: { id: agent.id }, data: { bankroll: { decrement: upkeepCost } } });
            // Upkeep goes to agent's town treasury (if assigned)
            const agentTown = await prisma.town.findFirst({ where: { plots: { some: { ownerId: agent.id } } } });
            if (agentTown) {
              await prisma.town.update({ where: { id: agentTown.id }, data: { totalInvested: { increment: upkeepCost } } });
            }
          } else {
            // Can't pay — lose health
            const currentHealth = (agent as any).health ?? 100;
            const newHealth = Math.max(0, currentHealth - 5);
            await prisma.arenaAgent.update({ where: { id: agent.id }, data: { health: newHealth } as any });
            console.log(`[AgentLoop] ${agent.name} can't pay upkeep (${agent.bankroll}/${upkeepCost}) — health: ${currentHealth} → ${newHealth}`);
          }
        } catch (e: any) {
          console.error(`[AgentLoop] Upkeep failed for ${agent.name}: ${e.message}`);
        }
      }

      // === YIELD: distribute for completed towns every 5th tick ===
      if (this.currentTick % 5 === 0) {
        try {
          const allTowns = await prisma.town.findMany({ where: { status: 'COMPLETE' } });
          for (const t of allTowns) {
            try {
              // Apply yield multiplier from events
              const res = await townService.distributeYield(t.id);
              if (res.distributed > 0) console.log(`[AgentLoop] Yield distributed for ${t.name}: ${res.distributed} $ARENA to ${res.recipients} recipients`);
            } catch (e: any) {
              console.error(`[AgentLoop] Yield distribution failed for ${t.name}: ${e.message}`);
            }
          }
        } catch {}
      }

      // === AGENT TICKS: process all agents in parallel ===
      const tickResults = await Promise.all(
        agents.map(agent =>
          this.processAgentTick(agent)
            .catch(err => ({
              agentId: agent.id,
              agentName: agent.name,
              archetype: agent.archetype,
              action: { type: 'rest' as const, reasoning: `Error: ${err.message}`, details: {} },
              success: false,
              narrative: `${agent.name} encountered an error: ${err.message}`,
              cost: { model: '', inputTokens: 0, outputTokens: 0, totalCost: 0 } as AICost,
              error: err.message,
            }))
        )
      );

      const results: AgentTickResult[] = [];
      for (const result of tickResults) {
        results.push(result);
        // Broadcast to listeners (e.g. Telegram)
        if (this.onTickResult) {
          try { this.onTickResult(result); } catch {}
        }
        // Update last active
        await prisma.arenaAgent.update({
          where: { id: result.agentId },
          data: { lastActiveAt: new Date() },
        });
      }

      return results;
    } finally {
      this.tickInFlight = false;
    }
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
    // Re-fetch agent to get post-upkeep state
    const freshAgentState = await prisma.arenaAgent.findUnique({ where: { id: agent.id } });
    if (freshAgentState) agent = freshAgentState;

    // Health gate: dead agents can only rest
    if ((agent as any).health <= 0) {
      return {
        agentId: agent.id,
        agentName: agent.name,
        archetype: agent.archetype,
        action: { type: 'rest', reasoning: 'Health is 0 — incapacitated.', details: {} },
        success: true,
        narrative: `💀 ${agent.name} is incapacitated (0 health). Cannot act.`,
        cost: { model: '', inputTokens: 0, outputTokens: 0, totalCost: 0 } as AICost,
      };
    }

    // 1. Observe the world
    const observation = await this.observe(agent);

    // 2. Decide what to do (LLM call = proof of inference)
    const { action, cost } = await this.decide(agent, observation);

    // 3. Execute the action
    const { success, narrative, error, actualAction } = await this.execute(agent, action, observation);

    // Use the actual action (post-redirect) for logging/memory, but keep original for cost tracking
    const effectiveAction = actualAction || action;

    // 4. Log the event
    if (observation.town) {
      const isSkill = effectiveAction.type === 'buy_skill';
      const skillName = isSkill ? String(effectiveAction.details.skill || '').toUpperCase().trim() : '';
      const title = isSkill && skillName
        ? `💳 ${agent.name} bought ${skillName}`
        : `${this.actionEmoji(effectiveAction.type)} ${agent.name}`;

      await townService.logEvent(
        observation.town.id,
        this.actionToEventType(effectiveAction.type),
        title,
        narrative,
        agent.id,
        {
          action: effectiveAction.type,
          reasoning: effectiveAction.reasoning,
          success,
          ...(isSkill ? { kind: 'X402_SKILL', skill: skillName } : {}),
        },
      );
    }

    // 5. Update agent memory (scratchpad) and last-action fields
    await this.updateAgentMemory(agent, effectiveAction, observation, success, narrative);

    return { agentId: agent.id, agentName: agent.name, archetype: agent.archetype, action: effectiveAction, success, narrative, cost, error };
  }

  // ============================================
  // Agent Memory (Scratchpad)
  // ============================================

  private async updateAgentMemory(
    agent: ArenaAgent,
    action: AgentAction,
    _obs: WorldObservation,
    success: boolean,
    narrative: string,
  ) {
    void _obs; // reserved for future memory features
    // Refresh balance after execution
    const updatedAgent = await prisma.arenaAgent.findUnique({ where: { id: agent.id }, select: { bankroll: true, reserveBalance: true } });
    const bal = updatedAgent?.bankroll ?? agent.bankroll;
    const reserve = updatedAgent?.reserveBalance ?? agent.reserveBalance;

    // Build scratchpad entry
    const tick = this.currentTick;
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    const emoji = this.actionEmoji(action.type);
    const outcome = success ? '✅' : '❌';
    const reasonShort = action.reasoning.replace(/\[AUTO\]\s*/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);

    // Extract calculations if present
    const calc = action.details?.calculations;
    const calcLine = calc ? `  CALC: ${JSON.stringify(calc).slice(0, 150)}` : '';

    // Build target plot info
    const plotInfo = action.details?.plotIndex != null
      ? ` Plot#${action.details.plotIndex}`
      : action.details?.plotId ? ` plot:${String(action.details.plotId).slice(0, 8)}` : '';
    const buildInfo = action.details?.buildingType ? ` "${action.details.buildingType}"` : '';
    const amountInfo = action.details?.amountIn != null ? ` amt:${action.details.amountIn}` : '';

    const entry = `[T${tick} ${time}] ${emoji} ${action.type}${plotInfo}${buildInfo}${amountInfo} ${outcome} | BAL: ${bal} $ARENA + ${reserve} reserve\n  WHY: ${reasonShort}${calcLine ? '\n' + calcLine : ''}`;

    // Append to scratchpad, keeping last 20 entries
    const existingPad = agent.scratchpad || '';
    const lines = existingPad.split('\n[T').filter(l => l.trim());
    // Each entry starts with [T so the first one may not have the prefix after split
    const entries = lines.length > 0
      ? lines.map((l, i) => i === 0 && !l.startsWith('[T') ? '[T' + l : (l.startsWith('[T') ? l : '[T' + l))
      : [];
    entries.push(entry);
    const trimmed = entries.slice(-20);
    const newScratchpad = trimmed.join('\n');

    // Determine target plot index for frontend 3D navigation
    let targetPlot: number | null = null;
    if (action.details?.plotIndex != null) {
      targetPlot = Number(action.details.plotIndex);
      if (!Number.isFinite(targetPlot)) targetPlot = null;
    }

    await prisma.arenaAgent.update({
      where: { id: agent.id },
      data: {
        scratchpad: newScratchpad,
        lastActionType: action.type,
        lastReasoning: action.reasoning.slice(0, 500),
        lastNarrative: narrative.slice(0, 500),
        lastTargetPlot: targetPlot,
        lastTickAt: new Date(),
      },
    });
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
        relationships: null,
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

    const [myPlots, availablePlots, recentEventsRaw, recentSkills, otherAgents, contributions, relationships] = await Promise.all([
      townService.getAgentPlots(agent.id),
      townService.getAvailablePlots(town.id),
      townService.getRecentEvents(town.id, 25),
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
      socialGraphService.listRelationships(agent.id).catch(() => null),
    ]);

    // Private spectator features (x402 purchases, chats, relationship changes) should not leak to other agents.
    const recentEvents = recentEventsRaw.filter((e) => {
      try {
        const meta = JSON.parse(e.metadata || '{}') as any;
        return !['X402_SKILL', 'AGENT_CHAT', 'RELATIONSHIP_CHANGE', 'AGENT_TRADE'].includes(String(meta?.kind || ''));
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
      relationships,
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

    const goalView: AgentGoalView | null = obs.town
      ? agentGoalService.computeGoalForAgent({
          agent: { id: agent.id, name: agent.name, archetype: agent.archetype },
          town: {
            id: obs.town.id,
            level: obs.town.level,
            theme: obs.town.theme,
            plots: Array.isArray((obs.town as any).plots) ? (obs.town as any).plots : [],
          },
          myPlots: Array.isArray(obs.myPlots) ? (obs.myPlots as any) : [],
          availablePlots: Array.isArray(obs.availablePlots) ? (obs.availablePlots as any) : [],
        } as any)
      : null;

    const systemPrompt = `You are ${agent.name}, an AI agent living in a virtual town.
${personality}
${agent.systemPrompt ? `\nYour creator's instructions: ${agent.systemPrompt}` : ''}

You are participating in a town-building economy. You have PERSISTENT MEMORY — your journal below contains your past decisions and their outcomes. Use it to learn, plan ahead, and avoid repeating mistakes.

CURRENCIES:
- $ARENA: "fuel" token used for claiming plots, starting builds, and arena wagers.
- Reserve: stable cash. You can swap Reserve <-> $ARENA via the in-town AMM.

TRADING RULES:
- buy_arena / sell_arena are SUPPORT actions to fund in-town moves, not the main gameplay loop.
- Only trade if you have a specific near-term use-case (e.g. claim/build/wager) or you are explicitly de-risking.
- If you trade, you MUST explain why and what you'll do next with the funds (details.why + details.nextAction).
- Avoid rapid back-and-forth trades.
- If you need $ARENA urgently, sell reserve via buy_arena.

⚠️ SURVIVAL:
- You pay UPKEEP each tick (currently ${worldEventService.getUpkeepMultiplier()} $ARENA/tick). If you can't pay, you lose 5 health.
- At 0 health, you become HOMELESS — your buildings stop yielding and you can barely function.
- There is NO mining. Earn through: working on buildings (1 $ARENA/step), building yields, selling reserve, or receiving transfers.

WAYS TO EARN:
- Town-building yield: contributing (spending $ARENA + doing inference work) earns a share of the town's yield when it completes.
- Working (do_work): each build step earns 1 $ARENA — exactly covers basic upkeep. You must BUILD to grow.
- Arena: wager $ARENA in matches; you may win or lose.
- Transfers: ask other agents for help (beg, negotiate deals, form alliances).

PRIORITIES (in order):
1. PAY UPKEEP (automatic) — if you can't, sell reserve or beg.
2. CLAIM & BUILD — this is the core gameplay. Building yields are how you grow.
3. WORK on buildings — earns 1 $ARENA/step, keeps you alive.
4. TRADE — only to fund building or survive.
5. ARENA — risky entertainment, not a primary income source.
6. REST — last resort only when nothing else is viable.

🌍 ACTIVE WORLD EVENTS:
${worldEventService.getPromptText()}

You can build ANYTHING — there is no fixed list of building types. But if you want examples, here are common "modules":
HOUSE, APARTMENT, SHOP, MARKET, TAVERN, WORKSHOP, FARM, MINE, LIBRARY, TOWN_HALL, ARENA, THEATER, PARK.
You may invent new concepts (e.g., "Oracle Spire", "Dragon Hatchery", "Noodle Stand") as long as they fit the zone.

SKILLS / ACTIONS (choose exactly one each tick):
- buy_arena: swap reserve -> $ARENA (details: amountIn, optional minAmountOut, why, nextAction)
- sell_arena: swap $ARENA -> reserve (details: amountIn, optional minAmountOut, why, nextAction)
- claim_plot: claim an empty plot (details: plotIndex, why)
- start_build: begin construction on a claimed plot you own (details: plotId or plotIndex, buildingType, why)
- do_work: progress an under-construction building (details: plotId or plotIndex, stepDescription)
- complete_build: finish a building if enough work is done (details: plotId or plotIndex)
- play_arena: wager $ARENA in a match (details: gameType "POKER|RPS", wager)
- transfer_arena: send $ARENA to another agent (details: targetAgentName, amount, reason). Use for deals, gifts, alliances.
- buy_skill: purchase a paid x402 "skill" using $ARENA. Only buy when you have a SPECIFIC pending decision.
  Available skills:
    - MARKET_DEPTH: quote + slippage/impact for a proposed swap
    - BLUEPRINT_INDEX: a short plan/risk checklist for a building in a zone + theme
    - SCOUT_REPORT: partial, uncertain intel about a zone based on recent events
- rest: only if there's truly nothing useful to do (details: thought)

⚠️ SHOW YOUR WORK — every decision must include calculations:
- Before spending: "I have X $ARENA. This costs Y. After this I'll have Z left. I need W more for my next planned action."
- Before trading: "Current price is P. I need N $ARENA for [specific action]. Cost in reserve: N × P × 1.01 (fee) = R."
- Before claiming/building: "Total project cost: claim(C) + build_start(B) + work_steps(S×cost) = T total. I can/cannot afford this."
- Reference your journal: "Last tick I did X, this tick I should continue with Y because Z."

RESPOND WITH JSON ONLY:
{
  "type": "<action>",
  "reasoning": "<your thinking — be in character, show personality, reference your journal, explain your strategy>",
  "calculations": {
    "currentBalance": <your $ARENA>,
    "actionCost": <estimated cost>,
    "remainingAfter": <balance after>,
    "plan": "<what you'll do next 2-3 ticks>"
  },
  "details": {
    // For buy_arena: {"amountIn": <reserve>, "why": "<reason>", "nextAction": "<what you'll do next>"}
    // For sell_arena: {"amountIn": <arena>, "why": "<reason>", "nextAction": "<what you'll do next>"}
    // For claim_plot: {"plotIndex": <number>, "why": "<reason>"}
    // For start_build: {"plotId": "<id>", "buildingType": "<creative building concept>", "why": "<reason>"}
    // For do_work: {"plotId": "<id>", "stepDescription": "<what to design next>"}
    // For complete_build: {"plotId": "<id>"}
    // For play_arena: {"gameType": "POKER|RPS", "wager": <amount>}
    // For transfer_arena: {"targetAgentName": "<name>", "amount": <number>, "reason": "<why>"}
    // For buy_skill: {"skill": "MARKET_DEPTH|BLUEPRINT_INDEX|SCOUT_REPORT", "question": "<what to learn>", "whyNow": "<pending decision>", "expectedNextAction": "<next action>"}
    // For rest: {"thought": "<what you're thinking about>"}
  }
}`;

    const liveObjective = obs.town ? this.extractLiveObjective(agent.id, obs) : null;
    const worldState = this.formatWorldState(agent, obs, goalView, liveObjective);

    // Inject scratchpad (agent's persistent memory/journal)
    const scratchpadBlock = agent.scratchpad
      ? `\n📝 YOUR JOURNAL (your memory from previous ticks — use this to track strategy, learn from outcomes, plan ahead):\n${agent.scratchpad}\n---`
      : `\n📝 YOUR JOURNAL: (empty — this is your first tick! Observe and plan.)\n---`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: scratchpadBlock + '\n\n' + worldState },
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
        details: {
          ...(parsed.details || {}),
          // Preserve calculations in details for logging/display
          ...(parsed.calculations ? { calculations: parsed.calculations } : {}),
        },
      };
    } catch {
      action = {
        type: 'rest',
        reasoning: `Couldn't decide. Raw thought: ${response.content.substring(0, 200)}`,
        details: {},
      };
    }

    // ── Anti-overtrade: discourage buy/sell unless there is a concrete plan. ──
    // Note: auto-topup is DISABLED — agents manage their own finances.
    const isTradeAction = action.type === 'buy_arena' || action.type === 'sell_arena';
    if (isTradeAction) {
      const lastTradeTick = this.lastTradeTickByAgentId.get(agent.id) ?? -1_000_000;
      const tooSoon = this.currentTick - lastTradeTick < 3; // ~90s at default 30s ticks
      const why = String((action.details as any)?.why || '').trim();
      const nextAction = String((action.details as any)?.nextAction || (action.details as any)?.next_action || '').trim();

      if (tooSoon || (!why && !nextAction)) {
        action = {
          type: 'rest',
          reasoning: `[AUTO] Skipping overtrade — focus on town actions.`,
          details: { thought: `No clear use-case for ${action.type}.` },
        };
      }
    }

    // ── Anti-stall: if agent would "rest" while the town has available plots and they own none, claim something. ──
    if (obs.town && action.type === 'rest' && obs.myPlots.length === 0 && obs.availablePlots.length > 0) {
      const suggested = goalView?.suggest?.claimPlotIndex;
      const preferred = suggested != null ? obs.availablePlots.find((p: any) => p.plotIndex === suggested) : null;
      const pick = preferred || obs.availablePlots[Math.floor(Math.random() * obs.availablePlots.length)];
      action = {
        type: 'claim_plot',
        reasoning: `[AUTO] No plots yet. Claiming a plot to get started.`,
        details: { plotIndex: pick.plotIndex, why: goalView ? `Goal: ${goalView.goalTitle}` : 'Need a foothold in town' },
      };
    }

    // ── Force-build override: if agent has unbuilt plots, override non-building actions ──
    if (obs.town) {
      const myUC = obs.myPlots.filter(p => p.status === 'UNDER_CONSTRUCTION');
      const myClaimed = obs.myPlots.filter(p => p.status === 'CLAIMED');

      const objectivePlotIndex =
        liveObjective?.objectiveType === 'RACE_CLAIM'
          ? liveObjective.plotIndex
          : liveObjective?.objectiveType === 'PACT_CLAIM'
            ? liveObjective.assignments[agent.id]
            : null;

      const objectivePlot =
        objectivePlotIndex != null
          ? obs.availablePlots.find((p) => p.plotIndex === objectivePlotIndex) || null
          : null;

      const claimCost = 10 + Math.max(0, (obs.town.level - 1)) * 5;
      const canFundObjectiveClaim = obs.myBalance >= claimCost || (!!obs.economy && obs.myReserve > 0);

      const isObjectiveClaim =
        !!objectivePlot &&
        action.type === 'claim_plot' &&
        Number.isFinite(Number(action.details?.plotIndex)) &&
        Number(action.details.plotIndex) === objectivePlotIndex;

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
      // Priority 1.5: time-bounded objective plot claims (creates stakes + follow-up action)
      else if (objectivePlot && canFundObjectiveClaim && !isObjectiveClaim && action.type !== 'complete_build') {
        const otherId = liveObjective?.participants?.find((p) => p !== agent.id) || '';
        const otherName = safeTrim(obs.otherAgents.find((a) => a.id === otherId)?.name || otherId.slice(0, 6), 24) || 'someone';
        const why =
          liveObjective?.objectiveType === 'RACE_CLAIM'
            ? `Objective race vs ${otherName} — claim before the deadline.`
            : `Objective pact with ${otherName} — claim your assigned plot before the deadline.`;

        action = {
          type: 'claim_plot',
          reasoning: `[AUTO] Live objective — claim plot ${objectivePlot.plotIndex} (${objectivePlot.zone})`,
          details: { plotIndex: objectivePlot.plotIndex, why },
        };
      }
      // Priority 2: do_work on under-construction plots
      else if (myUC.length > 0 && !isObjectiveClaim && !['do_work', 'complete_build'].includes(action.type)) {
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
      else if (myClaimed.length > 0 && !isObjectiveClaim && !['start_build', 'do_work', 'complete_build'].includes(action.type)) {
        const isBlueprintSkill =
          action.type === 'buy_skill' && String(action.details.skill || '').toUpperCase().trim() === 'BLUEPRINT_INDEX';
        if (!isBlueprintSkill) {
          const preferred = goalView?.focusZone ? myClaimed.find((p) => p.zone === goalView.focusZone) : null;
          const plot = preferred || myClaimed[0];
          const bt = agentGoalService.pickBuildingType({
            agentId: agent.id,
            archetype: agent.archetype,
            townId: obs.town.id,
            zone: plot.zone,
            plotIndex: plot.plotIndex,
          });
          action = { type: 'start_build', reasoning: `[AUTO] Starting build on claimed plot ${plot.plotIndex}`, details: { plotId: plot.id, plotIndex: plot.plotIndex, buildingType: bt, why: 'Must build on claimed plot' } };
        }
      }
    }

    // ── Pre-flight funding: if we are about to spend $ARENA but are short, buy fuel first. ──
    if (obs.town && obs.economy && obs.myReserve > 0 && action.type !== 'buy_arena') {
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
        const minSpend = 25; // avoid tiny swaps rounding to 0 output on large pools
        const spend = Math.min(obs.myReserve, Math.max(minSpend, Math.min(2000, estimatedReserve)));

        // Don't burn the whole tick on a standalone trade action. Instead, attach an auto top-up
        // and continue with the original intended action.
        action = {
          ...action,
          details: {
            ...action.details,
            _autoTopUp: {
              side: 'BUY_ARENA',
              amountIn: spend,
              nextAction: plannedActionType,
              why: `Top up fuel for ${plannedActionType} (need ${requiredArena}, have ${obs.myBalance})`,
            },
          },
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

  private extractLiveObjective(agentId: string, obs: WorldObservation): LiveObjective | null {
    const now = Date.now();
    const resolvedIds = new Set<string>();

    for (const e of obs.recentEvents || []) {
      const meta = safeParseJsonObject((e as any)?.metadata);
      if (!meta) continue;
      if (String(meta.kind || '') !== 'TOWN_OBJECTIVE_RESOLVED') continue;
      const objectiveId = typeof meta.objectiveId === 'string' ? meta.objectiveId : '';
      if (objectiveId) resolvedIds.add(objectiveId);
    }

    for (const e of obs.recentEvents || []) {
      const meta = safeParseJsonObject((e as any)?.metadata);
      if (!meta) continue;
      if (String(meta.kind || '') !== 'TOWN_OBJECTIVE') continue;

      const objectiveId = typeof (e as any)?.id === 'string' ? String((e as any).id) : '';
      if (!objectiveId || resolvedIds.has(objectiveId)) continue;

      const participants = Array.isArray(meta.participants)
        ? meta.participants.filter((p: any): p is string => typeof p === 'string')
        : [];
      if (!participants.includes(agentId)) continue;

      const expiresAtMs = Number(meta.expiresAtMs || 0);
      if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) continue;

      const objectiveType = String(meta.objectiveType || '').toUpperCase();
      if (objectiveType === 'RACE_CLAIM') {
        const plotIndexRaw = Number(meta.plotIndex);
        if (!Number.isFinite(plotIndexRaw)) continue;
        const plotIndex = Math.trunc(plotIndexRaw);
        const stakeRaw = Number(meta.stakeArena || 0);
        const stakeArena = Number.isFinite(stakeRaw) ? Math.max(0, Math.min(50, Math.trunc(stakeRaw))) : 0;
        const zone = safeTrim(meta.zone, 24).toUpperCase() || 'UNKNOWN';
        return { objectiveId, objectiveType: 'RACE_CLAIM', participants, plotIndex, zone, stakeArena, expiresAtMs };
      }

      if (objectiveType === 'PACT_CLAIM') {
        const zone = safeTrim(meta.zone, 24).toUpperCase() || 'UNKNOWN';
        const rawAssignments = meta.assignments;
        const assignmentsObj =
          rawAssignments && typeof rawAssignments === 'object'
            ? (rawAssignments as Record<string, unknown>)
            : null;
        if (!assignmentsObj) continue;

        const assignments: Record<string, number> = {};
        for (const [aid, idx] of Object.entries(assignmentsObj)) {
          const n = Number(idx);
          if (aid && Number.isFinite(n)) assignments[aid] = Math.trunc(n);
        }

        if (assignments[agentId] == null) continue;
        return { objectiveId, objectiveType: 'PACT_CLAIM', participants, assignments, zone, expiresAtMs };
      }
    }

    return null;
  }

  private formatWorldState(agent: ArenaAgent, obs: WorldObservation, goalView?: AgentGoalView | null, liveObjective?: LiveObjective | null): string {
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

    const friendsDesc = obs.relationships?.friends?.slice(0, 2).map((f) => `${f.name} (${f.archetype}, score ${f.score})`).join(', ') || 'none';
    const rivalsDesc = obs.relationships?.rivals?.slice(0, 2).map((r) => `${r.name} (${r.archetype}, score ${r.score})`).join(', ') || 'none';

    const g = goalView || null;
    const goalBlock = g
      ? `\n🎯 GOAL (this town):\n` +
        `  - ${safeTrim(g.goalTitle, 80)}\n` +
        `  - Progress: ${safeTrim(g.progress.label, 80)}\n` +
        `  - Next: ${safeTrim(g.next.detail, 120)}\n`
      : '';

    const obj = liveObjective || null;
    const objectiveBlock = (() => {
      if (!obj) return '';
      const left = formatTimeLeft(obj.expiresAtMs - Date.now());
      const otherId = obj.participants.find((p) => p !== agent.id) || '';
      const other = otherId ? obs.otherAgents.find((a) => a.id === otherId) : null;
      const otherName = other?.name || (otherId ? otherId.slice(0, 6) : 'someone');

      if (obj.objectiveType === 'RACE_CLAIM') {
        const targetOk = obs.availablePlots.some((p) => p.plotIndex === obj.plotIndex);
        return (
          `\n🔥 LIVE OBJECTIVE (expires in ${left}):\n` +
          `  - RACE: claim plot ${obj.plotIndex} (${obj.zone}) vs ${otherName}\n` +
          `${obj.stakeArena > 0 ? `  - Stakes: winner takes ${obj.stakeArena} $ARENA from loser (if they have it)\n` : ''}` +
          `${targetOk ? '' : `  - Note: if plot ${obj.plotIndex} is already claimed, ignore this objective.\n`}`
        );
      }

      const myPlot = Number(obj.assignments[agent.id]);
      const otherPlot = otherId ? Number(obj.assignments[otherId]) : Number.NaN;
      const myStatus = Number.isFinite(myPlot)
        ? obs.myPlots.some((p) => p.plotIndex === myPlot)
          ? 'CLAIMED'
          : obs.availablePlots.some((p) => p.plotIndex === myPlot)
            ? 'EMPTY'
            : 'TAKEN'
        : 'UNKNOWN';

      return (
        `\n🔥 LIVE OBJECTIVE (expires in ${left}):\n` +
        `  - PACT: you claim plot ${Number.isFinite(myPlot) ? myPlot : '?'} (${obj.zone}) — status ${myStatus}\n` +
        `${Number.isFinite(otherPlot) ? `  - Partner ${otherName} claims plot ${otherPlot}\n` : `  - Partner ${otherName} has an assigned plot\n`}`
      );
    })();

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
	${obs.economy ? `\n💱 ECONOMY:\nSpot price: 1 $ARENA ≈ ${obs.economy.spotPrice.toFixed(4)} reserve (fee ${obs.economy.feeBps / 100}%)\nTrade sparingly: buy_arena / sell_arena are mostly for funding specific actions.` : ''}

💳 YOUR RECENT PAID SKILLS (X402):
${skillsDesc}

🤝 RELATIONSHIPS:
Friends: ${friendsDesc}
Rivals: ${rivalsDesc}
${goalBlock}${objectiveBlock}

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
  ): Promise<{ success: boolean; narrative: string; error?: string; actualAction?: AgentAction }> {
    try {
      // Auto-topup DISABLED — agents must manage their own finances
      // Keeping code for reference but skipping execution
      let autoTopUpNarrative = '';
      const autoTopUp = false && (action.details as any)?._autoTopUp; // disabled
      if (autoTopUp && obs.economy) {
        const side = String(autoTopUp.side || '').toUpperCase();
        if (side === 'BUY_ARENA') {
          const amountIn = Number.parseInt(String(autoTopUp.amountIn || '0'), 10);
          const minAmountOut =
            autoTopUp.minAmountOut != null ? Number.parseInt(String(autoTopUp.minAmountOut), 10) : undefined;

          if (Number.isFinite(amountIn) && amountIn > 0) {
            const swapRes = await offchainAmmService.swap(agent.id, 'BUY_ARENA', amountIn, { minAmountOut });
            const price = swapRes.swap.amountOut > 0 ? swapRes.swap.amountIn / swapRes.swap.amountOut : null;
            const why = String(autoTopUp.why || '').replace(/\s+/g, ' ').trim();
            const nextAction = safeTrim(autoTopUp.nextAction, 32);

            autoTopUpNarrative =
              `Auto-topup: bought ${swapRes.swap.amountOut} $ARENA for ${swapRes.swap.amountIn} reserve (fee ${swapRes.swap.feeAmount}).` +
              `${price ? ` ~${price.toFixed(3)} reserve/ARENA.` : ''}` +
              `${why ? ` Purpose: ${why}` : ''}`;

            if (obs.town) {
              try {
                await townService.logEvent(
                  obs.town.id,
                  'TRADE',
                  `💱 ${agent.name} fueled up`,
                  `${agent.name} bought ${swapRes.swap.amountOut} $ARENA for ${swapRes.swap.amountIn} reserve.` +
                    `${why ? ` ${safeTrim(why, 180)}` : ''}` +
                    `${nextAction ? ` Next: ${nextAction}.` : ''}`,
                  agent.id,
                  {
                    kind: 'AGENT_TRADE',
                    source: 'AUTO_TOPUP',
                    swapId: swapRes.swap.id,
                    side: swapRes.swap.side,
                    amountIn: swapRes.swap.amountIn,
                    amountOut: swapRes.swap.amountOut,
                    feeAmount: swapRes.swap.feeAmount,
                    amountArena: swapRes.swap.amountOut,
                    purpose: safeTrim(why, 180),
                    nextAction: nextAction || undefined,
                  },
                );
              } catch {
                // non-fatal
              }
            }

            this.lastTradeTickByAgentId.set(agent.id, this.currentTick);
          }
        }
      }

      switch (action.type) {
        case 'buy_arena':
          return await this.executeBuyArena(agent, action, obs);
        case 'sell_arena':
          return await this.executeSellArena(agent, action, obs);
        case 'claim_plot':
          {
            const res = await this.executeClaim(agent, action, obs);
            if (autoTopUpNarrative) res.narrative = `${autoTopUpNarrative} ${res.narrative}`;
            return res;
          }
        case 'start_build':
          {
            const res = await this.executeStartBuild(agent, action, obs);
            if (autoTopUpNarrative) res.narrative = `${autoTopUpNarrative} ${res.narrative}`;
            return res;
          }
        case 'do_work':
          return await this.executeDoWork(agent, action, obs);
        case 'complete_build':
          return await this.executeCompleteBuild(agent, action, obs);
        case 'mine':
          // Mining removed — redirect to do_work or rest
          if (obs.myPlots.some((p: any) => p.status === 'UNDER_CONSTRUCTION')) {
            const workAction: AgentAction = { ...action, type: 'do_work', reasoning: '[REDIRECT] Mining removed. Working on building instead.', details: {} };
            return { ...(await this.executeDoWork(agent, workAction, obs)), actualAction: workAction };
          }
          return { success: true, narrative: `${agent.name} tried to mine but mining no longer exists. 💤 Resting instead.`, actualAction: { ...action, type: 'rest', reasoning: '[REDIRECT] Mining removed', details: {} } };
        case 'play_arena':
          return await this.executePlayArena(agent, action);
        case 'buy_skill':
          {
            const res = await this.executeBuySkill(agent, action, obs);
            if (autoTopUpNarrative) res.narrative = `${autoTopUpNarrative} ${res.narrative}`;
            return res;
          }
        case 'transfer_arena':
          return await this.executeTransferArena(agent, action, obs);
        case 'rest':
          return {
            success: true,
            narrative: `${agent.name} is resting. 💭 "${action.details.thought || action.reasoning}"`,
          };
        default:
          return { success: false, narrative: `${agent.name} tried an unknown action: ${action.type}`, error: 'Unknown action' };
      }
    } catch (err: any) {
      // Fix 8: Burn 1 $ARENA on failed actions (fumble tax)
      try {
        const freshAgent = await prisma.arenaAgent.findUnique({ where: { id: agent.id } });
        if (freshAgent && freshAgent.bankroll > 5) {
          await prisma.arenaAgent.update({ where: { id: agent.id }, data: { bankroll: { decrement: 1 } } });
          const pool = await prisma.economyPool.findFirst({ orderBy: { createdAt: 'desc' } });
          if (pool) {
            await prisma.economyPool.update({ where: { id: pool.id }, data: { arenaBalance: { increment: 1 } } });
          }
        }
      } catch {}
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

  private async executeBuyArena(agent: ArenaAgent, action: AgentAction, obs: WorldObservation) {
    const amountIn = Number.parseInt(String(action.details.amountIn || '0'), 10);
    if (!Number.isFinite(amountIn) || amountIn <= 0) throw new Error('No amountIn specified');
    const minAmountOut =
      action.details.minAmountOut != null ? Number.parseInt(String(action.details.minAmountOut), 10) : undefined;

    const result = await offchainAmmService.swap(agent.id, 'BUY_ARENA', amountIn, { minAmountOut });
    const price = result.swap.amountOut > 0 ? result.swap.amountIn / result.swap.amountOut : null;

    this.lastTradeTickByAgentId.set(agent.id, this.currentTick);

    const why = String((action.details as any)?.why || '').replace(/\s+/g, ' ').trim();
    const nextAction = String((action.details as any)?.nextAction || (action.details as any)?.next_action || '').replace(/\s+/g, ' ').trim();

    if (obs.town) {
      try {
        await townService.logEvent(
          obs.town.id,
          'TRADE',
          `💱 ${agent.name} bought fuel`,
          `${agent.name} bought ${result.swap.amountOut} $ARENA for ${result.swap.amountIn} reserve (fee ${result.swap.feeAmount}).` +
            `${why ? ` Purpose: ${safeTrim(why, 180)}.` : ''}` +
            `${nextAction ? ` Next: ${safeTrim(nextAction, 48)}.` : ''}`,
          agent.id,
          {
            kind: 'AGENT_TRADE',
            source: 'DECISION',
            swapId: result.swap.id,
            side: result.swap.side,
            amountIn: result.swap.amountIn,
            amountOut: result.swap.amountOut,
            feeAmount: result.swap.feeAmount,
            amountArena: result.swap.amountOut,
            purpose: safeTrim(why, 180),
            nextAction: safeTrim(nextAction, 48) || undefined,
          },
        );
      } catch {
        // non-fatal
      }
    }

    return {
      success: true,
      narrative: `${agent.name} bought ${result.swap.amountOut} $ARENA for ${result.swap.amountIn} reserve (fee ${result.swap.feeAmount}).` +
        `${price ? ` ~${price.toFixed(3)} reserve/ARENA.` : ''}` +
        `${why ? ` Purpose: ${why}.` : ''}` +
        `${nextAction ? ` Next: ${nextAction}.` : ''}`,
    };
  }

  private async executeSellArena(agent: ArenaAgent, action: AgentAction, obs: WorldObservation) {
    const amountIn = Number.parseInt(String(action.details.amountIn || '0'), 10);
    if (!Number.isFinite(amountIn) || amountIn <= 0) throw new Error('No amountIn specified');
    const minAmountOut =
      action.details.minAmountOut != null ? Number.parseInt(String(action.details.minAmountOut), 10) : undefined;

    const result = await offchainAmmService.swap(agent.id, 'SELL_ARENA', amountIn, { minAmountOut });
    const price = result.swap.amountOut > 0 ? result.swap.amountOut / result.swap.amountIn : null;

    this.lastTradeTickByAgentId.set(agent.id, this.currentTick);

    const why = String((action.details as any)?.why || '').replace(/\s+/g, ' ').trim();
    const nextAction = String((action.details as any)?.nextAction || (action.details as any)?.next_action || '').replace(/\s+/g, ' ').trim();

    if (obs.town) {
      try {
        await townService.logEvent(
          obs.town.id,
          'TRADE',
          `💱 ${agent.name} sold $ARENA`,
          `${agent.name} sold ${result.swap.amountIn} $ARENA for ${result.swap.amountOut} reserve (fee ${result.swap.feeAmount}).` +
            `${why ? ` Purpose: ${safeTrim(why, 180)}.` : ''}` +
            `${nextAction ? ` Next: ${safeTrim(nextAction, 48)}.` : ''}`,
          agent.id,
          {
            kind: 'AGENT_TRADE',
            source: 'DECISION',
            swapId: result.swap.id,
            side: result.swap.side,
            amountIn: result.swap.amountIn,
            amountOut: result.swap.amountOut,
            feeAmount: result.swap.feeAmount,
            amountArena: result.swap.amountIn,
            purpose: safeTrim(why, 180),
            nextAction: safeTrim(nextAction, 48) || undefined,
          },
        );
      } catch {
        // non-fatal
      }
    }

    return {
      success: true,
      narrative: `${agent.name} sold ${result.swap.amountIn} $ARENA for ${result.swap.amountOut} reserve (fee ${result.swap.feeAmount}).` +
        `${price ? ` ~${price.toFixed(3)} reserve/ARENA.` : ''}` +
        `${why ? ` Purpose: ${why}.` : ''}` +
        `${nextAction ? ` Next: ${nextAction}.` : ''}`,
    };
  }

  private async executeStartBuild(agent: ArenaAgent, action: AgentAction, obs: WorldObservation) {
    const { buildingType } = action.details;
    if (!buildingType) throw new Error('No buildingType specified');
    if (!obs.town) throw new Error('No active town');

    // --- Affordability check: redirect to mining if agent can't afford ANY build ---
    const zoneBaseCost: any = { RESIDENTIAL: 10, COMMERCIAL: 20, CIVIC: 35, INDUSTRIAL: 20, ENTERTAINMENT: 25 };
    const freshAgent = await prisma.arenaAgent.findUniqueOrThrow({ where: { id: agent.id } });
    const cheapestBuildCost = Math.min(...Object.values(zoneBaseCost).map((c: any) => c * obs.town!.level));
    if (freshAgent.bankroll < cheapestBuildCost) {
      // Can't afford any build — sell reserve if available, otherwise rest
      if (freshAgent.reserveBalance > 10) {
        const sellAction: AgentAction = { ...action, type: 'buy_arena', reasoning: `[REDIRECT] Can't afford any build (need ${cheapestBuildCost}, have ${freshAgent.bankroll}). Selling reserve for $ARENA.`, details: { amountIn: Math.min(50, freshAgent.reserveBalance), why: 'Need funds to build', nextAction: 'start_build' } };
        console.log(`[AgentLoop] ${agent.name}: start_build redirect → buy_arena (bankroll ${freshAgent.bankroll} < cheapest build ${cheapestBuildCost})`);
        const result = await this.executeBuyArena(agent, sellAction, obs);
        return { ...result, actualAction: sellAction };
      }
      const restAction: AgentAction = { ...action, type: 'rest', reasoning: `[REDIRECT] Can't afford any build and no reserve to sell. Resting.`, details: { thought: `I need ${cheapestBuildCost} $ARENA but only have ${freshAgent.bankroll}. No reserve to sell. Hoping for transfers or yield.` } };
      console.log(`[AgentLoop] ${agent.name}: start_build redirect → rest (broke, no reserve)`);
      return { success: true, narrative: `${agent.name} can't afford to build and has no reserve. 💤 Waiting for income...`, actualAction: restAction };
    }

    // --- Intent-based resolution: agent wants to BUILD, system handles sequencing ---

    // Helper: check if agent can afford building on a specific plot zone
    const canAffordZone = (zone: string) => {
      const baseCost = zoneBaseCost[zone] || 15;
      return freshAgent.bankroll >= baseCost * obs.town!.level;
    };

    // 1. Try to resolve the target plot
    let plotId: string | undefined;
    let targetPlot: any = null;
    const plotIndex = action.details.plotIndex ?? action.details.plotId;

    // Try by plotIndex first
    if (plotIndex !== undefined) {
      targetPlot = (obs.town as any).plots?.find((p: any) => p.plotIndex === Number(plotIndex));
      if (targetPlot) plotId = targetPlot.id;
    }

    // Try by plotId if it looks like a real CUID
    if (!plotId && action.details.plotId && String(action.details.plotId).length >= 10) {
      plotId = action.details.plotId;
      targetPlot = (obs.town as any).plots?.find((p: any) => p.id === plotId);
    }

    // 2. If we have a target plot, handle its current status intelligently
    if (targetPlot) {
      // Check affordability for this specific plot's zone
      if (!canAffordZone(targetPlot.zone)) {
        const cost = (zoneBaseCost[targetPlot.zone] || 15) * obs.town.level;
        // Can't afford zone build — try to sell reserve
        if (freshAgent.reserveBalance > 10) {
          const sellAction: AgentAction = { ...action, type: 'buy_arena', reasoning: `[REDIRECT] Can't afford ${targetPlot.zone} build (need ${cost}, have ${freshAgent.bankroll}). Selling reserve.`, details: { amountIn: Math.min(50, freshAgent.reserveBalance), why: `Need ${cost} for build`, nextAction: 'start_build' } };
          const result = await this.executeBuyArena(agent, sellAction, obs);
          return { ...result, actualAction: sellAction };
        }
        return { success: false, narrative: `${agent.name} can't afford ${targetPlot.zone} build (need ${cost}, have ${freshAgent.bankroll}) and has no reserve.`, actualAction: { ...action, type: 'rest', reasoning: '[REDIRECT] Broke', details: {} } };
      }

      if (targetPlot.status === 'EMPTY') {
        // Auto-claim first, then start build
        console.log(`[AgentLoop] ${agent.name}: auto-claiming plot ${targetPlot.plotIndex} before building`);
        await townService.claimPlot(agent.id, obs.town.id, targetPlot.plotIndex);
        const plot = await townService.startBuild(agent.id, targetPlot.id, buildingType);
        return {
          success: true,
          narrative: `${agent.name} claimed and started building a ${buildingType} on plot ${plot.plotIndex}! 💭 "${action.reasoning}"`,
        };
      }
      if (targetPlot.status === 'CLAIMED' && targetPlot.ownerId === agent.id) {
        // Perfect — plot is claimed by us, start building
        const plot = await townService.startBuild(agent.id, plotId!, buildingType);
        return {
          success: true,
          narrative: `${agent.name} started building a ${buildingType} on plot ${plot.plotIndex}! 💭 "${action.reasoning}"`,
        };
      }
      // If plot is UNDER_CONSTRUCTION and owned by us, redirect to do_work
      if (targetPlot.status === 'UNDER_CONSTRUCTION' && (targetPlot.ownerId === agent.id || targetPlot.builderId === agent.id)) {
        const workAction: AgentAction = { ...action, type: 'do_work', reasoning: `[REDIRECT] Plot ${targetPlot.plotIndex} already under construction. Working on it instead.`, details: { ...action.details, plotId: targetPlot.id } };
        console.log(`[AgentLoop] ${agent.name}: start_build redirect → do_work (plot ${targetPlot.plotIndex} already under construction)`);
        const result = await this.executeDoWork(agent, workAction, obs);
        return { ...result, actualAction: workAction };
      }
    }

    // 3. Fallback: find any claimed plot owned by agent (check affordability)
    const myClaimedPlots = obs.myPlots.filter((p: any) => p.status === 'CLAIMED');
    for (const cp of myClaimedPlots) {
      if (canAffordZone(cp.zone)) {
        plotId = cp.id;
        const plot = await townService.startBuild(agent.id, plotId, buildingType);
        return {
          success: true,
          narrative: `${agent.name} started building a ${buildingType} on plot ${plot.plotIndex}! 💭 "${action.reasoning}"`,
        };
      }
    }

    // If we have claimed plots but can't afford any of them, sell reserve or rest
    if (myClaimedPlots.length > 0) {
      if (agent.reserveBalance > 10) {
        const sellAction: AgentAction = { ...action, type: 'buy_arena', reasoning: `[REDIRECT] Has claimed plots but can't afford to build. Selling reserve.`, details: { amountIn: Math.min(50, agent.reserveBalance), why: 'Need funds for building', nextAction: 'start_build' } };
        console.log(`[AgentLoop] ${agent.name}: has claimed plots but can't afford → buy_arena`);
        const result = await this.executeBuyArena(agent, sellAction, obs);
        return { ...result, actualAction: sellAction };
      }
      return { success: true, narrative: `${agent.name} has claimed plots but can't afford to build. 💤 Waiting for income...`, actualAction: { ...action, type: 'rest', reasoning: '[REDIRECT] Broke with claimed plots', details: {} } };
    }

    // 4. Last resort: auto-claim an available plot and build (check affordability)
    const affordablePlots = obs.availablePlots.filter((p: any) => canAffordZone(p.zone));
    if (affordablePlots.length > 0) {
      const avail = affordablePlots[0];
      console.log(`[AgentLoop] ${agent.name}: auto-claiming available plot ${avail.plotIndex} for build`);
      await townService.claimPlot(agent.id, obs.town.id, avail.plotIndex);
      const plot = await townService.startBuild(agent.id, avail.id, buildingType);
      return {
        success: true,
        narrative: `${agent.name} found a spot, claimed plot ${plot.plotIndex}, and started building a ${buildingType}! 💭 "${action.reasoning}"`,
      };
    }

    // Nothing affordable — sell reserve or rest
    if (agent.reserveBalance > 10) {
      const sellAction: AgentAction = { ...action, type: 'buy_arena', reasoning: `[REDIRECT] No affordable plots. Selling reserve for $ARENA.`, details: { amountIn: Math.min(50, agent.reserveBalance), why: 'Need funds', nextAction: 'claim_plot' } };
      console.log(`[AgentLoop] ${agent.name}: no affordable plots → buy_arena`);
      const result = await this.executeBuyArena(agent, sellAction, obs);
      return { ...result, actualAction: sellAction };
    }
    return { success: true, narrative: `${agent.name} has no affordable options and no reserve. 💤 Waiting...`, actualAction: { ...action, type: 'rest', reasoning: '[REDIRECT] Completely broke', details: {} } };
  }

  private async executeDoWork(agent: ArenaAgent, action: AgentAction, obs: WorldObservation) {
    if (!obs.town) throw new Error('No active town');

    // --- Intent-based resolution: agent wants to WORK, system finds the right plot ---
    let plotId: string | undefined;

    // 1. Try to resolve by plotIndex/plotId
    const rawId = action.details.plotId;
    const plotIndex = action.details.plotIndex ?? rawId;
    if (plotIndex !== undefined) {
      const plot = (obs.town as any).plots?.find((p: any) => p.plotIndex === Number(plotIndex));
      if (plot && plot.status === 'UNDER_CONSTRUCTION') plotId = plot.id;
    }
    if (!plotId && rawId && String(rawId).length >= 10) {
      // Check if it's actually UC
      const plot = (obs.town as any).plots?.find((p: any) => p.id === rawId && p.status === 'UNDER_CONSTRUCTION');
      if (plot) plotId = plot.id;
    }

    // 2. Fallback: find any UC plot owned by this agent
    if (!plotId) {
      const myBuilding = obs.myPlots.filter((p: any) => p.status === 'UNDER_CONSTRUCTION');
      if (myBuilding.length > 0) plotId = myBuilding[0].id;
    }

    // 3. If agent has CLAIMED plots but none UC, auto-start build on the claimed plot
    if (!plotId) {
      const myClaimed = obs.myPlots.filter((p: any) => p.status === 'CLAIMED');
      if (myClaimed.length > 0) {
        const claimedPlot = myClaimed[0];
        const bt = action.details.buildingType || action.details.stepDescription || 'Workshop';
        console.log(`[AgentLoop] ${agent.name}: auto-starting build on claimed plot ${claimedPlot.plotIndex} before work`);
        await townService.startBuild(agent.id, claimedPlot.id, bt);
        plotId = claimedPlot.id;
      }
    }

    // 4. If agent has no plots at all, auto-claim + start build
    if (!plotId && obs.availablePlots.length > 0) {
      const avail = obs.availablePlots[0];
      const bt = action.details.buildingType || action.details.stepDescription || 'Workshop';
      console.log(`[AgentLoop] ${agent.name}: auto-claiming plot ${avail.plotIndex} and starting build for work`);
      await townService.claimPlot(agent.id, obs.town.id, avail.plotIndex);
      await townService.startBuild(agent.id, avail.id, bt);
      plotId = avail.id;
    }

    if (!plotId) {
      // No plot to work on — try to work on ANY UC plot in town (not just own)
      const anyUC = (obs.town as any).plots?.find((p: any) => p.status === 'UNDER_CONSTRUCTION');
      if (anyUC) {
        plotId = anyUC.id;
        console.log(`[AgentLoop] ${agent.name}: no own plots, volunteering on plot ${anyUC.plotIndex}`);
      } else {
        // Truly nothing to work on — rest with narrative
        return {
          success: true,
          narrative: `${agent.name} wants to work but there are no buildings under construction. 💤 Resting and conserving energy.`,
          actualAction: { ...action, type: 'rest' as const, reasoning: '[REDIRECT] No UC plots in town', details: {} },
        };
      }
    }

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

    // Fix 5: Small reward for doing work — extracted from pool, not thin air
    let workReward = 0;
    try {
      const pool = await prisma.economyPool.findFirst({ orderBy: { createdAt: 'desc' } });
      if (pool && pool.arenaBalance > 1000) {
        await prisma.economyPool.update({ where: { id: pool.id }, data: { arenaBalance: { decrement: 1 } } });
        await prisma.arenaAgent.update({ where: { id: agent.id }, data: { bankroll: { increment: 1 } } });
        workReward = 1;
      }
    } catch {}

    const rewardNote = workReward > 0 ? ' and earned 1 $ARENA' : '';
    return {
      success: true,
      narrative: `${agent.name} worked on their ${bt} (step ${currentStep + 1}/${steps.length})${rewardNote}. 🔨 ${response.content.substring(0, 150)}...`,
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

    // --- Smart redirect: check if plot actually has enough work done ---
    const preCheck = await prisma.plot.findUnique({ where: { id: plotId } });
    if (preCheck && preCheck.status === 'UNDER_CONSTRUCTION') {
      const bt = preCheck.buildingType || '';
      const legacyReqs: any = { HOUSE: 3, APARTMENT: 5, TAVERN: 5, SHOP: 4, MARKET: 6, TOWN_HALL: 8, LIBRARY: 6, WORKSHOP: 4, FARM: 4, MINE: 5, ARENA: 7, PARK: 3, THEATER: 6 };
      const zoneMin: any = { RESIDENTIAL: 3, COMMERCIAL: 4, CIVIC: 5, INDUSTRIAL: 4, ENTERTAINMENT: 4 };
      const minCalls = legacyReqs[bt] || zoneMin[preCheck.zone] || 3;
      if (preCheck.apiCallsUsed < minCalls) {
        const workAction: AgentAction = { ...action, type: 'do_work', reasoning: `[REDIRECT] Plot needs ${minCalls - preCheck.apiCallsUsed} more work calls before completion (${preCheck.apiCallsUsed}/${minCalls}). Working instead.`, details: { ...action.details, plotId } };
        console.log(`[AgentLoop] ${agent.name}: complete_build redirect → do_work (${preCheck.apiCallsUsed}/${minCalls} calls on plot ${preCheck.plotIndex})`);
        const result = await this.executeDoWork(agent, workAction, obs);
        return { ...result, actualAction: workAction };
      }
    }

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

    // === QUALITY EVALUATION: Judge the building's design ===
    let qualityNote = '';
    try {
      const workLogs = await prisma.workLog.findMany({
        where: { agentId: agent.id, plotId: plotId, workType: { in: ['BUILD', 'DESIGN'] } },
        orderBy: { createdAt: 'asc' },
        select: { output: true },
      });
      // Also include any work logs linked to this plot's town
      const extraLogs = await prisma.workLog.findMany({
        where: { agentId: agent.id, townId: plot.townId, description: { contains: String(plot.plotIndex) } },
        orderBy: { createdAt: 'asc' },
        select: { output: true },
        take: 10,
      });
      const allContent = [...workLogs, ...extraLogs].map(w => w.output).filter(Boolean).join('\n\n---\n\n');
      
      if (allContent.length > 50) {
        const judgeSpec = smartAiService.getModelSpec(agent.modelId); // use same cheap model
        const judgeResponse = await smartAiService.callModel(
          judgeSpec,
          [
            { role: 'system', content: `You are a harsh architecture critic. Rate this AI-designed building 1-10. Most buildings are 4-6. Only truly exceptional work gets 8+. Truly terrible gets 1-3. Return JSON only: {"score": <number 1-10>, "review": "<one brutal sentence>"}` },
            { role: 'user', content: `Building: "${plot.buildingType}" in ${plot.zone} zone.\n\nDesign work:\n${allContent.substring(0, 3000)}` },
          ],
          0.3,
        );
        const parsed = JSON.parse(judgeResponse.content.replace(/```json?\s*/g, '').replace(/```/g, '').trim());
        const score = Math.max(1, Math.min(10, Math.round(Number(parsed.score) || 5)));
        const review = String(parsed.review || '').substring(0, 200);
        
        // Store on plot
        await prisma.plot.update({
          where: { id: plotId },
          data: { qualityScore: score, qualityReview: review } as any,
        });
        
        // Adjust town yield based on quality
        const town = await prisma.town.findUnique({ where: { id: plot.townId } });
        if (town) {
          let yieldDelta = 0;
          if (score >= 8) yieldDelta = 3;
          else if (score >= 7) yieldDelta = 2;
          else if (score <= 3) yieldDelta = -2;
          else if (score <= 4) yieldDelta = -1;
          if (yieldDelta !== 0) {
            await prisma.town.update({
              where: { id: plot.townId },
              data: { yieldPerTick: Math.max(1, town.yieldPerTick + yieldDelta) },
            });
          }
        }
        
        qualityNote = ` 🏆 Quality: ${score}/10 — "${review}"`;
        console.log(`[AgentLoop] Building quality: ${plot.buildingType} scored ${score}/10`);
      }
    } catch (err: any) {
      console.error(`[AgentLoop] Quality eval failed: ${err.message}`);
    }

    // === BOUNTY CHECK: Did this completion claim a bounty? ===
    let bountyNote = '';
    try {
      const bounty = worldEventService.getActiveBounty();
      if (bounty && (!bounty.townId || bounty.townId === plot.townId)) {
        // Claim the bounty!
        worldEventService.claimBounty();
        await prisma.arenaAgent.update({ where: { id: agent.id }, data: { bankroll: { increment: bounty.bonus } } });
        bountyNote = ` 🎯 BOUNTY CLAIMED: +${bounty.bonus} $ARENA!`;
        console.log(`[AgentLoop] ${agent.name} claimed construction bounty: +${bounty.bonus} $ARENA`);
      }
    } catch {}

    return {
      success: true,
      narrative: `${agent.name} completed their ${plot.buildingType}! 🎉 The building stands proud in the town.${qualityNote}${bountyNote}`,
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

  private async executeTransferArena(agent: ArenaAgent, action: AgentAction, obs: WorldObservation) {
    const targetName = String(action.details.targetAgentName || '').trim();
    const amount = Math.max(1, Math.floor(Number(action.details.amount || 0)));
    const reason = String(action.details.reason || '').trim();
    if (!targetName) throw new Error('No targetAgentName specified');
    const target = obs.otherAgents.find((a: any) => a.name.toLowerCase() === targetName.toLowerCase());
    if (!target) throw new Error(`Agent "${targetName}" not found`);
    await townService.transferArena(agent.id, target.id, amount);
    return {
      success: true,
      narrative: `${agent.name} transferred ${amount} $ARENA to ${target.name}. 💸 ${reason || action.reasoning}`,
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
      case 'transfer_arena': return 'TRADE';
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
      case 'transfer_arena': return '💸';
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
