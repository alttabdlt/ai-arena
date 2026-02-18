import { describe, expect, it } from 'vitest';
import { installSmartAiMock } from '../../__tests__/mocks/smartAiService.mock';
installSmartAiMock();

import { prisma } from '../../config/database';
import { createTestAgent, seedPool } from '../../__tests__/helpers/fixtures';
import { AgentLoopService } from '../agentLoopService';
import { executeDefend } from '../warMarketService';

describe('Economy Audit Integration', () => {
  it('reports stable tracked ARENA float across closed-loop defend flows', async () => {
    const loop = new AgentLoopService();
    const agent = await createTestAgent(prisma, { name: 'AuditDefender', bankroll: 600 });
    const pool = await seedPool(prisma, {
      reserveBalance: 1_000_000,
      arenaBalance: 1_000_000,
      opsBudget: 10,
      pvpBudget: 20,
      rescueBudget: 30,
      insuranceBudget: 40,
      warBudget: 50,
    });

    const before = await loop.getEconomyAudit({ ledgerLookback: 50 });
    expect(before.ok).toBe(true);
    expect(before.baseline).not.toBeNull();
    expect(before.baseline?.driftSinceBaseline).toBe(0);

    await executeDefend({
      agentId: agent.id,
      agentName: agent.name,
      currentTick: 1,
      poolId: pool.id,
    });

    const after = await loop.getEconomyAudit({ ledgerLookback: 50 });
    expect(after.ok).toBe(true);
    expect(after.baseline).not.toBeNull();
    expect(after.baseline?.driftSinceBaseline).toBe(0);
    const floatCheck = after.checks.find((check) => check.code === 'TRACKED_ARENA_FLOAT_STABLE');
    expect(floatCheck?.ok).toBe(true);
  });

  it('flags negative pool budgets as an invariant failure', async () => {
    const loop = new AgentLoopService();
    const pool = await seedPool(prisma, {
      reserveBalance: 1_000_000,
      arenaBalance: 1_000_000,
      warBudget: 1,
    });

    await prisma.economyPool.update({
      where: { id: pool.id },
      data: { warBudget: -3 },
    });

    const audit = await loop.getEconomyAudit({ ledgerLookback: 25 });
    expect(audit.ok).toBe(false);
    const check = audit.checks.find((entry) => entry.code === 'NON_NEGATIVE_POOL_BUDGETS');
    expect(check).toBeDefined();
    expect(check?.ok).toBe(false);
    expect(check?.message).toContain('warBudget=-3');
  });
});
