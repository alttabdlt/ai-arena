/// <reference types="vitest/globals" />
import { describe, it, expect } from 'vitest';
import { prisma } from '../config/database';
import { createTestAgent, createTestTown, seedPool } from '../__tests__/helpers/fixtures';
import { TownService } from './townService';

let ts: TownService;

beforeEach(() => {
  ts = new TownService();
});

describe('TownService', () => {
  // ── createTown ───────────────────────────────────────────────

  describe('createTown', () => {
    it('creates town with correct plot count and zone distribution', async () => {
      const town = await ts.createTown('TestVillage', 'medieval', 4, 1);
      expect(town.name).toBe('TestVillage');
      expect(town.totalPlots).toBe(4);
      expect(town.status).toBe('BUILDING');
      expect(town.plots).toHaveLength(4);
      // Check zones exist (distribution varies but should all have a zone)
      for (const p of town.plots) {
        expect(['RESIDENTIAL', 'COMMERCIAL', 'CIVIC', 'INDUSTRIAL', 'ENTERTAINMENT']).toContain(p.zone);
      }
    });

    it('creates TOWN_CREATED event', async () => {
      const town = await ts.createTown('EventTown', 'test', 4, 1);
      const events = await prisma.townEvent.findMany({ where: { townId: town.id } });
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('TOWN_CREATED');
    });

    it('scales plots by level', async () => {
      const town = await ts.createTown('Level3Town', 'test', undefined, 3);
      // Level 3: BASE_PLOTS(25) + (3-1) * PLOTS_PER_LEVEL(5) = 35
      expect(town.totalPlots).toBe(35);
    });
  });

  // ── claimPlot ────────────────────────────────────────────────

  describe('claimPlot', () => {
    it('transitions plot to CLAIMED, deducts bankroll, creates contribution', async () => {
      const town = await createTestTown(prisma, { name: 'ClaimTown' });
      const agent = await createTestAgent(prisma, { bankroll: 10000 });

      const plot = await ts.claimPlot(agent.id, town.id, 0);
      expect(plot.status).toBe('CLAIMED');
      expect(plot.ownerId).toBe(agent.id);

      const updated = await prisma.arenaAgent.findUnique({ where: { id: agent.id } });
      expect(updated!.bankroll).toBeLessThan(10000);

      const contrib = await prisma.townContribution.findFirst({ where: { agentId: agent.id, townId: town.id } });
      expect(contrib).not.toBeNull();
      expect(contrib!.arenaSpent).toBeGreaterThan(0);
    });

    it('errors if plot not EMPTY', async () => {
      const town = await createTestTown(prisma);
      const agent = await createTestAgent(prisma, { bankroll: 10000 });
      await ts.claimPlot(agent.id, town.id, 0);

      const agent2 = await createTestAgent(prisma, { bankroll: 10000 });
      await expect(ts.claimPlot(agent2.id, town.id, 0)).rejects.toThrow('already');
    });

    it('errors if insufficient bankroll', async () => {
      const town = await createTestTown(prisma);
      const agent = await createTestAgent(prisma, { bankroll: 1 });
      await expect(ts.claimPlot(agent.id, town.id, 0)).rejects.toThrow('Not enough');
    });

    it('errors if town not BUILDING', async () => {
      const town = await createTestTown(prisma);
      await prisma.town.update({ where: { id: town.id }, data: { status: 'COMPLETE' } });

      const agent = await createTestAgent(prisma, { bankroll: 10000 });
      await expect(ts.claimPlot(agent.id, town.id, 0)).rejects.toThrow('not accepting');
    });

    it('creates PLOT_CLAIMED event', async () => {
      const town = await createTestTown(prisma);
      const agent = await createTestAgent(prisma, { bankroll: 10000 });
      await ts.claimPlot(agent.id, town.id, 0);

      const events = await prisma.townEvent.findMany({ where: { townId: town.id, eventType: 'PLOT_CLAIMED' } });
      expect(events).toHaveLength(1);
    });
  });

  // ── startBuild ───────────────────────────────────────────────

  describe('startBuild', () => {
    it('transitions plot to UNDER_CONSTRUCTION, deducts cost', async () => {
      const town = await createTestTown(prisma);
      const agent = await createTestAgent(prisma, { bankroll: 10000 });
      const claimed = await ts.claimPlot(agent.id, town.id, 0);

      const bankBefore = (await prisma.arenaAgent.findUnique({ where: { id: agent.id } }))!.bankroll;
      const built = await ts.startBuild(agent.id, claimed.id, 'HOUSE');
      expect(built.status).toBe('UNDER_CONSTRUCTION');
      expect(built.buildingType).toBe('HOUSE');

      const bankAfter = (await prisma.arenaAgent.findUnique({ where: { id: agent.id } }))!.bankroll;
      expect(bankAfter).toBeLessThan(bankBefore);
    });

    it('errors if plot not CLAIMED', async () => {
      const town = await createTestTown(prisma);
      const plotId = town.plots[0].id;
      const agent = await createTestAgent(prisma, { bankroll: 10000 });
      await expect(ts.startBuild(agent.id, plotId, 'HOUSE')).rejects.toThrow('must be CLAIMED');
    });
  });

  // ── submitWork ───────────────────────────────────────────────

  describe('submitWork', () => {
    it('creates WorkLog and increments apiCallsUsed', async () => {
      const town = await createTestTown(prisma);
      const agent = await createTestAgent(prisma, { bankroll: 10000 });
      const claimed = await ts.claimPlot(agent.id, town.id, 0);
      const built = await ts.startBuild(agent.id, claimed.id, 'HOUSE');

      const wl = await ts.submitWork(agent.id, built.id, 'CONSTRUCT', 'Building walls', 'prompt', 'output', 1, 2, 'mock', 100);
      expect(wl.workType).toBe('CONSTRUCT');

      const updatedPlot = await prisma.plot.findUnique({ where: { id: built.id } });
      expect(updatedPlot!.apiCallsUsed).toBe(1);
    });
  });

  // ── completeBuild ────────────────────────────────────────────

  describe('completeBuild', () => {
    it('transitions to BUILT, increments builtPlots, updates completionPct', async () => {
      const town = await createTestTown(prisma, { totalPlots: 4 });
      const agent = await createTestAgent(prisma, { bankroll: 50000 });

      const claimed = await ts.claimPlot(agent.id, town.id, 0);
      const built = await ts.startBuild(agent.id, claimed.id, 'HOUSE');

      // Submit minimum 3 work units (RESIDENTIAL zone)
      for (let i = 0; i < 3; i++) {
        await ts.submitWork(agent.id, built.id, 'CONSTRUCT', `step ${i}`, 'p', 'o', 1, 0, 'mock');
      }

      const completed = await ts.completeBuild(agent.id, built.id);
      expect(completed.status).toBe('BUILT');

      const updatedTown = await prisma.town.findUnique({ where: { id: town.id } });
      expect(updatedTown!.builtPlots).toBe(1);
      expect(updatedTown!.completionPct).toBe(25); // 1/4 * 100
    });

    it('errors if not enough API calls', async () => {
      const town = await createTestTown(prisma);
      const agent = await createTestAgent(prisma, { bankroll: 50000 });
      const claimed = await ts.claimPlot(agent.id, town.id, 0);
      const built = await ts.startBuild(agent.id, claimed.id, 'HOUSE');

      // Only 1 work unit, needs 3
      await ts.submitWork(agent.id, built.id, 'CONSTRUCT', 'step', 'p', 'o', 1, 0, 'mock');
      await expect(ts.completeBuild(agent.id, built.id)).rejects.toThrow('Not enough work');
    });
  });

  // ── Town completion ──────────────────────────────────────────

  describe('town completion', () => {
    it('last plot → COMPLETE, yield shares calculated', async () => {
      const town = await createTestTown(prisma, { totalPlots: 2 });
      const a1 = await createTestAgent(prisma, { bankroll: 50000 });
      const a2 = await createTestAgent(prisma, { bankroll: 50000 });

      // Claim and start build for both agents first (before completing any)
      const c1 = await ts.claimPlot(a1.id, town.id, 0);
      const c2 = await ts.claimPlot(a2.id, town.id, 1);
      const b1 = await ts.startBuild(a1.id, c1.id, 'HOUSE');
      const b2 = await ts.startBuild(a2.id, c2.id, 'SHOP');

      // Submit minimum work for each zone
      // RESIDENTIAL (HOUSE) = 3 API calls
      for (let i = 0; i < 3; i++) await ts.submitWork(a1.id, b1.id, 'CONSTRUCT', `s${i}`, 'p', 'o', 1, 0, 'mock');
      // COMMERCIAL (SHOP) = 4 API calls
      for (let i = 0; i < 4; i++) await ts.submitWork(a2.id, b2.id, 'CONSTRUCT', `s${i}`, 'p', 'o', 1, 0, 'mock');

      // Complete builds — second completion triggers town COMPLETE
      await ts.completeBuild(a1.id, b1.id);
      await ts.completeBuild(a2.id, b2.id);

      const final = await prisma.town.findUnique({ where: { id: town.id } });
      expect(final!.status).toBe('COMPLETE');
      expect(final!.completionPct).toBe(100);

      // Yield shares should be set
      const contributions = await prisma.townContribution.findMany({ where: { townId: town.id } });
      const totalShare = contributions.reduce((s, c) => s + c.yieldShare, 0);
      expect(totalShare).toBeCloseTo(1.0, 2);
    });
  });

  // ── distributeYield ──────────────────────────────────────────

  describe('distributeYield', () => {
    it('distributes proportionally to contributors', async () => {
      // Set up a completed town with yield shares
      const town = await createTestTown(prisma, { totalPlots: 1 });
      const agent = await createTestAgent(prisma, { bankroll: 50000 });
      const c = await ts.claimPlot(agent.id, town.id, 0);
      const b = await ts.startBuild(agent.id, c.id, 'HOUSE');
      for (let i = 0; i < 3; i++) await ts.submitWork(agent.id, b.id, 'CONSTRUCT', `s${i}`, 'p', 'o', 1, 0, 'mock');
      await ts.completeBuild(agent.id, b.id);

      const bankBefore = (await prisma.arenaAgent.findUnique({ where: { id: agent.id } }))!.bankroll;

      const result = await ts.distributeYield(town.id);
      expect(result.distributed).toBeGreaterThan(0);
      expect(result.recipients).toBe(1);

      const bankAfter = (await prisma.arenaAgent.findUnique({ where: { id: agent.id } }))!.bankroll;
      expect(bankAfter).toBeGreaterThan(bankBefore);
    });

    it('errors if town not COMPLETE', async () => {
      const town = await createTestTown(prisma);
      await expect(ts.distributeYield(town.id)).rejects.toThrow('not complete');
    });
  });

  // ── Mining ───────────────────────────────────────────────────

  describe('submitMiningWork', () => {
    it('creates WorkLog MINE type and credits bankroll', async () => {
      const town = await createTestTown(prisma);
      const agent = await createTestAgent(prisma, { bankroll: 1000 });
      await seedPool(prisma, { opsBudget: 500 });

      const wl = await ts.submitMiningWork(agent.id, town.id, 'mining', 'prompt', 'output', 1, 0, 'mock', 50);
      expect(wl.workType).toBe('MINE');
      expect(wl.arenaEarned).toBe(50);

      const updated = await prisma.arenaAgent.findUnique({ where: { id: agent.id } });
      expect(updated!.bankroll).toBe(1050);
    });
  });
});
