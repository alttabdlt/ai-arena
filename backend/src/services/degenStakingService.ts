/**
 * DegenStakingService — Agent backing (staking), yield distribution to backers,
 * and leaderboard for the Degen Mode feature.
 */

import { prisma } from '../config/database';

class DegenStakingService {
  /**
   * Get or auto-create a user balance (10K virtual $ARENA on first connect).
   */
  async getOrCreateUserBalance(walletAddress: string) {
    const existing = await prisma.userBalance.findUnique({ where: { walletAddress } });
    if (existing) return existing;
    return prisma.userBalance.create({ data: { walletAddress } });
  }

  /**
   * Back (stake on) an agent.
   */
  async backAgent(walletAddress: string, agentId: string, amount: number) {
    if (amount <= 0) throw new Error('Amount must be positive');

    return prisma.$transaction(async (tx) => {
      const balance = await tx.userBalance.findUnique({ where: { walletAddress } });
      if (!balance) throw new Error('User balance not found — call getOrCreateUserBalance first');
      if (balance.balance < amount) throw new Error('Insufficient balance');

      // Verify agent exists
      const agent = await tx.arenaAgent.findUnique({ where: { id: agentId } });
      if (!agent) throw new Error('Agent not found');

      // Debit user
      await tx.userBalance.update({
        where: { walletAddress },
        data: {
          balance: { decrement: amount },
          totalStaked: { increment: amount },
        },
      });

      // Create stake
      const stake = await tx.agentStake.create({
        data: { walletAddress, agentId, amount },
      });

      return stake;
    });
  }

  /**
   * Unback (unstake) — returns principal + unclaimed yield.
   */
  async unbackAgent(walletAddress: string, stakeId: string) {
    return prisma.$transaction(async (tx) => {
      const stake = await tx.agentStake.findUnique({ where: { id: stakeId } });
      if (!stake) throw new Error('Stake not found');
      if (!stake.isActive) throw new Error('Stake is already inactive');
      if (stake.walletAddress !== walletAddress) throw new Error('Not your stake');

      // Deactivate stake
      await tx.agentStake.update({
        where: { id: stakeId },
        data: { isActive: false, unstakedAt: new Date() },
      });

      // Refund principal + yield earned
      const refund = stake.amount + stake.totalYieldEarned;
      await tx.userBalance.update({
        where: { walletAddress },
        data: {
          balance: { increment: refund },
          totalEarned: { increment: stake.totalYieldEarned },
        },
      });

      return { refund, principal: stake.amount, yieldEarned: stake.totalYieldEarned };
    });
  }

  /**
   * Get all active positions for a wallet, with live PnL.
   */
  async getPositions(walletAddress: string) {
    const stakes = await prisma.agentStake.findMany({
      where: { walletAddress, isActive: true },
      include: { agent: { select: { id: true, name: true, archetype: true, elo: true, bankroll: true, wins: true, losses: true } } },
      orderBy: { stakedAt: 'desc' },
    });

    return stakes.map((s) => ({
      id: s.id,
      agentId: s.agentId,
      agentName: s.agent.name,
      agentArchetype: s.agent.archetype,
      agentElo: s.agent.elo,
      agentWins: s.agent.wins,
      agentLosses: s.agent.losses,
      amount: s.amount,
      yieldEarned: s.totalYieldEarned,
      pnl: s.totalYieldEarned, // PnL = yield earned (principal returned separately on unstake)
      stakedAt: s.stakedAt,
    }));
  }

  /**
   * Get backer info for an agent.
   */
  async getAgentBackingInfo(agentId: string) {
    const stakes = await prisma.agentStake.findMany({
      where: { agentId, isActive: true },
    });

    return {
      backerCount: stakes.length,
      totalStaked: stakes.reduce((sum, s) => sum + s.amount, 0),
    };
  }

  /**
   * Distribute yield to all active backers of an agent, proportionally.
   * Called when agent earns (yield distribution, arena win, etc.).
   */
  async distributeYieldToBackers(agentId: string, totalAmount: number) {
    if (totalAmount <= 0) return;

    const stakes = await prisma.agentStake.findMany({
      where: { agentId, isActive: true },
    });
    if (stakes.length === 0) return;

    const totalStaked = stakes.reduce((sum, s) => sum + s.amount, 0);
    if (totalStaked <= 0) return;

    for (const stake of stakes) {
      const share = Math.floor((stake.amount / totalStaked) * totalAmount);
      if (share <= 0) continue;

      await prisma.agentStake.update({
        where: { id: stake.id },
        data: { totalYieldEarned: { increment: share } },
      });
    }
  }

  /**
   * Leaderboard — top stakers by total PnL (yield earned across all stakes).
   */
  async getLeaderboard(limit = 20) {
    // Aggregate yield earned per wallet across all stakes
    const results = await prisma.agentStake.groupBy({
      by: ['walletAddress'],
      _sum: { totalYieldEarned: true, amount: true },
      _count: { id: true },
      orderBy: { _sum: { totalYieldEarned: 'desc' } },
      take: limit,
    });

    return results.map((r) => ({
      walletAddress: r.walletAddress,
      totalPnL: r._sum.totalYieldEarned || 0,
      totalStaked: r._sum.amount || 0,
      stakeCount: r._count.id,
    }));
  }
}

export const degenStakingService = new DegenStakingService();
