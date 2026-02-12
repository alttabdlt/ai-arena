/**
 * PredictionService — Binary prediction markets on arena matches.
 *
 * Auto-create when a match goes ACTIVE, auto-resolve on completion.
 * Winners split the losing pool proportionally, minus rake.
 */

import { prisma } from '../config/database';

class PredictionService {
  /**
   * Create a prediction market for an arena match.
   */
  async createMarket(matchId: string, player1Id: string, player2Id: string) {
    // Avoid duplicates
    const existing = await prisma.predictionMarket.findFirst({ where: { matchId } });
    if (existing) return existing;

    const [p1, p2] = await Promise.all([
      prisma.arenaAgent.findUnique({ where: { id: player1Id }, select: { name: true } }),
      prisma.arenaAgent.findUnique({ where: { id: player2Id }, select: { name: true } }),
    ]);

    const p1Name = p1?.name || 'Player 1';
    const p2Name = p2?.name || 'Player 2';

    return prisma.predictionMarket.create({
      data: {
        matchId,
        question: `Who wins? ${p1Name} vs ${p2Name}`,
        optionA: p1Name,
        optionB: p2Name,
        optionAAgentId: player1Id,
        optionBAgentId: player2Id,
      },
    });
  }

  /**
   * Place a bet on a prediction market.
   */
  async placeBet(walletAddress: string, marketId: string, side: 'A' | 'B', amount: number) {
    if (amount <= 0) throw new Error('Amount must be positive');

    return prisma.$transaction(async (tx) => {
      const market = await tx.predictionMarket.findUnique({ where: { id: marketId } });
      if (!market) throw new Error('Market not found');
      if (market.status !== 'OPEN') throw new Error('Market is not open for bets');

      const balance = await tx.userBalance.findUnique({ where: { walletAddress } });
      if (!balance) throw new Error('User balance not found');
      if (balance.balance < amount) throw new Error('Insufficient balance');

      // Debit user
      await tx.userBalance.update({
        where: { walletAddress },
        data: { balance: { decrement: amount } },
      });

      // Update pool
      const poolField = side === 'A' ? 'poolA' : 'poolB';
      await tx.predictionMarket.update({
        where: { id: marketId },
        data: { [poolField]: { increment: amount } },
      });

      // Create bet
      const bet = await tx.predictionBet.create({
        data: { marketId, walletAddress, side, amount },
      });

      return bet;
    });
  }

  /**
   * Resolve a prediction market after match completion.
   */
  async resolve(matchId: string, winnerId: string | null) {
    const market = await prisma.predictionMarket.findFirst({
      where: { matchId, status: { in: ['OPEN', 'LOCKED'] } },
    });
    if (!market) return;
    return this.resolveMarket(market, winnerId);
  }

  async resolveById(marketId: string, winnerId: string | null) {
    const market = await prisma.predictionMarket.findUnique({ where: { id: marketId } });
    if (!market || (market.status !== 'OPEN' && market.status !== 'LOCKED')) return;
    return this.resolveMarket(market, winnerId);
  }

  private async resolveMarket(market: any, winnerId: string | null) {

    if (!winnerId) {
      // Draw — refund all bets
      await this.cancelMarket(market.id);
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Re-check status inside transaction for idempotency
      const current = await tx.predictionMarket.findUnique({ where: { id: market.id } });
      if (!current || (current.status !== 'OPEN' && current.status !== 'LOCKED')) return;

      const winningSide = winnerId === current.optionAAgentId ? 'A' : 'B';
      const winningPool = winningSide === 'A' ? current.poolA : current.poolB;
      const totalPool = current.poolA + current.poolB;
      const rake = Math.floor(totalPool * current.rakePercent / 100);
      const payoutPool = totalPool - rake;

      // Get winning bets
      const winningBets = await tx.predictionBet.findMany({
        where: { marketId: current.id, side: winningSide },
      });

      // Distribute payouts proportionally
      for (const bet of winningBets) {
        const share = winningPool > 0 ? bet.amount / winningPool : 0;
        const payout = Math.floor(share * payoutPool);
        if (payout <= 0) continue;

        await tx.predictionBet.update({
          where: { id: bet.id },
          data: { payout },
        });

        // Credit user balance
        await tx.userBalance.upsert({
          where: { walletAddress: bet.walletAddress },
          update: {
            balance: { increment: payout },
            totalEarned: { increment: payout - bet.amount }, // Net profit
          },
          create: {
            walletAddress: bet.walletAddress,
            balance: 10000 + payout,
            totalEarned: payout - bet.amount,
          },
        });
      }

      // Mark losing bets
      await tx.predictionBet.updateMany({
        where: { marketId: current.id, side: winningSide === 'A' ? 'B' : 'A' },
        data: { payout: 0 },
      });

      // Resolve market
      await tx.predictionMarket.update({
        where: { id: current.id },
        data: {
          status: 'RESOLVED',
          outcome: winningSide,
          resolvedAt: new Date(),
        },
      });
    });
  }

  /**
   * Cancel a market and refund all bets.
   */
  async cancelMarket(marketId: string) {
    await prisma.$transaction(async (tx) => {
      const market = await tx.predictionMarket.findUnique({ where: { id: marketId } });
      if (!market || market.status === 'CANCELLED' || market.status === 'RESOLVED') return;

      const bets = await tx.predictionBet.findMany({ where: { marketId } });

      for (const bet of bets) {
        await tx.userBalance.upsert({
          where: { walletAddress: bet.walletAddress },
          update: { balance: { increment: bet.amount } },
          create: { walletAddress: bet.walletAddress, balance: 10000 + bet.amount },
        });

        await tx.predictionBet.update({
          where: { id: bet.id },
          data: { payout: bet.amount },
        });
      }

      await tx.predictionMarket.update({
        where: { id: marketId },
        data: { status: 'CANCELLED', resolvedAt: new Date() },
      });
    });
  }

  /**
   * Get active (open) prediction markets.
   */
  async getActiveMarkets() {
    return prisma.predictionMarket.findMany({
      where: { status: 'OPEN' },
      include: { bets: { select: { id: true, side: true, amount: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get user's bet history.
   */
  async getUserBets(walletAddress: string) {
    return prisma.predictionBet.findMany({
      where: { walletAddress },
      include: {
        market: {
          select: { question: true, optionA: true, optionB: true, status: true, outcome: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}

export const predictionService = new PredictionService();
