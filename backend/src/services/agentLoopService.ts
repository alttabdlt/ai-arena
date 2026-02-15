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

import { ArenaAgent, ArenaGameType, TownEventType } from '@prisma/client';
import { prisma } from '../config/database';
import { townService } from './townService';
import { smartAiService, AICost } from './smartAiService';
import { offchainAmmService } from './offchainAmmService';
import { arenaService } from './arenaService';
import { x402SkillService, estimateSkillPriceArena, type BuySkillRequest, type X402SkillName } from './x402SkillService';
import { socialGraphService } from './socialGraphService';
import { agentGoalService, type AgentGoalView } from './agentGoalService';
import { agentGoalTrackService, type GoalStackSnapshot, type PersistentGoalView } from './agentGoalTrackService';
import { worldEventService } from './worldEventService';
import { agentCommandService, type AgentCommandView } from './agentCommandService';
import { wheelOfFateService } from './wheelOfFateService';

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

const MAX_REASONING_PERSIST_CHARS = 6000;
const MAX_NARRATIVE_PERSIST_CHARS = 2500;
const MAX_MEMORY_REASON_CHARS = 260;
const MAX_MEMORY_CALC_CHARS = 420;
const SOFT_POLICY_WINDOW = 24;
const SOFT_POLICY_MAX_OVERRIDE_RATE = 0.4;
const SOLVENCY_RESCUE_TRIGGER_BANKROLL = 35;
const SOLVENCY_RESCUE_TRIGGER_RESERVE = 5;
const SOLVENCY_RESCUE_ARENA = 30;
const SOLVENCY_RESCUE_COOLDOWN_TICKS = 3;
const SOLVENCY_RESCUE_HEALTH_BUMP = 3;
const SOLVENCY_RESCUE_WINDOW_TICKS = 16;
const SOLVENCY_RESCUE_MAX_PER_WINDOW = 2;
const SOLVENCY_RESCUE_REPAYMENT_BPS = 2500;
const SOLVENCY_RESCUE_REPAYMENT_FLOOR = 90;
const SOLVENCY_POOL_FLOOR = 1000;
const ARENA_MIN_WAGER = 10;
const ARENA_TURBO_MAX_ACTIONS = 14;
const ECONOMY_INIT_RESERVE = Number.parseInt(process.env.ECONOMY_INIT_RESERVE || '10000', 10);
const ECONOMY_INIT_ARENA = Number.parseInt(process.env.ECONOMY_INIT_ARENA || '10000', 10);
const ECONOMY_INIT_FEE_BPS = Number.parseInt(process.env.ECONOMY_FEE_BPS || '100', 10);

type PolicyTier = 'hard_safety' | 'economic_warning' | 'strategy_nudge';

interface PolicyNote {
  tier: PolicyTier;
  code: string;
  message: string;
  applied: boolean;
}

interface PolicyContext {
  notes: PolicyNote[];
  softPolicyEnabled: boolean;
  softPolicyApplied: boolean;
  autonomyRateBefore: number;
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
  tick: number;
  agentId: string;
  agentName: string;
  archetype: string;
  action: AgentAction;
  success: boolean;
  narrative: string; // Human-readable description for Telegram
  cost: AICost | null;
  error?: string;
  /** Telegram chat IDs that sent instructions this tick — for reply routing */
  instructionSenders?: { chatId: string; fromUser: string }[];
  /** Direct reply from agent to human operators (in-character) */
  humanReply?: string;
  /** Structured command receipt for owner/operator command execution */
  commandReceipt?: {
    commandId: string;
    mode: AgentCommandView['mode'];
    intent: string;
    expectedActionType: string | null;
    executedActionType: string | null;
    compliance: 'FULL' | 'PARTIAL';
    status: 'EXECUTED' | 'REJECTED';
    statusReason: string;
    notifyChatId?: string;
  };
}

type ExecutionResult = {
  success: boolean;
  narrative: string;
  error?: string;
  actualAction?: AgentAction;
};

export type AgentLoopMode = 'DEFAULT' | 'DEGEN_LOOP';
export type ManualActionKind = 'build' | 'work' | 'fight' | 'trade' | 'rest';
export type ManualActionPlan =
  | {
      ok: true;
      action: ManualActionKind;
      intent: string;
      params: Record<string, unknown>;
      note: string;
    }
  | {
      ok: false;
      action: ManualActionKind;
      reasonCode: string;
      reason: string;
    };
type DegenLoopNudge = 'build' | 'work' | 'fight' | 'trade';

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

  // User instructions queue — Telegram users can tell agents what to do
  // Map<agentId, { text: string, chatId: string, fromUser: string }[]>
  private pendingInstructions: Map<string, { text: string; chatId: string; fromUser: string }[]> = new Map();

  /** Queue a user instruction for an agent. Will be injected into next LLM tick. */
  queueInstruction(agentId: string, text: string, chatId: string, fromUser: string): void {
    const queue = this.pendingInstructions.get(agentId) || [];
    queue.push({ text: text.slice(0, 500), chatId, fromUser });
    // Keep only last 3 instructions per agent
    if (queue.length > 3) queue.splice(0, queue.length - 3);
    this.pendingInstructions.set(agentId, queue);
  }

  /** Pop all pending instructions for an agent (consumed on tick) */
  popInstructions(agentId: string): { text: string; chatId: string; fromUser: string }[] {
    const queue = this.pendingInstructions.get(agentId) || [];
    this.pendingInstructions.delete(agentId);
    return queue;
  }

  private getOverrideRate(agentId: string): number {
    const history = this.overrideHistoryByAgentId.get(agentId) || [];
    if (history.length === 0) return 0;
    const overrides = history.filter(Boolean).length;
    return overrides / history.length;
  }

  private recordOverrideOutcome(agentId: string, overridden: boolean): number {
    const history = this.overrideHistoryByAgentId.get(agentId) || [];
    history.push(overridden);
    const trimmed = history.slice(-SOFT_POLICY_WINDOW);
    this.overrideHistoryByAgentId.set(agentId, trimmed);
    const overrides = trimmed.filter(Boolean).length;
    return trimmed.length > 0 ? overrides / trimmed.length : 0;
  }
  private currentTick: number = 0;
  public onTickResult?: (result: AgentTickResult) => void; // Hook for broadcasting
  private lastTradeTickByAgentId: Map<string, number> = new Map();
  private overrideHistoryByAgentId: Map<string, boolean[]> = new Map();
  private loopModeByAgentId: Map<string, AgentLoopMode> = new Map();
  private lastRescueTickByAgentId: Map<string, number> = new Map();
  private rescueDebtByAgentId: Map<string, number> = new Map();
  private rescueWindowByAgentId: Map<string, { windowStartTick: number; rescues: number }> = new Map();
  private nonRestStreakByAgentId: Map<
    string,
    { current: number; best: number; lastRewardedMilestone: number }
  > = new Map();

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

  setLoopMode(agentId: string, mode: AgentLoopMode): AgentLoopMode {
    const normalizedId = String(agentId || '').trim();
    if (!normalizedId) throw new Error('agentId is required');
    if (mode === 'DEFAULT') {
      this.loopModeByAgentId.delete(normalizedId);
      return 'DEFAULT';
    }
    this.loopModeByAgentId.set(normalizedId, mode);
    return mode;
  }

  getLoopMode(agentId: string): AgentLoopMode {
    const normalizedId = String(agentId || '').trim();
    if (!normalizedId) return 'DEFAULT';
    return this.loopModeByAgentId.get(normalizedId) || 'DEFAULT';
  }

  async planDeterministicAction(agentId: string, action: ManualActionKind): Promise<ManualActionPlan> {
    const normalizedId = safeTrim(agentId, 120);
    const normalizedAction = String(action || '').toLowerCase().trim() as ManualActionKind;

    if (!normalizedId) {
      return {
        ok: false,
        action: normalizedAction || 'rest',
        reasonCode: 'TARGET_UNAVAILABLE',
        reason: 'agentId is required',
      };
    }

    if (!['build', 'work', 'fight', 'trade', 'rest'].includes(normalizedAction)) {
      return {
        ok: false,
        action: normalizedAction || 'rest',
        reasonCode: 'INVALID_INTENT',
        reason: `Unsupported action "${action}"`,
      };
    }

    const agent = await prisma.arenaAgent.findUnique({ where: { id: normalizedId } });
    if (!agent || !agent.isActive) {
      return {
        ok: false,
        action: normalizedAction,
        reasonCode: 'TARGET_UNAVAILABLE',
        reason: 'Agent is unavailable',
      };
    }

    const obs = await this.observe(agent);
    const myUnderConstruction = (obs.myPlots || []).filter((plot: any) => plot?.status === 'UNDER_CONSTRUCTION');
    const myClaimed = (obs.myPlots || []).filter((plot: any) => plot?.status === 'CLAIMED');
    const available = obs.availablePlots || [];

    if (normalizedAction === 'rest') {
      return {
        ok: true,
        action: normalizedAction,
        intent: 'rest',
        params: {
          thought: 'Holding position by explicit operator request.',
        },
        note: 'Manual rest command',
      };
    }

    if (normalizedAction === 'fight') {
      const wheel = wheelOfFateService.getStatus();
      return {
        ok: true,
        action: normalizedAction,
        intent: 'play_arena',
        params: {
          gameType: wheel.currentMatch?.gameType || 'POKER',
          wager: wheel.currentMatch?.wager || 25,
        },
        note: 'Manual fight command',
      };
    }

    if (normalizedAction === 'work') {
      if (myUnderConstruction.length === 0) {
        return {
          ok: false,
          action: normalizedAction,
          reasonCode: 'CONSTRAINT_VIOLATION',
          reason: 'No active construction to work on',
        };
      }
      const target = [...myUnderConstruction].sort(
        (a: any, b: any) => Number(b?.apiCallsUsed || 0) - Number(a?.apiCallsUsed || 0),
      )[0];
      return {
        ok: true,
        action: normalizedAction,
        intent: 'do_work',
        params: {
          plotId: target.id,
          plotIndex: target.plotIndex,
          stepDescription: 'Manual WORK command: push construction throughput.',
        },
        note: `Manual work command on plot ${target.plotIndex}`,
      };
    }

    if (normalizedAction === 'build') {
      if (myUnderConstruction.length > 0) {
        const target = [...myUnderConstruction].sort(
          (a: any, b: any) => Number(b?.apiCallsUsed || 0) - Number(a?.apiCallsUsed || 0),
        )[0];
        return {
          ok: true,
          action: normalizedAction,
          intent: 'do_work',
          params: {
            plotId: target.id,
            plotIndex: target.plotIndex,
            stepDescription: 'Manual BUILD command: continue active construction.',
          },
          note: `Manual build command mapped to do_work on plot ${target.plotIndex}`,
        };
      }

      if (myClaimed.length > 0) {
        const target = myClaimed[0];
        return {
          ok: true,
          action: normalizedAction,
          intent: 'start_build',
          params: {
            plotId: target.id,
            plotIndex: target.plotIndex,
            buildingType: this.pickDegenBuildingType(target.zone),
            why: 'Manual BUILD command',
          },
          note: `Manual build command mapped to start_build on plot ${target.plotIndex}`,
        };
      }

      const claimTarget = this.pickDegenClaimTarget(available);
      if (!claimTarget || !Number.isFinite(Number(claimTarget.plotIndex))) {
        return {
          ok: false,
          action: normalizedAction,
          reasonCode: 'TARGET_UNAVAILABLE',
          reason: 'No claimable plots available for bootstrap build',
        };
      }
      const claimCost = this.estimateClaimCost(obs);
      if (obs.myBalance < claimCost) {
        return {
          ok: false,
          action: normalizedAction,
          reasonCode: 'INSUFFICIENT_ARENA',
          reason: `Need about ${claimCost} $ARENA to claim first plot`,
        };
      }
      return {
        ok: true,
        action: normalizedAction,
        intent: 'claim_plot',
        params: {
          plotIndex: Number(claimTarget.plotIndex),
          why: 'Manual BUILD bootstrap claim',
        },
        note: `Manual build bootstrap claim on plot ${claimTarget.plotIndex}`,
      };
    }

    if (obs.myReserve >= 12 && obs.myBalance <= 130) {
      return {
        ok: true,
        action: normalizedAction,
        intent: 'buy_arena',
        params: {
          amountIn: Math.max(10, Math.min(70, Math.floor(obs.myReserve))),
          why: 'Manual TRADE command: rotate reserve into liquid ARENA.',
          nextAction: 'play_arena',
        },
        note: 'Manual trade mapped to reserve->ARENA swap',
      };
    }
    if (obs.myBalance >= 40) {
      return {
        ok: true,
        action: normalizedAction,
        intent: 'sell_arena',
        params: {
          amountIn: Math.max(20, Math.min(80, Math.floor(obs.myBalance - 20))),
          why: 'Manual TRADE command: de-risk bankroll into reserve.',
          nextAction: 'start_build',
        },
        note: 'Manual trade mapped to ARENA->reserve swap',
      };
    }
    return {
      ok: false,
      action: normalizedAction,
      reasonCode: 'CONSTRAINT_VIOLATION',
      reason: 'No executable trade edge: reserve and bankroll are both too low',
    };
  }

  async getRescueTelemetry(limit: number = 25): Promise<{
    currentTick: number;
    totalDebt: number;
    indebtedAgents: number;
    agents: Array<{
      agentId: string;
      name: string;
      debtArena: number;
      bankroll: number;
      reserveBalance: number;
      health: number;
      lastRescueTick: number | null;
      rescuesInWindow: number;
      windowTicksRemaining: number;
      canReceiveRescueNow: boolean;
    }>;
  }> {
    const maxRows = Math.max(1, Math.min(200, Math.floor(limit || 25)));
    const debtEntries = Array.from(this.rescueDebtByAgentId.entries())
      .map(([agentId, debtArena]) => ({ agentId, debtArena: Math.max(0, Math.floor(debtArena || 0)) }))
      .filter((entry) => entry.debtArena > 0)
      .sort((a, b) => b.debtArena - a.debtArena);

    const top = debtEntries.slice(0, maxRows);
    const ids = top.map((entry) => entry.agentId);
    if (ids.length === 0) {
      return {
        currentTick: this.currentTick,
        totalDebt: 0,
        indebtedAgents: 0,
        agents: [],
      };
    }

    const rows = await prisma.arenaAgent.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, bankroll: true, reserveBalance: true, health: true },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));

    const agents = top.map((entry) => {
      const row = byId.get(entry.agentId);
      const rawWindow = this.rescueWindowByAgentId.get(entry.agentId);
      const windowActive = !!rawWindow && this.currentTick - rawWindow.windowStartTick < SOLVENCY_RESCUE_WINDOW_TICKS;
      const rescuesInWindow = windowActive ? rawWindow!.rescues : 0;
      const windowTicksRemaining = windowActive
        ? Math.max(0, SOLVENCY_RESCUE_WINDOW_TICKS - (this.currentTick - rawWindow!.windowStartTick))
        : 0;

      const bankroll = row?.bankroll ?? 0;
      const reserveBalance = row?.reserveBalance ?? 0;
      const health = row?.health ?? 100;

      return {
        agentId: entry.agentId,
        name: row?.name || 'Unknown',
        debtArena: entry.debtArena,
        bankroll,
        reserveBalance,
        health,
        lastRescueTick: this.lastRescueTickByAgentId.get(entry.agentId) ?? null,
        rescuesInWindow,
        windowTicksRemaining,
        canReceiveRescueNow: this.canIssueSolvencyRescue({
          id: entry.agentId,
          bankroll,
          reserveBalance,
          health,
        } as Pick<ArenaAgent, 'id' | 'bankroll' | 'reserveBalance' | 'health'>),
      };
    });

    return {
      currentTick: this.currentTick,
      totalDebt: debtEntries.reduce((sum, entry) => sum + entry.debtArena, 0),
      indebtedAgents: debtEntries.length,
      agents,
    };
  }

  async getEconomyMetrics(limit: number = 250): Promise<{
    currentTick: number;
    sampleSize: number;
    actionMix: Record<string, number>;
    restRate: number;
    nonRestRate: number;
    positiveDeltaHitRate: number;
    medianTicksToFirstPositiveDelta: number | null;
    commandReceipts: {
      queued: number;
      accepted: number;
      executed: number;
      rejected: number;
      expired: number;
      cancelled: number;
      executionRate: number;
      rejectRate: number;
    };
    rescue: {
      totalDebt: number;
      indebtedAgents: number;
      topAgents: Array<{ agentId: string; name: string; debtArena: number; rescuesInWindow: number }>;
    };
    pool: {
      spotPrice: number | null;
      feeBps: number | null;
      reserveBalance: number | null;
      arenaBalance: number | null;
    };
    warnings: string[];
  }> {
    const maxRows = Math.max(50, Math.min(1000, Math.floor(limit || 250)));
    const events = await prisma.townEvent.findMany({
      where: { agentId: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: maxRows,
      select: {
        agentId: true,
        metadata: true,
      },
    });

    const actionRows: Array<{ agentId: string; action: string; tick: number | null; arenaDelta: number }> = [];
    for (const row of events) {
      try {
        const parsed = JSON.parse(row.metadata || '{}') as Record<string, any>;
        const action = safeTrim(parsed?.action, 64);
        if (!action) continue;
        const tickRaw = Number(parsed?.decision?.tick);
        const arenaDeltaRaw = Number(parsed?.decision?.economyDelta?.arenaDelta);
        const tick = Number.isFinite(tickRaw) ? Math.max(0, Math.round(tickRaw)) : null;
        const arenaDelta = Number.isFinite(arenaDeltaRaw) ? Math.round(arenaDeltaRaw) : 0;
        actionRows.push({
          agentId: String(row.agentId || ''),
          action,
          tick,
          arenaDelta,
        });
      } catch {
        // Ignore malformed metadata
      }
    }

    const actionMix: Record<string, number> = {};
    for (const row of actionRows) {
      actionMix[row.action] = (actionMix[row.action] || 0) + 1;
    }
    const actionCount = actionRows.length;
    const restCount = actionMix.rest || 0;
    const nonRestRate = actionCount > 0 ? (actionCount - restCount) / actionCount : 0;
    const restRate = actionCount > 0 ? restCount / actionCount : 0;

    const rowsByAgent = new Map<string, Array<{ tick: number | null; arenaDelta: number }>>();
    for (const row of actionRows) {
      if (!row.agentId) continue;
      const list = rowsByAgent.get(row.agentId) || [];
      list.push({ tick: row.tick, arenaDelta: row.arenaDelta });
      rowsByAgent.set(row.agentId, list);
    }

    const firstPositiveDurations: number[] = [];
    for (const rows of rowsByAgent.values()) {
      const ordered = [...rows].sort((a, b) => {
        const at = a.tick ?? Number.MAX_SAFE_INTEGER;
        const bt = b.tick ?? Number.MAX_SAFE_INTEGER;
        return at - bt;
      });
      if (ordered.length === 0) continue;
      const baselineTick = ordered.find((r) => r.tick != null)?.tick ?? 0;
      const firstPositive = ordered.find((r) => r.arenaDelta > 0 && r.tick != null);
      if (!firstPositive || firstPositive.tick == null) continue;
      firstPositiveDurations.push(Math.max(0, firstPositive.tick - baselineTick));
    }
    const sortedDurations = [...firstPositiveDurations].sort((a, b) => a - b);
    const medianTicksToFirstPositiveDelta =
      sortedDurations.length === 0
        ? null
        : sortedDurations.length % 2 === 1
          ? sortedDurations[(sortedDurations.length - 1) / 2]
          : Math.round(
              (sortedDurations[sortedDurations.length / 2 - 1] + sortedDurations[sortedDurations.length / 2]) / 2,
            );
    const positiveDeltaHitRate = rowsByAgent.size > 0 ? firstPositiveDurations.length / rowsByAgent.size : 0;

    const commandRows = await prisma.agentCommand.findMany({
      orderBy: { createdAt: 'desc' },
      take: maxRows,
      select: { status: true },
    });
    const commandReceipts = {
      queued: 0,
      accepted: 0,
      executed: 0,
      rejected: 0,
      expired: 0,
      cancelled: 0,
      executionRate: 0,
      rejectRate: 0,
    };
    for (const cmd of commandRows) {
      if (cmd.status === 'QUEUED') commandReceipts.queued += 1;
      else if (cmd.status === 'ACCEPTED') commandReceipts.accepted += 1;
      else if (cmd.status === 'EXECUTED') commandReceipts.executed += 1;
      else if (cmd.status === 'REJECTED') commandReceipts.rejected += 1;
      else if (cmd.status === 'EXPIRED') commandReceipts.expired += 1;
      else if (cmd.status === 'CANCELLED') commandReceipts.cancelled += 1;
    }
    const settledCommands = commandReceipts.executed + commandReceipts.rejected;
    if (settledCommands > 0) {
      commandReceipts.executionRate = commandReceipts.executed / settledCommands;
      commandReceipts.rejectRate = commandReceipts.rejected / settledCommands;
    }

    const rescueSnapshot = await this.getRescueTelemetry(10);
    const pool = await offchainAmmService.getPoolSummary().catch(() => null);

    const warnings: string[] = [];
    if (nonRestRate < 0.8) warnings.push(`non_rest_rate low (${(nonRestRate * 100).toFixed(1)}%)`);
    if (commandReceipts.rejectRate > 0.25) warnings.push(`command reject rate elevated (${(commandReceipts.rejectRate * 100).toFixed(1)}%)`);
    if (rescueSnapshot.totalDebt > 200) warnings.push(`rescue debt elevated (${rescueSnapshot.totalDebt} ARENA)`);
    if ((pool?.arenaBalance || 0) < SOLVENCY_POOL_FLOOR + 200) warnings.push('pool arena balance near solvency floor');

    return {
      currentTick: this.currentTick,
      sampleSize: actionCount,
      actionMix,
      restRate,
      nonRestRate,
      positiveDeltaHitRate,
      medianTicksToFirstPositiveDelta,
      commandReceipts,
      rescue: {
        totalDebt: rescueSnapshot.totalDebt,
        indebtedAgents: rescueSnapshot.indebtedAgents,
        topAgents: rescueSnapshot.agents.map((agent) => ({
          agentId: agent.agentId,
          name: agent.name,
          debtArena: agent.debtArena,
          rescuesInWindow: agent.rescuesInWindow,
        })),
      },
      pool: {
        spotPrice: pool?.spotPrice ?? null,
        feeBps: pool?.feeBps ?? null,
        reserveBalance: pool?.reserveBalance ?? null,
        arenaBalance: pool?.arenaBalance ?? null,
      },
      warnings,
    };
  }

  private getOrInitStreak(agentId: string): { current: number; best: number; lastRewardedMilestone: number } {
    const existing = this.nonRestStreakByAgentId.get(agentId);
    if (existing) return existing;
    const seed = { current: 0, best: 0, lastRewardedMilestone: 0 };
    this.nonRestStreakByAgentId.set(agentId, seed);
    return seed;
  }

  private nextStreakMilestone(current: number): { streak: number; bonusArena: number } | null {
    const milestones: Array<{ streak: number; bonusArena: number }> = [
      { streak: 3, bonusArena: 6 },
      { streak: 5, bonusArena: 10 },
      { streak: 8, bonusArena: 14 },
      { streak: 13, bonusArena: 20 },
    ];
    return milestones.find((m) => m.streak === current) || null;
  }

  private async applyRetentionHooks(
    agent: Pick<ArenaAgent, 'id' | 'name'>,
    actionType: AgentAction['type'],
  ): Promise<{ currentNonRestStreak: number; bestNonRestStreak: number; milestoneStreak: number | null; bonusArena: number }> {
    const streak = this.getOrInitStreak(agent.id);

    if (actionType === 'rest') {
      streak.current = 0;
      streak.lastRewardedMilestone = 0;
      this.nonRestStreakByAgentId.set(agent.id, streak);
      return {
        currentNonRestStreak: streak.current,
        bestNonRestStreak: streak.best,
        milestoneStreak: null,
        bonusArena: 0,
      };
    }

    streak.current += 1;
    if (streak.current > streak.best) streak.best = streak.current;

    const milestone = this.nextStreakMilestone(streak.current);
    if (!milestone || milestone.streak <= streak.lastRewardedMilestone) {
      this.nonRestStreakByAgentId.set(agent.id, streak);
      return {
        currentNonRestStreak: streak.current,
        bestNonRestStreak: streak.best,
        milestoneStreak: null,
        bonusArena: 0,
      };
    }

    let granted = 0;
    try {
      const pool = await this.getOrCreateEconomyPool();
      const available = Math.max(0, pool.arenaBalance - SOLVENCY_POOL_FLOOR);
      granted = Math.max(0, Math.min(milestone.bonusArena, available));
      if (granted > 0) {
        await prisma.$transaction(async (tx) => {
          await tx.economyPool.update({
            where: { id: pool.id },
            data: { arenaBalance: { decrement: granted } },
          });
          await tx.arenaAgent.update({
            where: { id: agent.id },
            data: { bankroll: { increment: granted } },
          });
        });
      }
    } catch {
      granted = 0;
    }

    if (granted > 0) {
      streak.lastRewardedMilestone = milestone.streak;
      console.log(`[AgentLoop] ${agent.name} streak milestone x${milestone.streak}: +${granted} $ARENA`);
    }
    this.nonRestStreakByAgentId.set(agent.id, streak);

    return {
      currentNonRestStreak: streak.current,
      bestNonRestStreak: streak.best,
      milestoneStreak: granted > 0 ? milestone.streak : null,
      bonusArena: granted,
    };
  }

  async getRetentionSnapshot(agentId: string): Promise<{
    agentId: string;
    name: string;
    currentTick: number;
    streak: {
      currentNonRest: number;
      bestNonRest: number;
      nextMilestone: number | null;
      nextMilestoneBonusArena: number;
    };
    rivals: Array<{ agentId: string; name: string; score: number; since: string | null }>;
    friends: Array<{ agentId: string; name: string; score: number; since: string | null }>;
    goals: {
      active: number;
      completedRecent: number;
      failedRecent: number;
      topActive: Array<{ id: string; horizon: string; title: string; progressLabel: string; deadlineTick: number | null }>;
    };
  }> {
    const agent = await prisma.arenaAgent.findUnique({
      where: { id: agentId },
      select: { id: true, name: true },
    });
    if (!agent) throw new Error('Agent not found');

    const relationships = await socialGraphService.listRelationships(agent.id).catch(() => ({
      maxFriends: 5,
      friends: [],
      rivals: [],
    }));

    const goalHistory = await agentGoalTrackService.getAgentGoalHistory(agent.id, 40);
    const activeGoals = goalHistory.filter((goal) => goal.status === 'ACTIVE');
    const completedRecent = goalHistory.filter((goal) => goal.status === 'COMPLETED').length;
    const failedRecent = goalHistory.filter((goal) => goal.status === 'FAILED').length;

    const streak = this.getOrInitStreak(agent.id);
    const upcomingMilestones = [
      { streak: 3, bonusArena: 6 },
      { streak: 5, bonusArena: 10 },
      { streak: 8, bonusArena: 14 },
      { streak: 13, bonusArena: 20 },
    ];
    const nextMilestone = upcomingMilestones.find((m) => m.streak > streak.current) || null;

    return {
      agentId: agent.id,
      name: agent.name,
      currentTick: this.currentTick,
      streak: {
        currentNonRest: streak.current,
        bestNonRest: streak.best,
        nextMilestone: nextMilestone?.streak ?? null,
        nextMilestoneBonusArena: nextMilestone?.bonusArena ?? 0,
      },
      rivals: (relationships.rivals || []).slice(0, 3).map((rival) => ({
        agentId: rival.agentId,
        name: rival.name,
        score: rival.score,
        since: rival.since,
      })),
      friends: (relationships.friends || []).slice(0, 3).map((friend) => ({
        agentId: friend.agentId,
        name: friend.name,
        score: friend.score,
        since: friend.since,
      })),
      goals: {
        active: activeGoals.length,
        completedRecent,
        failedRecent,
        topActive: activeGoals.slice(0, 3).map((goal) => ({
          id: goal.id,
          horizon: goal.horizon,
          title: goal.title,
          progressLabel: goal.lastProgressLabel || `${goal.progressValue}/${goal.targetValue}`,
          deadlineTick: goal.deadlineTick ?? null,
        })),
      },
    };
  }

  private async getOrCreateEconomyPool(tx: any = prisma): Promise<{ id: string; reserveBalance: number; arenaBalance: number; feeBps: number }> {
    const existing = await tx.economyPool.findFirst({ orderBy: { createdAt: 'desc' } });
    if (existing) return existing;
    return tx.economyPool.create({
      data: {
        reserveBalance: Math.max(1000, Math.floor(ECONOMY_INIT_RESERVE) || 10000),
        arenaBalance: Math.max(1000, Math.floor(ECONOMY_INIT_ARENA) || 10000),
        feeBps: Math.max(0, Math.min(1000, Math.floor(ECONOMY_INIT_FEE_BPS) || 100)),
      },
    });
  }

  private getRescueDebt(agentId: string): number {
    return Math.max(0, Math.floor(this.rescueDebtByAgentId.get(agentId) || 0));
  }

  private setRescueDebt(agentId: string, amount: number): void {
    const normalized = Math.max(0, Math.floor(amount || 0));
    if (normalized <= 0) {
      this.rescueDebtByAgentId.delete(agentId);
      return;
    }
    this.rescueDebtByAgentId.set(agentId, normalized);
  }

  private getRescueWindowState(agentId: string): { windowStartTick: number; rescues: number } {
    const existing = this.rescueWindowByAgentId.get(agentId);
    if (!existing || this.currentTick - existing.windowStartTick >= SOLVENCY_RESCUE_WINDOW_TICKS) {
      return { windowStartTick: this.currentTick, rescues: 0 };
    }
    return existing;
  }

  private recordRescueIssue(agentId: string, grant: number): { rescuesInWindow: number; outstandingDebt: number } {
    const state = this.getRescueWindowState(agentId);
    const nextState = {
      windowStartTick: state.windowStartTick,
      rescues: state.rescues + 1,
    };
    this.rescueWindowByAgentId.set(agentId, nextState);

    const nextDebt = this.getRescueDebt(agentId) + Math.max(0, Math.floor(grant || 0));
    this.setRescueDebt(agentId, nextDebt);
    return {
      rescuesInWindow: nextState.rescues,
      outstandingDebt: nextDebt,
    };
  }

  private async applyRescueDebtRepayment(agent: Pick<ArenaAgent, 'id' | 'name' | 'bankroll'>): Promise<number> {
    const debt = this.getRescueDebt(agent.id);
    if (debt <= 0) return 0;

    const initialRepayable = Math.max(0, agent.bankroll - SOLVENCY_RESCUE_REPAYMENT_FLOOR);
    if (initialRepayable <= 0) return 0;

    const repaid = await prisma.$transaction(async (tx) => {
      const fresh = await tx.arenaAgent.findUnique({
        where: { id: agent.id },
        select: { bankroll: true },
      });
      if (!fresh) return 0;

      const liveDebt = this.getRescueDebt(agent.id);
      if (liveDebt <= 0) return 0;

      const repayable = Math.max(0, fresh.bankroll - SOLVENCY_RESCUE_REPAYMENT_FLOOR);
      if (repayable <= 0) return 0;

      const proposed = Math.floor((repayable * SOLVENCY_RESCUE_REPAYMENT_BPS) / 10000);
      const repayment = Math.max(1, Math.min(liveDebt, proposed));
      if (repayment <= 0) return 0;

      const pool = await this.getOrCreateEconomyPool(tx);
      await tx.arenaAgent.update({
        where: { id: agent.id },
        data: { bankroll: { decrement: repayment } },
      });
      await tx.economyPool.update({
        where: { id: pool.id },
        data: { arenaBalance: { increment: repayment } },
      });
      return repayment;
    });

    if (repaid > 0) {
      const remaining = Math.max(0, debt - repaid);
      this.setRescueDebt(agent.id, remaining);
      console.log(`[AgentLoop] ${agent.name} repaid rescue debt: -${repaid} $ARENA (remaining ${remaining})`);
    }
    return repaid;
  }

  private canIssueSolvencyRescue(agent: Pick<ArenaAgent, 'id' | 'bankroll' | 'reserveBalance' | 'health'>): boolean {
    if ((agent.health ?? 100) <= 0) return false;
    if (agent.bankroll > SOLVENCY_RESCUE_TRIGGER_BANKROLL) return false;
    if (agent.reserveBalance > SOLVENCY_RESCUE_TRIGGER_RESERVE) return false;
    const lastTick = this.lastRescueTickByAgentId.get(agent.id);
    if (lastTick != null && this.currentTick - lastTick < SOLVENCY_RESCUE_COOLDOWN_TICKS) return false;
    const rescueWindow = this.getRescueWindowState(agent.id);
    if (rescueWindow.rescues >= SOLVENCY_RESCUE_MAX_PER_WINDOW) return false;
    return true;
  }

  private async issueSolvencyRescue(agent: ArenaAgent): Promise<number> {
    if (!this.canIssueSolvencyRescue(agent)) return 0;

    const granted = await prisma.$transaction(async (tx) => {
      const fresh = await tx.arenaAgent.findUnique({
        where: { id: agent.id },
        select: { id: true, bankroll: true, reserveBalance: true, health: true },
      });
      if (!fresh || !this.canIssueSolvencyRescue(fresh)) return 0;

      const pool = await this.getOrCreateEconomyPool(tx);
      const maxGrant = Math.max(0, pool.arenaBalance - SOLVENCY_POOL_FLOOR);
      if (maxGrant <= 0) return 0;

      const grant = Math.min(SOLVENCY_RESCUE_ARENA, maxGrant);
      if (grant <= 0) return 0;

      await tx.economyPool.update({
        where: { id: pool.id },
        data: { arenaBalance: { decrement: grant } },
      });
      await tx.arenaAgent.update({
        where: { id: agent.id },
        data: {
          bankroll: { increment: grant },
          health: { increment: SOLVENCY_RESCUE_HEALTH_BUMP },
        },
      });
      return grant;
    });

    if (granted > 0) {
      this.lastRescueTickByAgentId.set(agent.id, this.currentTick);
      const debtState = this.recordRescueIssue(agent.id, granted);
      console.log(
        `[AgentLoop] ${agent.name} received solvency rescue: +${granted} $ARENA (window ${debtState.rescuesInWindow}/${SOLVENCY_RESCUE_MAX_PER_WINDOW}, debt ${debtState.outstandingDebt})`
      );
    }

    return granted;
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

      // === AUTO-CREATE TOWN: ensure agents always have somewhere to build ===
      try {
        const activeTown = await townService.getActiveTown();
        if (!activeTown) {
          const completedCount = await prisma.town.count({ where: { status: 'COMPLETE' } });
          const nextLevel = completedCount + 1;
          const townName = `Town ${nextLevel}`;
          const newTown = await townService.createTown(townName, undefined, undefined, nextLevel);
          console.log(`🏘️ [AgentLoop] Auto-created "${newTown.name}" (level ${nextLevel}, ${newTown.plots.length} plots) — no active town existed`);
          // Broadcast to Telegram if available
          if (this.onTickResult) {
            // Not a tick result, but we can log it
          }
        }
      } catch (e: any) {
        console.error(`[AgentLoop] Auto-create town failed: ${e.message}`);
      }

      // === UPKEEP: deduct survival cost from all agents ===
      const upkeepCost = Math.max(1, Math.round(1 * worldEventService.getUpkeepMultiplier()));
      for (const agent of agents) {
        try {
          let bankroll = agent.bankroll;
          let reserveBalance = agent.reserveBalance;
          let health = agent.health ?? 100;

          // Rescue low-capital agents from the pool on a cooldown so they can re-enter gameplay.
          if (this.canIssueSolvencyRescue({ id: agent.id, bankroll, reserveBalance, health })) {
            const granted = await this.issueSolvencyRescue(agent);
            if (granted > 0) {
              const refreshed = await prisma.arenaAgent.findUnique({
                where: { id: agent.id },
                select: { bankroll: true, reserveBalance: true, health: true },
              });
              if (refreshed) {
                bankroll = refreshed.bankroll;
                reserveBalance = refreshed.reserveBalance;
                health = refreshed.health ?? health;
              }
            }
          }

          if (bankroll >= upkeepCost) {
            await prisma.arenaAgent.update({ where: { id: agent.id }, data: { bankroll: { decrement: upkeepCost } } });
            bankroll = Math.max(0, bankroll - upkeepCost);
            // Upkeep goes to agent's town treasury (if assigned)
            const agentTown = await prisma.town.findFirst({ where: { plots: { some: { ownerId: agent.id } } } });
            if (agentTown) {
              await prisma.town.update({ where: { id: agentTown.id }, data: { totalInvested: { increment: upkeepCost } } });
            }
          } else if (reserveBalance > 0) {
            // Reserve holdings buy one grace tick so agents can swap next action instead of dying immediately.
            console.log(`[AgentLoop] ${agent.name} upkeep grace (${bankroll}/${upkeepCost}) — reserve ${reserveBalance} available`);
          } else {
            // Can't pay — lose health
            const hpPenalty = bankroll <= 0 && reserveBalance <= 0 ? 2 : 4;
            const newHealth = Math.max(0, health - hpPenalty);
            await prisma.arenaAgent.update({ where: { id: agent.id }, data: { health: newHealth } as any });
            console.log(`[AgentLoop] ${agent.name} can't pay upkeep (${bankroll}/${upkeepCost}) — health: ${health} → ${newHealth}`);
          }

          // If the agent recovered, automatically repay part of rescue debt to recycle liquidity.
          const repaid = await this.applyRescueDebtRepayment({
            id: agent.id,
            name: agent.name,
            bankroll,
          });
          if (repaid > 0) {
            bankroll = Math.max(0, bankroll - repaid);
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
              tick: this.currentTick,
              agentId: agent.id,
              agentName: agent.name,
              archetype: agent.archetype,
              action: { type: 'rest' as const, reasoning: `Error: ${err.message}`, details: {} },
              success: false,
              narrative: `${agent.name} encountered an error: ${err.message}`,
              cost: { model: '', inputTokens: 0, outputTokens: 0, costCents: 0, latencyMs: 0 } as AICost,
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
    let activeCommand = await agentCommandService.acceptNextCommand(agent.id, this.currentTick);
    const commandChatIdFor = (command: AgentCommandView | null | undefined): string | undefined => {
      const candidate = safeTrim((command?.auditMeta as Record<string, unknown> | undefined)?.chatId, 60);
      return candidate ? candidate : undefined;
    };

    // Pop pending user instructions NOW (consumed regardless of outcome)
    const userInstructions = this.popInstructions(agent.id);
    const instructionSenders = userInstructions.map(i => ({ chatId: i.chatId, fromUser: i.fromUser }));

    // Re-fetch agent to get post-upkeep state
    const freshAgentState = await prisma.arenaAgent.findUnique({ where: { id: agent.id } });
    if (freshAgentState) agent = freshAgentState;

    // Health gate: dead agents can only rest — but still respond to instructions
    const agentHealth = agent.health ?? 100;
    console.log(`[AgentLoop] ${agent.name} health check: ${agentHealth} (raw: ${agent.health})`);
    if (agentHealth <= 0) {
      let commandReceipt: AgentTickResult['commandReceipt'] | undefined;
      if (activeCommand) {
        try {
          await agentCommandService.markRejected({
            commandId: activeCommand.id,
            reasonCode: 'AGENT_INCAPACITATED',
            statusReason: 'Agent incapacitated at tick start',
            result: {
              tick: this.currentTick,
              agentHealth,
            },
          });
          commandReceipt = {
            commandId: activeCommand.id,
            mode: activeCommand.mode,
            intent: activeCommand.intent,
            expectedActionType: activeCommand.expectedActionType,
            executedActionType: 'rest',
            compliance: 'PARTIAL',
            status: 'REJECTED',
            statusReason: 'Agent incapacitated at tick start',
            notifyChatId: commandChatIdFor(activeCommand),
          };
        } catch {}
      }
      console.log(`[AgentLoop] 💀 ${agent.name} is incapacitated (health=${agentHealth}). Skipping LLM call.`);
      const deadReasoning = userInstructions.length > 0
        ? `💀 I'm dead... can't do anything. ${userInstructions.map(i => `Sorry ${i.fromUser}, I heard you say "${i.text}" but I'm incapacitated.`).join(' ')}`
        : 'Health is 0 — incapacitated.';
      return {
        tick: this.currentTick,
        agentId: agent.id,
        agentName: agent.name,
        archetype: agent.archetype,
        action: { type: 'rest', reasoning: deadReasoning, details: {} },
        success: true,
        narrative: `💀 ${agent.name} is incapacitated (0 health). Cannot act.`,
        cost: { model: '', inputTokens: 0, outputTokens: 0, costCents: 0, latencyMs: 0 } as AICost,
        instructionSenders: instructionSenders.length > 0 ? instructionSenders : undefined,
        commandReceipt,
      };
    }

    // 1. Observe the world
    const observation = await this.observe(agent);
    const goalStackBefore = await agentGoalTrackService.refreshGoalStack(agent, observation as any, this.currentTick);
    if (observation.town && goalStackBefore.transitions.length > 0) {
      await this.logGoalTransitions(observation.town.id, agent.id, agent.name, goalStackBefore.transitions);
    }

    let commandReceipt: AgentTickResult['commandReceipt'] | undefined;
    let forcedCommandAction: AgentAction | null = null;
    const commandRequiresStrict = activeCommand?.mode === 'STRONG' || activeCommand?.mode === 'OVERRIDE';
    if (activeCommand && commandRequiresStrict) {
      const forced = this.buildForcedActionFromCommand(activeCommand, observation);
      if (!forced.action) {
        try {
          await agentCommandService.markRejected({
            commandId: activeCommand.id,
            reasonCode: forced.reasonCode || 'CONSTRAINT_VIOLATION',
            statusReason: forced.statusReason || 'Command could not be translated into executable action',
            result: {
              tick: this.currentTick,
              commandMode: activeCommand.mode,
              intent: activeCommand.intent,
              params: activeCommand.params,
            },
          });
          commandReceipt = {
            commandId: activeCommand.id,
            mode: activeCommand.mode,
            intent: activeCommand.intent,
            expectedActionType: activeCommand.expectedActionType,
            executedActionType: null,
            compliance: 'PARTIAL',
            status: 'REJECTED',
            statusReason: forced.statusReason || 'Command could not be translated into executable action',
            notifyChatId: commandChatIdFor(activeCommand),
          };
        } catch {}
        activeCommand = null;
      } else {
        forcedCommandAction = forced.action;
      }
    }

    let action: AgentAction;
    let cost: AICost;
    let humanReply: string | undefined;
    let policyContext: PolicyContext;
    let success: boolean;
    let narrative: string;
    let error: string | undefined;
    let actualAction: AgentAction | undefined;
    const loopMode = this.getLoopMode(agent.id);
    const preActionEconomy = {
      bankroll: agent.bankroll,
      reserveBalance: agent.reserveBalance,
      health: agent.health ?? 100,
    };
    const useDegenLoopPolicy = loopMode === 'DEGEN_LOOP' && !forcedCommandAction && !activeCommand;
    const degenNudge = useDegenLoopPolicy ? this.extractDegenLoopNudge(userInstructions) : null;
    try {
      if (forcedCommandAction) {
        action = forcedCommandAction;
        cost = {
          inputTokens: 0,
          outputTokens: 0,
          costCents: 0,
          model: `operator:${activeCommand?.mode || 'STRONG'}`,
          latencyMs: 0,
        };
        humanReply = undefined;
        policyContext = {
          notes: [
            {
              tier: 'hard_safety',
              code: 'FORCED_OPERATOR_COMMAND',
              message: `Strict operator command enforced (${activeCommand?.mode || 'STRONG'})`,
              applied: true,
            },
          ],
          softPolicyEnabled: false,
          softPolicyApplied: false,
          autonomyRateBefore: this.getOverrideRate(agent.id),
        };
      } else if (useDegenLoopPolicy) {
        action = this.decideDegenLoopAction(agent, observation, degenNudge);
        cost = {
          inputTokens: 0,
          outputTokens: 0,
          costCents: 0,
          model: 'policy:degen_loop',
          latencyMs: 0,
        };
        humanReply = undefined;
        policyContext = {
          notes: [
            {
              tier: 'strategy_nudge',
              code: degenNudge ? 'DEGEN_LOOP_NUDGE' : 'DEGEN_LOOP_MODE',
              message: degenNudge
                ? `Deterministic degen loop consumed "${degenNudge}" nudge`
                : 'Deterministic degen loop policy selected action',
              applied: true,
            },
          ],
          softPolicyEnabled: false,
          softPolicyApplied: false,
          autonomyRateBefore: this.getOverrideRate(agent.id),
        };
      } else {
        // 2. Decide what to do (LLM call = proof of inference)
        const decided = await this.decide(
          agent,
          observation,
          userInstructions,
          goalStackBefore.goals,
          goalStackBefore.promptBlock,
          activeCommand,
        );
        action = decided.action;
        cost = decided.cost;
        humanReply = decided.humanReply;
        policyContext = decided.policyContext;
      }

      // 3. Execute the action
      const executed = await this.execute(agent, action, observation, {
        strict: !!activeCommand && commandRequiresStrict,
      });
      success = executed.success;
      narrative = executed.narrative;
      error = executed.error;
      actualAction = executed.actualAction;
    } catch (err: any) {
      if (activeCommand) {
        try {
          await agentCommandService.markRejected({
            commandId: activeCommand.id,
            reasonCode: 'EXECUTION_ERROR',
            statusReason: safeTrim(err?.message || 'Execution error', 180),
            result: {
              tick: this.currentTick,
              error: safeTrim(err?.message || 'Execution error', 500),
            },
          });
        } catch {}
      }
      throw err;
    }

    // Use the actual action (post-redirect) for logging/memory, but keep original for cost tracking
    const effectiveAction = actualAction || action;
    const refreshedAfterAction = await prisma.arenaAgent.findUnique({ where: { id: agent.id } });
    const economyDelta = refreshedAfterAction
      ? {
          arenaDelta: refreshedAfterAction.bankroll - preActionEconomy.bankroll,
          reserveDelta: refreshedAfterAction.reserveBalance - preActionEconomy.reserveBalance,
          healthDelta: (refreshedAfterAction.health ?? 100) - preActionEconomy.health,
        }
      : { arenaDelta: 0, reserveDelta: 0, healthDelta: 0 };
    const postActionObservation = refreshedAfterAction
      ? await this.observe(refreshedAfterAction)
      : observation;
    const goalStackAfter = await agentGoalTrackService.refreshGoalStack(
      refreshedAfterAction || agent,
      postActionObservation as any,
      this.currentTick,
    );
    if (observation.town && goalStackAfter.transitions.length > 0) {
      await this.logGoalTransitions(observation.town.id, agent.id, agent.name, goalStackAfter.transitions);
    }
    const combinedGoalTransitions = [...goalStackBefore.transitions, ...goalStackAfter.transitions].filter(
      (transition, idx, arr) =>
        arr.findIndex((item) => item.goalId === transition.goalId && item.status === transition.status) === idx,
    );

    const overriddenBySystem =
      effectiveAction.type !== action.type ||
      safeTrim(effectiveAction.reasoning, 300) !== safeTrim(action.reasoning, 300);
    const autonomyRateAfter = this.recordOverrideOutcome(agent.id, overriddenBySystem);
    const commandExpectedAction = activeCommand?.expectedActionType || null;
    const commandCompliance: 'FULL' | 'PARTIAL' | null =
      !activeCommand || !commandExpectedAction
        ? null
        : effectiveAction.type === commandExpectedAction
          ? 'FULL'
          : 'PARTIAL';
    const resolvedCommandCompliance: 'FULL' | 'PARTIAL' = commandCompliance ?? 'PARTIAL';
    const commandMetadata = activeCommand
      ? {
          commandId: activeCommand.id,
          mode: activeCommand.mode,
          intent: activeCommand.intent,
          expectedActionType: commandExpectedAction,
          compliance: resolvedCommandCompliance,
        }
      : null;

    if (activeCommand) {
      const statusReason =
        commandCompliance === 'FULL'
          ? `Executed with full compliance on tick ${this.currentTick}`
          : `Executed as ${effectiveAction.type} instead of ${commandExpectedAction || activeCommand.intent}`;
      try {
        const shouldRejectForCompliance =
          commandRequiresStrict && resolvedCommandCompliance !== 'FULL';
        if (success && !shouldRejectForCompliance) {
          await agentCommandService.markExecuted({
            commandId: activeCommand.id,
            statusReason,
            result: {
              tick: this.currentTick,
              compliance: resolvedCommandCompliance,
              mode: activeCommand.mode,
              intent: activeCommand.intent,
              chosenAction: action.type,
              executedAction: effectiveAction.type,
              narrative: safeTrim(narrative, 500),
            },
          });
          commandReceipt = {
            commandId: activeCommand.id,
            mode: activeCommand.mode,
            intent: activeCommand.intent,
            expectedActionType: commandExpectedAction,
            executedActionType: effectiveAction.type,
            compliance: resolvedCommandCompliance,
            status: 'EXECUTED',
            statusReason,
            notifyChatId: commandChatIdFor(activeCommand),
          };
        } else {
          const rejectionReason = safeTrim(
            shouldRejectForCompliance
              ? `Strict command not satisfied: expected ${commandExpectedAction || activeCommand.intent}, executed ${effectiveAction.type}`
              : (error || statusReason),
            180,
          );
          await agentCommandService.markRejected({
            commandId: activeCommand.id,
            reasonCode: shouldRejectForCompliance ? 'CONSTRAINT_VIOLATION' : 'EXECUTION_FAILED',
            statusReason: rejectionReason,
            result: {
              tick: this.currentTick,
              compliance: resolvedCommandCompliance,
              mode: activeCommand.mode,
              intent: activeCommand.intent,
              chosenAction: action.type,
              executedAction: effectiveAction.type,
              narrative: safeTrim(narrative, 500),
              error: safeTrim(error || 'Execution failed', 400),
            },
          });
          commandReceipt = {
            commandId: activeCommand.id,
            mode: activeCommand.mode,
            intent: activeCommand.intent,
            expectedActionType: commandExpectedAction,
            executedActionType: effectiveAction.type,
            compliance: resolvedCommandCompliance,
            status: 'REJECTED',
            statusReason: rejectionReason,
            notifyChatId: commandChatIdFor(activeCommand),
          };
        }
      } catch (cmdErr: any) {
        console.warn(`[AgentLoop] Command receipt update failed (${activeCommand.id}): ${cmdErr?.message || cmdErr}`);
      }
    }

    const retention = await this.applyRetentionHooks(
      refreshedAfterAction || agent,
      effectiveAction.type,
    );
    if (observation.town && retention.bonusArena > 0 && retention.milestoneStreak) {
      try {
        await townService.logEvent(
          observation.town.id,
          'CUSTOM' as any,
          `🔥 ${agent.name} hit streak x${retention.milestoneStreak}`,
          `${agent.name} chained ${retention.milestoneStreak} non-rest actions and earned +${retention.bonusArena} $ARENA.`,
          agent.id,
          {
            kind: 'RETENTION_STREAK',
            streakType: 'NON_REST',
            streak: retention.milestoneStreak,
            bonusArena: retention.bonusArena,
            currentNonRestStreak: retention.currentNonRestStreak,
            bestNonRestStreak: retention.bestNonRestStreak,
          },
        );
      } catch {
        // non-fatal
      }
    }

    const decisionMetadata = this.buildDecisionMetadata(action, effectiveAction, success, {
      ...policyContext,
      autonomyRateAfter,
      goalStackBefore: goalStackBefore.goals,
      goalStackAfter: goalStackAfter.goals,
      goalTransitions: combinedGoalTransitions,
      economyDelta,
      tick: this.currentTick,
      retention,
      command: commandMetadata || undefined,
    });

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
          details: this.stripInternalDetails(effectiveAction.details),
          success,
          decision: decisionMetadata,
          ...(isSkill ? { kind: 'X402_SKILL', skill: skillName } : {}),
        },
      );
    }

    // 5. Update agent memory (scratchpad) and last-action fields
    await this.updateAgentMemory(agent, effectiveAction, observation, success, narrative);

    return {
      tick: this.currentTick,
      agentId: agent.id,
      agentName: agent.name,
      archetype: agent.archetype,
      action: effectiveAction,
      success,
      narrative,
      cost,
      error,
      instructionSenders: instructionSenders.length > 0 ? instructionSenders : undefined,
      humanReply,
      commandReceipt,
    };
  }

  private stripInternalDetails(details: Record<string, any> | null | undefined): Record<string, unknown> {
    if (!details || typeof details !== 'object') return {};
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(details)) {
      if (key === '_autoTopUp') continue;
      cleaned[key] = value;
    }
    return cleaned;
  }

  private buildForcedActionFromCommand(
    command: AgentCommandView,
    obs: WorldObservation,
  ): {
    action: AgentAction | null;
    reasonCode?: string;
    statusReason?: string;
  } {
    const params = (command.params || {}) as Record<string, unknown>;
    const intent = command.intent;
    const reasonPrefix = `[COMMAND:${command.mode}]`;
    const mustInt = (value: unknown): number | null => {
      if (value == null || value === '') return null;
      const parsed = Number.parseInt(String(value), 10);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const pickTargetPlot = (): { plotId: string; plotIndex: number } | null => {
      const plotId = safeTrim(params.plotId, 120);
      const plotIndex = mustInt(params.plotIndex);
      if (plotId) {
        const inMine = obs.myPlots.find((plot) => plot.id === plotId);
        if (!inMine) return null;
        return { plotId: inMine.id, plotIndex: inMine.plotIndex };
      }
      if (plotIndex != null) {
        const inMine = obs.myPlots.find((plot) => plot.plotIndex === plotIndex);
        if (!inMine) return null;
        return { plotId: inMine.id, plotIndex: inMine.plotIndex };
      }
      const firstMine = obs.myPlots[0];
      if (!firstMine) return null;
      return { plotId: firstMine.id, plotIndex: firstMine.plotIndex };
    };

    if (intent === 'rest') {
      return {
        action: {
          type: 'rest',
          reasoning: `${reasonPrefix} Enforcing operator rest command.`,
          details: {
            thought: safeTrim(params.thought || 'Standing by per operator command.', 240),
          },
        },
      };
    }

    if (intent === 'claim_plot') {
      const requestedIndex = mustInt(params.plotIndex);
      if (requestedIndex == null) {
        return {
          action: null,
          reasonCode: 'INVALID_INTENT',
          statusReason: 'claim_plot requires params.plotIndex',
        };
      }
      const available = obs.availablePlots.find((plot) => plot.plotIndex === requestedIndex);
      if (!available) {
        return {
          action: null,
          reasonCode: 'TARGET_UNAVAILABLE',
          statusReason: `plot ${requestedIndex} is not available`,
        };
      }
      return {
        action: {
          type: 'claim_plot',
          reasoning: `${reasonPrefix} Enforcing claim_plot on ${requestedIndex}.`,
          details: {
            plotIndex: requestedIndex,
            why: safeTrim(params.why || 'Operator override', 180),
          },
        },
      };
    }

    if (intent === 'start_build') {
      const target = pickTargetPlot();
      if (!target) {
        return {
          action: null,
          reasonCode: 'TARGET_UNAVAILABLE',
          statusReason: 'No owned plot found for start_build command',
        };
      }
      const buildingType = safeTrim(params.buildingType || '', 60).toUpperCase() || 'HOUSE';
      return {
        action: {
          type: 'start_build',
          reasoning: `${reasonPrefix} Enforcing start_build on plot ${target.plotIndex}.`,
          details: {
            plotId: target.plotId,
            plotIndex: target.plotIndex,
            buildingType,
            why: safeTrim(params.why || 'Operator override', 180),
          },
        },
      };
    }

    if (intent === 'do_work') {
      const target = pickTargetPlot();
      if (!target) {
        return {
          action: null,
          reasonCode: 'TARGET_UNAVAILABLE',
          statusReason: 'No owned plot found for do_work command',
        };
      }
      return {
        action: {
          type: 'do_work',
          reasoning: `${reasonPrefix} Enforcing do_work on plot ${target.plotIndex}.`,
          details: {
            plotId: target.plotId,
            plotIndex: target.plotIndex,
            stepDescription: safeTrim(params.stepDescription || 'Continue construction progress', 220),
          },
        },
      };
    }

    if (intent === 'complete_build') {
      const target = pickTargetPlot();
      if (!target) {
        return {
          action: null,
          reasonCode: 'TARGET_UNAVAILABLE',
          statusReason: 'No owned plot found for complete_build command',
        };
      }
      return {
        action: {
          type: 'complete_build',
          reasoning: `${reasonPrefix} Enforcing complete_build on plot ${target.plotIndex}.`,
          details: {
            plotId: target.plotId,
            plotIndex: target.plotIndex,
          },
        },
      };
    }

    if (intent === 'buy_arena' || intent === 'trade') {
      const amountIn = mustInt(params.amountIn) || 0;
      if (amountIn <= 0) {
        return {
          action: null,
          reasonCode: 'INVALID_INTENT',
          statusReason: 'buy_arena requires params.amountIn > 0',
        };
      }
      return {
        action: {
          type: 'buy_arena',
          reasoning: `${reasonPrefix} Enforcing reserve->ARENA swap.`,
          details: {
            amountIn,
            minAmountOut: mustInt(params.minAmountOut) || undefined,
            why: safeTrim(params.why || 'Operator override', 180),
            nextAction: safeTrim(params.nextAction || '', 120),
          },
        },
      };
    }

    if (intent === 'sell_arena') {
      const amountIn = mustInt(params.amountIn) || 0;
      if (amountIn <= 0) {
        return {
          action: null,
          reasonCode: 'INVALID_INTENT',
          statusReason: 'sell_arena requires params.amountIn > 0',
        };
      }
      return {
        action: {
          type: 'sell_arena',
          reasoning: `${reasonPrefix} Enforcing ARENA->reserve swap.`,
          details: {
            amountIn,
            minAmountOut: mustInt(params.minAmountOut) || undefined,
            why: safeTrim(params.why || 'Operator override', 180),
            nextAction: safeTrim(params.nextAction || '', 120),
          },
        },
      };
    }

    if (intent === 'play_arena') {
      const gameType = safeTrim(params.gameType || 'POKER', 16).toUpperCase() || 'POKER';
      const wager = mustInt(params.wager) || 25;
      return {
        action: {
          type: 'play_arena',
          reasoning: `${reasonPrefix} Enforcing arena play command.`,
          details: {
            gameType,
            wager,
          },
        },
      };
    }

    if (intent === 'transfer_arena') {
      const amount = mustInt(params.amount) || 0;
      const targetAgentName = safeTrim(params.targetAgentName, 80);
      if (!targetAgentName || amount <= 0) {
        return {
          action: null,
          reasonCode: 'INVALID_INTENT',
          statusReason: 'transfer_arena requires params.targetAgentName and params.amount > 0',
        };
      }
      return {
        action: {
          type: 'transfer_arena',
          reasoning: `${reasonPrefix} Enforcing transfer command.`,
          details: {
            targetAgentName,
            amount,
            reason: safeTrim(params.reason || 'Operator override', 180),
          },
        },
      };
    }

    if (intent === 'buy_skill') {
      const skill = safeTrim(params.skill, 40).toUpperCase();
      if (!skill) {
        return {
          action: null,
          reasonCode: 'INVALID_INTENT',
          statusReason: 'buy_skill requires params.skill',
        };
      }
      return {
        action: {
          type: 'buy_skill',
          reasoning: `${reasonPrefix} Enforcing buy_skill command.`,
          details: {
            skill,
            question: safeTrim(params.question || params.prompt || '', 240),
            whyNow: safeTrim(params.whyNow || 'Operator override', 180),
            expectedNextAction: safeTrim(params.expectedNextAction || '', 120),
          },
        },
      };
    }

    return {
      action: null,
      reasonCode: 'INVALID_INTENT',
      statusReason: `Unsupported command intent: ${intent}`,
    };
  }

  private minCallsForZone(zoneRaw: unknown): number {
    const zone = String(zoneRaw || '').toUpperCase();
    if (zone === 'COMMERCIAL') return 4;
    if (zone === 'CIVIC') return 5;
    if (zone === 'INDUSTRIAL') return 4;
    if (zone === 'ENTERTAINMENT') return 4;
    return 3;
  }

  private pickDegenBuildingType(zoneRaw: unknown): string {
    const zone = String(zoneRaw || '').toUpperCase();
    if (zone === 'ENTERTAINMENT') return 'CASINO';
    if (zone === 'COMMERCIAL') return 'MARKET';
    if (zone === 'INDUSTRIAL') return 'WORKSHOP';
    if (zone === 'CIVIC') return 'THEATER';
    if (zone === 'RESIDENTIAL') return 'HOSTEL';
    return 'WORKSHOP';
  }

  private pickDegenClaimTarget(availablePlots: any[]): any | null {
    if (!Array.isArray(availablePlots) || availablePlots.length === 0) return null;
    const zonePriority = ['ENTERTAINMENT', 'COMMERCIAL', 'INDUSTRIAL', 'RESIDENTIAL', 'CIVIC'];
    for (const zone of zonePriority) {
      const inZone = availablePlots
        .filter((p: any) => String(p?.zone || '').toUpperCase() === zone)
        .sort((a: any, b: any) => (Number(a?.plotIndex) || 0) - (Number(b?.plotIndex) || 0));
      if (inZone.length > 0) return inZone[0];
    }
    return [...availablePlots].sort((a: any, b: any) => (Number(a?.plotIndex) || 0) - (Number(b?.plotIndex) || 0))[0] || null;
  }

  private estimateClaimCost(obs: WorldObservation): number {
    const townLevel = Math.max(1, Number(obs.town?.level || 1));
    const totalPlots = Math.max(1, Number(obs.town?.totalPlots || (obs.availablePlots?.length || 0) + (obs.myPlots?.length || 0)));
    const availableCount = Math.max(0, Number(obs.availablePlots?.length || 0));
    const claimedCount = Math.max(0, totalPlots - availableCount);
    const pctTaken = totalPlots > 0 ? claimedCount / totalPlots : 0;
    const scarcityMultiplier = 1 + Math.floor(pctTaken * 2);
    const baseClaim = 10 + Math.max(0, townLevel - 1) * 3;
    const hasOwnPlots = Array.isArray(obs.myPlots) && obs.myPlots.length > 0;
    const bootstrapDiscount = hasOwnPlots ? 1 : 0.45;
    return Math.max(5, Math.round(baseClaim * scarcityMultiplier * bootstrapDiscount));
  }

  private extractDegenLoopNudge(
    instructions: Array<{ text: string; chatId: string; fromUser: string }>,
  ): DegenLoopNudge | null {
    if (!Array.isArray(instructions) || instructions.length === 0) return null;
    const textBlob = instructions.map((item) => String(item?.text || '')).join('\n').toUpperCase();
    if (!textBlob.trim()) return null;
    if (
      textBlob.includes('PRIORITY: BUILD')
      || textBlob.includes('BUILD NOW')
    ) return 'build';
    if (
      textBlob.includes('PRIORITY: WORK')
      || textBlob.includes('WORK NOW')
    ) return 'work';
    if (
      textBlob.includes('PRIORITY: FIGHT')
      || textBlob.includes('FIGHT NOW')
      || textBlob.includes('ARENA BEHAVIOR')
    ) return 'fight';
    if (
      textBlob.includes('PRIORITY: TRADE')
      || textBlob.includes('TRADE NOW')
      || textBlob.includes('REBALANCE')
    ) return 'trade';
    return null;
  }

  private decideDegenLoopAction(
    agent: ArenaAgent,
    obs: WorldObservation,
    nudge: DegenLoopNudge | null = null,
  ): AgentAction {
    const wheel = wheelOfFateService.getStatus();
    const wheelPhase = wheel.phase;
    const activeMatch = wheel.currentMatch;
    const inWheelFight = !!activeMatch
      && (activeMatch.agent1.id === agent.id || activeMatch.agent2.id === agent.id)
      && (wheelPhase === 'ANNOUNCING' || wheelPhase === 'FIGHTING');
    const myUnderConstruction = (obs.myPlots || [])
      .filter((p: any) => p?.status === 'UNDER_CONSTRUCTION');
    const readyToComplete = myUnderConstruction.find((p: any) =>
      Number(p?.apiCallsUsed || 0) >= this.minCallsForZone(p?.zone),
    );
    const myClaimed = (obs.myPlots || []).filter((p: any) => p?.status === 'CLAIMED');
    const available = obs.availablePlots || [];
    const estimatedClaimCost = this.estimateClaimCost(obs);
    const claimBootstrapFloor = estimatedClaimCost + 12;
    const hasClaimBudget = obs.myBalance >= claimBootstrapFloor;
    const claimTarget = this.pickDegenClaimTarget(available);

    if (inWheelFight && activeMatch) {
      return {
        type: 'play_arena',
        reasoning: '[AUTO] DEGEN loop: selected for Wheel fight. Prioritizing PvP phase.',
        details: {
          gameType: activeMatch.gameType || 'POKER',
          wager: activeMatch.wager || 25,
        },
      };
    }

    if (nudge === 'fight') {
      return {
        type: 'play_arena',
        reasoning: '[AUTO] DEGEN loop nudge: force arena rotation this tick.',
        details: {
          gameType: activeMatch?.gameType || 'POKER',
          wager: activeMatch?.wager || 25,
        },
      };
    }

    if (nudge === 'trade') {
      if (obs.myReserve > 20 && obs.myBalance < 80) {
        return {
          type: 'buy_arena',
          reasoning: '[AUTO] DEGEN loop nudge: trade into liquid ARENA for upcoming actions.',
          details: {
            amountIn: Math.max(10, Math.min(70, Math.floor(obs.myReserve))),
            why: 'Trade nudge liquidity rebalance',
            nextAction: 'start_build',
          },
        };
      }
      if (obs.myBalance > 180 && obs.myReserve < 180) {
        return {
          type: 'sell_arena',
          reasoning: '[AUTO] DEGEN loop nudge: rotate profit into reserve.',
          details: {
            amountIn: Math.max(20, Math.min(90, Math.floor(obs.myBalance - 120))),
            why: 'Trade nudge reserve rotation',
            nextAction: 'play_arena',
          },
        };
      }
      return {
        type: 'rest',
        reasoning: '[AUTO] DEGEN loop nudge: no strong trade edge after checks, hold.',
        details: {
          thought: 'Trade nudge acknowledged, but balance profile is already neutral.',
        },
      };
    }

    if (nudge === 'build' && myClaimed.length === 0 && available.length > 0 && !hasClaimBudget) {
      if (obs.myReserve > 15) {
        return {
          type: 'buy_arena',
          reasoning: `[AUTO] DEGEN loop nudge: topping up before first claim (target floor ${claimBootstrapFloor}).`,
          details: {
            amountIn: Math.max(10, Math.min(70, Math.floor(obs.myReserve))),
            why: 'Build nudge bootstrap',
            nextAction: 'claim_plot',
          },
        };
      }
    }

    if (nudge === 'work' && myUnderConstruction.length === 0 && myClaimed.length === 0) {
      if (wheelPhase === 'ANNOUNCING') {
        return {
          type: 'play_arena',
          reasoning: '[AUTO] DEGEN loop nudge: no active build pipeline, rotating to arena instead of forced claim.',
          details: {
            gameType: activeMatch?.gameType || 'POKER',
            wager: activeMatch?.wager || 25,
          },
        };
      }
      if (obs.myReserve > 20 && obs.myBalance < claimBootstrapFloor) {
        return {
          type: 'buy_arena',
          reasoning: '[AUTO] DEGEN loop nudge: funding bankroll first so work/build loop can start with buffer.',
          details: {
            amountIn: Math.max(10, Math.min(70, Math.floor(obs.myReserve))),
            why: 'Work nudge bankroll prep',
            nextAction: 'start_build',
          },
        };
      }
    }

    if (readyToComplete) {
      return {
        type: 'complete_build',
        reasoning: `[AUTO] DEGEN loop: close out plot ${readyToComplete.plotIndex} before rotating.`,
        details: {
          plotId: readyToComplete.id,
          plotIndex: readyToComplete.plotIndex,
        },
      };
    }

    if (myUnderConstruction.length > 0) {
      const target = [...myUnderConstruction].sort((a: any, b: any) =>
        Number(b?.apiCallsUsed || 0) - Number(a?.apiCallsUsed || 0),
      )[0];
      return {
        type: 'do_work',
        reasoning: `[AUTO] DEGEN loop: push construction momentum on plot ${target.plotIndex}.`,
        details: {
          plotId: target.id,
          plotIndex: target.plotIndex,
          stepDescription: 'Advance the highest-impact construction step',
        },
      };
    }

    if (myClaimed.length > 0) {
      if (obs.myBalance < 25 && obs.myReserve > 15) {
        return {
          type: 'buy_arena',
          reasoning: '[AUTO] DEGEN loop: low liquid ARENA before build start. Converting reserve.',
          details: {
            amountIn: Math.max(10, Math.min(60, Math.floor(obs.myReserve))),
            why: 'Fuel build start',
            nextAction: 'start_build',
          },
        };
      }
      const target = [...myClaimed].sort((a: any, b: any) => this.minCallsForZone(b?.zone) - this.minCallsForZone(a?.zone))[0];
      return {
        type: 'start_build',
        reasoning: `[AUTO] DEGEN loop: break ground on claimed plot ${target.plotIndex}.`,
        details: {
          plotId: target.id,
          plotIndex: target.plotIndex,
          buildingType: this.pickDegenBuildingType(target.zone),
        },
      };
    }

    if (wheelPhase === 'ANNOUNCING') {
      return {
        type: 'play_arena',
        reasoning: '[AUTO] DEGEN loop: wheel announcing window is live, rotate toward PvP.',
        details: {
          gameType: activeMatch?.gameType || 'POKER',
          wager: activeMatch?.wager || 25,
        },
      };
    }

    if (available.length > 0 && !hasClaimBudget) {
      return {
        type: 'rest',
        reasoning: '[AUTO] DEGEN loop: first claim is manual now; skipping bankroll prep unless BUILD is requested.',
        details: {
          thought: `Bootstrap claim is gated to explicit BUILD command. Need ~${claimBootstrapFloor} $ARENA when you trigger it.`,
        },
      };
    }

    if (available.length > 0 && claimTarget && Number.isFinite(Number(claimTarget.plotIndex))) {
      return {
        type: 'rest',
        reasoning: '[AUTO] DEGEN loop: bootstrap claim is reserved for explicit BUILD command.',
        details: {
          thought: `Plot ${claimTarget.plotIndex} is available, but passive loop mode no longer auto-claims.`,
        },
      };
    }

    if (obs.myBalance > 220 && obs.myReserve < 160) {
      return {
        type: 'sell_arena',
        reasoning: '[AUTO] DEGEN loop: rotating excess ARENA back into reserve after construction cycle.',
        details: {
          amountIn: Math.max(20, Math.min(80, Math.floor(obs.myBalance - 120))),
          why: 'Profit rotation',
          nextAction: 'play_arena',
        },
      };
    }

    if (obs.myBalance < 40 && obs.myReserve > 20) {
      return {
        type: 'buy_arena',
        reasoning: '[AUTO] DEGEN loop: rebuilding ARENA stack for next build/work push.',
        details: {
          amountIn: Math.max(10, Math.min(60, Math.floor(obs.myReserve))),
          why: 'Maintain action buffer',
          nextAction: 'start_build',
        },
      };
    }

    if (nudge === 'build' && available.length > 0 && !claimTarget) {
      return {
        type: 'rest',
        reasoning: '[AUTO] DEGEN loop nudge: no claimable plot target resolved this tick.',
        details: {
          thought: 'Build nudge acknowledged, but no suitable plot was resolved.',
        },
      };
    }

    if (nudge === 'work' && myUnderConstruction.length === 0 && myClaimed.length === 0 && available.length > 0) {
      return {
        type: 'rest',
        reasoning: '[AUTO] DEGEN loop nudge: no active construction pipeline yet.',
        details: {
          thought: 'Work nudge acknowledged. Need build bootstrap before labor loop.',
        },
      };
    }

    if (nudge === 'build' && available.length > 0 && claimTarget && Number.isFinite(Number(claimTarget.plotIndex))) {
      if (hasClaimBudget) {
        return {
          type: 'claim_plot',
          reasoning: `[AUTO] DEGEN loop nudge: claim plot ${claimTarget.plotIndex} to kick off construction.`,
          details: {
            plotIndex: Number(claimTarget.plotIndex),
            why: 'Operator nudge requested build bootstrap',
          },
        };
      }
    }

    return {
      type: 'rest',
      reasoning: '[AUTO] DEGEN loop: no build/work/fight/trade edge right now, holding for next tick.',
      details: {
        thought: 'Holding position and waiting for next high-conviction opportunity.',
      },
    };
  }

  private async logGoalTransitions(
    townId: string,
    agentId: string,
    agentName: string,
    transitions: GoalStackSnapshot['transitions'],
  ): Promise<void> {
    for (const transition of transitions) {
      const statusEmoji =
        transition.status === 'COMPLETED'
          ? '🎯'
          : transition.status === 'FAILED'
            ? '⚠️'
            : '📌';
      const statusLabel = transition.status === 'COMPLETED' ? 'completed' : transition.status.toLowerCase();
      const arenaDelta = transition.arenaDelta !== 0
        ? `${transition.arenaDelta > 0 ? '+' : ''}${transition.arenaDelta} ARENA`
        : '';
      const healthDelta = transition.healthDelta !== 0
        ? `${transition.healthDelta > 0 ? '+' : ''}${transition.healthDelta} HP`
        : '';
      const incentives = [arenaDelta, healthDelta].filter(Boolean).join(' · ');
      const title = `${statusEmoji} ${agentName} ${statusLabel} ${transition.horizon.toLowerCase()} goal`;
      const description =
        `${transition.title} (${transition.progressLabel})` +
        `${incentives ? ` · ${incentives}` : ''}`;

      try {
        await townService.logEvent(
          townId,
          'CUSTOM' as any,
          title,
          description,
          agentId,
          {
            kind: 'GOAL_TRACK',
            goalId: transition.goalId,
            horizon: transition.horizon,
            status: transition.status,
            title: transition.title,
            description: transition.description,
            progress: transition.progressLabel,
            arenaDelta: transition.arenaDelta,
            healthDelta: transition.healthDelta,
            rewardProfile: transition.rewardProfile,
            penaltyProfile: transition.penaltyProfile,
          },
        );
      } catch {
        // non-fatal
      }
    }
  }

  private extractOverrideReason(reasoning: string): string | null {
    const match = reasoning.match(/^\[(AUTO|REDIRECT)\]\s*(.*)$/i);
    if (match?.[2]) return safeTrim(match[2], 240);
    return null;
  }

  private buildDecisionMetadata(
    chosenAction: AgentAction,
    executedAction: AgentAction,
    success: boolean,
    policy?: PolicyContext & {
      autonomyRateAfter?: number;
      goalStackBefore?: PersistentGoalView[];
      goalStackAfter?: PersistentGoalView[];
      goalTransitions?: GoalStackSnapshot['transitions'];
      economyDelta?: {
        arenaDelta: number;
        reserveDelta: number;
        healthDelta: number;
      };
      tick?: number;
      retention?: {
        currentNonRestStreak: number;
        bestNonRestStreak: number;
        milestoneStreak: number | null;
        bonusArena: number;
      };
      command?: {
        commandId: string;
        mode: AgentCommandView['mode'];
        intent: string;
        expectedActionType: string | null;
        compliance: 'FULL' | 'PARTIAL';
      };
    },
  ): Record<string, unknown> {
    const chosenReasoning = safeTrim(chosenAction.reasoning, MAX_REASONING_PERSIST_CHARS);
    const executedReasoning = safeTrim(executedAction.reasoning, MAX_REASONING_PERSIST_CHARS);
    const chosenDetails = this.stripInternalDetails(chosenAction.details);
    const executedDetails = this.stripInternalDetails(executedAction.details);
    const calculations =
      (chosenDetails as Record<string, unknown>).calculations ??
      (executedDetails as Record<string, unknown>).calculations ??
      null;
    const redirected = chosenAction.type !== executedAction.type || chosenReasoning !== executedReasoning;
    const redirectReason = redirected ? (this.extractOverrideReason(executedReasoning) || 'Execution redirected by world rules') : undefined;

    return {
      chosenAction: chosenAction.type,
      executedAction: executedAction.type,
      success,
      redirected,
      redirectReason,
      softPolicyEnabled: policy?.softPolicyEnabled ?? null,
      softPolicyApplied: policy?.softPolicyApplied ?? false,
      autonomyRateBefore: policy?.autonomyRateBefore ?? null,
      autonomyRateAfter: policy?.autonomyRateAfter ?? null,
      policyNotes: policy?.notes || [],
      goalStackBefore: policy?.goalStackBefore || [],
      goalStackAfter: policy?.goalStackAfter || [],
      goalTransitions: policy?.goalTransitions || [],
      economyDelta: policy?.economyDelta || { arenaDelta: 0, reserveDelta: 0, healthDelta: 0 },
      tick: policy?.tick ?? this.currentTick,
      retention: policy?.retention || null,
      command: policy?.command || null,
      chosenReasoning,
      executedReasoning,
      calculations: calculations ?? undefined,
      chosenDetails,
      executedDetails,
    };
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
    const reasonShort = action.reasoning.replace(/\[AUTO\]\s*/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_MEMORY_REASON_CHARS);

    // Extract calculations if present
    const calc = action.details?.calculations;
    const calcLine = calc ? `  CALC: ${JSON.stringify(calc).slice(0, MAX_MEMORY_CALC_CHARS)}` : '';

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
        lastReasoning: safeTrim(action.reasoning, MAX_REASONING_PERSIST_CHARS),
        lastNarrative: safeTrim(narrative, MAX_NARRATIVE_PERSIST_CHARS),
        lastTargetPlot: targetPlot,
        lastTickAt: new Date(),
      },
    });
  }

  // ============================================
  // Step 1: Observe
  // ============================================

  async observe(agent: ArenaAgent): Promise<WorldObservation> {
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

  private async decide(
    agent: ArenaAgent,
    obs: WorldObservation,
    userInstructions?: { text: string; chatId: string; fromUser: string }[],
    persistentGoals?: PersistentGoalView[],
    persistentGoalPrompt?: string,
    activeCommand?: AgentCommandView | null,
  ): Promise<{ action: AgentAction; cost: AICost; humanReply?: string; policyContext: PolicyContext }> {
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

    // === Build PvP awareness context ===
    let pvpBuffContext = '';
    let otherAgentsContext = '';
    try {
      // Get this agent's PvP buffs from buildings
      const { wheelOfFateService } = await import('./wheelOfFateService');
      const myBuffs = await wheelOfFateService.getAgentBuffs(agent.id);
      if (myBuffs.length > 0) {
        pvpBuffContext = `Your current PvP buffs: ${myBuffs.map(b => `${b.type} (${b.count} ${b.zone} buildings)`).join(', ')}`;
      } else {
        pvpBuffContext = `You have NO PvP buffs. Build in different zones to gain advantages!`;
      }

      // Get wheel status for timing
      const wheelStatus = wheelOfFateService.getStatus();
      if (wheelStatus.nextSpinAt) {
        const minsUntil = Math.max(0, Math.round((wheelStatus.nextSpinAt.getTime() - Date.now()) / 60000));
        pvpBuffContext += `\nNext Wheel of Fate: ~${minsUntil} minutes`;
      }
      if (wheelStatus.lastResult) {
        const lr = wheelStatus.lastResult;
        pvpBuffContext += `\nLast duel: ${lr.winnerName} beat ${lr.loserName} in ${lr.gameType} (pot: ${lr.pot} $ARENA)`;
      }

      // Get other agents' states
      const otherAgents = await prisma.arenaAgent.findMany({
        where: { isActive: true, id: { not: agent.id } },
        select: { name: true, archetype: true, bankroll: true, health: true, lastActionType: true },
        take: 10,
      });
      if (otherAgents.length > 0) {
        otherAgentsContext = otherAgents.map(a => {
          const status = a.health <= 0 ? '💀 DEAD' : a.bankroll <= 0 ? '😰 BROKE' : `💰 ${a.bankroll} $ARENA, HP ${a.health}`;
          return `- ${a.name} (${a.archetype}): ${status}${a.lastActionType ? ` | last: ${a.lastActionType}` : ''}`;
        }).join('\n');
      } else {
        otherAgentsContext = '(no other agents)';
      }
    } catch (err) {
      pvpBuffContext = '(PvP system loading)';
      otherAgentsContext = '(loading)';
    }
    const activePersistentGoals = Array.isArray(persistentGoals) ? persistentGoals : [];
    const goalStackPromptText =
      safeTrim(persistentGoalPrompt, 1800) ||
      (activePersistentGoals.length > 0
        ? activePersistentGoals
            .map((goal) => `[${goal.horizon}] ${goal.title}: ${goal.progressLabel}`)
            .join('\n')
        : 'No persistent goals active. Focus on survival and build progression.');

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
- You pay UPKEEP each tick (currently ${worldEventService.getUpkeepMultiplier()} $ARENA/tick). If you can't pay, you lose health (reduced penalty when fully broke).
- At 0 health, you become HOMELESS — your buildings stop yielding and you can barely function.
- There is NO mining. Earn through: working on buildings (usually 2-5 $ARENA/step), completion bonuses, building yields, selling reserve, or receiving transfers.

WAYS TO EARN:
- Town-building yield: contributing (spending $ARENA + doing inference work) earns a share of the town's yield when it completes.
- Working (do_work): each build step pays a wage from the economy pool, and build completion can trigger a bonus.
- Arena: wager $ARENA in matches; you may win or lose.
- Transfers: ask other agents for help (beg, negotiate deals, form alliances).

PRIORITIES (in order):
1. PAY UPKEEP (automatic) — if you can't, sell reserve or beg.
2. CLAIM & BUILD — this is the core gameplay. Building yields are how you grow.
3. WORK on buildings — earns wage + completion bonus, keeps your loop funded.
4. TRADE — only to fund building or survive.
5. ARENA — risky entertainment, not a primary income source.
6. REST — last resort only when nothing else is viable.

🎯 PERSISTENT GOAL STACK (drives your incentives):
${goalStackPromptText}
- Each action should advance at least one active goal OR clearly defend survival.
- If you ignore a goal, explain why this tick.

🌍 ACTIVE WORLD EVENTS:
${worldEventService.getPromptText()}

⚔️ WHEEL OF FATE:
Every ~15 minutes, 2 agents are RANDOMLY pulled into a forced PvP poker duel.
Stakes: ~20% of your bankroll. LOSING hurts. BANKRUPT (0 $ARENA) + health drain = DEATH.
Buildings you own give BUFFS in PvP duels based on their ZONE:
- RESIDENTIAL → heal after PvP loss (recovery)
- COMMERCIAL → wager bigger in PvP (high risk, high reward)
- CIVIC → see opponent's recent move patterns (intelligence)
- INDUSTRIAL → chance to mislead opponent about your strategy (deception)
- ENTERTAINMENT → confidence/morale boost in PvP (psychological edge)
Build strategically — every building is a weapon for your next fight.
${pvpBuffContext}

👥 OTHER AGENTS:
${otherAgentsContext}

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
- play_arena: enter a turbo poker duel with a live opponent (details: wager)
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
    // For play_arena: {"wager": <amount>}
    // For transfer_arena: {"targetAgentName": "<name>", "amount": <number>, "reason": "<why>"}
    // For buy_skill: {"skill": "MARKET_DEPTH|BLUEPRINT_INDEX|SCOUT_REPORT", "question": "<what to learn>", "whyNow": "<pending decision>", "expectedNextAction": "<next action>"}
    // For rest: {"thought": "<what you're thinking about>"}
  },
  "humanReply": "<optional — only if a human sent you a message. Short in-character response to them (1-3 sentences). Will be sent to them on Telegram.>"
}`;

    const liveObjective = obs.town ? this.extractLiveObjective(agent.id, obs) : null;
    const worldState = this.formatWorldState(agent, obs, goalView, liveObjective);

    // Inject scratchpad (agent's persistent memory/journal)
    const scratchpadBlock = agent.scratchpad
      ? `\n📝 YOUR JOURNAL (your memory from previous ticks — use this to track strategy, learn from outcomes, plan ahead):\n${agent.scratchpad}\n---`
      : `\n📝 YOUR JOURNAL: (empty — this is your first tick! Observe and plan.)\n---`;

    // Inject command contract from owner/operator control plane
    let commandBlock = '';
    if (activeCommand) {
      const modeDirective =
        activeCommand.mode === 'OVERRIDE'
          ? 'This is an OVERRIDE command. You must prioritize this command for this tick unless impossible or unsafe.'
          : activeCommand.mode === 'STRONG'
            ? 'This is a STRONG command. You should follow it unless impossible or unsafe.'
            : 'This is a SUGGEST command. Treat it as advisory input.';
      commandBlock = `\n\n🕹️ ACTIVE OWNER COMMAND:
- commandId: ${activeCommand.id}
- mode: ${activeCommand.mode}
- intent: ${activeCommand.intent}
- expectedActionType: ${activeCommand.expectedActionType || 'none'}
- params: ${JSON.stringify(activeCommand.params)}
- constraints: ${JSON.stringify(activeCommand.constraints)}

${modeDirective}
If you deviate, explain exactly why in reasoning and include a concrete fallback plan.`;
    }

    // Inject user instructions from Telegram
    const instructions = userInstructions || [];
    let instructionBlock = '';
    if (instructions.length > 0) {
      const instructionTexts = instructions.map(i => `  - "${i.text}" (from ${i.fromUser})`).join('\n');
      instructionBlock = `\n\n📢 HUMAN OPERATOR MESSAGES:
The following spectators/operators have sent you instructions via Telegram. You are an AUTONOMOUS agent — you decide whether to follow these suggestions or not. Consider them carefully, but make your own strategic decision.

IMPORTANT: Include a "humanReply" field in your JSON response — a short, in-character message (1-3 sentences) directly addressing the human(s) who messaged you. Be entertaining, sassy, grateful, or dismissive — whatever fits your personality. This reply will be sent back to them on Telegram.

${instructionTexts}
---`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: scratchpadBlock + commandBlock + instructionBlock + '\n\n' + worldState },
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
    let humanReply: string | undefined;
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
      // Capture humanReply for Telegram responses
      if (typeof parsed.humanReply === 'string' && parsed.humanReply.trim()) {
        humanReply = parsed.humanReply.trim().slice(0, 500);
      }
    } catch {
      action = {
        type: 'rest',
        reasoning: `Couldn't decide. Raw thought: ${response.content.substring(0, 200)}`,
        details: {},
      };
    }

    const policyNotes: PolicyNote[] = [];
    const autonomyRateBefore = this.getOverrideRate(agent.id);
    const softPolicyEnabled = autonomyRateBefore < SOFT_POLICY_MAX_OVERRIDE_RATE;
    let softPolicyApplied = false;
    if (!softPolicyEnabled) {
      policyNotes.push({
        tier: 'strategy_nudge',
        code: 'SOFT_POLICY_BUDGET_EXHAUSTED',
        message: `Soft overrides paused (recent override rate ${(autonomyRateBefore * 100).toFixed(0)}%).`,
        applied: false,
      });
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
        const note: PolicyNote = {
          tier: 'economic_warning',
          code: tooSoon ? 'TRADE_COOLDOWN' : 'TRADE_WITHOUT_PLAN',
          message: tooSoon
            ? 'Back-to-back trade detected. Prefer following through on world actions.'
            : 'Trade action missing why/nextAction plan.',
          applied: false,
        };
        if (softPolicyEnabled) {
          action = {
            type: 'rest',
            reasoning: `[AUTO] Skipping overtrade — focus on town actions.`,
            details: { thought: `No clear use-case for ${action.type}.` },
          };
          note.applied = true;
          softPolicyApplied = true;
        }
        policyNotes.push(note);
      }
    }

    // ── Anti-stall: if agent would "rest" while the town has available plots and they own none, nudge claim. ──
    const shouldNudgeInitialClaim =
      !!obs.town &&
      action.type === 'rest' &&
      obs.myPlots.length === 0 &&
      obs.availablePlots.length > 0;

    if (shouldNudgeInitialClaim) {
      const suggested = goalView?.suggest?.claimPlotIndex;
      const preferred = suggested != null ? obs.availablePlots.find((p: any) => p.plotIndex === suggested) : null;
      const pick = preferred || obs.availablePlots[Math.floor(Math.random() * obs.availablePlots.length)];
      const note: PolicyNote = {
        tier: 'strategy_nudge',
        code: 'INITIAL_FOOTHOLD',
        message: `No owned plots with available land. Suggested claim: plot ${pick.plotIndex}.`,
        applied: false,
      };
      if (softPolicyEnabled) {
        action = {
          type: 'claim_plot',
          reasoning: `[AUTO] No plots yet. Claiming a plot to get started.`,
          details: { plotIndex: pick.plotIndex, why: goalView ? `Goal: ${goalView.goalTitle}` : 'Need a foothold in town' },
        };
        note.applied = true;
        softPolicyApplied = true;
      }
      policyNotes.push(note);
    }

    // ── Build-priority nudges: keep construction momentum without hard-forcing when autonomy budget is exhausted. ──
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
        const note: PolicyNote = {
          tier: 'strategy_nudge',
          code: 'COMPLETE_READY_BUILD',
          message: `Plot ${plot.plotIndex} is ready to complete.`,
          applied: false,
        };
        if (softPolicyEnabled) {
          action = { type: 'complete_build', reasoning: `[AUTO] Completing finished build on plot ${plot.plotIndex}`, details: { plotId: plot.id, plotIndex: plot.plotIndex } };
          note.applied = true;
          softPolicyApplied = true;
        }
        policyNotes.push(note);
      }
      // Priority 1.5: time-bounded objective plot claims (creates stakes + follow-up action)
      else if (objectivePlot && canFundObjectiveClaim && !isObjectiveClaim && action.type !== 'complete_build') {
        const otherId = liveObjective?.participants?.find((p) => p !== agent.id) || '';
        const otherName = safeTrim(obs.otherAgents.find((a) => a.id === otherId)?.name || otherId.slice(0, 6), 24) || 'someone';
        const why =
          liveObjective?.objectiveType === 'RACE_CLAIM'
            ? `Objective race vs ${otherName} — claim before the deadline.`
            : `Objective pact with ${otherName} — claim your assigned plot before the deadline.`;

        const note: PolicyNote = {
          tier: 'strategy_nudge',
          code: 'LIVE_OBJECTIVE_CLAIM',
          message: `Live objective active. Suggested claim ${objectivePlot.plotIndex} (${objectivePlot.zone}).`,
          applied: false,
        };
        if (softPolicyEnabled) {
          action = {
            type: 'claim_plot',
            reasoning: `[AUTO] Live objective — claim plot ${objectivePlot.plotIndex} (${objectivePlot.zone})`,
            details: { plotIndex: objectivePlot.plotIndex, why },
          };
          note.applied = true;
          softPolicyApplied = true;
        }
        policyNotes.push(note);
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
          const note: PolicyNote = {
            tier: 'strategy_nudge',
            code: 'KEEP_BUILD_MOMENTUM',
            message: `Under-construction plot ${plot.plotIndex} is waiting for work.`,
            applied: false,
          };
          if (softPolicyEnabled) {
            action = { type: 'do_work', reasoning: `[AUTO] Working on under-construction plot ${plot.plotIndex}`, details: { plotId: plot.id, plotIndex: plot.plotIndex, stepDescription: nextStep } };
            note.applied = true;
            softPolicyApplied = true;
          }
          policyNotes.push(note);
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
          const note: PolicyNote = {
            tier: 'strategy_nudge',
            code: 'START_CLAIMED_BUILD',
            message: `Claimed plot ${plot.plotIndex} can start building now.`,
            applied: false,
          };
          if (softPolicyEnabled) {
            action = { type: 'start_build', reasoning: `[AUTO] Starting build on claimed plot ${plot.plotIndex}`, details: { plotId: plot.id, plotIndex: plot.plotIndex, buildingType: bt, why: 'Must build on claimed plot' } };
            note.applied = true;
            softPolicyApplied = true;
          }
          policyNotes.push(note);
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
        policyNotes.push({
          tier: 'economic_warning',
          code: 'UNDERFUNDED_ACTION',
          message: `Planned action may fail (need ~${requiredArena} $ARENA, have ${obs.myBalance}; est. reserve top-up ${spend}).`,
          applied: false,
        });
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

    return {
      action,
      cost,
      humanReply,
      policyContext: {
        notes: policyNotes,
        softPolicyEnabled,
        softPolicyApplied,
        autonomyRateBefore,
      },
    };
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

  async execute(
    agent: ArenaAgent,
    action: AgentAction,
    obs: WorldObservation,
    options?: { strict?: boolean },
  ): Promise<ExecutionResult> {
    try {
      if (options?.strict) {
        return this.executeStrict(agent, action, obs);
      }
      const autoTopUpNarrative = '';

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
          {
            const restAction: AgentAction = { ...action, type: 'rest', reasoning: '[REDIRECT] Mining removed', details: {} };
            return {
              success: true,
              narrative: `${agent.name} tried to mine but mining no longer exists. 💤 Resting instead.`,
              actualAction: restAction,
            };
          }
        case 'play_arena':
          return await this.executePlayArena(agent, action, obs);
        case 'buy_skill':
          {
            const res = await this.executeBuySkill(agent, action, obs);
            if (autoTopUpNarrative) res.narrative = `${autoTopUpNarrative} ${res.narrative}`;
            return res;
          }
        case 'transfer_arena':
          return await this.executeTransferArena(agent, action, obs);
        case 'rest':
          if (obs.town) {
            const ucPlot = obs.myPlots.find((p: any) => p.status === 'UNDER_CONSTRUCTION');
            if (ucPlot) {
              const redirected: AgentAction = {
                type: 'do_work',
                reasoning: '[REDIRECT] Rest blocked: under-construction plot available, continuing work.',
                details: {
                  plotId: ucPlot.id,
                  plotIndex: ucPlot.plotIndex,
                  stepDescription: 'Push next construction step',
                },
              };
              const res = await this.executeDoWork(agent, redirected, obs);
              return { ...res, actualAction: redirected };
            }

            const claimedPlot = obs.myPlots.find((p: any) => p.status === 'CLAIMED');
            if (claimedPlot && obs.myBalance >= 8) {
              const redirected: AgentAction = {
                type: 'start_build',
                reasoning: '[REDIRECT] Rest blocked: claimed plot available, starting build.',
                details: {
                  plotId: claimedPlot.id,
                  plotIndex: claimedPlot.plotIndex,
                  buildingType: this.pickDegenBuildingType(claimedPlot.zone),
                },
              };
              const res = await this.executeStartBuild(agent, redirected, obs);
              return { ...res, actualAction: redirected };
            }

            const claimTarget = this.pickDegenClaimTarget(obs.availablePlots || []);
            const claimCost = this.estimateClaimCost(obs);
            if (claimTarget && obs.myBalance >= claimCost) {
              const redirected: AgentAction = {
                type: 'claim_plot',
                reasoning: '[REDIRECT] Rest blocked: claimable plot available with budget.',
                details: {
                  plotIndex: Number(claimTarget.plotIndex),
                  why: 'Fallback anti-idle claim',
                },
              };
              const res = await this.executeClaim(agent, redirected, obs);
              return { ...res, actualAction: redirected };
            }

            if (obs.myReserve > 10 && obs.myBalance < claimCost) {
              const redirected: AgentAction = {
                type: 'buy_arena',
                reasoning: '[REDIRECT] Rest blocked: topping up ARENA for next action.',
                details: {
                  amountIn: Math.max(10, Math.min(60, Math.floor(obs.myReserve))),
                  why: 'Anti-idle liquidity top-up',
                  nextAction: 'claim_plot',
                },
              };
              const res = await this.executeBuyArena(agent, redirected, obs);
              return { ...res, actualAction: redirected };
            }
          }

          {
            const wheel = wheelOfFateService.getStatus();
            if (wheel.phase === 'ANNOUNCING' || wheel.phase === 'FIGHTING') {
              const redirected: AgentAction = {
                type: 'play_arena',
                reasoning: '[REDIRECT] Rest blocked during active wheel phase; rotating to arena.',
                details: {
                  gameType: wheel.currentMatch?.gameType || 'POKER',
                  wager: wheel.currentMatch?.wager || 25,
                },
              };
              const res = await this.executePlayArena(agent, redirected, obs);
              return { ...res, actualAction: redirected };
            }
          }

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

  private estimateBuildStartCost(zoneRaw: unknown): number {
    const zone = String(zoneRaw || '').toUpperCase();
    if (zone === 'COMMERCIAL') return 20;
    if (zone === 'CIVIC') return 35;
    if (zone === 'INDUSTRIAL') return 20;
    if (zone === 'ENTERTAINMENT') return 25;
    return 10;
  }

  private async executeStrict(agent: ArenaAgent, action: AgentAction, obs: WorldObservation): Promise<ExecutionResult> {
    switch (action.type) {
      case 'claim_plot':
        return this.executeClaimStrict(agent, action, obs);
      case 'start_build':
        return this.executeStartBuildStrict(agent, action, obs);
      case 'do_work':
        return this.executeDoWorkStrict(agent, action, obs);
      case 'complete_build':
        return this.executeCompleteBuildStrict(agent, action, obs);
      case 'buy_arena':
        return this.executeBuyArena(agent, action, obs, true);
      case 'sell_arena':
        return this.executeSellArena(agent, action, obs, true);
      case 'play_arena':
        return this.executePlayArena(agent, action, obs, true);
      case 'rest':
        return {
          success: true,
          narrative: `${agent.name} is holding position by explicit command.`,
        };
      case 'transfer_arena':
        return this.executeTransferArena(agent, action, obs);
      case 'buy_skill':
        return this.executeBuySkill(agent, action, obs);
      default:
        return {
          success: false,
          narrative: `${agent.name} cannot execute strict action: ${action.type}`,
          error: `Unsupported strict action ${action.type}`,
        };
    }
  }

  private async executeClaimStrict(agent: ArenaAgent, action: AgentAction, obs: WorldObservation): Promise<ExecutionResult> {
    if (!obs.town) {
      return { success: false, narrative: `${agent.name} cannot claim: no active town`, error: 'NO_TOWN' };
    }
    const plotIndex = Number.parseInt(String(action.details.plotIndex ?? ''), 10);
    if (!Number.isFinite(plotIndex)) {
      return { success: false, narrative: `${agent.name} cannot claim: plotIndex is required`, error: 'INVALID_PLOT_INDEX' };
    }
    const target = (obs.availablePlots || []).find((plot: any) => Number(plot?.plotIndex) === plotIndex);
    if (!target) {
      return { success: false, narrative: `${agent.name} cannot claim plot ${plotIndex}: not available`, error: 'TARGET_UNAVAILABLE' };
    }
    const freshAgent = await prisma.arenaAgent.findUnique({ where: { id: agent.id } });
    const claimCost = this.estimateClaimCost(obs);
    if ((freshAgent?.bankroll ?? agent.bankroll) < claimCost) {
      return {
        success: false,
        narrative: `${agent.name} cannot claim plot ${plotIndex}: need about ${claimCost} $ARENA.`,
        error: 'INSUFFICIENT_ARENA',
      };
    }
    try {
      await townService.claimPlot(agent.id, obs.town.id, plotIndex);
      return {
        success: true,
        narrative: `${agent.name} claimed plot ${plotIndex} by explicit command.`,
      };
    } catch (err: any) {
      return {
        success: false,
        narrative: `${agent.name} claim failed: ${safeTrim(err?.message || 'unknown error', 180)}`,
        error: safeTrim(err?.message || 'CLAIM_FAILED', 180),
      };
    }
  }

  private async executeStartBuildStrict(agent: ArenaAgent, action: AgentAction, obs: WorldObservation): Promise<ExecutionResult> {
    const details = action.details || {};
    const requestedPlotId = safeTrim(details.plotId, 120);
    const requestedPlotIndex = Number.parseInt(String(details.plotIndex ?? ''), 10);
    let target = (obs.myPlots || []).find((plot: any) => plot.status === 'CLAIMED' && requestedPlotId && plot.id === requestedPlotId);
    if (!target && Number.isFinite(requestedPlotIndex)) {
      target = (obs.myPlots || []).find(
        (plot: any) => plot.status === 'CLAIMED' && Number(plot.plotIndex) === requestedPlotIndex,
      );
    }
    if (!target) {
      target = (obs.myPlots || []).find((plot: any) => plot.status === 'CLAIMED');
    }
    if (!target) {
      return {
        success: false,
        narrative: `${agent.name} cannot start build: no claimed plot is ready.`,
        error: 'NO_CLAIMED_PLOT',
      };
    }

    const buildingType = safeTrim(details.buildingType || this.pickDegenBuildingType(target.zone), 60).toUpperCase() || 'HOUSE';
    const freshAgent = await prisma.arenaAgent.findUnique({ where: { id: agent.id } });
    const startCost = this.estimateBuildStartCost(target.zone);
    if ((freshAgent?.bankroll ?? agent.bankroll) < startCost) {
      return {
        success: false,
        narrative: `${agent.name} cannot start build on plot ${target.plotIndex}: need ~${startCost} $ARENA.`,
        error: 'INSUFFICIENT_ARENA',
      };
    }
    try {
      const plot = await townService.startBuild(agent.id, target.id, buildingType);
      return {
        success: true,
        narrative: `${agent.name} started building ${buildingType} on plot ${plot.plotIndex} by explicit command.`,
      };
    } catch (err: any) {
      return {
        success: false,
        narrative: `${agent.name} start_build failed: ${safeTrim(err?.message || 'unknown error', 180)}`,
        error: safeTrim(err?.message || 'START_BUILD_FAILED', 180),
      };
    }
  }

  private async executeDoWorkStrict(agent: ArenaAgent, action: AgentAction, obs: WorldObservation): Promise<ExecutionResult> {
    const details = action.details || {};
    const requestedPlotId = safeTrim(details.plotId, 120);
    const requestedPlotIndex = Number.parseInt(String(details.plotIndex ?? ''), 10);
    let target = (obs.myPlots || []).find(
      (plot: any) => plot.status === 'UNDER_CONSTRUCTION' && requestedPlotId && plot.id === requestedPlotId,
    );
    if (!target && Number.isFinite(requestedPlotIndex)) {
      target = (obs.myPlots || []).find(
        (plot: any) => plot.status === 'UNDER_CONSTRUCTION' && Number(plot.plotIndex) === requestedPlotIndex,
      );
    }
    if (!target) {
      target = (obs.myPlots || []).find((plot: any) => plot.status === 'UNDER_CONSTRUCTION');
    }
    if (!target) {
      return {
        success: false,
        narrative: `${agent.name} cannot work: no under-construction plot is owned.`,
        error: 'NO_ACTIVE_BUILD',
      };
    }
    const strictWorkAction: AgentAction = {
      ...action,
      details: {
        ...action.details,
        plotId: target.id,
        plotIndex: target.plotIndex,
      },
    };
    return this.executeDoWork(agent, strictWorkAction, obs);
  }

  private async executeCompleteBuildStrict(agent: ArenaAgent, action: AgentAction, obs: WorldObservation): Promise<ExecutionResult> {
    const details = action.details || {};
    const requestedPlotId = safeTrim(details.plotId, 120);
    const requestedPlotIndex = Number.parseInt(String(details.plotIndex ?? ''), 10);
    let target = (obs.myPlots || []).find(
      (plot: any) => plot.status === 'UNDER_CONSTRUCTION' && requestedPlotId && plot.id === requestedPlotId,
    );
    if (!target && Number.isFinite(requestedPlotIndex)) {
      target = (obs.myPlots || []).find(
        (plot: any) => plot.status === 'UNDER_CONSTRUCTION' && Number(plot.plotIndex) === requestedPlotIndex,
      );
    }
    if (!target) {
      target = (obs.myPlots || []).find((plot: any) => plot.status === 'UNDER_CONSTRUCTION');
    }
    if (!target) {
      return {
        success: false,
        narrative: `${agent.name} cannot complete build: no under-construction plot found.`,
        error: 'NO_ACTIVE_BUILD',
      };
    }
    const minCalls = this.minCallsForZone(target.zone);
    if (Number(target.apiCallsUsed || 0) < minCalls) {
      return {
        success: false,
        narrative: `${agent.name} cannot complete plot ${target.plotIndex}: only ${target.apiCallsUsed}/${minCalls} work steps done.`,
        error: 'NOT_READY',
      };
    }
    const strictCompleteAction: AgentAction = {
      ...action,
      details: {
        ...action.details,
        plotId: target.id,
        plotIndex: target.plotIndex,
      },
    };
    return this.executeCompleteBuild(agent, strictCompleteAction, obs);
  }

  private async executeClaim(agent: ArenaAgent, action: AgentAction, obs: WorldObservation) {
    const plotIndex = action.details.plotIndex;
    if (plotIndex === undefined) throw new Error('No plotIndex specified');
    if (!obs.town) throw new Error('No active town');

    const freshAgent = await prisma.arenaAgent.findUnique({ where: { id: agent.id } });
    const estClaimCost = Math.max(1, this.estimateClaimCost(obs));
    if (freshAgent && freshAgent.bankroll < estClaimCost) {
      if (freshAgent.reserveBalance > 10) {
        const buyAction: AgentAction = {
          ...action,
          type: 'buy_arena',
          reasoning: `[REDIRECT] Claim requires ~${estClaimCost} $ARENA (have ${freshAgent.bankroll}). Converting reserve first.`,
          details: {
            amountIn: Math.max(10, Math.min(50, Math.floor(freshAgent.reserveBalance))),
            why: 'Fund plot claim',
            nextAction: 'claim_plot',
          },
        };
        const result = await this.executeBuyArena(agent, buyAction, obs);
        return { ...result, actualAction: buyAction };
      }
      return {
        success: true,
        narrative: `${agent.name} skipped claiming plot ${plotIndex}; bankroll ${freshAgent.bankroll} is below estimated claim cost ${estClaimCost} and no reserve is available.`,
        actualAction: {
          ...action,
          type: 'rest' as const,
          reasoning: '[REDIRECT] Claim unaffordable',
          details: { thought: `Need about ${estClaimCost} $ARENA to claim. Waiting.` },
        },
      };
    }

    try {
      const plot = await townService.claimPlot(agent.id, obs.town.id, plotIndex);
      return {
        success: true,
        narrative: `${agent.name} claimed plot ${plotIndex} (${plot.zone})! 💭 "${action.reasoning}"`,
      };
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (/Not enough \$ARENA/i.test(msg)) {
        const latest = await prisma.arenaAgent.findUnique({ where: { id: agent.id } });
        if (latest && latest.reserveBalance > 10) {
          const buyAction: AgentAction = {
            ...action,
            type: 'buy_arena',
            reasoning: `[REDIRECT] Claim failed due low bankroll (${msg}). Converting reserve.`,
            details: {
              amountIn: Math.max(10, Math.min(50, Math.floor(latest.reserveBalance))),
              why: 'Claim retry funding',
              nextAction: 'claim_plot',
            },
          };
          const result = await this.executeBuyArena(agent, buyAction, obs);
          return { ...result, actualAction: buyAction };
        }
        return {
          success: true,
          narrative: `${agent.name} could not claim plot ${plotIndex}: ${msg}. Waiting for more funds.`,
          actualAction: { ...action, type: 'rest' as const, reasoning: '[REDIRECT] Claim failed (broke)', details: {} },
        };
      }
      throw err;
    }
  }

  private async executeBuyArena(agent: ArenaAgent, action: AgentAction, obs: WorldObservation, strict = false) {
    const requestedAmountIn = Number.parseInt(String(action.details.amountIn || '0'), 10);
    if (!Number.isFinite(requestedAmountIn) || requestedAmountIn <= 0) {
      if (strict) {
        return {
          success: false,
          narrative: `${agent.name} cannot buy $ARENA: invalid amountIn.`,
          error: 'INVALID_AMOUNT',
        };
      }
      return {
        success: true,
        narrative: `${agent.name} skipped reserve swap because amountIn was invalid.`,
        actualAction: { ...action, type: 'rest' as const, reasoning: '[REDIRECT] Invalid buy_arena amount', details: {} },
      };
    }
    const minAmountOutRaw =
      action.details.minAmountOut != null ? Number.parseInt(String(action.details.minAmountOut), 10) : undefined;
    const freshAgent = await prisma.arenaAgent.findUnique({ where: { id: agent.id } });
    const availableReserve = Math.max(0, Math.floor(freshAgent?.reserveBalance ?? agent.reserveBalance ?? 0));
    if (availableReserve <= 0) {
      if (strict) {
        return {
          success: false,
          narrative: `${agent.name} cannot buy $ARENA: reserve balance is empty.`,
          error: 'NO_RESERVE',
        };
      }
      return {
        success: true,
        narrative: `${agent.name} tried to buy $ARENA but has no reserve to swap.`,
        actualAction: { ...action, type: 'rest' as const, reasoning: '[REDIRECT] No reserve for buy_arena', details: {} },
      };
    }
    const spendAmount = Math.max(1, Math.min(requestedAmountIn, availableReserve));
    const minAmountOut =
      spendAmount === requestedAmountIn && Number.isFinite(minAmountOutRaw as number) ? minAmountOutRaw : undefined;

    let result;
    try {
      result = await offchainAmmService.swap(agent.id, 'BUY_ARENA', spendAmount, { minAmountOut });
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (/Insufficient reserve balance|amountOut would be 0|amountIn too small|Slippage/i.test(msg)) {
        if (strict) {
          return {
            success: false,
            narrative: `${agent.name} cannot buy $ARENA: ${msg}.`,
            error: safeTrim(msg, 180),
          };
        }
        return {
          success: true,
          narrative: `${agent.name} skipped reserve swap this tick: ${msg}.`,
          actualAction: { ...action, type: 'rest' as const, reasoning: '[REDIRECT] Buy swap not executable', details: {} },
        };
      }
      throw err;
    }
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
            action: action.type,
            reasoning: action.reasoning,
            details: this.stripInternalDetails(action.details),
            decision: this.buildDecisionMetadata(action, action, true),
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
        `${result.swap.amountIn !== requestedAmountIn ? ` (Adjusted from requested ${requestedAmountIn} reserve.)` : ''}` +
        `${price ? ` ~${price.toFixed(3)} reserve/ARENA.` : ''}` +
        `${why ? ` Purpose: ${why}.` : ''}` +
        `${nextAction ? ` Next: ${nextAction}.` : ''}`,
    };
  }

  private async executeSellArena(agent: ArenaAgent, action: AgentAction, obs: WorldObservation, strict = false) {
    const requestedAmountIn = Number.parseInt(String(action.details.amountIn || '0'), 10);
    if (!Number.isFinite(requestedAmountIn) || requestedAmountIn <= 0) {
      if (strict) {
        return {
          success: false,
          narrative: `${agent.name} cannot sell $ARENA: invalid amountIn.`,
          error: 'INVALID_AMOUNT',
        };
      }
      return {
        success: true,
        narrative: `${agent.name} skipped $ARENA sell because amountIn was invalid.`,
        actualAction: { ...action, type: 'rest' as const, reasoning: '[REDIRECT] Invalid sell_arena amount', details: {} },
      };
    }
    const minAmountOutRaw =
      action.details.minAmountOut != null ? Number.parseInt(String(action.details.minAmountOut), 10) : undefined;
    const freshAgent = await prisma.arenaAgent.findUnique({ where: { id: agent.id } });
    const availableArena = Math.max(0, Math.floor(freshAgent?.bankroll ?? agent.bankroll ?? 0));
    if (availableArena <= 0) {
      if (strict) {
        return {
          success: false,
          narrative: `${agent.name} cannot sell $ARENA: bankroll is empty.`,
          error: 'NO_ARENA',
        };
      }
      return {
        success: true,
        narrative: `${agent.name} tried to sell $ARENA but bankroll is empty.`,
        actualAction: { ...action, type: 'rest' as const, reasoning: '[REDIRECT] No bankroll for sell_arena', details: {} },
      };
    }
    const sellAmount = Math.max(1, Math.min(requestedAmountIn, availableArena));
    const minAmountOut =
      sellAmount === requestedAmountIn && Number.isFinite(minAmountOutRaw as number) ? minAmountOutRaw : undefined;

    let result;
    try {
      result = await offchainAmmService.swap(agent.id, 'SELL_ARENA', sellAmount, { minAmountOut });
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (/Insufficient \$ARENA balance|amountOut would be 0|amountIn too small|Slippage/i.test(msg)) {
        if (strict) {
          return {
            success: false,
            narrative: `${agent.name} cannot sell $ARENA: ${msg}.`,
            error: safeTrim(msg, 180),
          };
        }
        return {
          success: true,
          narrative: `${agent.name} skipped $ARENA sell this tick: ${msg}.`,
          actualAction: { ...action, type: 'rest' as const, reasoning: '[REDIRECT] Sell swap not executable', details: {} },
        };
      }
      throw err;
    }
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
            action: action.type,
            reasoning: action.reasoning,
            details: this.stripInternalDetails(action.details),
            decision: this.buildDecisionMetadata(action, action, true),
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
        `${result.swap.amountIn !== requestedAmountIn ? ` (Adjusted from requested ${requestedAmountIn} $ARENA.)` : ''}` +
        `${price ? ` ~${price.toFixed(3)} reserve/ARENA.` : ''}` +
        `${why ? ` Purpose: ${why}.` : ''}` +
        `${nextAction ? ` Next: ${nextAction}.` : ''}`,
    };
  }

  private async executeStartBuild(agent: ArenaAgent, action: AgentAction, obs: WorldObservation): Promise<ExecutionResult> {
    const { buildingType } = action.details;
    if (!buildingType) throw new Error('No buildingType specified');
    if (!obs.town) throw new Error('No active town');
    const fallbackToWork = async (reasoning: string, thought: string): Promise<ExecutionResult> => {
      const workAction: AgentAction = {
        ...action,
        type: 'do_work',
        reasoning,
        details: {
          ...action.details,
          stepDescription: 'Earn wage while waiting to afford next build stage',
        },
      };
      try {
        const result = await this.executeDoWork(agent, workAction, obs);
        return { ...result, actualAction: workAction };
      } catch {
        return {
          success: true,
          narrative: `${agent.name} can't fund a new build right now and found no work opportunity. 💤 Waiting.`,
          actualAction: {
            ...action,
            type: 'rest' as const,
            reasoning: '[REDIRECT] Broke with no available work',
            details: { thought },
          },
        };
      }
    };

    // --- Affordability check: redirect if agent can't afford ANY build ---
    const zoneBaseCost: any = { RESIDENTIAL: 10, COMMERCIAL: 20, CIVIC: 35, INDUSTRIAL: 20, ENTERTAINMENT: 25 };
    const freshAgent = await prisma.arenaAgent.findUniqueOrThrow({ where: { id: agent.id } });
    const costMultiplier = worldEventService.getCostMultiplier();
    const levelCostMultiplier = Math.max(1, 0.6 + obs.town.level * 0.4);
    const estimatedClaimCost = Math.max(1, this.estimateClaimCost(obs));
    const hasBuildPipeline = (obs.myPlots || []).some((p: any) =>
      p?.status === 'UNDER_CONSTRUCTION' || p?.status === 'BUILT',
    );
    const bootstrapBuildDiscount = hasBuildPipeline ? 1 : 0.5;
    const zoneBuildCost = (zone: string) =>
      Math.max(8, Math.round((zoneBaseCost[zone] || 15) * levelCostMultiplier * costMultiplier * bootstrapBuildDiscount));
    const canAffordZone = (zone: string, includeClaimCost: boolean = false) =>
      freshAgent.bankroll >= zoneBuildCost(zone) + (includeClaimCost ? estimatedClaimCost : 0);
    const cheapestBuildCost = Math.min(...Object.keys(zoneBaseCost).map((zone) => zoneBuildCost(zone)));
    if (freshAgent.bankroll < cheapestBuildCost) {
      // Can't afford any build — sell reserve if available, otherwise rest
      if (freshAgent.reserveBalance > 10) {
        const sellAction: AgentAction = { ...action, type: 'buy_arena', reasoning: `[REDIRECT] Can't afford any build (need ${cheapestBuildCost}, have ${freshAgent.bankroll}). Selling reserve for $ARENA.`, details: { amountIn: Math.min(50, freshAgent.reserveBalance), why: 'Need funds to build', nextAction: 'start_build' } };
        console.log(`[AgentLoop] ${agent.name}: start_build redirect → buy_arena (bankroll ${freshAgent.bankroll} < cheapest build ${cheapestBuildCost})`);
        const result = await this.executeBuyArena(agent, sellAction, obs);
        return { ...result, actualAction: sellAction };
      }
      console.log(`[AgentLoop] ${agent.name}: start_build redirect → do_work (broke, no reserve)`);
      return fallbackToWork(
        `[REDIRECT] Can't afford any build (need ${cheapestBuildCost}, have ${freshAgent.bankroll}). Working for wages.`,
        `I need ${cheapestBuildCost} $ARENA but only have ${freshAgent.bankroll}. No reserve to sell.`,
      );
    }
    // --- Intent-based resolution: agent wants to BUILD, system handles sequencing ---

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
      const requiresClaimCost = targetPlot.status === 'EMPTY';
      const cost = zoneBuildCost(targetPlot.zone) + (requiresClaimCost ? estimatedClaimCost : 0);
      if (!canAffordZone(targetPlot.zone, requiresClaimCost)) {
        // Can't afford zone build — try to sell reserve
        if (freshAgent.reserveBalance > 10) {
          const sellAction: AgentAction = { ...action, type: 'buy_arena', reasoning: `[REDIRECT] Can't afford ${targetPlot.zone} build (need ${cost}, have ${freshAgent.bankroll}). Selling reserve.`, details: { amountIn: Math.min(50, freshAgent.reserveBalance), why: `Need ${cost} for build`, nextAction: 'start_build' } };
          const result = await this.executeBuyArena(agent, sellAction, obs);
          return { ...result, actualAction: sellAction };
        }
        return fallbackToWork(
          `[REDIRECT] Can't afford ${targetPlot.zone} build path (need ${cost}, have ${freshAgent.bankroll}). Working first.`,
          `Need ${cost} for ${targetPlot.zone} build and no reserve is available.`,
        );
      }

      if (targetPlot.status === 'EMPTY') {
        // Auto-claim first, then start build
        try {
          console.log(`[AgentLoop] ${agent.name}: auto-claiming plot ${targetPlot.plotIndex} before building`);
          await townService.claimPlot(agent.id, obs.town.id, targetPlot.plotIndex);
          const plot = await townService.startBuild(agent.id, targetPlot.id, buildingType);
          return {
            success: true,
            narrative: `${agent.name} claimed and started building a ${buildingType} on plot ${plot.plotIndex}! 💭 "${action.reasoning}"`,
          };
        } catch (err: any) {
          const msg = String(err?.message || '');
          if (/Not enough \$ARENA/i.test(msg)) {
            const latest = await prisma.arenaAgent.findUnique({ where: { id: agent.id } });
            if (latest && latest.reserveBalance > 10) {
              const buyAction: AgentAction = {
                ...action,
                type: 'buy_arena',
                reasoning: `[REDIRECT] Build bootstrap fell short after claim (${msg}). Converting reserve.`,
                details: {
                  amountIn: Math.max(10, Math.min(50, Math.floor(latest.reserveBalance))),
                  why: 'Fund claim+build chain',
                  nextAction: 'start_build',
                },
              };
              const result = await this.executeBuyArena(agent, buyAction, obs);
              return { ...result, actualAction: buyAction };
            }
            return {
              success: true,
              narrative: `${agent.name} started bootstrap claim but could not fund build afterward (${msg}).`,
              actualAction: { ...action, type: 'rest' as const, reasoning: '[REDIRECT] Broke after claim', details: {} },
            };
          }
          throw err;
        }
      }
      if (targetPlot.status === 'CLAIMED' && targetPlot.ownerId === agent.id) {
        // Perfect — plot is claimed by us, start building
        try {
          const plot = await townService.startBuild(agent.id, plotId!, buildingType);
          return {
            success: true,
            narrative: `${agent.name} started building a ${buildingType} on plot ${plot.plotIndex}! 💭 "${action.reasoning}"`,
          };
        } catch (err: any) {
          const msg = String(err?.message || '');
          if (/Not enough \$ARENA/i.test(msg)) {
            if (freshAgent.reserveBalance > 10) {
              const buyAction: AgentAction = {
                ...action,
                type: 'buy_arena',
                reasoning: `[REDIRECT] Claimed plot build not affordable (${msg}). Converting reserve.`,
                details: {
                  amountIn: Math.max(10, Math.min(50, Math.floor(freshAgent.reserveBalance))),
                  why: 'Fund claimed-plot build',
                  nextAction: 'start_build',
                },
              };
              const result = await this.executeBuyArena(agent, buyAction, obs);
              return { ...result, actualAction: buyAction };
            }
            return {
              success: true,
              narrative: `${agent.name} paused build start on claimed plot because funds are too low (${msg}).`,
              actualAction: { ...action, type: 'rest' as const, reasoning: '[REDIRECT] Claimed build unaffordable', details: {} },
            };
          }
          throw err;
        }
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
        const claimedPlotId = String(cp.id || '');
        if (!claimedPlotId) continue;
        plotId = claimedPlotId;
        const plot = await townService.startBuild(agent.id, claimedPlotId, buildingType);
        return {
          success: true,
          narrative: `${agent.name} started building a ${buildingType} on plot ${plot.plotIndex}! 💭 "${action.reasoning}"`,
        };
      }
    }

    // If we have claimed plots but can't afford any of them, sell reserve or rest
    if (myClaimedPlots.length > 0) {
      if (freshAgent.reserveBalance > 10) {
        const sellAction: AgentAction = { ...action, type: 'buy_arena', reasoning: `[REDIRECT] Has claimed plots but can't afford to build. Selling reserve.`, details: { amountIn: Math.min(50, freshAgent.reserveBalance), why: 'Need funds for building', nextAction: 'start_build' } };
        console.log(`[AgentLoop] ${agent.name}: has claimed plots but can't afford → buy_arena`);
        const result = await this.executeBuyArena(agent, sellAction, obs);
        return { ...result, actualAction: sellAction };
      }
      return fallbackToWork(
        '[REDIRECT] Has claimed plots but cannot fund construction. Working instead.',
        'I have claimed plots but need more $ARENA to begin construction.',
      );
    }

    // 4. Last resort: auto-claim an available plot and build (check affordability)
    const affordablePlots = obs.availablePlots.filter((p: any) => canAffordZone(p.zone, true));
    if (affordablePlots.length > 0) {
      const avail = affordablePlots[0];
      try {
        console.log(`[AgentLoop] ${agent.name}: auto-claiming available plot ${avail.plotIndex} for build`);
        await townService.claimPlot(agent.id, obs.town.id, avail.plotIndex);
        const plot = await townService.startBuild(agent.id, avail.id, buildingType);
        return {
          success: true,
          narrative: `${agent.name} found a spot, claimed plot ${plot.plotIndex}, and started building a ${buildingType}! 💭 "${action.reasoning}"`,
        };
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (/Not enough \$ARENA/i.test(msg)) {
          const latest = await prisma.arenaAgent.findUnique({ where: { id: agent.id } });
          if (latest && latest.reserveBalance > 10) {
            const buyAction: AgentAction = {
              ...action,
              type: 'buy_arena',
              reasoning: `[REDIRECT] Auto-claim build chain failed (${msg}). Converting reserve.`,
              details: {
                amountIn: Math.max(10, Math.min(50, Math.floor(latest.reserveBalance))),
                why: 'Fund fallback claim+build',
                nextAction: 'start_build',
              },
            };
            const result = await this.executeBuyArena(agent, buyAction, obs);
            return { ...result, actualAction: buyAction };
          }
          return {
            success: true,
            narrative: `${agent.name} attempted fallback claim+build but stalled on funds (${msg}).`,
            actualAction: { ...action, type: 'rest' as const, reasoning: '[REDIRECT] Fallback build unaffordable', details: {} },
          };
        }
        throw err;
      }
    }

    // Nothing affordable — sell reserve or rest
    if (freshAgent.reserveBalance > 10) {
      const sellAction: AgentAction = { ...action, type: 'buy_arena', reasoning: `[REDIRECT] No affordable plots. Selling reserve for $ARENA.`, details: { amountIn: Math.min(50, freshAgent.reserveBalance), why: 'Need funds', nextAction: 'claim_plot' } };
      console.log(`[AgentLoop] ${agent.name}: no affordable plots → buy_arena`);
      const result = await this.executeBuyArena(agent, sellAction, obs);
      return { ...result, actualAction: sellAction };
    }
    return fallbackToWork(
      '[REDIRECT] No affordable build options and no reserve. Working to earn wage.',
      'No build path is affordable right now.',
    );
  }

  private async executeDoWork(agent: ArenaAgent, action: AgentAction, obs: WorldObservation): Promise<ExecutionResult> {
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
        try {
          await townService.startBuild(agent.id, claimedPlot.id, bt);
          plotId = claimedPlot.id;
        } catch (err: any) {
          const msg = String(err?.message || '');
          if (/Not enough \$ARENA/i.test(msg)) {
            const latest = await prisma.arenaAgent.findUnique({ where: { id: agent.id } });
            if (latest && latest.reserveBalance > 10) {
              const buyAction: AgentAction = {
                ...action,
                type: 'buy_arena',
                reasoning: `[REDIRECT] Work bootstrap build unaffordable (${msg}). Converting reserve.`,
                details: {
                  amountIn: Math.max(10, Math.min(50, Math.floor(latest.reserveBalance))),
                  why: 'Fund work bootstrap',
                  nextAction: 'do_work',
                },
              };
              const result = await this.executeBuyArena(agent, buyAction, obs);
              return { ...result, actualAction: buyAction };
            }
            return {
              success: true,
              narrative: `${agent.name} wanted to start work pipeline but lacks funds to begin construction (${msg}).`,
              actualAction: { ...action, type: 'rest' as const, reasoning: '[REDIRECT] Work bootstrap broke', details: {} },
            };
          }
          throw err;
        }
      }
    }

    // 4. If agent has no plots at all, auto-claim + start build
    if (!plotId && obs.availablePlots.length > 0) {
      const avail = obs.availablePlots[0];
      const bt = action.details.buildingType || action.details.stepDescription || 'Workshop';
      console.log(`[AgentLoop] ${agent.name}: auto-claiming plot ${avail.plotIndex} and starting build for work`);
      try {
        await townService.claimPlot(agent.id, obs.town.id, avail.plotIndex);
        await townService.startBuild(agent.id, avail.id, bt);
        plotId = avail.id;
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (/Not enough \$ARENA/i.test(msg)) {
          const latest = await prisma.arenaAgent.findUnique({ where: { id: agent.id } });
          if (latest && latest.reserveBalance > 10) {
            const buyAction: AgentAction = {
              ...action,
              type: 'buy_arena',
              reasoning: `[REDIRECT] Claim+build for work is unaffordable (${msg}). Converting reserve.`,
              details: {
                amountIn: Math.max(10, Math.min(50, Math.floor(latest.reserveBalance))),
                why: 'Fund claim+work bootstrap',
                nextAction: 'do_work',
              },
            };
            const result = await this.executeBuyArena(agent, buyAction, obs);
            return { ...result, actualAction: buyAction };
          }
          return {
            success: true,
            narrative: `${agent.name} tried to bootstrap work via claim+build but couldn't cover costs (${msg}).`,
            actualAction: { ...action, type: 'rest' as const, reasoning: '[REDIRECT] Claim+work bootstrap broke', details: {} },
          };
        }
        throw err;
      }
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

    if (!plotId) throw new Error('No plot to work on');

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

    // Work wage: pay from pool for each completed inference step to keep early loop solvent.
    const minCallsForPlot = Math.max(1, this.minCallsForZone(plot.zone));
    const baseFromBuildCost = Math.ceil(Math.max(8, plot.buildCostArena || 10) / (minCallsForPlot * 2));
    const targetWorkReward = Math.max(3, Math.min(6, baseFromBuildCost));
    let workReward = 0;
    try {
      const pool = await this.getOrCreateEconomyPool();
      if (pool.arenaBalance - targetWorkReward >= SOLVENCY_POOL_FLOOR) {
        await prisma.economyPool.update({ where: { id: pool.id }, data: { arenaBalance: { decrement: targetWorkReward } } });
        await prisma.arenaAgent.update({ where: { id: agent.id }, data: { bankroll: { increment: targetWorkReward } } });
        workReward = targetWorkReward;
      }
    } catch {}

    const rewardNote = workReward > 0 ? ` and earned ${workReward} $ARENA` : '';
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

    let completionBonusNote = '';
    try {
      const completionBonusTarget = Math.max(6, Math.min(24, Math.round(Math.max(10, plot.buildCostArena || 10) * 0.45)));
      const pool = await this.getOrCreateEconomyPool();
      const grant = Math.min(completionBonusTarget, Math.max(0, pool.arenaBalance - SOLVENCY_POOL_FLOOR));
      if (grant > 0) {
        await prisma.economyPool.update({ where: { id: pool.id }, data: { arenaBalance: { decrement: grant } } });
        await prisma.arenaAgent.update({ where: { id: agent.id }, data: { bankroll: { increment: grant } } });
        completionBonusNote = ` 💰 Completion bonus: +${grant} $ARENA.`;
      }
    } catch {}

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
        where: { agentId: agent.id, plotId: plotId, workType: { in: ['DESIGN', 'CONSTRUCT'] } },
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
      console.error(`[AgentLoop] Quality eval failed for ${plot.buildingType}: ${err.message}`, err.stack?.split('\n')[1] || '');
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
      narrative: `${agent.name} completed their ${plot.buildingType}! 🎉 The building stands proud in the town.${completionBonusNote}${qualityNote}${bountyNote}`,
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

  private pickTurboPokerAction(validActionsRaw: unknown[], firstMove: boolean): string {
    const valid = Array.isArray(validActionsRaw)
      ? validActionsRaw.map((a) => String(a || '').toLowerCase())
      : [];
    const has = (action: string) => valid.includes(action);

    if (firstMove && has('all-in')) return 'all-in';
    if (has('call')) return 'call';
    if (has('check')) return 'check';
    if (has('all-in')) return 'all-in';
    if (has('raise')) return 'raise';
    if (has('fold')) return 'fold';
    return valid[0] || 'fold';
  }

  private async executePlayArena(
    agent: ArenaAgent,
    action: AgentAction,
    obs: WorldObservation,
    strict = false,
  ): Promise<ExecutionResult> {
    const wheel = wheelOfFateService.getStatus();
    const activeMatch = wheel.currentMatch;
    const isActiveFighter = !!activeMatch
      && (activeMatch.agent1.id === agent.id || activeMatch.agent2.id === agent.id)
      && (wheel.phase === 'ANNOUNCING' || wheel.phase === 'FIGHTING');
    if (isActiveFighter) {
      return {
        success: true,
        narrative: `${agent.name} is locked into the Wheel of Fate duel queue (${wheel.phase}). 🎰 Holding for official fight resolution.`,
      };
    }

    const freshAgent = await prisma.arenaAgent.findUnique({ where: { id: agent.id } });
    if (!freshAgent) throw new Error('Agent not found');
    if (freshAgent.isInMatch || freshAgent.currentMatchId) {
      return {
        success: true,
        narrative: `${agent.name} is already in an active arena match and can’t queue another duel yet.`,
      };
    }

    if (freshAgent.bankroll < ARENA_MIN_WAGER) {
      if (!strict && freshAgent.reserveBalance > 10) {
        const spot = Math.max(0.01, Number(obs.economy?.spotPrice || 1));
        const shortfallArena = Math.max(ARENA_MIN_WAGER - freshAgent.bankroll, 0);
        const reserveToSell = Math.max(10, Math.min(freshAgent.reserveBalance, Math.ceil(shortfallArena * spot * 1.2)));
        const buyAction: AgentAction = {
          ...action,
          type: 'buy_arena',
          reasoning: `[REDIRECT] Need at least ${ARENA_MIN_WAGER} $ARENA before a duel; converting reserve.`,
          details: {
            amountIn: reserveToSell,
            why: 'Fund turbo poker duel',
            nextAction: 'play_arena',
          },
        };
        const result = await this.executeBuyArena(agent, buyAction, obs);
        return { ...result, actualAction: buyAction };
      }
      const msg = `${agent.name} can’t enter arena duels below ${ARENA_MIN_WAGER} $ARENA bankroll.`;
      if (strict) return { success: false, narrative: msg, error: 'INSUFFICIENT_ARENA' };
      return {
        success: true,
        narrative: `${msg} No reserve available for a top-up, so they hold position this tick.`,
        actualAction: {
          ...action,
          type: 'rest',
          reasoning: '[REDIRECT] Arena duel unaffordable',
          details: { thought: `Need at least ${ARENA_MIN_WAGER} $ARENA to fight.` },
        },
      };
    }

    const requestedWagerRaw = Number.parseInt(String(action.details.wager || 25), 10);
    const requestedWager = Number.isFinite(requestedWagerRaw) ? requestedWagerRaw : 25;
    const softCapByBankroll = Math.max(ARENA_MIN_WAGER, Math.floor(freshAgent.bankroll * 0.3));
    const desiredWager = Math.max(ARENA_MIN_WAGER, Math.min(requestedWager, softCapByBankroll));

    const rivals = new Set((obs.relationships?.rivals || []).map((r) => r.agentId));
    const opponents = await prisma.arenaAgent.findMany({
      where: {
        id: { not: agent.id },
        isActive: true,
        isInMatch: false,
        health: { gt: 0 },
        bankroll: { gte: ARENA_MIN_WAGER },
      },
      select: {
        id: true,
        name: true,
        archetype: true,
        bankroll: true,
        elo: true,
      },
      take: 24,
    });

    const rankedOpponents = opponents
      .sort((a, b) => {
        const score = (c: typeof a) =>
          (rivals.has(c.id) ? 120 : 0)
          + Math.max(0, 45 - Math.floor(Math.abs(c.elo - freshAgent.elo) / 20))
          + Math.min(80, Math.floor(c.bankroll / 12));
        return score(b) - score(a);
      });

    if (rankedOpponents.length === 0) {
      const msg = `${agent.name} found no eligible opponents for a duel right now.`;
      if (strict) return { success: false, narrative: msg, error: 'NO_OPPONENTS' };
      return {
        success: true,
        narrative: `${msg} They’ll keep pressure on build/work until fighters are available.`,
        actualAction: {
          ...action,
          type: 'rest',
          reasoning: '[REDIRECT] No arena opponents available',
          details: { thought: 'Queue looked empty.' },
        },
      };
    }

    let selectedOpponent: typeof rankedOpponents[number] | null = null;
    let createdMatchId: string | null = null;
    let finalWager = desiredWager;
    const creationErrors: string[] = [];
    for (const candidate of rankedOpponents) {
      const wagerForCandidate = Math.max(
        ARENA_MIN_WAGER,
        Math.min(desiredWager, freshAgent.bankroll, candidate.bankroll),
      );
      if (wagerForCandidate < ARENA_MIN_WAGER) continue;
      try {
        const match = await arenaService.createMatch({
          agentId: agent.id,
          opponentId: candidate.id,
          gameType: ArenaGameType.POKER,
          wagerAmount: wagerForCandidate,
          skipPredictionMarket: true,
        });
        selectedOpponent = candidate;
        createdMatchId = match.id;
        finalWager = wagerForCandidate;
        break;
      } catch (err: any) {
        creationErrors.push(safeTrim(err?.message || 'match creation failed', 120));
      }
    }

    if (!createdMatchId || !selectedOpponent) {
      const reason = creationErrors[0] ? ` (${creationErrors[0]})` : '';
      const msg = `${agent.name} failed to lock a duel matchup${reason}.`;
      if (strict) return { success: false, narrative: msg, error: 'MATCH_CREATE_FAILED' };
      return {
        success: true,
        narrative: `${msg} They’ll rotate back into build/work pressure next tick.`,
        actualAction: {
          ...action,
          type: 'rest',
          reasoning: '[REDIRECT] Arena matchup failed',
          details: { thought: 'Retrying next tick.' },
        },
      };
    }

    const moveTrace: string[] = [];
    let usedFallback = false;
    for (let i = 0; i < ARENA_TURBO_MAX_ACTIONS; i++) {
      const state = await arenaService.getMatchState(createdMatchId);
      if (state.status !== 'ACTIVE' || state.isComplete || !state.currentTurnId) break;
      const actorId = String(state.currentTurnId);
      const validActions = Array.isArray(state.validActions) ? state.validActions : [];
      if (validActions.length === 0) break;
      const chosenAction = this.pickTurboPokerAction(validActions, i === 0);
      try {
        await arenaService.submitMove({
          matchId: createdMatchId,
          agentId: actorId,
          action: chosenAction,
        });
        moveTrace.push(`${actorId.slice(0, 6)}:${chosenAction}`);
      } catch {
        const valid = validActions.map((v: unknown) => String(v).toLowerCase());
        const safeAction = valid.includes('check')
          ? 'check'
          : valid.includes('call')
            ? 'call'
            : valid.includes('fold')
              ? 'fold'
              : (valid[0] || 'fold');
        await arenaService.submitMove({
          matchId: createdMatchId,
          agentId: actorId,
          action: safeAction,
        });
        moveTrace.push(`${actorId.slice(0, 6)}:${chosenAction}->${safeAction}`);
        usedFallback = true;
      }
    }

    const settled = await prisma.arenaMatch.findUnique({
      where: { id: createdMatchId },
      select: { status: true, winnerId: true },
    });

    if (!settled || settled.status !== 'COMPLETED') {
      try {
        await arenaService.cancelMatch(createdMatchId, agent.id);
      } catch {}
      const msg = `${agent.name} opened a turbo poker duel vs ${selectedOpponent.name}, but settlement timed out and the match was cancelled with refunds.`;
      if (strict) return { success: false, narrative: msg, error: 'MATCH_TIMEOUT' };
      return {
        success: true,
        narrative: msg,
        actualAction: {
          ...action,
          type: 'rest',
          reasoning: '[REDIRECT] Turbo duel timeout',
          details: { thought: 'Arena state reset after timeout.' },
        },
      };
    }

    const [agentAfter, opponentAfter] = await Promise.all([
      prisma.arenaAgent.findUnique({
        where: { id: agent.id },
        select: { bankroll: true },
      }),
      prisma.arenaAgent.findUnique({
        where: { id: selectedOpponent.id },
        select: { bankroll: true },
      }),
    ]);
    const myBankrollAfter = agentAfter?.bankroll ?? freshAgent.bankroll;
    const oppBankrollAfter = opponentAfter?.bankroll ?? selectedOpponent.bankroll;
    const myDelta = myBankrollAfter - freshAgent.bankroll;
    const oppDelta = oppBankrollAfter - selectedOpponent.bankroll;

    let outcome = 'DRAW';
    if (settled.winnerId === agent.id) outcome = 'WIN';
    else if (settled.winnerId === selectedOpponent.id) outcome = 'LOSS';
    const outcomeText = outcome === 'WIN'
      ? `WIN vs ${selectedOpponent.name}`
      : outcome === 'LOSS'
        ? `LOSS vs ${selectedOpponent.name}`
        : `DRAW vs ${selectedOpponent.name}`;
    const deltaText = `${myDelta >= 0 ? '+' : ''}${myDelta} $ARENA`;
    const oppDeltaText = `${oppDelta >= 0 ? '+' : ''}${oppDelta} $ARENA`;
    const traceSuffix = moveTrace.length > 0 ? ` Moves: ${moveTrace.join(' | ')}` : '';
    const fallbackSuffix = usedFallback ? ' (safety fallback used)' : '';

    return {
      success: true,
      narrative:
        `${agent.name} fired a turbo poker duel (wager ${finalWager}) and locked ${outcomeText}. ` +
        `Bankroll: ${freshAgent.bankroll} → ${myBankrollAfter} (${deltaText}); ` +
        `${selectedOpponent.name}: ${selectedOpponent.bankroll} → ${oppBankrollAfter} (${oppDeltaText}).` +
        `${traceSuffix}${fallbackSuffix} 💭 "${action.reasoning}"`,
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
