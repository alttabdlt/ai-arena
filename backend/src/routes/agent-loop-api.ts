/**
 * Agent Loop API — Control and monitor the autonomous agent decision loop.
 */

import { Router, Request, Response } from 'express';
import { agentLoopService } from '../services/agentLoopService';

const router = Router();

// Start the agent loop
router.post('/agent-loop/start', async (req: Request, res: Response): Promise<void> => {
  try {
    const intervalMs = req.body.intervalMs || 60000; // Default 60s between ticks
    agentLoopService.start(intervalMs);
    res.json({ status: 'started', intervalMs });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Stop the agent loop
router.post('/agent-loop/stop', async (_req: Request, res: Response): Promise<void> => {
  try {
    agentLoopService.stop();
    res.json({ status: 'stopped' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get loop status
router.get('/agent-loop/status', async (_req: Request, res: Response): Promise<void> => {
  res.json({
    running: agentLoopService.isRunning(),
    currentTick: agentLoopService.getCurrentTick(),
  });
});

// Manually trigger one tick (process all agents once)
router.post('/agent-loop/tick', async (_req: Request, res: Response): Promise<void> => {
  try {
    const results = await agentLoopService.tick();
    res.json({ tick: agentLoopService.getCurrentTick(), results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Manually trigger one agent
router.post('/agent-loop/tick/:agentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await agentLoopService.processAgent(req.params.agentId);
    res.json({ result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
