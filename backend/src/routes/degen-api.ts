/**
 * Degen Mode REST API — Staking, predictions, leaderboard.
 *
 * Base path: /api/v1
 * Auth: x-wallet-address header (demo-mode, no signature verification).
 */

import { Router, Request, Response } from 'express';
import { degenStakingService } from '../services/degenStakingService';
import { predictionService } from '../services/predictionService';

const router = Router();

function getWallet(req: Request): string {
  const wallet = (req.headers['x-wallet-address'] as string || '').toLowerCase().trim();
  if (!wallet) throw new Error('Missing x-wallet-address header');
  return wallet;
}

// ============================================================================
// Balance
// ============================================================================

router.get('/degen/balance/:wallet', async (req: Request, res: Response): Promise<void> => {
  try {
    const wallet = req.params.wallet.toLowerCase().trim();
    const balance = await degenStakingService.getOrCreateUserBalance(wallet);
    res.json({ balance });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================================================
// Staking
// ============================================================================

router.post('/degen/back', async (req: Request, res: Response): Promise<void> => {
  try {
    const wallet = getWallet(req);
    const { agentId, amount } = req.body;
    if (!agentId || !amount) {
      res.status(400).json({ error: 'agentId and amount are required' });
      return;
    }
    const stake = await degenStakingService.backAgent(wallet, agentId, Number(amount));
    res.json({ ok: true, stake });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/degen/unback', async (req: Request, res: Response): Promise<void> => {
  try {
    const wallet = getWallet(req);
    const { stakeId } = req.body;
    if (!stakeId) {
      res.status(400).json({ error: 'stakeId is required' });
      return;
    }
    const result = await degenStakingService.unbackAgent(wallet, stakeId);
    res.json({ ok: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/degen/positions/:wallet', async (req: Request, res: Response): Promise<void> => {
  try {
    const wallet = req.params.wallet.toLowerCase().trim();
    const positions = await degenStakingService.getPositions(wallet);
    res.json({ positions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/degen/agent/:agentId/backers', async (req: Request, res: Response): Promise<void> => {
  try {
    const info = await degenStakingService.getAgentBackingInfo(req.params.agentId);
    res.json(info);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/degen/leaderboard', async (_req: Request, res: Response): Promise<void> => {
  try {
    const leaderboard = await degenStakingService.getLeaderboard();
    res.json({ leaderboard });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Predictions
// ============================================================================

router.get('/degen/predictions/active', async (_req: Request, res: Response): Promise<void> => {
  try {
    const markets = await predictionService.getActiveMarkets();
    res.json({ markets });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/degen/predictions/bet', async (req: Request, res: Response): Promise<void> => {
  try {
    const wallet = getWallet(req);
    const { marketId, side, amount } = req.body;
    if (!marketId || !side || !amount) {
      res.status(400).json({ error: 'marketId, side, and amount are required' });
      return;
    }
    if (side !== 'A' && side !== 'B') {
      res.status(400).json({ error: 'side must be A or B' });
      return;
    }
    const bet = await predictionService.placeBet(wallet, marketId, side, Number(amount));
    res.json({ ok: true, bet });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/degen/predictions/:wallet', async (req: Request, res: Response): Promise<void> => {
  try {
    const wallet = req.params.wallet.toLowerCase().trim();
    const bets = await predictionService.getUserBets(wallet);
    res.json({ bets });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
