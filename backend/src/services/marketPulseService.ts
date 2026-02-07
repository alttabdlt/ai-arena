/**
 * marketPulseService — lightweight, high-frequency trading to make the economy feel alive.
 *
 * Design goals (demo-first):
 * - Produce frequent swaps without requiring expensive LLM calls.
 * - Keep behavior "agent-like" (archetype-weighted reflex trades), not purely random noise.
 * - Avoid draining agents to zero instantly (small sizing + cooldown).
 *
 * This is intentionally NOT a profit-maximizer; it's a "market microstructure" layer.
 */

import { EconomySwapSide } from '@prisma/client';
import { prisma } from '../config/database';
import { offchainAmmService } from './offchainAmmService';

const DEFAULT_INTERVAL_MS = Number.parseInt(process.env.MARKET_PULSE_INTERVAL_MS || '1200', 10);
const DEFAULT_TRADES_PER_TICK = Number.parseInt(process.env.MARKET_PULSE_TRADES_PER_TICK || '2', 10);

const MIN_TRADE_IN = 120;
const MAX_TRADE_IN = 6000;
const AGENT_COOLDOWN_MS = 3500;

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function buyProbability(archetype: string, trend: number): number {
  // trend > 0 => price up (ARENA more expensive); trend < 0 => price down
  const up = trend > 0;
  switch (String(archetype || '').toUpperCase()) {
    case 'SHARK':
      // Contrarian / predator: sell strength, buy weakness.
      return up ? 0.35 : 0.75;
    case 'DEGEN':
      // Momentum-chasing with occasional panic.
      return up ? 0.72 : 0.62;
    case 'GRINDER':
      // Slow DCA, prefers stability.
      return 0.55;
    case 'ROCK':
      // Mostly inert.
      return 0.5;
    case 'CHAMELEON':
    default:
      // Follows vibe / adapts.
      return up ? 0.62 : 0.45;
  }
}

function sizeFraction(archetype: string): number {
  // Fraction of available balance to trade (clamped by MIN/MAX).
  switch (String(archetype || '').toUpperCase()) {
    case 'DEGEN':
      return 0.06;
    case 'SHARK':
      return 0.045;
    case 'CHAMELEON':
      return 0.035;
    case 'GRINDER':
      return 0.02;
    case 'ROCK':
    default:
      return 0.012;
  }
}

function jitter(mult: number): number {
  // 0.85..1.15
  return mult * (0.85 + Math.random() * 0.3);
}

class MarketPulseService {
  private timer: NodeJS.Timeout | null = null;
  private lastSpotPrice: number | null = null;
  private lastTradeAtByAgentId = new Map<string, number>();

  start(intervalMs: number = DEFAULT_INTERVAL_MS, tradesPerTick: number = DEFAULT_TRADES_PER_TICK): void {
    const interval = clampInt(intervalMs, 250, 30_000);
    const trades = clampInt(tradesPerTick, 0, 25);

    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      void this.tick(trades);
    }, interval);

    void this.tick(trades);
    // eslint-disable-next-line no-console
    console.log(`📈 Market pulse started (every ${Math.round(interval)}ms, ~${trades}/tick)`);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    // eslint-disable-next-line no-console
    console.log('📉 Market pulse stopped');
  }

  isRunning(): boolean {
    return !!this.timer;
  }

  private async tick(tradesPerTick: number): Promise<void> {
    if (tradesPerTick <= 0) return;

    const now = Date.now();

    let spot = 1;
    try {
      const pool = await offchainAmmService.getPoolSummary();
      spot = pool.spotPrice || 1;
    } catch {
      return;
    }

    const trend = this.lastSpotPrice != null ? spot - this.lastSpotPrice : 0;
    this.lastSpotPrice = spot;

    const agents = await prisma.arenaAgent.findMany({
      where: { isActive: true },
      select: { id: true, archetype: true, bankroll: true, reserveBalance: true },
    });
    if (agents.length === 0) return;

    // Avoid hammering the same agent repeatedly.
    const eligible = agents.filter((a) => (now - (this.lastTradeAtByAgentId.get(a.id) || 0)) >= AGENT_COOLDOWN_MS);
    if (eligible.length === 0) return;

    // Pick a handful each tick.
    const picks = Math.min(tradesPerTick, eligible.length);
    for (let i = 0; i < picks; i++) {
      const idx = Math.floor(Math.random() * eligible.length);
      const a = eligible.splice(idx, 1)[0];
      if (!a) continue;

      const hasReserve = a.reserveBalance >= MIN_TRADE_IN;
      const hasArena = a.bankroll >= MIN_TRADE_IN;
      if (!hasReserve && !hasArena) continue;

      let side: EconomySwapSide | null = null;
      if (hasReserve && !hasArena) side = 'BUY_ARENA';
      else if (hasArena && !hasReserve) side = 'SELL_ARENA';
      else {
        // Portfolio nudge: keep some of each currency around.
        const totalValue = a.reserveBalance + a.bankroll * spot;
        const arenaValue = a.bankroll * spot;
        const arenaShare = totalValue > 0 ? arenaValue / totalValue : 0.5;

        let pBuy = buyProbability(a.archetype, trend);
        if (arenaShare < 0.2) pBuy = Math.min(0.9, pBuy + 0.25);
        if (arenaShare > 0.8) pBuy = Math.max(0.1, pBuy - 0.25);

        side = Math.random() < pBuy ? 'BUY_ARENA' : 'SELL_ARENA';
      }

      // Size the trade.
      const frac = jitter(sizeFraction(a.archetype));
      if (side === 'BUY_ARENA') {
        const maxIn = a.reserveBalance;
        const amountIn = clampInt(Math.floor(maxIn * frac), MIN_TRADE_IN, Math.min(MAX_TRADE_IN, maxIn));
        if (amountIn < MIN_TRADE_IN) continue;
        try {
          await offchainAmmService.swap(a.id, 'BUY_ARENA', amountIn);
          this.lastTradeAtByAgentId.set(a.id, now);
        } catch {
          // ignore
        }
      } else {
        const maxIn = a.bankroll;
        const amountIn = clampInt(Math.floor(maxIn * frac), MIN_TRADE_IN, Math.min(MAX_TRADE_IN, maxIn));
        if (amountIn < MIN_TRADE_IN) continue;
        try {
          await offchainAmmService.swap(a.id, 'SELL_ARENA', amountIn);
          this.lastTradeAtByAgentId.set(a.id, now);
        } catch {
          // ignore
        }
      }
    }
  }
}

export const marketPulseService = new MarketPulseService();

