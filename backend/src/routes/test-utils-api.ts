import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { agentLoopService } from '../services/agentLoopService';

const router = Router();

function guardTestUtils(req: Request, res: Response): boolean {
  if (process.env.ENABLE_TEST_UTILS !== '1') {
    res.status(404).json({
      ok: false,
      code: 'TEST_UTILS_DISABLED',
      error: 'Test utils are disabled in this environment.',
    });
    return false;
  }

  if (process.env.DISABLE_WHEEL !== '1') {
    res.status(409).json({
      ok: false,
      code: 'WHEEL_MUST_BE_DISABLED',
      error: 'Set DISABLE_WHEEL=1 before running destructive test-utils reset.',
    });
    return false;
  }

  const requiredKey = String(process.env.TEST_UTILS_KEY || '').trim();
  if (!requiredKey) {
    res.status(503).json({
      ok: false,
      code: 'TEST_UTILS_KEY_MISCONFIGURED',
      error: 'TEST_UTILS_KEY must be set when ENABLE_TEST_UTILS=1.',
    });
    return false;
  }

  const provided = String(req.headers['x-test-utils-key'] || '').trim();
  if (!provided || provided !== requiredKey) {
    res.status(401).json({
      ok: false,
      code: 'TEST_UTILS_KEY_REQUIRED',
      error: 'Missing or invalid x-test-utils-key header.',
    });
    return false;
  }

  return true;
}

async function deleteAllUserTables(): Promise<string[]> {
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF;');
  try {
    const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
          AND name != '_prisma_migrations'
      `,
    );
    const names = tables.map((row) => row.name).filter(Boolean);
    for (const tableName of names) {
      await prisma.$executeRawUnsafe(`DELETE FROM "${tableName.replace(/"/g, '""')}"`);
    }
    return names;
  } finally {
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
  }
}

router.get('/test-utils/status', async (req: Request, res: Response): Promise<void> => {
  if (!guardTestUtils(req, res)) return;
  res.json({
    ok: true,
    enabled: true,
    wheelDisabled: process.env.DISABLE_WHEEL === '1',
    testUtilsKeyRequired: String(process.env.TEST_UTILS_KEY || '').trim().length > 0,
    currentTick: agentLoopService.getCurrentTick(),
    loopRunning: agentLoopService.isRunning(),
  });
});

router.get('/test-utils/economy-stats', async (req: Request, res: Response): Promise<void> => {
  if (!guardTestUtils(req, res)) return;

  try {
    const pool = await prisma.economyPool.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        reserveBalance: true,
        arenaBalance: true,
        opsBudget: true,
        pvpBudget: true,
        rescueBudget: true,
        insuranceBudget: true,
        feeBps: true,
        cumulativeFeesReserve: true,
        cumulativeFeesArena: true,
        updatedAt: true,
      },
    });

    const ledgerTotal = await prisma.economyLedger.count();
    const grouped = await prisma.economyLedger.groupBy({
      by: ['type'],
      _count: { _all: true },
    });
    const ledgerByType = Object.fromEntries(
      grouped.map((row) => [row.type, row._count._all]),
    );

    res.json({
      ok: true,
      pool,
      ledger: {
        total: ledgerTotal,
        byType: ledgerByType,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      code: 'ECONOMY_STATS_FAILED',
      error: error?.message || 'Failed to query economy stats',
    });
  }
});

router.post('/test-utils/reset-world', async (req: Request, res: Response): Promise<void> => {
  if (!guardTestUtils(req, res)) return;

  const started = Date.now();
  const label = String((req.body as any)?.label || 'unspecified').slice(0, 80);

  try {
    agentLoopService.resetRuntimeState({ stopLoop: true, resetTick: true });
    const tablesDeleted = await deleteAllUserTables();

    // Re-seed baseline AMM liquidity so trade/build loops can bootstrap immediately.
    await prisma.economyPool.create({
      data: {
        reserveBalance: 1_000_000,
        arenaBalance: 1_000_000,
        feeBps: 100,
      },
    });

    res.json({
      ok: true,
      label,
      durationMs: Date.now() - started,
      tablesDeleted,
      seeded: {
        economyPool: true,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      code: 'RESET_FAILED',
      error: error?.message || 'Failed to reset world state',
    });
  }
});

export default router;
