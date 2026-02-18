/**
 * Economy REST API — Off-chain reserve ⇄ $ARENA swaps for agents.
 *
 * Base path: /api/v1
 * Public:
 *   GET  /economy/pool
 *   GET  /economy/quote?side=BUY_ARENA|SELL_ARENA&amountIn=123
 *   GET  /economy/swaps?limit=30
 * Auth (Bearer apiKey):
 *   POST /economy/swap { side, amountIn, minAmountOut? }
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ArenaAgent, EconomySwapSide } from '@prisma/client';
import { offchainAmmService } from '../services/offchainAmmService';
import { arenaService } from '../services/arenaService';
import { priceSnapshotService } from '../services/priceSnapshotService';

const router = Router();

interface AuthenticatedRequest extends Request {
  agent?: ArenaAgent;
}

async function authenticateAgent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header. Use: Bearer <api_key>' });
    return;
  }

  const apiKey = authHeader.split(' ')[1];
  const agent = await arenaService.getAgentByApiKey(apiKey);
  if (!agent) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  req.agent = agent;
  next();
}

function parseSide(raw: unknown): EconomySwapSide {
  const v = String(raw || '').toUpperCase();
  if (v === 'BUY_ARENA') return 'BUY_ARENA';
  if (v === 'SELL_ARENA') return 'SELL_ARENA';
  throw new Error('Invalid side. Use BUY_ARENA or SELL_ARENA');
}

// ============================================================================
// Public
// ============================================================================

router.get('/economy/pool', async (_req: Request, res: Response): Promise<void> => {
  try {
    const pool = await offchainAmmService.getPoolSummary();
    res.json({ pool });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/economy/quote', async (req: Request, res: Response): Promise<void> => {
  try {
    const side = parseSide(req.query.side);
    const amountIn = Number.parseInt(String(req.query.amountIn || '0'), 10);
    const quote = await offchainAmmService.quote(side, amountIn);
    res.json({ quote });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/economy/swaps', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Number.parseInt(String(req.query.limit || '30'), 10);
    const swaps = await offchainAmmService.listRecentSwaps(limit);
    res.json({ swaps });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/economy/price-history', async (req: Request, res: Response): Promise<void> => {
  try {
    const period = (req.query.period as string) || '1h';
    const valid = ['1h', '6h', '24h', '7d'];
    if (!valid.includes(period)) {
      res.status(400).json({ error: `Invalid period. Use: ${valid.join(', ')}` });
      return;
    }
    const snapshots = await priceSnapshotService.getHistory(period as any);
    res.json({ snapshots });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Auth
// ============================================================================

router.post('/economy/swap', authenticateAgent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const side = parseSide(req.body?.side);
    const amountIn = Number.parseInt(String(req.body?.amountIn || '0'), 10);
    const minAmountOut = req.body?.minAmountOut != null ? Number.parseInt(String(req.body.minAmountOut), 10) : undefined;

    const result = await offchainAmmService.swap(req.agent!.id, side, amountIn, { minAmountOut });
    res.json({
      ok: true,
      swap: result.swap,
      agent: result.agent,
      pool: {
        id: result.pool.id,
        reserveBalance: result.pool.reserveBalance,
        arenaBalance: result.pool.arenaBalance,
        feeBps: result.pool.feeBps,
        cumulativeFeesReserve: result.pool.cumulativeFeesReserve,
        cumulativeFeesArena: result.pool.cumulativeFeesArena,
        opsBudget: result.pool.opsBudget,
        pvpBudget: result.pool.pvpBudget,
        rescueBudget: result.pool.rescueBudget,
        insuranceBudget: result.pool.insuranceBudget,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
