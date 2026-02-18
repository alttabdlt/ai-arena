/**
 * OffchainAmmService — Reserve token ⇄ $ARENA swaps (constant-product AMM).
 *
 * Hackathon-mode design goals:
 * - Deterministic, simple pricing (x*y=k style)
 * - Fast to ship and easy to reason about
 * - Fee is routed to "treasury" counters (not kept in pool reserves)
 *
 * NOTE: This is not on-chain enforcement. It's an off-chain simulation layer that lets
 * agents autonomously decide when to buy/sell $ARENA as "fuel" for actions.
 */

import { EconomyLedgerType, EconomyPool, EconomySwap, EconomySwapSide } from '@prisma/client';
import { prisma } from '../config/database';
import { appendEconomyLedger, splitArenaFeeToBudgets } from './economyAccountingService';

const INIT_RESERVE = Number.parseInt(process.env.ECONOMY_INIT_RESERVE || '10000', 10);
const INIT_ARENA = Number.parseInt(process.env.ECONOMY_INIT_ARENA || '10000', 10);
const DEFAULT_FEE_BPS = Number.parseInt(process.env.ECONOMY_FEE_BPS || '100', 10); // 1.00%

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function spotPrice(pool: Pick<EconomyPool, 'reserveBalance' | 'arenaBalance'>): number {
  if (pool.arenaBalance <= 0) return Infinity;
  return pool.reserveBalance / pool.arenaBalance;
}

function calcFee(amountIn: number, feeBps: number): number {
  return Math.floor((amountIn * feeBps) / 10000);
}

type Quote = {
  side: EconomySwapSide;
  amountIn: number;
  amountInAfterFee: number;
  amountOut: number;
  feeAmount: number;
  priceBefore: number;
  priceAfter: number;
};

export class OffchainAmmService {

  private async getOrCreatePool(tx: any = prisma): Promise<EconomyPool> {
    const existing = await tx.economyPool.findFirst({ orderBy: { createdAt: 'desc' } });
    if (existing) {
      return existing;
    }

    const reserveBalance = clampInt(INIT_RESERVE, 1_000, 2_000_000_000);
    const arenaBalance = clampInt(INIT_ARENA, 1_000, 2_000_000_000);
    const feeBps = clampInt(DEFAULT_FEE_BPS, 0, 1_000);

    return tx.economyPool.create({
      data: {
        reserveBalance,
        arenaBalance,
        feeBps,
      },
    });
  }

  async getPoolSummary() {
    const pool = await this.getOrCreatePool();
    return {
      id: pool.id,
      reserveBalance: pool.reserveBalance,
      arenaBalance: pool.arenaBalance,
      feeBps: pool.feeBps,
      cumulativeFeesReserve: pool.cumulativeFeesReserve,
      cumulativeFeesArena: pool.cumulativeFeesArena,
      opsBudget: pool.opsBudget,
      pvpBudget: pool.pvpBudget,
      rescueBudget: pool.rescueBudget,
      insuranceBudget: pool.insuranceBudget,
      spotPrice: spotPrice(pool),
      updatedAt: pool.updatedAt,
    };
  }

  async quote(side: EconomySwapSide, amountInRaw: number): Promise<Quote> {
    const pool = await this.getOrCreatePool();
    return this.quoteWithPool(pool, side, amountInRaw);
  }

  private quoteWithPool(pool: EconomyPool, side: EconomySwapSide, amountInRaw: number): Quote {
    const amountIn = clampInt(amountInRaw, 0, 2_000_000_000);
    if (amountIn <= 0) {
      throw new Error('amountIn must be > 0');
    }

    const priceBefore = spotPrice(pool);
    const feeAmount = calcFee(amountIn, pool.feeBps);
    const amountInAfterFee = amountIn - feeAmount;
    if (amountInAfterFee <= 0) {
      throw new Error('amountIn too small for current fee');
    }

    let amountOut = 0;
    let nextReserve = pool.reserveBalance;
    let nextArena = pool.arenaBalance;

    if (side === 'BUY_ARENA') {
      // Reserve in, ARENA out
      const numerator = BigInt(amountInAfterFee) * BigInt(pool.arenaBalance);
      const denom = BigInt(pool.reserveBalance) + BigInt(amountInAfterFee);
      amountOut = Number(numerator / denom);
      nextReserve = pool.reserveBalance + amountInAfterFee;
      nextArena = pool.arenaBalance - amountOut;
    } else {
      // ARENA in, Reserve out
      const numerator = BigInt(amountInAfterFee) * BigInt(pool.reserveBalance);
      const denom = BigInt(pool.arenaBalance) + BigInt(amountInAfterFee);
      amountOut = Number(numerator / denom);
      nextArena = pool.arenaBalance + amountInAfterFee;
      nextReserve = pool.reserveBalance - amountOut;
    }

    if (!Number.isFinite(amountOut) || amountOut <= 0) {
      throw new Error('amountOut would be 0 — increase amountIn');
    }
    if (nextReserve < 0 || nextArena < 0) {
      throw new Error('insufficient pool liquidity');
    }

    const priceAfter = nextArena <= 0 ? Infinity : nextReserve / nextArena;

    return {
      side,
      amountIn,
      amountInAfterFee,
      amountOut,
      feeAmount,
      priceBefore,
      priceAfter,
    };
  }

  async swap(
    agentId: string,
    side: EconomySwapSide,
    amountIn: number,
    opts?: { minAmountOut?: number },
  ): Promise<{
    pool: EconomyPool;
    swap: EconomySwap;
    agent: { id: string; bankroll: number; reserveBalance: number };
  }> {
    return prisma.$transaction(async (tx) => {
      const pool = await this.getOrCreatePool(tx);
      const agent = await tx.arenaAgent.findUniqueOrThrow({ where: { id: agentId } });

      if (side === 'BUY_ARENA') {
        if (agent.reserveBalance < amountIn) throw new Error('Insufficient reserve balance');
      } else {
        if (agent.bankroll < amountIn) throw new Error('Insufficient $ARENA balance');
      }

      const q = this.quoteWithPool(pool, side, amountIn);
      const minAmountOut = opts?.minAmountOut ? clampInt(opts.minAmountOut, 0, 2_000_000_000) : 0;
      if (minAmountOut > 0 && q.amountOut < minAmountOut) {
        throw new Error(`Slippage: expected >= ${minAmountOut}, got ${q.amountOut}`);
      }
      const arenaFeeSplit = side === 'SELL_ARENA' ? splitArenaFeeToBudgets(q.feeAmount) : null;

      const poolUpdate: Partial<EconomyPool> = {};
      const agentUpdate: any = {};

      if (side === 'BUY_ARENA') {
        poolUpdate.reserveBalance = pool.reserveBalance + q.amountInAfterFee;
        poolUpdate.arenaBalance = pool.arenaBalance - q.amountOut;
        poolUpdate.cumulativeFeesReserve = pool.cumulativeFeesReserve + q.feeAmount;

        agentUpdate.reserveBalance = { decrement: q.amountIn };
        agentUpdate.bankroll = { increment: q.amountOut };
      } else {
        poolUpdate.arenaBalance = pool.arenaBalance + q.amountInAfterFee;
        poolUpdate.reserveBalance = pool.reserveBalance - q.amountOut;
        poolUpdate.cumulativeFeesArena = pool.cumulativeFeesArena + q.feeAmount;
        if (arenaFeeSplit) {
          poolUpdate.opsBudget = pool.opsBudget + arenaFeeSplit.opsBudget;
          poolUpdate.insuranceBudget = pool.insuranceBudget + arenaFeeSplit.insuranceBudget;
        }

        agentUpdate.bankroll = { decrement: q.amountIn };
        agentUpdate.reserveBalance = { increment: q.amountOut };
      }

      const [updatedPool, updatedAgent, swapRow] = await Promise.all([
        tx.economyPool.update({ where: { id: pool.id }, data: poolUpdate }),
        tx.arenaAgent.update({
          where: { id: agentId },
          data: agentUpdate,
          select: { id: true, bankroll: true, reserveBalance: true },
        }),
        tx.economySwap.create({
          data: {
            agentId,
            side,
            amountIn: q.amountIn,
            amountOut: q.amountOut,
            feeAmount: q.feeAmount,
            priceBefore: q.priceBefore,
            priceAfter: q.priceAfter,
          },
        }),
      ]);
      if (side === 'SELL_ARENA' && arenaFeeSplit && q.feeAmount > 0) {
        await appendEconomyLedger(tx, [
          ...(arenaFeeSplit.opsBudget > 0
            ? [{
                poolId: pool.id,
                source: 'AMM_SELL_FEE',
                destination: 'POOL_OPS_BUDGET',
                amount: arenaFeeSplit.opsBudget,
                type: EconomyLedgerType.TRADE_FEE_SPLIT,
                agentId,
                metadata: {
                  side,
                  amountIn: q.amountIn,
                  feeAmount: q.feeAmount,
                  to: 'opsBudget',
                },
              }]
            : []),
          ...(arenaFeeSplit.insuranceBudget > 0
            ? [{
                poolId: pool.id,
                source: 'AMM_SELL_FEE',
                destination: 'POOL_INSURANCE_BUDGET',
                amount: arenaFeeSplit.insuranceBudget,
                type: EconomyLedgerType.TRADE_FEE_SPLIT,
                agentId,
                metadata: {
                  side,
                  amountIn: q.amountIn,
                  feeAmount: q.feeAmount,
                  to: 'insuranceBudget',
                },
              }]
            : []),
        ]);
      }

      return { pool: updatedPool, agent: updatedAgent, swap: swapRow };
    });
  }

  async listRecentSwaps(limitRaw: number = 30) {
    const limit = clampInt(limitRaw, 1, 200);
    const swaps = await prisma.economySwap.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { agent: { select: { id: true, name: true, archetype: true } } },
    });
    return swaps.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      agent: s.agent,
      side: s.side,
      amountIn: s.amountIn,
      amountOut: s.amountOut,
      feeAmount: s.feeAmount,
      priceBefore: s.priceBefore,
      priceAfter: s.priceAfter,
    }));
  }
}

export const offchainAmmService = new OffchainAmmService();
