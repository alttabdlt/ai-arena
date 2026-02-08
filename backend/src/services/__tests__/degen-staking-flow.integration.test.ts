/**
 * Integration: User stakes on agent, agent wins, yield flows.
 */

import { describe, it, expect } from 'vitest';
import { installSmartAiMock } from '../../__tests__/mocks/smartAiService.mock';
installSmartAiMock();

import { prisma } from '../../config/database';
import { createTestAgent, createTestUser } from '../../__tests__/helpers/fixtures';
import { degenStakingService } from '../degenStakingService';
import { ArenaService } from '../arenaService';

describe('Degen Staking Flow Integration', () => {
  it('user stakes on agent, agent wins, yield distributed, user unstakes with profit', async () => {
    const arena = new ArenaService();

    // 1. Create agent + user
    const agent = await createTestAgent(prisma, { name: 'StakeHero', bankroll: 10000 });
    await createTestUser(prisma, '0xABC', 10000);

    // 2. User backs agent with 5000
    const stake = await degenStakingService.backAgent('0xABC', agent.id, 5000);
    expect(stake.amount).toBe(5000);

    const userAfterStake = await prisma.userBalance.findUnique({ where: { walletAddress: '0xABC' } });
    expect(userAfterStake!.balance).toBe(5000);

    // 3. Agent wins an RPS match → yield distributed to backers
    const opponent = await createTestAgent(prisma, { name: 'Loser', bankroll: 10000 });
    const match = await arena.createMatch({
      agentId: agent.id,
      gameType: 'RPS',
      wagerAmount: 200,
      opponentId: opponent.id,
    });

    // Play to completion (agent wins)
    let complete = false;
    let turn = 0;
    while (!complete && turn < 30) {
      const state = await arena.getMatchState(match.id);
      if (state.status === 'COMPLETED') break;
      const currentId = state.currentTurnId!;
      const action = currentId === agent.id ? 'rock' : 'scissors';
      const result = await arena.submitMove({ matchId: match.id, agentId: currentId, action });
      complete = result.isComplete;
      turn++;
    }

    // Wait briefly for async yield distribution (fire-and-forget in resolveMatch)
    await new Promise((r) => setTimeout(r, 200));

    // Check that yield was distributed to the stake
    const updatedStake = await prisma.agentStake.findUnique({ where: { id: stake.id } });
    // 30% of payout (380) = 114 → distributed to sole backer
    expect(updatedStake!.totalYieldEarned).toBeGreaterThan(0);

    // 4. User unstakes
    const result = await degenStakingService.unbackAgent('0xABC', stake.id);
    expect(result.principal).toBe(5000);
    expect(result.yieldEarned).toBeGreaterThan(0);
    expect(result.refund).toBe(5000 + result.yieldEarned);

    // 5. Final balance = initial(10K) - staked(5K) + refund(5K + yield)
    const finalUser = await prisma.userBalance.findUnique({ where: { walletAddress: '0xABC' } });
    expect(finalUser!.balance).toBe(5000 + result.refund);

    // 6. Leaderboard
    const lb = await degenStakingService.getLeaderboard();
    expect(lb.length).toBeGreaterThan(0);
    expect(lb[0].walletAddress).toBe('0xABC');
  });
});
