/**
 * Integration: deterministic DEGEN loop trigger coverage.
 *
 * These tests validate that nudged autonomy paths execute end-to-end through
 * processAgent(), mutate world state, and emit decision metadata.
 */

import { describe, it, expect } from 'vitest';
import { installSmartAiMock } from '../../__tests__/mocks/smartAiService.mock';
installSmartAiMock();

import { prisma } from '../../config/database';
import { createTestAgent, createTestTown, seedPool } from '../../__tests__/helpers/fixtures';
import { AgentLoopService } from '../agentLoopService';
import { TownService } from '../townService';

describe('Agent Autonomy Flow Integration', () => {
  it('DEGEN BUILD -> WORK nudges advance construction and persist decision metadata', async () => {
    const loop = new AgentLoopService();
    const townService = new TownService();

    await seedPool(prisma, { reserveBalance: 1_000_000, arenaBalance: 1_000_000 });
    const town = await createTestTown(prisma, { totalPlots: 4 });
    const agent = await createTestAgent(prisma, {
      name: 'AutoBuilder',
      bankroll: 20_000,
      reserveBalance: 20_000,
    });

    await townService.claimPlot(agent.id, town.id, 0);

    loop.setLoopMode(agent.id, 'DEGEN_LOOP');
    loop.queueInstruction(agent.id, 'PRIORITY: BUILD', 'chat-build', 'ops');

    const buildResult = await loop.processAgent(agent.id);
    expect(buildResult.success).toBe(true);
    expect(buildResult.action.type).toBe('start_build');

    const afterBuild = await prisma.plot.findUniqueOrThrow({
      where: { townId_plotIndex: { townId: town.id, plotIndex: 0 } },
      select: { id: true, status: true, apiCallsUsed: true },
    });
    expect(afterBuild.status).toBe('UNDER_CONSTRUCTION');

    loop.queueInstruction(agent.id, 'PRIORITY: WORK', 'chat-work', 'ops');
    const workResult = await loop.processAgent(agent.id);
    expect(workResult.success).toBe(true);
    expect(workResult.action.type).toBe('do_work');

    const afterWork = await prisma.plot.findUniqueOrThrow({
      where: { id: afterBuild.id },
      select: { status: true, apiCallsUsed: true },
    });
    expect(afterWork.status).toBe('UNDER_CONSTRUCTION');
    expect(afterWork.apiCallsUsed).toBeGreaterThan(afterBuild.apiCallsUsed);

    const latestEvent = await prisma.townEvent.findFirst({
      where: { townId: town.id, agentId: agent.id },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true },
    });
    expect(latestEvent).not.toBeNull();
    const metadata = JSON.parse(String(latestEvent?.metadata || '{}')) as Record<string, unknown>;
    const decision =
      metadata.decision && typeof metadata.decision === 'object'
        ? (metadata.decision as Record<string, unknown>)
        : null;
    expect(decision).not.toBeNull();
    expect(decision?.chosenAction).toBe('do_work');
    expect(decision?.executedAction).toBe('do_work');
    expect(typeof decision?.executedReasoning).toBe('string');
    expect(String(decision?.executedReasoning || '').length).toBeGreaterThan(0);
  });

  it('DEGEN TRADE nudge rotates buy/sell based on bankroll and reserve profile', async () => {
    const loop = new AgentLoopService();

    await seedPool(prisma, { reserveBalance: 1_000_000, arenaBalance: 1_000_000 });
    await createTestTown(prisma, { totalPlots: 4 });
    const agent = await createTestAgent(prisma, {
      name: 'AutoTrader',
      bankroll: 60,
      reserveBalance: 120,
    });

    loop.setLoopMode(agent.id, 'DEGEN_LOOP');
    loop.queueInstruction(agent.id, 'PRIORITY: TRADE', 'chat-trade-buy', 'ops');
    const buyResult = await loop.processAgent(agent.id);
    expect(buyResult.success).toBe(true);
    expect(buyResult.action.type).toBe('buy_arena');

    const buySwap = await prisma.economySwap.findFirst({
      where: { agentId: agent.id },
      orderBy: { createdAt: 'desc' },
      select: { side: true, amountIn: true, amountOut: true },
    });
    expect(buySwap).not.toBeNull();
    expect(buySwap?.side).toBe('BUY_ARENA');
    expect((buySwap?.amountIn || 0) > 0).toBe(true);
    expect((buySwap?.amountOut || 0) > 0).toBe(true);

    await prisma.arenaAgent.update({
      where: { id: agent.id },
      data: {
        bankroll: 260,
        reserveBalance: 20,
      },
    });

    loop.queueInstruction(agent.id, 'PRIORITY: TRADE', 'chat-trade-sell', 'ops');
    const sellResult = await loop.processAgent(agent.id);
    expect(sellResult.success).toBe(true);
    expect(sellResult.action.type).toBe('sell_arena');

    const sellSwap = await prisma.economySwap.findFirst({
      where: { agentId: agent.id },
      orderBy: { createdAt: 'desc' },
      select: { side: true, amountIn: true, amountOut: true },
    });
    expect(sellSwap).not.toBeNull();
    expect(sellSwap?.side).toBe('SELL_ARENA');
    expect((sellSwap?.amountIn || 0) > 0).toBe(true);
    expect((sellSwap?.amountOut || 0) > 0).toBe(true);
  });

  it('DEGEN FIGHT nudge executes arena path and logs ARENA_MATCH event metadata', async () => {
    const loop = new AgentLoopService();

    await seedPool(prisma, { reserveBalance: 1_000_000, arenaBalance: 1_000_000 });
    const town = await createTestTown(prisma, { totalPlots: 4 });
    const fighter = await createTestAgent(prisma, {
      name: 'AutoFighter',
      bankroll: 1_000,
      reserveBalance: 300,
      elo: 1500,
    });
    await createTestAgent(prisma, {
      name: 'AutoOpponent',
      bankroll: 1_000,
      reserveBalance: 300,
      elo: 1490,
    });

    loop.setLoopMode(fighter.id, 'DEGEN_LOOP');
    loop.queueInstruction(fighter.id, 'PRIORITY: FIGHT', 'chat-fight', 'ops');
    const result = await loop.processAgent(fighter.id);

    expect(result.success).toBe(true);
    expect(result.action.type).toBe('play_arena');

    const arenaEvent = await prisma.townEvent.findFirst({
      where: { townId: town.id, agentId: fighter.id, eventType: 'ARENA_MATCH' },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true },
    });
    expect(arenaEvent).not.toBeNull();
    const metadata = JSON.parse(String(arenaEvent?.metadata || '{}')) as Record<string, unknown>;
    const decision =
      metadata.decision && typeof metadata.decision === 'object'
        ? (metadata.decision as Record<string, unknown>)
        : null;
    expect(decision).not.toBeNull();
    expect(decision?.chosenAction).toBe('play_arena');
    expect(decision?.executedAction).toBe('play_arena');
  });
});
