import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/database';
import { createTestAgent, createTestTown } from '../__tests__/helpers/fixtures';
import { AgentLoopService } from './agentLoopService';

describe('AgentLoopService deterministic planner', () => {
  let service: AgentLoopService;

  beforeEach(() => {
    service = new AgentLoopService();
  });

  it('setLoopMode/getLoopMode tracks per-agent loop mode', () => {
    const agentId = 'agent-loop-mode-test';
    expect(service.getLoopMode(agentId)).toBe('DEFAULT');

    expect(service.setLoopMode(agentId, 'DEGEN_LOOP')).toBe('DEGEN_LOOP');
    expect(service.getLoopMode(agentId)).toBe('DEGEN_LOOP');

    expect(service.setLoopMode(agentId, 'DEFAULT')).toBe('DEFAULT');
    expect(service.getLoopMode(agentId)).toBe('DEFAULT');
  });

  it('WORK is blocked when no under-construction plot exists', async () => {
    const agent = await createTestAgent(prisma);
    await createTestTown(prisma, { totalPlots: 4 });

    const plan = await service.planDeterministicAction(agent.id, 'work');
    expect(plan.ok).toBe(false);
    if (plan.ok) {
      throw new Error('Expected WORK plan to be blocked');
    }
    expect(plan.reasonCode).toBe('CONSTRAINT_VIOLATION');
    expect(plan.reason).toContain('No active construction');
  });

  it('BUILD maps to do_work when the agent already has active construction', async () => {
    const agent = await createTestAgent(prisma);
    const town = await createTestTown(prisma, { totalPlots: 3 });
    const targetPlot = town.plots[0];

    await prisma.plot.update({
      where: { id: targetPlot.id },
      data: {
        status: 'UNDER_CONSTRUCTION',
        ownerId: agent.id,
        builderId: agent.id,
        apiCallsUsed: 2,
      },
    });

    const plan = await service.planDeterministicAction(agent.id, 'build');
    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      throw new Error(`Expected BUILD to map to do_work, got ${plan.reasonCode}`);
    }
    expect(plan.intent).toBe('do_work');
    expect(plan.params).toMatchObject({
      plotId: targetPlot.id,
      plotIndex: targetPlot.plotIndex,
    });
  });

  it('BUILD returns INSUFFICIENT_ARENA during bootstrap claim when bankroll is too low', async () => {
    const agent = await createTestAgent(prisma, { bankroll: 1, reserveBalance: 0 });
    await createTestTown(prisma, { totalPlots: 4 });

    const plan = await service.planDeterministicAction(agent.id, 'build');
    expect(plan.ok).toBe(false);
    if (plan.ok) {
      throw new Error('Expected BUILD bootstrap plan to fail on low bankroll');
    }
    expect(plan.reasonCode).toBe('INSUFFICIENT_ARENA');
    expect(plan.reason).toContain('Need about');
  });

  it('TRADE maps to buy_arena when reserve is available and liquid bankroll is low', async () => {
    const agent = await createTestAgent(prisma, { reserveBalance: 50, bankroll: 100 });

    const plan = await service.planDeterministicAction(agent.id, 'trade');
    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      throw new Error(`Expected TRADE to map to buy_arena, got ${plan.reasonCode}`);
    }
    expect(plan.intent).toBe('buy_arena');
    expect(plan.params).toMatchObject({
      amountIn: 50,
      nextAction: 'play_arena',
    });
  });

  it('TRADE maps to sell_arena when bankroll is high and reserve is low', async () => {
    const agent = await createTestAgent(prisma, { reserveBalance: 5, bankroll: 210 });

    const plan = await service.planDeterministicAction(agent.id, 'trade');
    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      throw new Error(`Expected TRADE to map to sell_arena, got ${plan.reasonCode}`);
    }
    expect(plan.intent).toBe('sell_arena');
    expect(plan.params).toMatchObject({
      amountIn: 80,
      nextAction: 'start_build',
    });
  });
});
