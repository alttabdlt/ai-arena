/**
 * Integration: Agent buys/sells $ARENA, price moves.
 */

import { describe, it, expect } from 'vitest';
import { prisma } from '../../config/database';
import { createTestAgent, seedPool } from '../../__tests__/helpers/fixtures';
import { OffchainAmmService } from '../offchainAmmService';

describe('Economy Flow Integration', () => {
  it('agent buys and sells $ARENA, prices move correctly', async () => {
    const amm = new OffchainAmmService();

    // 1. Seed pool (1M/1M, price=1.0)
    await seedPool(prisma, { reserveBalance: 1_000_000, arenaBalance: 1_000_000 });
    const initialSummary = await amm.getPoolSummary();
    expect(initialSummary.spotPrice).toBeCloseTo(1.0, 2);

    // 2. Create agent (10K reserve, 0 bankroll)
    const agent = await createTestAgent(prisma, { reserveBalance: 10000, bankroll: 0 });

    // 3. Buy 1000 reserve → should get ~990 ARENA (after 1% fee)
    const buyResult = await amm.swap(agent.id, 'BUY_ARENA', 1000);
    expect(buyResult.swap.amountOut).toBeGreaterThan(900);
    expect(buyResult.swap.amountOut).toBeLessThan(1000);
    expect(buyResult.swap.feeAmount).toBe(10); // 1% of 1000

    // 4. Assert: pool price increased
    const afterBuy = await amm.getPoolSummary();
    expect(afterBuy.spotPrice).toBeGreaterThan(1.0);

    // 5. Sell 500 ARENA → get reserve back
    const sellResult = await amm.swap(agent.id, 'SELL_ARENA', 500);
    expect(sellResult.swap.amountOut).toBeGreaterThan(400);
    expect(sellResult.swap.feeAmount).toBe(5); // 1% of 500

    // 6. Assert: pool price decreased from post-buy level
    const afterSell = await amm.getPoolSummary();
    expect(afterSell.spotPrice).toBeLessThan(afterBuy.spotPrice);

    // 7. Assert: cumulative fees tracked
    expect(afterSell.cumulativeFeesReserve).toBe(10); // from buy
    expect(afterSell.cumulativeFeesArena).toBe(5); // from sell

    // 8. EconomySwap records correct
    const swaps = await amm.listRecentSwaps();
    expect(swaps).toHaveLength(2);
    // Most recent first
    expect(swaps[0].side).toBe('SELL_ARENA');
    expect(swaps[1].side).toBe('BUY_ARENA');

    // 9. Agent balances consistent
    const finalAgent = await prisma.arenaAgent.findUnique({ where: { id: agent.id } });
    // Reserve: 10000 - 1000 (buy) + sellResult.amountOut
    expect(finalAgent!.reserveBalance).toBe(10000 - 1000 + sellResult.swap.amountOut);
    // Bankroll: 0 + buyResult.amountOut - 500 (sell)
    expect(finalAgent!.bankroll).toBe(buyResult.swap.amountOut - 500);
  });
});
