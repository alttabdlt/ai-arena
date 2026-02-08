import { describe, it, expect } from 'vitest';
import { prisma } from '../config/database';
import { createTestAgent } from '../__tests__/helpers/fixtures';
import { socialGraphService } from './socialGraphService';

describe('socialGraphService', () => {
  // ── upsertInteraction ────────────────────────────────────────

  describe('upsertInteraction', () => {
    it('creates relationship row with normalized pair (a < b)', async () => {
      const a = await createTestAgent(prisma, { name: 'Alpha' });
      const b = await createTestAgent(prisma, { name: 'Beta' });

      const result = await socialGraphService.upsertInteraction({
        agentAId: b.id,
        agentBId: a.id,
        outcome: 'NEUTRAL',
        delta: 3,
      });

      // Should normalize: smaller ID goes to agentAId
      const expectedA = a.id < b.id ? a.id : b.id;
      const expectedB = a.id < b.id ? b.id : a.id;
      expect(result.relationship.agentAId).toBe(expectedA);
      expect(result.relationship.agentBId).toBe(expectedB);
    });

    it('score clamped to [-30, +30]', async () => {
      const a = await createTestAgent(prisma);
      const b = await createTestAgent(prisma);

      // Create initial relationship at score 28
      await prisma.agentRelationship.create({
        data: {
          agentAId: a.id < b.id ? a.id : b.id,
          agentBId: a.id < b.id ? b.id : a.id,
          score: 28,
          interactions: 5,
          lastInteractionAt: new Date(Date.now() - 60_000),
        },
      });

      const result = await socialGraphService.upsertInteraction({
        agentAId: a.id,
        agentBId: b.id,
        outcome: 'BOND',
        delta: 7,
      });

      expect(result.relationship.score).toBe(30); // clamped
    });

    it('delta clamped to [-7, +7]', async () => {
      const a = await createTestAgent(prisma);
      const b = await createTestAgent(prisma);

      const result = await socialGraphService.upsertInteraction({
        agentAId: a.id,
        agentBId: b.id,
        outcome: 'BOND',
        delta: 15, // should be clamped to 7
      });

      expect(result.relationship.score).toBe(7);
    });

    it('NEUTRAL → FRIEND when BOND + score >= 10', async () => {
      const a = await createTestAgent(prisma);
      const b = await createTestAgent(prisma);

      // Pre-seed at score 5, past cooldown
      await prisma.agentRelationship.create({
        data: {
          agentAId: a.id < b.id ? a.id : b.id,
          agentBId: a.id < b.id ? b.id : a.id,
          score: 5,
          interactions: 1,
          lastInteractionAt: new Date(Date.now() - 60_000),
        },
      });

      const result = await socialGraphService.upsertInteraction({
        agentAId: a.id,
        agentBId: b.id,
        outcome: 'BOND',
        delta: 5,
      });

      expect(result.relationship.status).toBe('FRIEND');
      expect(result.relationship.score).toBe(10);
      expect(result.statusChanged).toEqual({ from: 'NEUTRAL', to: 'FRIEND' });
    });

    it('NEUTRAL → RIVAL when BEEF + score <= -10', async () => {
      const a = await createTestAgent(prisma);
      const b = await createTestAgent(prisma);

      await prisma.agentRelationship.create({
        data: {
          agentAId: a.id < b.id ? a.id : b.id,
          agentBId: a.id < b.id ? b.id : a.id,
          score: -5,
          interactions: 1,
          lastInteractionAt: new Date(Date.now() - 60_000),
        },
      });

      const result = await socialGraphService.upsertInteraction({
        agentAId: a.id,
        agentBId: b.id,
        outcome: 'BEEF',
        delta: -5,
      });

      expect(result.relationship.status).toBe('RIVAL');
      expect(result.relationship.score).toBe(-10);
    });

    it('FRIEND → NEUTRAL when BEEF + score < 4', async () => {
      const a = await createTestAgent(prisma);
      const b = await createTestAgent(prisma);

      await prisma.agentRelationship.create({
        data: {
          agentAId: a.id < b.id ? a.id : b.id,
          agentBId: a.id < b.id ? b.id : a.id,
          status: 'FRIEND',
          score: 10,
          interactions: 3,
          friendSince: new Date(),
          lastInteractionAt: new Date(Date.now() - 60_000),
        },
      });

      const result = await socialGraphService.upsertInteraction({
        agentAId: a.id,
        agentBId: b.id,
        outcome: 'BEEF',
        delta: -7,
      });

      expect(result.relationship.score).toBe(3);
      expect(result.relationship.status).toBe('NEUTRAL');
      expect(result.statusChanged).toEqual({ from: 'FRIEND', to: 'NEUTRAL' });
    });

    it('RIVAL → NEUTRAL when BOND + score > -4', async () => {
      const a = await createTestAgent(prisma);
      const b = await createTestAgent(prisma);

      await prisma.agentRelationship.create({
        data: {
          agentAId: a.id < b.id ? a.id : b.id,
          agentBId: a.id < b.id ? b.id : a.id,
          status: 'RIVAL',
          score: -10,
          interactions: 3,
          rivalSince: new Date(),
          lastInteractionAt: new Date(Date.now() - 60_000),
        },
      });

      const result = await socialGraphService.upsertInteraction({
        agentAId: a.id,
        agentBId: b.id,
        outcome: 'BOND',
        delta: 7,
      });

      expect(result.relationship.score).toBe(-3);
      expect(result.relationship.status).toBe('NEUTRAL');
    });

    it('friend cap: 3rd friend blocked (MAX_FRIENDS=2)', async () => {
      const a = await createTestAgent(prisma);
      const b = await createTestAgent(prisma);
      const c = await createTestAgent(prisma);
      const d = await createTestAgent(prisma);

      // a is friends with b and c already
      for (const other of [b, c]) {
        const pair = a.id < other.id
          ? { agentAId: a.id, agentBId: other.id }
          : { agentAId: other.id, agentBId: a.id };
        await prisma.agentRelationship.create({
          data: { ...pair, status: 'FRIEND', score: 15, interactions: 5, friendSince: new Date() },
        });
      }

      // Now try to become friends with d — should be capped
      await prisma.agentRelationship.create({
        data: {
          agentAId: a.id < d.id ? a.id : d.id,
          agentBId: a.id < d.id ? d.id : a.id,
          score: 5,
          interactions: 1,
          lastInteractionAt: new Date(Date.now() - 60_000),
        },
      });

      const result = await socialGraphService.upsertInteraction({
        agentAId: a.id,
        agentBId: d.id,
        outcome: 'BOND',
        delta: 5,
      });

      expect(result.friendCapHit).toBe(true);
      expect(result.relationship.status).toBe('NEUTRAL');
    });

    it('pair cooldown: rejects interaction within 45s', async () => {
      const a = await createTestAgent(prisma);
      const b = await createTestAgent(prisma);

      // First interaction
      await socialGraphService.upsertInteraction({
        agentAId: a.id,
        agentBId: b.id,
        outcome: 'NEUTRAL',
        delta: 1,
      });

      // Second interaction immediately
      await expect(
        socialGraphService.upsertInteraction({
          agentAId: a.id,
          agentBId: b.id,
          outcome: 'NEUTRAL',
          delta: 1,
        }),
      ).rejects.toThrow('Pair chat cooldown');
    });

    it('symmetric: upsert(A,B) and upsert(B,A) affect same row', async () => {
      const a = await createTestAgent(prisma);
      const b = await createTestAgent(prisma);

      await socialGraphService.upsertInteraction({
        agentAId: a.id,
        agentBId: b.id,
        outcome: 'NEUTRAL',
        delta: 3,
      });

      // Advance time past cooldown by directly updating
      const pair = a.id < b.id
        ? { agentAId: a.id, agentBId: b.id }
        : { agentAId: b.id, agentBId: a.id };
      await prisma.agentRelationship.updateMany({
        where: pair,
        data: { lastInteractionAt: new Date(Date.now() - 60_000) },
      });

      // Reverse order
      const result = await socialGraphService.upsertInteraction({
        agentAId: b.id,
        agentBId: a.id,
        outcome: 'NEUTRAL',
        delta: 2,
      });

      expect(result.relationship.score).toBe(5); // 3 + 2
      expect(result.relationship.interactions).toBe(2);
    });

    it('throws when forming relationship with self', async () => {
      const a = await createTestAgent(prisma);
      await expect(
        socialGraphService.upsertInteraction({
          agentAId: a.id,
          agentBId: a.id,
          outcome: 'NEUTRAL',
          delta: 1,
        }),
      ).rejects.toThrow('Cannot form relationship with self');
    });
  });

  // ── List queries ─────────────────────────────────────────────

  describe('listRelationships', () => {
    it('returns friends and rivals correctly', async () => {
      const a = await createTestAgent(prisma);
      const b = await createTestAgent(prisma);
      const c = await createTestAgent(prisma);

      const pairAB = a.id < b.id
        ? { agentAId: a.id, agentBId: b.id }
        : { agentAId: b.id, agentBId: a.id };
      await prisma.agentRelationship.create({
        data: { ...pairAB, status: 'FRIEND', score: 12, interactions: 3, friendSince: new Date() },
      });

      const pairAC = a.id < c.id
        ? { agentAId: a.id, agentBId: c.id }
        : { agentAId: c.id, agentBId: a.id };
      await prisma.agentRelationship.create({
        data: { ...pairAC, status: 'RIVAL', score: -12, interactions: 3, rivalSince: new Date() },
      });

      const result = await socialGraphService.listRelationships(a.id);
      expect(result.friends).toHaveLength(1);
      expect(result.rivals).toHaveLength(1);
      expect(result.friends[0].agentId).toBe(b.id);
      expect(result.rivals[0].agentId).toBe(c.id);
    });
  });

  describe('listFriends', () => {
    it('returns only friend IDs', async () => {
      const a = await createTestAgent(prisma);
      const b = await createTestAgent(prisma);
      const c = await createTestAgent(prisma);

      const pairAB = a.id < b.id
        ? { agentAId: a.id, agentBId: b.id }
        : { agentAId: b.id, agentBId: a.id };
      await prisma.agentRelationship.create({
        data: { ...pairAB, status: 'FRIEND', score: 15, interactions: 5, friendSince: new Date() },
      });

      const pairAC = a.id < c.id
        ? { agentAId: a.id, agentBId: c.id }
        : { agentAId: c.id, agentBId: a.id };
      await prisma.agentRelationship.create({
        data: { ...pairAC, status: 'NEUTRAL', score: 3, interactions: 1 },
      });

      const friends = await socialGraphService.listFriends(a.id);
      expect(friends).toEqual([b.id]);
    });
  });
});
