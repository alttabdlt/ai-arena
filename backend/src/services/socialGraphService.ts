/**
 * socialGraphService — relationships between ArenaAgents in AI Town.
 *
 * Goals:
 * - Friends should be rare, not the default equilibrium.
 * - Relationships should be symmetric and stable (single row per pair).
 * - Used later for "friends aid each other" combat interactions.
 */

import { RelationshipStatus } from '@prisma/client';
import { prisma } from '../config/database';
import type { ConversationOutcome } from './agentConversationService';

// Calibrated for demos: friends/rivals should happen sometimes, but not for every pair.
const FRIEND_THRESHOLD = 10;
const RIVAL_THRESHOLD = -10;
const FRIEND_BREAK_THRESHOLD = 4;
const RIVAL_BREAK_THRESHOLD = -4;
const MAX_FRIENDS_PER_AGENT = 2;

// Pair cooldown: prevents spam chats between the same two agents.
const MIN_SECONDS_BETWEEN_PAIR_CHATS = 45;

function normalizePair(a: string, b: string): { a: string; b: string } {
  return a < b ? { a, b } : { a: b, b: a };
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export const socialGraphService = {
  async upsertInteraction(opts: {
    agentAId: string;
    agentBId: string;
    outcome: ConversationOutcome;
    delta: number;
  }): Promise<{
    relationship: {
      id: string;
      agentAId: string;
      agentBId: string;
      status: RelationshipStatus;
      score: number;
      interactions: number;
      friendSince: Date | null;
      rivalSince: Date | null;
      lastInteractionAt: Date | null;
    };
    statusChanged: null | { from: RelationshipStatus; to: RelationshipStatus };
    friendCapHit: boolean;
  }> {
    if (opts.agentAId === opts.agentBId) throw new Error('Cannot form relationship with self');

    const pair = normalizePair(opts.agentAId, opts.agentBId);
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      const countFriendsTx = (agentId: string) =>
        tx.agentRelationship.count({
          where: {
            status: 'FRIEND',
            OR: [{ agentAId: agentId }, { agentBId: agentId }],
          },
        });

      const existing = await tx.agentRelationship.findUnique({
        where: { agentAId_agentBId: { agentAId: pair.a, agentBId: pair.b } },
      });

      if (existing?.lastInteractionAt) {
        const ms = now.getTime() - existing.lastInteractionAt.getTime();
        if (ms < MIN_SECONDS_BETWEEN_PAIR_CHATS * 1000) {
          throw new Error('Pair chat cooldown');
        }
      }

      const delta = clampInt(opts.delta, -7, 7);
      const nextScoreRaw = (existing?.score ?? 0) + delta;
      const nextScore = clampInt(nextScoreRaw, -30, 30);
      const nextInteractions = (existing?.interactions ?? 0) + 1;

      const prevStatus: RelationshipStatus = existing?.status ?? 'NEUTRAL';
      let nextStatus: RelationshipStatus = prevStatus;
      let friendSince = existing?.friendSince ?? null;
      let rivalSince = existing?.rivalSince ?? null;
      let friendCapHit = false;

      // Promote/demote only on "special" outcomes so friendships stay rare.
      if (prevStatus === 'NEUTRAL') {
        if (opts.outcome === 'BOND' && nextScore >= FRIEND_THRESHOLD) {
          const [aFriends, bFriends] = await Promise.all([countFriendsTx(pair.a), countFriendsTx(pair.b)]);
          if (aFriends < MAX_FRIENDS_PER_AGENT && bFriends < MAX_FRIENDS_PER_AGENT) {
            nextStatus = 'FRIEND';
            friendSince = now;
            rivalSince = null;
          } else {
            friendCapHit = true;
          }
        } else if (opts.outcome === 'BEEF' && nextScore <= RIVAL_THRESHOLD) {
          nextStatus = 'RIVAL';
          rivalSince = now;
          friendSince = null;
        }
      } else if (prevStatus === 'FRIEND') {
        // Friendships can break if relationship deteriorates.
        if (opts.outcome === 'BEEF' && nextScore < FRIEND_BREAK_THRESHOLD) {
          nextStatus = 'NEUTRAL';
          friendSince = null;
        }
      } else if (prevStatus === 'RIVAL') {
        // Rivalries can cool off.
        if (opts.outcome === 'BOND' && nextScore > RIVAL_BREAK_THRESHOLD) {
          nextStatus = 'NEUTRAL';
          rivalSince = null;
        }
      }

      const rel = existing
        ? await tx.agentRelationship.update({
            where: { id: existing.id },
            data: {
              score: nextScore,
              interactions: nextInteractions,
              status: nextStatus,
              friendSince,
              rivalSince,
              lastInteractionAt: now,
            },
          })
        : await tx.agentRelationship.create({
            data: {
              agentAId: pair.a,
              agentBId: pair.b,
              score: nextScore,
              interactions: nextInteractions,
              status: nextStatus,
              friendSince: nextStatus === 'FRIEND' ? now : null,
              rivalSince: nextStatus === 'RIVAL' ? now : null,
              lastInteractionAt: now,
            },
          });

      const statusChanged = prevStatus !== rel.status ? { from: prevStatus, to: rel.status } : null;
      return {
        relationship: {
          id: rel.id,
          agentAId: rel.agentAId,
          agentBId: rel.agentBId,
          status: rel.status,
          score: rel.score,
          interactions: rel.interactions,
          friendSince: rel.friendSince,
          rivalSince: rel.rivalSince,
          lastInteractionAt: rel.lastInteractionAt,
        },
        statusChanged,
        friendCapHit,
      };
    });
  },

  async listRelationships(agentId: string): Promise<{
    maxFriends: number;
    friends: Array<{ agentId: string; name: string; archetype: string; score: number; since: string | null }>;
    rivals: Array<{ agentId: string; name: string; archetype: string; score: number; since: string | null }>;
  }> {
    const rels = await prisma.agentRelationship.findMany({
      where: { OR: [{ agentAId: agentId }, { agentBId: agentId }] },
      include: {
        agentA: { select: { id: true, name: true, archetype: true } },
        agentB: { select: { id: true, name: true, archetype: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    const friends: Array<{ agentId: string; name: string; archetype: string; score: number; since: string | null }> = [];
    const rivals: Array<{ agentId: string; name: string; archetype: string; score: number; since: string | null }> = [];

    for (const r of rels) {
      const other = r.agentAId === agentId ? r.agentB : r.agentA;
      if (!other) continue;
      if (r.status === 'FRIEND') {
        friends.push({ agentId: other.id, name: other.name, archetype: other.archetype, score: r.score, since: r.friendSince?.toISOString() ?? null });
      } else if (r.status === 'RIVAL') {
        rivals.push({ agentId: other.id, name: other.name, archetype: other.archetype, score: r.score, since: r.rivalSince?.toISOString() ?? null });
      }
    }

    // Sort friends highest score first; rivals lowest score first.
    friends.sort((a, b) => b.score - a.score);
    rivals.sort((a, b) => a.score - b.score);

    return { maxFriends: MAX_FRIENDS_PER_AGENT, friends: friends.slice(0, 10), rivals: rivals.slice(0, 10) };
  },

  async listFriends(agentId: string): Promise<string[]> {
    const rels = await prisma.agentRelationship.findMany({
      where: {
        status: 'FRIEND',
        OR: [{ agentAId: agentId }, { agentBId: agentId }],
      },
      select: { agentAId: true, agentBId: true },
    });
    return rels.map((r) => (r.agentAId === agentId ? r.agentBId : r.agentAId));
  },
};
