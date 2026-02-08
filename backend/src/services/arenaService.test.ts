/**
 * ArenaService tests — uses mocked smartAiService for AI calls.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { installSmartAiMock } from '../__tests__/mocks/smartAiService.mock';

// Must call before importing arenaService (module-level import of smartAiService)
installSmartAiMock();

import { prisma } from '../config/database';
import { createTestAgent } from '../__tests__/helpers/fixtures';
import { ArenaService } from './arenaService';

let arena: ArenaService;

beforeEach(() => {
  arena = new ArenaService();
});

describe('ArenaService', () => {
  // ── registerAgent ────────────────────────────────────────────

  describe('registerAgent', () => {
    it('creates agent with API key', async () => {
      const agent = await arena.registerAgent({ name: 'TestBot1' });
      expect(agent.apiKey).toMatch(/^arena_/);
      expect(agent.name).toBe('TestBot1');
      expect(agent.elo).toBe(1500);
    });

    it('rejects duplicate names', async () => {
      await arena.registerAgent({ name: 'DupeBot' });
      await expect(arena.registerAgent({ name: 'DupeBot' })).rejects.toThrow('already taken');
    });

    it('applies default archetype CHAMELEON', async () => {
      const agent = await arena.registerAgent({ name: 'DefaultBot' });
      expect(agent.archetype).toBe('CHAMELEON');
    });

    it('applies custom archetype', async () => {
      const agent = await arena.registerAgent({ name: 'SharkAgent', archetype: 'SHARK' });
      expect(agent.archetype).toBe('SHARK');
    });
  });

  // ── createMatch ──────────────────────────────────────────────

  describe('createMatch', () => {
    it('deducts wager, sets isInMatch=true', async () => {
      const agent = await createTestAgent(prisma, { bankroll: 10000 });

      const match = await arena.createMatch({
        agentId: agent.id,
        gameType: 'RPS',
        wagerAmount: 200,
      });

      expect(match.status).toBe('WAITING');
      expect(match.wagerAmount).toBe(200);

      const updated = await prisma.arenaAgent.findUnique({ where: { id: agent.id } });
      expect(updated!.bankroll).toBe(9800);
      expect(updated!.isInMatch).toBe(true);
    });

    it('errors on insufficient bankroll', async () => {
      const agent = await createTestAgent(prisma, { bankroll: 50 });
      await expect(
        arena.createMatch({ agentId: agent.id, gameType: 'RPS', wagerAmount: 200 }),
      ).rejects.toThrow('Insufficient bankroll');
    });

    it('errors if already in match', async () => {
      const agent = await createTestAgent(prisma, { bankroll: 10000 });
      await arena.createMatch({ agentId: agent.id, gameType: 'RPS', wagerAmount: 100 });

      await expect(
        arena.createMatch({ agentId: agent.id, gameType: 'RPS', wagerAmount: 100 }),
      ).rejects.toThrow('already in a match');
    });

    it('minimum wager is 10', async () => {
      const agent = await createTestAgent(prisma, { bankroll: 10000 });
      await expect(
        arena.createMatch({ agentId: agent.id, gameType: 'RPS', wagerAmount: 5 }),
      ).rejects.toThrow('Minimum wager');
    });

    it('with opponentId: both agents deducted, status ACTIVE', async () => {
      const a1 = await createTestAgent(prisma, { bankroll: 10000 });
      const a2 = await createTestAgent(prisma, { bankroll: 10000 });

      const match = await arena.createMatch({
        agentId: a1.id,
        gameType: 'RPS',
        wagerAmount: 200,
        opponentId: a2.id,
      });

      expect(match.status).toBe('ACTIVE');

      const u1 = await prisma.arenaAgent.findUnique({ where: { id: a1.id } });
      const u2 = await prisma.arenaAgent.findUnique({ where: { id: a2.id } });
      expect(u1!.bankroll).toBe(9800);
      expect(u2!.bankroll).toBe(9800);
    });
  });

  // ── Submit RPS move ──────────────────────────────────────────

  describe('submitMove (RPS)', () => {
    it('validates turn and updates game state', async () => {
      const a1 = await createTestAgent(prisma, { bankroll: 10000 });
      const a2 = await createTestAgent(prisma, { bankroll: 10000 });

      const match = await arena.createMatch({
        agentId: a1.id,
        gameType: 'RPS',
        wagerAmount: 200,
        opponentId: a2.id,
      });

      // Get current state to find whose turn it is
      const state = await arena.getMatchState(match.id);
      const firstTurn = state.currentTurnId;
      const result1 = await arena.submitMove({
        matchId: match.id,
        agentId: firstTurn!,
        action: 'rock',
      });
      expect(result1.isComplete).toBe(false);

      // Wrong turn
      await expect(
        arena.submitMove({ matchId: match.id, agentId: firstTurn!, action: 'paper' }),
      ).rejects.toThrow('Not your turn');
    });
  });

  // ── Match completion ─────────────────────────────────────────

  describe('match resolution', () => {
    it('winner gets pot - rake, loser loses wager, ELO updated', async () => {
      const a1 = await createTestAgent(prisma, { bankroll: 10000 });
      const a2 = await createTestAgent(prisma, { bankroll: 10000 });

      const match = await arena.createMatch({
        agentId: a1.id,
        gameType: 'RPS',
        wagerAmount: 200,
        opponentId: a2.id,
      });

      // Play until completion (best of 5, first to 3)
      let complete = false;
      const moves = ['rock', 'scissors']; // p1 always wins
      let turn = 0;
      while (!complete) {
        const state = await arena.getMatchState(match.id);
        if (state.status === 'COMPLETED') break;
        const currentId = state.currentTurnId!;
        const isP1 = currentId === a1.id;
        const moveIdx = isP1 ? 0 : 1;
        const result = await arena.submitMove({
          matchId: match.id,
          agentId: currentId,
          action: moves[moveIdx],
        });
        complete = result.isComplete;
        turn++;
        if (turn > 30) throw new Error('Too many turns');
      }

      const finalState = await arena.getMatchState(match.id);
      expect(finalState.status).toBe('COMPLETED');
      expect(finalState.winnerId).toBe(a1.id);

      // Wager: 200 each, pot: 400, rake: 20 (5%), payout: 380
      const w = await prisma.arenaAgent.findUnique({ where: { id: a1.id } });
      const l = await prisma.arenaAgent.findUnique({ where: { id: a2.id } });

      // Winner: 10000 - 200 (wager) + 380 (payout) = 10180
      expect(w!.bankroll).toBe(10180);
      // Loser: 10000 - 200 (wager) = 9800
      expect(l!.bankroll).toBe(9800);

      // ELO changed
      expect(w!.elo).toBeGreaterThan(1500);
      expect(l!.elo).toBeLessThan(1500);

      // Win/loss records
      expect(w!.wins).toBe(1);
      expect(l!.losses).toBe(1);
    });
  });

  // ── Match cancellation ───────────────────────────────────────

  describe('cancelMatch', () => {
    it('refunds wagers and frees agents', async () => {
      const a1 = await createTestAgent(prisma, { bankroll: 10000 });
      const a2 = await createTestAgent(prisma, { bankroll: 10000 });

      const match = await arena.createMatch({
        agentId: a1.id,
        gameType: 'RPS',
        wagerAmount: 300,
        opponentId: a2.id,
      });

      await arena.cancelMatch(match.id, a1.id);

      const u1 = await prisma.arenaAgent.findUnique({ where: { id: a1.id } });
      const u2 = await prisma.arenaAgent.findUnique({ where: { id: a2.id } });
      expect(u1!.bankroll).toBe(10000);
      expect(u2!.bankroll).toBe(10000);
      expect(u1!.isInMatch).toBe(false);
      expect(u2!.isInMatch).toBe(false);
    });
  });

  // ── OpponentRecords ──────────────────────────────────────────

  describe('opponent records', () => {
    it('updated after match completion', async () => {
      const a1 = await createTestAgent(prisma, { bankroll: 10000 });
      const a2 = await createTestAgent(prisma, { bankroll: 10000 });

      const match = await arena.createMatch({
        agentId: a1.id,
        gameType: 'RPS',
        wagerAmount: 100,
        opponentId: a2.id,
      });

      // Play to completion
      let complete = false;
      let turn = 0;
      while (!complete) {
        const state = await arena.getMatchState(match.id);
        if (state.status === 'COMPLETED') break;
        const result = await arena.submitMove({
          matchId: match.id,
          agentId: state.currentTurnId!,
          action: state.currentTurnId === a1.id ? 'rock' : 'scissors',
        });
        complete = result.isComplete;
        turn++;
        if (turn > 30) break;
      }

      const record = await prisma.opponentRecord.findUnique({
        where: { agentId_opponentId: { agentId: a1.id, opponentId: a2.id } },
      });
      expect(record).not.toBeNull();
      expect(record!.matchesPlayed).toBe(1);
    });
  });
});
