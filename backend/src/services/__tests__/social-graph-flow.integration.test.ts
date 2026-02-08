/**
 * Integration: Agents form friendship through bonding interactions.
 */

import { describe, it, expect } from 'vitest';
import { prisma } from '../../config/database';
import { createTestAgent } from '../../__tests__/helpers/fixtures';
import { socialGraphService } from '../socialGraphService';

describe('Social Graph Flow Integration', () => {
  it('agents form friendship through bonding, then break it through beef', async () => {
    const agentA = await createTestAgent(prisma, { name: 'BondA' });
    const agentB = await createTestAgent(prisma, { name: 'BondB' });

    // 1. Interaction 1: BOND +5 → score=5, still NEUTRAL
    const r1 = await socialGraphService.upsertInteraction({
      agentAId: agentA.id,
      agentBId: agentB.id,
      outcome: 'BOND',
      delta: 5,
    });
    expect(r1.relationship.score).toBe(5);
    expect(r1.relationship.status).toBe('NEUTRAL');

    // 2. Advance time past 45s cooldown
    const pair = agentA.id < agentB.id
      ? { agentAId: agentA.id, agentBId: agentB.id }
      : { agentAId: agentB.id, agentBId: agentA.id };
    await prisma.agentRelationship.updateMany({
      where: pair,
      data: { lastInteractionAt: new Date(Date.now() - 60_000) },
    });

    // 3. Interaction 2: BOND +5 → score=10, → FRIEND
    const r2 = await socialGraphService.upsertInteraction({
      agentAId: agentA.id,
      agentBId: agentB.id,
      outcome: 'BOND',
      delta: 5,
    });
    expect(r2.relationship.score).toBe(10);
    expect(r2.relationship.status).toBe('FRIEND');
    expect(r2.statusChanged).toEqual({ from: 'NEUTRAL', to: 'FRIEND' });

    // 4. Verify friendship
    const friends = await socialGraphService.listFriends(agentA.id);
    expect(friends).toContain(agentB.id);

    // 5. Advance cooldown again
    await prisma.agentRelationship.updateMany({
      where: pair,
      data: { lastInteractionAt: new Date(Date.now() - 60_000) },
    });

    // 6. Interaction 3: BEEF -7 → score=3 (<4) → NEUTRAL
    const r3 = await socialGraphService.upsertInteraction({
      agentAId: agentA.id,
      agentBId: agentB.id,
      outcome: 'BEEF',
      delta: -7,
    });
    expect(r3.relationship.score).toBe(3);
    expect(r3.relationship.status).toBe('NEUTRAL');
    expect(r3.statusChanged).toEqual({ from: 'FRIEND', to: 'NEUTRAL' });

    // 7. Verify friendship broken
    const friendsAfter = await socialGraphService.listFriends(agentA.id);
    expect(friendsAfter).not.toContain(agentB.id);
    expect(friendsAfter).toHaveLength(0);
  });
});
