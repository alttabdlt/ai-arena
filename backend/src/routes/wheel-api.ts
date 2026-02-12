/**
 * Wheel of Fate REST API — PvP game cycle status, control, and betting.
 */

import { Router, Request, Response } from 'express';
import { wheelOfFateService } from '../services/wheelOfFateService';
import { predictionService } from '../services/predictionService';

const router = Router();

// GET /wheel/status — Current wheel state (frontend polls this)
// Optional: ?wallet=0x... to get personal bet result during AFTERMATH
router.get('/wheel/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const status = wheelOfFateService.getStatus();
    const wallet = (req.query.wallet as string || '').toLowerCase().trim();

    // Enrich with personal bet result during AFTERMATH
    if (wallet && status.phase === 'AFTERMATH' && status.lastResult?.marketId) {
      try {
        const { prisma } = await import('../config/database');
        const bet = await prisma.predictionBet.findFirst({
          where: { walletAddress: wallet, marketId: status.lastResult.marketId },
          orderBy: { createdAt: 'desc' },
        });
        if (bet) {
          const won = (bet.payout || 0) > 0;
          (status as any).myBetResult = {
            side: bet.side,
            amount: bet.amount,
            payout: bet.payout || 0,
            netProfit: (bet.payout || 0) - bet.amount,
            won,
          };
        }
      } catch {}
    }

    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /wheel/history — Recent wheel results
router.get('/wheel/history', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const history = wheelOfFateService.getHistory(limit);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /wheel/spin — Manual trigger (debug/admin)
router.post('/wheel/spin', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await wheelOfFateService.forceSpin();
    if (result) {
      res.json({ success: true, result });
    } else {
      res.json({ success: false, reason: 'Not enough eligible agents or already spinning' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Betting — convenience routes that proxy to predictionService
// ============================================================================

// POST /wheel/bet — Quick bet on current match
// Body: { wallet: string, side: 'A' | 'B', amount: number }
router.post('/wheel/bet', async (req: Request, res: Response): Promise<void> => {
  try {
    const wallet = (req.body.wallet || req.headers['x-wallet-address'] as string || '').toLowerCase().trim();
    if (!wallet) {
      res.status(400).json({ error: 'wallet address required (body.wallet or x-wallet-address header)' });
      return;
    }

    const { side, amount } = req.body;
    if (!side || !amount) {
      res.status(400).json({ error: 'side (A or B) and amount required' });
      return;
    }
    if (side !== 'A' && side !== 'B') {
      res.status(400).json({ error: 'side must be A or B' });
      return;
    }
    if (Number(amount) <= 0) {
      res.status(400).json({ error: 'amount must be positive' });
      return;
    }

    const status = wheelOfFateService.getStatus();
    if (status.phase !== 'ANNOUNCING') {
      res.status(400).json({
        error: 'Betting is only open during ANNOUNCING phase',
        phase: status.phase,
        nextSpinAt: status.nextSpinAt,
      });
      return;
    }

    const marketId = wheelOfFateService.getActiveMarketId();
    if (!marketId) {
      res.status(400).json({ error: 'No active betting market' });
      return;
    }

    const bet = await predictionService.placeBet(wallet, marketId, side, Number(amount));

    // Return enriched response
    const market = await (await import('../config/database')).prisma.predictionMarket.findUnique({ where: { id: marketId } });
    res.json({
      ok: true,
      bet,
      market: market ? {
        poolA: market.poolA,
        poolB: market.poolB,
        total: market.poolA + market.poolB,
        oddsA: market.poolA > 0 ? ((market.poolA + market.poolB) / market.poolA).toFixed(2) : null,
        oddsB: market.poolB > 0 ? ((market.poolA + market.poolB) / market.poolB).toFixed(2) : null,
      } : null,
      bettingEndsIn: status.bettingEndsIn,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// GET /wheel/odds — Current betting odds for active match
router.get('/wheel/odds', async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = wheelOfFateService.getStatus();
    const marketId = wheelOfFateService.getActiveMarketId();

    if (!marketId || status.phase !== 'ANNOUNCING') {
      res.json({
        betting: false,
        phase: status.phase,
        nextSpinAt: status.nextSpinAt,
      });
      return;
    }

    const { prisma } = await import('../config/database');
    const market = await prisma.predictionMarket.findUnique({
      where: { id: marketId },
      include: { bets: { select: { side: true, amount: true, walletAddress: true } } },
    });

    if (!market) {
      res.json({ betting: false, phase: status.phase });
      return;
    }

    const total = market.poolA + market.poolB;
    res.json({
      betting: true,
      marketId,
      match: status.currentMatch ? {
        agent1: status.currentMatch.agent1,
        agent2: status.currentMatch.agent2,
        gameType: status.currentMatch.gameType,
        wager: status.currentMatch.wager,
      } : null,
      odds: {
        poolA: market.poolA,
        poolB: market.poolB,
        total,
        pctA: total > 0 ? Math.round((market.poolA / total) * 100) : 50,
        pctB: total > 0 ? Math.round((market.poolB / total) * 100) : 50,
        multA: market.poolA > 0 ? parseFloat((total / market.poolA).toFixed(2)) : null,
        multB: market.poolB > 0 ? parseFloat((total / market.poolB).toFixed(2)) : null,
      },
      betCount: market.bets.length,
      bettingEndsIn: status.bettingEndsIn,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /wheel/my-stats — Per-wallet betting stats (P&L, hit rate, streaks)
router.get('/wheel/my-stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const wallet = (req.query.wallet as string || '').toLowerCase().trim();
    if (!wallet) {
      res.status(400).json({ error: 'wallet query parameter required' });
      return;
    }

    const { prisma } = await import('../config/database');
    const bets = await prisma.predictionBet.findMany({
      where: { walletAddress: wallet },
      include: { market: { select: { status: true, outcome: true } } },
      orderBy: { createdAt: 'desc' },
    });

    let totalWagered = 0;
    let totalWon = 0;
    let wins = 0;
    let losses = 0;
    let currentStreak = 0;
    let bestStreak = 0;
    let worstLoss = 0;
    const resolved = bets.filter(b => b.market.status === 'RESOLVED');

    for (const bet of resolved) {
      totalWagered += bet.amount;
      totalWon += bet.payout || 0;
      const won = (bet.payout || 0) > 0;
      if (won) {
        wins++;
        if (currentStreak >= 0) currentStreak++;
        else currentStreak = 1;
        if (currentStreak > bestStreak) bestStreak = currentStreak;
      } else {
        losses++;
        if (currentStreak <= 0) currentStreak--;
        else currentStreak = -1;
        if (bet.amount > worstLoss) worstLoss = bet.amount;
      }
    }

    const netPnL = totalWon - totalWagered;
    const hitRate = resolved.length > 0 ? Math.round((wins / resolved.length) * 100) : 0;

    // Get current balance
    const userBalance = await prisma.userBalance.findUnique({ where: { walletAddress: wallet } });

    res.json({
      wallet,
      balance: userBalance?.balance ?? 0,
      totalBets: resolved.length,
      totalWagered,
      totalWon,
      netPnL,
      hitRate,
      wins,
      losses,
      currentStreak,
      bestStreak,
      worstLoss,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /wheel/leaderboard — Top bettors by net profit
router.get('/wheel/leaderboard', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { prisma } = await import('../config/database');
    const balances = await prisma.userBalance.findMany({
      orderBy: { totalEarned: 'desc' },
      take: 10,
      select: { walletAddress: true, balance: true, totalEarned: true },
    });

    // Enrich with bet counts
    const leaderboard = await Promise.all(balances.map(async (b) => {
      const betCount = await prisma.predictionBet.count({
        where: { walletAddress: b.walletAddress, market: { status: 'RESOLVED' } },
      });
      return {
        wallet: `${b.walletAddress.slice(0, 6)}...${b.walletAddress.slice(-4)}`,
        netProfit: b.totalEarned,
        balance: b.balance,
        bets: betCount,
      };
    }));

    res.json(leaderboard);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
