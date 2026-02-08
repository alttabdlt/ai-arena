import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../config/database';
import { createTestAgent, seedPool } from '../__tests__/helpers/fixtures';

// Re-import after mock is installed by setup.ts
import { OffchainAmmService } from './offchainAmmService';

let amm: OffchainAmmService;

beforeEach(() => {
  amm = new OffchainAmmService();
});

describe('OffchainAmmService', () => {
  // ── Pool basics ──────────────────────────────────────────────

  describe('getPoolSummary', () => {
    it('auto-creates pool with defaults when none exists', async () => {
      const summary = await amm.getPoolSummary();
      expect(summary.reserveBalance).toBeGreaterThan(0);
      expect(summary.arenaBalance).toBeGreaterThan(0);
      expect(summary.spotPrice).toBeCloseTo(1.0, 1);
    });

    it('returns correct spotPrice = reserveBalance / arenaBalance', async () => {
      await seedPool(prisma, { reserveBalance: 2_000_000, arenaBalance: 1_000_000 });
      const summary = await amm.getPoolSummary();
      expect(summary.spotPrice).toBeCloseTo(2.0, 5);
    });
  });

  // ── Quoting ──────────────────────────────────────────────────

  describe('quote', () => {
    it('calculates fee as 1% of amountIn (100 bps)', async () => {
      await seedPool(prisma, { feeBps: 100 });
      const q = await amm.quote('BUY_ARENA', 10000);
      expect(q.feeAmount).toBe(100); // floor(10000 * 100 / 10000)
      expect(q.amountInAfterFee).toBe(9900);
    });

    it('BUY_ARENA: reserve in → arena out, price increases', async () => {
      await seedPool(prisma, { reserveBalance: 1_000_000, arenaBalance: 1_000_000 });
      const q = await amm.quote('BUY_ARENA', 10000);
      expect(q.side).toBe('BUY_ARENA');
      expect(q.amountOut).toBeGreaterThan(0);
      expect(q.priceAfter).toBeGreaterThan(q.priceBefore);
    });

    it('SELL_ARENA: arena in → reserve out, price decreases', async () => {
      await seedPool(prisma, { reserveBalance: 1_000_000, arenaBalance: 1_000_000 });
      const q = await amm.quote('SELL_ARENA', 10000);
      expect(q.side).toBe('SELL_ARENA');
      expect(q.amountOut).toBeGreaterThan(0);
      expect(q.priceAfter).toBeLessThan(q.priceBefore);
    });

    it('k-value approximately preserved after swap (minus fees)', async () => {
      await seedPool(prisma, { reserveBalance: 1_000_000, arenaBalance: 1_000_000 });
      const kBefore = 1_000_000 * 1_000_000;
      const q = await amm.quote('BUY_ARENA', 50000);
      const afterR = 1_000_000 + q.amountInAfterFee;
      const afterA = 1_000_000 - q.amountOut;
      // k should be roughly preserved (fee removed from input before swap)
      expect(afterR * afterA).toBeGreaterThanOrEqual(kBefore * 0.99);
    });

    it('large swap → significant price impact', async () => {
      await seedPool(prisma, { reserveBalance: 1_000_000, arenaBalance: 1_000_000 });
      const small = await amm.quote('BUY_ARENA', 1000);
      const big = await amm.quote('BUY_ARENA', 500_000);
      const smallImpact = big.priceAfter - big.priceBefore;
      const smallSmall = small.priceAfter - small.priceBefore;
      expect(smallImpact).toBeGreaterThan(smallSmall * 10);
    });

    it('throws on amountIn = 0', async () => {
      await seedPool(prisma);
      await expect(amm.quote('BUY_ARENA', 0)).rejects.toThrow('amountIn must be > 0');
    });
  });

  // ── Swap execution ───────────────────────────────────────────

  describe('swap', () => {
    it('BUY_ARENA updates agent balances correctly', async () => {
      await seedPool(prisma, { reserveBalance: 1_000_000, arenaBalance: 1_000_000 });
      const agent = await createTestAgent(prisma, { reserveBalance: 10000, bankroll: 0 });

      const result = await amm.swap(agent.id, 'BUY_ARENA', 5000);
      expect(result.agent.reserveBalance).toBe(10000 - 5000);
      expect(result.agent.bankroll).toBeGreaterThan(0);
    });

    it('SELL_ARENA updates agent balances correctly', async () => {
      await seedPool(prisma, { reserveBalance: 1_000_000, arenaBalance: 1_000_000 });
      const agent = await createTestAgent(prisma, { reserveBalance: 0, bankroll: 10000 });

      const result = await amm.swap(agent.id, 'SELL_ARENA', 5000);
      expect(result.agent.bankroll).toBe(10000 - 5000);
      expect(result.agent.reserveBalance).toBeGreaterThan(0);
    });

    it('creates EconomySwap record with correct priceBefore/priceAfter', async () => {
      await seedPool(prisma, { reserveBalance: 1_000_000, arenaBalance: 1_000_000 });
      const agent = await createTestAgent(prisma, { reserveBalance: 10000, bankroll: 0 });

      const result = await amm.swap(agent.id, 'BUY_ARENA', 2000);
      expect(result.swap.priceBefore).toBeCloseTo(1.0, 2);
      expect(result.swap.priceAfter).toBeGreaterThan(result.swap.priceBefore);
      expect(result.swap.amountIn).toBe(2000);
      expect(result.swap.amountOut).toBeGreaterThan(0);
    });

    it('buy then sell same amount → get back less (fees both ways)', async () => {
      await seedPool(prisma, { reserveBalance: 1_000_000, arenaBalance: 1_000_000 });
      const agent = await createTestAgent(prisma, { reserveBalance: 50000, bankroll: 50000 });

      const buyResult = await amm.swap(agent.id, 'BUY_ARENA', 10000);
      const arenaBought = buyResult.swap.amountOut;

      const sellResult = await amm.swap(agent.id, 'SELL_ARENA', arenaBought);
      const reserveBack = sellResult.swap.amountOut;

      // Should get back less than 10000 due to fees both ways
      expect(reserveBack).toBeLessThan(10000);
    });

    it('throws on insufficient reserve balance for BUY_ARENA', async () => {
      await seedPool(prisma);
      const agent = await createTestAgent(prisma, { reserveBalance: 100, bankroll: 0 });
      await expect(amm.swap(agent.id, 'BUY_ARENA', 500)).rejects.toThrow('Insufficient reserve balance');
    });

    it('throws on insufficient bankroll for SELL_ARENA', async () => {
      await seedPool(prisma);
      const agent = await createTestAgent(prisma, { reserveBalance: 0, bankroll: 100 });
      await expect(amm.swap(agent.id, 'SELL_ARENA', 500)).rejects.toThrow('Insufficient $ARENA balance');
    });
  });

  // ── Recent swaps ─────────────────────────────────────────────

  describe('listRecentSwaps', () => {
    it('returns swaps in desc order', async () => {
      await seedPool(prisma, { reserveBalance: 1_000_000, arenaBalance: 1_000_000 });
      const agent = await createTestAgent(prisma, { reserveBalance: 50000, bankroll: 50000 });

      await amm.swap(agent.id, 'BUY_ARENA', 1000);
      await amm.swap(agent.id, 'BUY_ARENA', 2000);

      const swaps = await amm.listRecentSwaps();
      expect(swaps.length).toBe(2);
      expect(swaps[0].amountIn).toBe(2000);
      expect(swaps[1].amountIn).toBe(1000);
    });
  });
});
