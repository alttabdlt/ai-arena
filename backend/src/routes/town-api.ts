/**
 * Town REST API — Endpoints for AI agents to interact with the AI Town world.
 *
 * Auth: Bearer token (agent's apiKey) for mutation endpoints.
 * Base path: /api/v1
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ArenaAgent } from '@prisma/client';
import { townService } from '../services/townService';
import { arenaService } from '../services/arenaService';
import { prisma } from '../config/database';

const router = Router();

// ============================================
// Auth Middleware (shared pattern with arena-api)
// ============================================

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

// ============================================
// Town Endpoints (Public — read)
// ============================================

// Get active (currently building) town
router.get('/town', async (_req: Request, res: Response): Promise<void> => {
  try {
    const town = await townService.getActiveTown();
    if (!town) {
      res.json({ town: null, message: 'No active town. Create one first.' });
      return;
    }
    res.json({ town });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all towns
router.get('/towns', async (_req: Request, res: Response): Promise<void> => {
  try {
    const towns = await townService.getAllTowns();
    res.json({ towns });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific town by ID
router.get('/town/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const town = await townService.getTown(req.params.id);
    if (!town) {
      res.status(404).json({ error: 'Town not found' });
      return;
    }
    res.json({ town });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get town progress summary
router.get('/town/:id/progress', async (req: Request, res: Response): Promise<void> => {
  try {
    const progress = await townService.getTownProgress(req.params.id);
    res.json(progress);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get available (empty) plots in a town
router.get('/town/:id/plots', async (req: Request, res: Response): Promise<void> => {
  try {
    const available = req.query.available === 'true';
    if (available) {
      const plots = await townService.getAvailablePlots(req.params.id);
      res.json({ plots });
    } else {
      const town = await townService.getTown(req.params.id);
      res.json({ plots: town?.plots || [] });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get town event feed
router.get('/town/:id/events', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const events = await townService.getRecentEvents(req.params.id, limit);
    res.json({ events });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get town contributor leaderboard
router.get('/town/:id/contributors', async (req: Request, res: Response): Promise<void> => {
  try {
    const progress = await townService.getTownProgress(req.params.id);
    res.json({ contributors: progress.topContributors });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Town Endpoints (Auth — write)
// ============================================

// Create a new town (can be done by any agent or admin)
router.post('/town', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, theme, totalPlots, level } = req.body;
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const town = await townService.createTown(name, theme, totalPlots, level);
    res.status(201).json({ town });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Start next town (auto-names, increments level)
router.post('/town/next', async (_req: Request, res: Response): Promise<void> => {
  try {
    const town = await townService.startNextTown();
    res.status(201).json({ town });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Claim a plot
router.post('/town/:id/claim', authenticateAgent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { plotIndex } = req.body;
    if (plotIndex === undefined || plotIndex === null) {
      res.status(400).json({ error: 'plotIndex is required' });
      return;
    }
    const plot = await townService.claimPlot(req.agent!.id, req.params.id, plotIndex);
    res.json({ plot });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Start building on a claimed plot
router.post('/town/:id/build', authenticateAgent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { plotId, buildingType } = req.body;
    if (!plotId || !buildingType) {
      res.status(400).json({ error: 'plotId and buildingType are required' });
      return;
    }
    const plot = await townService.startBuild(req.agent!.id, plotId, buildingType);
    res.json({ plot });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Submit work (proof of inference) for a building
router.post('/town/:id/work', authenticateAgent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { plotId, workType, description, input, output, apiCalls, apiCostCents, modelUsed, responseTimeMs } = req.body;
    if (!plotId || !workType) {
      res.status(400).json({ error: 'plotId and workType are required' });
      return;
    }
    const workLog = await townService.submitWork(
      req.agent!.id,
      plotId,
      workType,
      description || '',
      input || '',
      output || '',
      apiCalls || 1,
      apiCostCents || 0,
      modelUsed || 'unknown',
      responseTimeMs || 0,
    );
    res.json({ workLog });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Complete a build (finalize when enough work is done)
router.post('/town/:id/complete-build', authenticateAgent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { plotId } = req.body;
    if (!plotId) {
      res.status(400).json({ error: 'plotId is required' });
      return;
    }
    const plot = await townService.completeBuild(req.agent!.id, plotId);
    res.json({ plot, message: 'Building complete!' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Submit mining work (earn $ARENA)
router.post('/town/:id/mine', authenticateAgent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { description, input, output, apiCalls, apiCostCents, modelUsed, arenaEarned, responseTimeMs } = req.body;
    const workLog = await townService.submitMiningWork(
      req.agent!.id,
      req.params.id,
      description || '',
      input || '',
      output || '',
      apiCalls || 1,
      apiCostCents || 0,
      modelUsed || 'unknown',
      arenaEarned || 0,
      responseTimeMs || 0,
    );
    res.json({ workLog });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// Agent Economy
// ============================================

router.get('/agent/:id/economy', async (req: Request, res: Response): Promise<void> => {
  try {
    const economy = await townService.getAgentEconomy(req.params.id);
    res.json(economy);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/agent/me/economy', authenticateAgent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const economy = await townService.getAgentEconomy(req.agent!.id);
    res.json(economy);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// World Stats
// ============================================

router.get('/world/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await townService.getWorldStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/world/events', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const events = await townService.getGlobalEvents(limit);
    res.json({ events });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Agent Action Logs
// ============================================

router.get('/agent/:id/actions', async (req: Request, res: Response): Promise<void> => {
  try {
    const agentId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    
    // Get work logs for this agent
    const workLogs = await prisma.workLog.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        plot: {
          select: { plotIndex: true, buildingName: true, zone: true },
        },
      },
    });

    // Get town events for this agent
    const events = await prisma.townEvent.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Combine and sort
    const actions = [
      ...workLogs.map((w: any) => ({
        type: 'work',
        id: w.id,
        workType: w.workType,
        content: w.description || w.input || '',
        input: w.input,
        output: w.output,
        plotIndex: w.plot?.plotIndex,
        buildingName: w.plot?.buildingName,
        zone: w.plot?.zone,
        createdAt: w.createdAt,
      })),
      ...events.map((e: any) => ({
        type: 'event',
        id: e.id,
        eventType: e.eventType,
        title: e.title,
        description: e.description,
        createdAt: e.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
     .slice(0, limit);

    res.json({ actions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Yield Distribution (admin/cron)
// ============================================

router.post('/town/:id/distribute-yield', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await townService.distributeYield(req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// Sprite Library API
// ============================================

router.get('/sprites', async (req: Request, res: Response): Promise<void> => {
  try {
    const spriteLib = await import('../services/spriteLibraryService');
    
    const category = req.query.category as string | undefined;
    const tags = req.query.tags ? (req.query.tags as string).split(',') : undefined;
    const search = req.query.search as string | undefined;
    
    const result = spriteLib.browseSprites({
      category: category as any,
      tags,
      searchText: search,
    });
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sprites/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    const spriteLib = await import('../services/spriteLibraryService');
    const stats = spriteLib.getCatalogStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sprites/refresh', async (_req: Request, res: Response): Promise<void> => {
  try {
    const spriteLib = await import('../services/spriteLibraryService');
    const catalog = spriteLib.refreshCatalog();
    res.json({ refreshed: true, total: catalog.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sprites/find', async (req: Request, res: Response): Promise<void> => {
  try {
    const spriteLib = await import('../services/spriteLibraryService');
    const type = req.query.type as string || 'house';
    const name = req.query.name as string | undefined;
    
    const sprite = spriteLib.findSpriteForBuilding(type, name);
    res.json({ buildingType: type, buildingName: name, sprite });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Gallery page to browse sprite library
router.get('/sprites/gallery', async (_req: Request, res: Response): Promise<void> => {
  try {
    const spriteLib = await import('../services/spriteLibraryService');
    const result = spriteLib.browseSprites({});
    const stats = spriteLib.getCatalogStats();
    
    const html = `<!DOCTYPE html>
<html><head><title>🎨 Sprite Library</title>
<style>
  body { font-family: system-ui, sans-serif; background: #1a1a2e; color: #eee; padding: 20px; margin: 0; }
  h1 { color: #ffd700; margin-bottom: 8px; }
  .stats { color: #888; margin-bottom: 20px; }
  .categories { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
  .cat { background: #16213e; padding: 6px 12px; border-radius: 20px; font-size: 13px; }
  .cat.active { background: #ffd700; color: #1a1a2e; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px; }
  .card { background: #16213e; border-radius: 12px; padding: 12px; text-align: center; }
  .card img { width: 64px; height: 64px; image-rendering: pixelated; background: #0f3460; border-radius: 8px; }
  .card h4 { margin: 8px 0 4px; font-size: 13px; color: #ffd700; }
  .card p { margin: 2px 0; font-size: 11px; color: #666; }
  .empty { text-align: center; padding: 60px; color: #666; }
  .empty h2 { color: #888; }
  code { background: #0f3460; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
</style></head>
<body>
<h1>🎨 Sprite Library</h1>
<p class="stats">${stats.total} sprites across ${Object.values(stats.byCategory).filter(n => n > 0).length} categories</p>

<div class="categories">
  <span class="cat active">All (${stats.total})</span>
  ${Object.entries(stats.byCategory).filter(([,n]) => n > 0).map(([cat, n]) => 
    `<span class="cat">${cat} (${n})</span>`
  ).join('')}
</div>

${result.sprites.length === 0 ? `
<div class="empty">
  <h2>📭 Library is empty</h2>
  <p>Add sprites to: <code>backend/public/sprite-library/{category}/</code></p>
  <p>Categories: residential, commercial, industrial, civic, entertainment, nature</p>
  <p>Naming: <code>sprite-name-64px.png</code></p>
  <p>Then hit <a href="/api/v1/sprites/refresh" style="color:#ffd700">/api/v1/sprites/refresh</a></p>
</div>
` : `
<div class="grid">
${result.sprites.map(s => `
  <div class="card">
    <img src="${s.url}" alt="${s.name}" onerror="this.style.display='none'">
    <h4>${s.name}</h4>
    <p>${s.category} • ${s.size}px</p>
    <p>${s.tags.slice(0, 3).join(', ')}</p>
  </div>
`).join('')}
</div>
`}
</body></html>`;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
