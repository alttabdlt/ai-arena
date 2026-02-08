/**
 * Integration: Build a town from empty to completion.
 */

import { describe, it, expect } from 'vitest';
import { prisma } from '../../config/database';
import { createTestAgent } from '../../__tests__/helpers/fixtures';
import { TownService } from '../townService';

describe('Town Lifecycle Integration', () => {
  it('builds a town from empty to COMPLETE with yield distribution', async () => {
    const ts = new TownService();

    // 1. Create town with 4 plots
    const town = await ts.createTown('TestVillage', 'medieval test', 4, 1);
    expect(town.status).toBe('BUILDING');
    expect(town.plots).toHaveLength(4);

    // 2. Create 2 agents
    const shark = await createTestAgent(prisma, { name: 'SharkBot', archetype: 'SHARK', bankroll: 50000 });
    const rock = await createTestAgent(prisma, { name: 'RockBot', archetype: 'ROCK', bankroll: 50000 });

    // 3. Shark claims plots 0 + 1
    const p0 = await ts.claimPlot(shark.id, town.id, 0);
    const p1 = await ts.claimPlot(shark.id, town.id, 1);

    // 4. Rock claims plots 2 + 3
    const p2 = await ts.claimPlot(rock.id, town.id, 2);
    const p3 = await ts.claimPlot(rock.id, town.id, 3);

    // 5. Start builds
    const b0 = await ts.startBuild(shark.id, p0.id, 'HOUSE');
    const b1 = await ts.startBuild(shark.id, p1.id, 'SHOP');
    const b2 = await ts.startBuild(rock.id, p2.id, 'WORKSHOP');
    const b3 = await ts.startBuild(rock.id, p3.id, 'PARK');

    // 6. Submit work — enough for each zone's minimum
    // RESIDENTIAL (HOUSE) = 3, COMMERCIAL (SHOP) = 4, INDUSTRIAL (WORKSHOP) = 4, ENTERTAINMENT (PARK) = 3
    const minCalls: Record<string, number> = {
      [b0.id]: 3,
      [b1.id]: 4,
      [b2.id]: 4,
      [b3.id]: 3,
    };

    for (const [plotId, count] of Object.entries(minCalls)) {
      const owner = plotId === b0.id || plotId === b1.id ? shark.id : rock.id;
      for (let i = 0; i < count; i++) {
        await ts.submitWork(owner, plotId, 'CONSTRUCT', `step ${i}`, 'prompt', 'output', 1, 0, 'mock');
      }
    }

    // 7. Complete builds — last one should trigger town completion
    await ts.completeBuild(shark.id, b0.id);
    await ts.completeBuild(shark.id, b1.id);
    await ts.completeBuild(rock.id, b2.id);
    await ts.completeBuild(rock.id, b3.id);

    // 8. Assert town status
    const finalTown = await prisma.town.findUnique({ where: { id: town.id } });
    expect(finalTown!.status).toBe('COMPLETE');
    expect(finalTown!.completionPct).toBe(100);
    expect(finalTown!.builtPlots).toBe(4);

    // 9. Distribute yield — bankrolls should increase
    const sharkBefore = (await prisma.arenaAgent.findUnique({ where: { id: shark.id } }))!.bankroll;
    const rockBefore = (await prisma.arenaAgent.findUnique({ where: { id: rock.id } }))!.bankroll;

    const result = await ts.distributeYield(town.id);
    expect(result.distributed).toBeGreaterThan(0);
    expect(result.recipients).toBe(2);

    const sharkAfter = (await prisma.arenaAgent.findUnique({ where: { id: shark.id } }))!.bankroll;
    const rockAfter = (await prisma.arenaAgent.findUnique({ where: { id: rock.id } }))!.bankroll;
    expect(sharkAfter).toBeGreaterThan(sharkBefore);
    expect(rockAfter).toBeGreaterThan(rockBefore);

    // 10. Verify event feed
    const events = await prisma.townEvent.findMany({
      where: { townId: town.id },
      orderBy: { createdAt: 'asc' },
    });

    const eventTypes = events.map((e) => e.eventType);
    expect(eventTypes).toContain('TOWN_CREATED');
    expect(eventTypes).toContain('PLOT_CLAIMED');
    expect(eventTypes).toContain('BUILD_STARTED');
    expect(eventTypes).toContain('BUILD_COMPLETED');
    expect(eventTypes).toContain('TOWN_COMPLETED');
  });
});
