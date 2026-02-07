/**
 * x402SkillService — Paid (in-$ARENA) skills that agents can purchase.
 *
 * Design goals:
 * - Feels like intentional "tool use", not random content buying.
 * - Buyer gets full structured output; spectators see a safe summary via town events.
 * - Hard throttles to prevent spam + herding + prompt-injection issues.
 *
 * NOTE: For hackathon/demo we charge agents' off-chain $ARENA balance (ArenaAgent.bankroll).
 * This is NOT the HTTP x402 middleware. It's an in-world economic mechanic.
 */

import { PlotZone } from '@prisma/client';
import { prisma } from '../config/database';
import { offchainAmmService } from './offchainAmmService';
import { smartAiService } from './smartAiService';

export type X402SkillName = 'MARKET_DEPTH' | 'BLUEPRINT_INDEX' | 'SCOUT_REPORT';

export type BuySkillRequest = {
  skill: X402SkillName;
  // Narrative fields (used for logging + preventing "random buys").
  question: string;
  whyNow: string;
  expectedNextAction: string;
  ifThen: { if: string; then: string; else?: string };
  // Skill-specific structured params.
  params: Record<string, unknown>;
};

export type BuySkillResult = {
  skill: X402SkillName;
  cached: boolean;
  priceArena: number;
  spotPriceUsed: number | null; // reserve per ARENA
  output: Record<string, unknown>;
  publicSummary: string; // safe for global event feed
};

type SkillConfig = {
  basePriceReserve: number; // target value in "reserve" units
  ttlTicks: number;
  minTicksBetweenBuys: number;
};

const SKILL_CONFIG: Record<X402SkillName, SkillConfig> = {
  MARKET_DEPTH: { basePriceReserve: 6, ttlTicks: 2, minTicksBetweenBuys: 2 },
  BLUEPRINT_INDEX: { basePriceReserve: 18, ttlTicks: 20, minTicksBetweenBuys: 5 },
  SCOUT_REPORT: { basePriceReserve: 12, ttlTicks: 5, minTicksBetweenBuys: 3 },
};

const GLOBAL_MIN_TICKS_BETWEEN_PURCHASES = 3;
const MAX_PURCHASES_PER_10_TICKS = 2;

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function estimateSkillPriceArena(skill: X402SkillName, spotPrice: number | null): number {
  const cfg = SKILL_CONFIG[skill];
  // Peg value in reserve; pay in $ARENA. spotPrice = reserve per ARENA.
  if (!spotPrice || !Number.isFinite(spotPrice) || spotPrice <= 0) {
    // Fallback: fixed-ish $ARENA fee in demo if economy unavailable.
    return clampInt(Math.ceil(cfg.basePriceReserve / 2), 1, 250);
  }
  const arena = Math.ceil(cfg.basePriceReserve / spotPrice);
  return clampInt(arena, 1, 250);
}

function safeTrim(s: unknown, maxLen: number): string {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function canonicalKey(skill: X402SkillName, params: Record<string, unknown>): string {
  // Stable stringify. We only need "good enough" for demo caching.
  const keys = Object.keys(params).sort();
  const obj: Record<string, unknown> = {};
  for (const k of keys) obj[k] = params[k];
  return `${skill}:${JSON.stringify(obj)}`;
}

type AgentPurchaseWindow = {
  lastPurchaseTick: number;
  windowStartTick: number;
  purchasesInWindow: number;
  spentArenaInWindow: number;
  // Per-skill cooldowns.
  lastSkillTick: Partial<Record<X402SkillName, number>>;
};

type CacheEntry = {
  createdTick: number;
  result: BuySkillResult;
};

export class X402SkillService {
  private cacheByAgent = new Map<string, Map<string, CacheEntry>>();
  private windowByAgent = new Map<string, AgentPurchaseWindow>();

  private getWindow(agentId: string): AgentPurchaseWindow {
    const existing = this.windowByAgent.get(agentId);
    if (existing) return existing;
    const w: AgentPurchaseWindow = {
      lastPurchaseTick: -1,
      windowStartTick: 0,
      purchasesInWindow: 0,
      spentArenaInWindow: 0,
      lastSkillTick: {},
    };
    this.windowByAgent.set(agentId, w);
    return w;
  }

  private getAgentCache(agentId: string) {
    let m = this.cacheByAgent.get(agentId);
    if (!m) {
      m = new Map();
      this.cacheByAgent.set(agentId, m);
    }
    return m;
  }

  private estimatePriceArena(skill: X402SkillName, spotPrice: number | null): number {
    return estimateSkillPriceArena(skill, spotPrice);
  }

  private assertMeaningfulPurchase(req: BuySkillRequest) {
    // These fields prevent "random buying shit".
    if (!req.skill) throw new Error('buy_skill missing skill');
    if (safeTrim(req.question, 1).length === 0) throw new Error('buy_skill missing question');
    if (safeTrim(req.whyNow, 1).length === 0) throw new Error('buy_skill missing whyNow');
    if (safeTrim(req.expectedNextAction, 1).length === 0) throw new Error('buy_skill missing expectedNextAction');
    if (!req.ifThen || safeTrim(req.ifThen.if, 1).length === 0 || safeTrim(req.ifThen.then, 1).length === 0) {
      throw new Error('buy_skill missing ifThen plan');
    }
  }

  private assertStakeThreshold(
    req: BuySkillRequest,
    obs: { myBalance: number; myReserve: number; townLevel: number; economySpotPrice: number | null },
  ) {
    // Simple thresholds that make buying feel intentional.
    if (req.skill === 'MARKET_DEPTH') {
      const side = String(req.params.side || '').toUpperCase();
      const amountIn = Number(req.params.amountIn);
      if (!['BUY_ARENA', 'SELL_ARENA'].includes(side)) throw new Error('MARKET_DEPTH requires params.side BUY_ARENA|SELL_ARENA');
      if (!Number.isFinite(amountIn) || amountIn <= 0) throw new Error('MARKET_DEPTH requires params.amountIn > 0');

      // Only allow if the planned trade is meaningfully sized.
      const relevant = side === 'BUY_ARENA' ? obs.myReserve : obs.myBalance;
      const threshold = Math.max(500, Math.floor(relevant * 0.25));
      if (amountIn < threshold) {
        throw new Error(`MARKET_DEPTH not justified for small trade (need >= ${threshold})`);
      }

      // Must be used for a trade next (commitment).
      if (!['buy_arena', 'sell_arena'].includes(req.expectedNextAction)) {
        throw new Error('MARKET_DEPTH expectedNextAction must be buy_arena or sell_arena');
      }
      return;
    }

    if (req.skill === 'BLUEPRINT_INDEX') {
      // Must be in context of building.
      if (!['start_build', 'do_work'].includes(req.expectedNextAction)) {
        throw new Error('BLUEPRINT_INDEX expectedNextAction must be start_build or do_work');
      }
      const buildingType = safeTrim(req.params.buildingType, 48);
      if (!buildingType) throw new Error('BLUEPRINT_INDEX requires params.buildingType');
      const zone = safeTrim(req.params.zone, 24).toUpperCase();
      if (zone && !['RESIDENTIAL', 'COMMERCIAL', 'CIVIC', 'INDUSTRIAL', 'ENTERTAINMENT'].includes(zone)) {
        throw new Error('BLUEPRINT_INDEX params.zone invalid');
      }
      // Don't allow if the agent is completely broke.
      const coreBuild = Math.max(10, 20 * Math.max(1, obs.townLevel));
      if (obs.myBalance < Math.max(5, Math.floor(coreBuild * 0.15))) {
        throw new Error('BLUEPRINT_INDEX not justified when too broke to build');
      }
      return;
    }

    if (req.skill === 'SCOUT_REPORT') {
      if (!['claim_plot', 'start_build'].includes(req.expectedNextAction)) {
        throw new Error('SCOUT_REPORT expectedNextAction must be claim_plot or start_build');
      }
      const zone = safeTrim(req.params.zone, 24).toUpperCase();
      if (!zone) throw new Error('SCOUT_REPORT requires params.zone');
      if (!['RESIDENTIAL', 'COMMERCIAL', 'CIVIC', 'INDUSTRIAL', 'ENTERTAINMENT'].includes(zone)) {
        throw new Error('SCOUT_REPORT params.zone invalid');
      }
      return;
    }
  }

  private computeMaxSpendArenaPer10Ticks(townLevel: number): number {
    // Runway-based, not raw balance. Keeps x402 "special".
    const claimCost = 10 + Math.max(0, townLevel - 1) * 5;
    const typicalBuildCost = 20 * Math.max(1, townLevel);
    const core = claimCost + typicalBuildCost;
    return clampInt(Math.ceil(core * 0.25), 10, 2500);
  }

  private async runMarketDepth(params: { side: 'BUY_ARENA' | 'SELL_ARENA'; amountIn: number }) {
    const q = await offchainAmmService.quote(params.side, params.amountIn);
    const spot = q.priceBefore;
    const exec = params.side === 'BUY_ARENA'
      ? q.amountIn / q.amountOut
      : q.amountOut / q.amountIn;
    const slippageBps = spot > 0 ? Math.round(((exec - spot) / spot) * 10000) : 0;
    const priceImpactPct = spot > 0 ? Math.round(((q.priceAfter - q.priceBefore) / q.priceBefore) * 1000) / 10 : 0;

    return {
      quote: q,
      executionPrice: exec,
      slippageBps,
      priceImpactPct,
    } as Record<string, unknown>;
  }

  private async runBlueprintIndex(input: { townName: string; theme: string; zone: PlotZone; buildingType: string }) {
    const spec = smartAiService.getModelSpec('deepseek-v3');
    const start = Date.now();
    const response = await smartAiService.callModel(
      spec,
      [
        {
          role: 'system',
          content:
            `You are BlueprintIndex, a paid planning tool for an AI town.\n` +
            `Return STRICT JSON only (no markdown).\n` +
            `You produce a short plan that helps an agent build, without telling them what maximizes profit.`,
        },
        {
          role: 'user',
          content:
            `Town: ${input.townName}\nTheme: ${input.theme}\nZone: ${input.zone}\nBuildingType: ${input.buildingType}\n\n` +
            `Return JSON with keys:\n` +
            `- planSteps: string[] (3-6 steps)\n` +
            `- risks: string[] (0-4)\n` +
            `- qualityChecks: string[] (0-4)\n` +
            `- uncertainty: string (one sentence)\n`,
        },
      ],
      0.4,
    );
    const latencyMs = Date.now() - start;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(response.content || '{}') as Record<string, unknown>;
    } catch {
      parsed = {
        planSteps: ['Draft an exterior concept', 'Draft an interior concept', 'Add staff/roles', 'Write a short lore hook'],
        risks: ['Tool output was malformed; treat this as a rough template'],
        qualityChecks: ['Keep it coherent with the town theme'],
        uncertainty: 'This plan is approximate due to a formatting issue.',
      };
    }
    const cost = smartAiService.calculateCost(spec, response.inputTokens, response.outputTokens, latencyMs);
    return { output: parsed, modelUsed: spec.modelName, apiCalls: 1, apiCostCents: cost.costCents, responseTimeMs: latencyMs };
  }

  private async runScoutReport(input: {
    townName: string;
    theme: string;
    zone: PlotZone;
    recentEvents: Array<{ title: string; description: string }>;
  }) {
    const spec = smartAiService.getModelSpec('deepseek-v3');
    const start = Date.now();
    const response = await smartAiService.callModel(
      spec,
      [
        {
          role: 'system',
          content:
            `You are ScoutReport, a paid intel tool for an AI town.\n` +
            `Return STRICT JSON only (no markdown).\n` +
            `You provide partial, uncertain information. Do NOT reveal hidden stats.`,
        },
        {
          role: 'user',
          content:
            `Town: ${input.townName}\nTheme: ${input.theme}\nZone: ${input.zone}\n\n` +
            `Recent events:\n${input.recentEvents.map((e) => `- ${e.title}: ${e.description}`).join('\n')}\n\n` +
            `Return JSON with keys:\n` +
            `- risk: "LOW"|"MED"|"HIGH"\n` +
            `- signals: string[] (2-6 short bullets)\n` +
            `- suggestedQuestions: string[] (1-3) (what a cautious agent might ask next)\n` +
            `- uncertainty: string (one sentence)\n`,
        },
      ],
      0.5,
    );
    const latencyMs = Date.now() - start;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(response.content || '{}') as Record<string, unknown>;
    } catch {
      parsed = {
        risk: 'MED',
        signals: ['Report formatting failed; treat this as low-confidence'],
        suggestedQuestions: ['What changed recently in this zone?'],
        uncertainty: 'Low confidence due to formatting issue.',
      };
    }
    const cost = smartAiService.calculateCost(spec, response.inputTokens, response.outputTokens, latencyMs);
    return { output: parsed, modelUsed: spec.modelName, apiCalls: 1, apiCostCents: cost.costCents, responseTimeMs: latencyMs };
  }

  async buySkill(opts: {
    agentId: string;
    townId: string;
    townLevel: number;
    townName: string;
    townTheme: string;
    recentEvents: Array<{ title: string; description: string }>;
    myBalance: number;
    myReserve: number;
    economySpotPrice: number | null;
    currentTick: number;
    request: BuySkillRequest;
  }): Promise<BuySkillResult> {
    this.assertMeaningfulPurchase(opts.request);
    this.assertStakeThreshold(opts.request, {
      myBalance: opts.myBalance,
      myReserve: opts.myReserve,
      townLevel: opts.townLevel,
      economySpotPrice: opts.economySpotPrice,
    });

    const cfg = SKILL_CONFIG[opts.request.skill];
    const cacheKey = canonicalKey(opts.request.skill, opts.request.params);
    const agentCache = this.getAgentCache(opts.agentId);
    const existing = agentCache.get(cacheKey);
    if (existing && opts.currentTick - existing.createdTick <= cfg.ttlTicks) {
      throw new Error(`Cached result still valid for ${opts.request.skill} — wait ${cfg.ttlTicks} ticks before repurchasing`);
    }

    const w = this.getWindow(opts.agentId);

    // Rolling window reset (10 ticks).
    if (opts.currentTick - w.windowStartTick >= 10) {
      w.windowStartTick = opts.currentTick;
      w.purchasesInWindow = 0;
      w.spentArenaInWindow = 0;
    }

    if (w.lastPurchaseTick >= 0 && opts.currentTick - w.lastPurchaseTick < GLOBAL_MIN_TICKS_BETWEEN_PURCHASES) {
      throw new Error(`Too soon to buy another skill (wait ${GLOBAL_MIN_TICKS_BETWEEN_PURCHASES} ticks)`);
    }
    const lastSkill = w.lastSkillTick[opts.request.skill];
    if (typeof lastSkill === 'number' && opts.currentTick - lastSkill < cfg.minTicksBetweenBuys) {
      throw new Error(`Skill cooldown: wait ${cfg.minTicksBetweenBuys} ticks before buying ${opts.request.skill} again`);
    }
    if (w.purchasesInWindow >= MAX_PURCHASES_PER_10_TICKS) {
      throw new Error(`Purchase cap reached (max ${MAX_PURCHASES_PER_10_TICKS} per 10 ticks)`);
    }

    const priceArena = this.estimatePriceArena(opts.request.skill, opts.economySpotPrice);
    const maxSpend = this.computeMaxSpendArenaPer10Ticks(opts.townLevel);
    if (w.spentArenaInWindow + priceArena > maxSpend) {
      throw new Error(`Skill spend cap reached (${w.spentArenaInWindow}/${maxSpend} $ARENA in window)`);
    }

    let output: Record<string, unknown> = {};
    let publicSummary = '';
    let modelUsed = 'OFFCHAIN';
    let apiCalls = 0;
    let apiCostCents = 0;
    let responseTimeMs = 0;

    if (opts.request.skill === 'MARKET_DEPTH') {
      const side = String(opts.request.params.side || '').toUpperCase() as 'BUY_ARENA' | 'SELL_ARENA';
      const amountIn = Number(opts.request.params.amountIn);
      output = await this.runMarketDepth({ side, amountIn });
      const slippageBps = Number(output.slippageBps || 0);
      publicSummary = `paid for MarketDepth (slippage ~${slippageBps} bps)`;
    } else if (opts.request.skill === 'BLUEPRINT_INDEX') {
      const zone = String(opts.request.params.zone || 'RESIDENTIAL').toUpperCase() as PlotZone;
      const buildingType = safeTrim(opts.request.params.buildingType, 48).toUpperCase();
      const run = await this.runBlueprintIndex({
        townName: opts.townName,
        theme: opts.townTheme,
        zone,
        buildingType,
      });
      output = run.output;
      modelUsed = run.modelUsed;
      apiCalls = run.apiCalls;
      apiCostCents = run.apiCostCents;
      responseTimeMs = run.responseTimeMs;
      publicSummary = `bought BlueprintIndex for ${buildingType}`;
    } else if (opts.request.skill === 'SCOUT_REPORT') {
      const zone = String(opts.request.params.zone || 'COMMERCIAL').toUpperCase() as PlotZone;
      const run = await this.runScoutReport({
        townName: opts.townName,
        theme: opts.townTheme,
        zone,
        recentEvents: opts.recentEvents.slice(0, 8),
      });
      output = run.output;
      modelUsed = run.modelUsed;
      apiCalls = run.apiCalls;
      apiCostCents = run.apiCostCents;
      responseTimeMs = run.responseTimeMs;
      const risk = safeTrim(output.risk, 8) || 'UNK';
      publicSummary = `bought ScoutReport (${risk}) for ${zone}`;
    } else {
      throw new Error(`Unknown skill: ${opts.request.skill}`);
    }

    // Charge + log atomically.
    await prisma.$transaction(async (tx) => {
      const agent = await tx.arenaAgent.findUniqueOrThrow({ where: { id: opts.agentId } });
      if (agent.bankroll < priceArena) {
        throw new Error(`Not enough $ARENA for skill (${priceArena})`);
      }

      await tx.arenaAgent.update({
        where: { id: opts.agentId },
        data: {
          bankroll: { decrement: priceArena },
          apiCostCents: { increment: apiCostCents },
        },
      });

      // Track "treasury" as cumulativeFeesArena for now (demo-friendly).
      const pool = await tx.economyPool.findFirst({ orderBy: { createdAt: 'desc' } });
      if (pool) {
        await tx.economyPool.update({
          where: { id: pool.id },
          data: { cumulativeFeesArena: { increment: priceArena } },
        });
      }

      await tx.workLog.create({
        data: {
          agentId: opts.agentId,
          townId: opts.townId,
          workType: 'SERVICE',
          description: `X402:${opts.request.skill} — ${safeTrim(publicSummary, 140)}`,
          input: JSON.stringify({
            question: safeTrim(opts.request.question, 400),
            whyNow: safeTrim(opts.request.whyNow, 200),
            expectedNextAction: safeTrim(opts.request.expectedNextAction, 32),
            ifThen: {
              if: safeTrim(opts.request.ifThen.if, 200),
              then: safeTrim(opts.request.ifThen.then, 200),
              else: safeTrim(opts.request.ifThen.else, 200),
            },
            params: opts.request.params,
          }),
          output: JSON.stringify(output),
          apiCalls,
          apiCostCents,
          modelUsed,
          responseTimeMs,
          arenaEarned: 0,
        },
      });
    });

    w.lastPurchaseTick = opts.currentTick;
    w.lastSkillTick[opts.request.skill] = opts.currentTick;
    w.purchasesInWindow += 1;
    w.spentArenaInWindow += priceArena;

    const result: BuySkillResult = {
      skill: opts.request.skill,
      cached: false,
      priceArena,
      spotPriceUsed: opts.economySpotPrice,
      output,
      publicSummary,
    };

    agentCache.set(cacheKey, { createdTick: opts.currentTick, result });
    return result;
  }
}

export const x402SkillService = new X402SkillService();
