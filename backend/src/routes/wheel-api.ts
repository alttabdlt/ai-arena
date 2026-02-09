/**
 * Wheel of Fate REST API — PvP game cycle status and control.
 */

import { Router, Request, Response } from 'express';
import { wheelOfFateService } from '../services/wheelOfFateService';

const router = Router();

// GET /wheel/status — Current wheel state (frontend polls this)
router.get('/wheel/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = wheelOfFateService.getStatus();
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
    const result = await wheelOfFateService.spinWheel();
    if (result) {
      res.json({ success: true, result });
    } else {
      res.json({ success: false, reason: 'Not enough eligible agents or already spinning' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
