/**
 * Integration: Two agents play RPS with full settlement.
 */

import { describe, it, expect } from 'vitest';
import { installSmartAiMock } from '../../__tests__/mocks/smartAiService.mock';
installSmartAiMock();

import { prisma } from '../../config/database';
import { createTestAgent } from '../../__tests__/helpers/fixtures';
import { ArenaService } from '../arenaService';

describe('Arena Match Flow Integration', () => {
  it('two agents play RPS with full settlement', async () => {
    const arena = new ArenaService();

    // 1. Create 2 agents (10K bankroll each)
    const agent1 = await createTestAgent(prisma, { name: 'Fighter1', bankroll: 10000 });
    const agent2 = await createTestAgent(prisma, { name: 'Fighter2', bankroll: 10000 });

    // 2. Agent1 creates RPS match (wager 200)
    const match = await arena.createMatch({
      agentId: agent1.id,
      gameType: 'RPS',
      wagerAmount: 200,
    });
    expect(match.status).toBe('WAITING');

    // 3. Agent2 joins → status ACTIVE
    const joined = await arena.joinMatch(match.id, agent2.id);
    expect(joined.status).toBe('ACTIVE');

    // 4. Play turns until completion — agent1 always picks rock, agent2 always picks scissors
    let complete = false;
    let turn = 0;
    while (!complete && turn < 30) {
      const state = await arena.getMatchState(match.id);
      if (state.status === 'COMPLETED') break;
      const currentId = state.currentTurnId!;
      const action = currentId === agent1.id ? 'rock' : 'scissors';
      const result = await arena.submitMove({ matchId: match.id, agentId: currentId, action });
      complete = result.isComplete;
      turn++;
    }

    // 5. Assert winner bankroll = 10K - 200 + (400 - 20) = 10180
    const winner = await prisma.arenaAgent.findUnique({ where: { id: agent1.id } });
    expect(winner!.bankroll).toBe(10180);

    // 6. Assert loser bankroll = 10K - 200 = 9800
    const loser = await prisma.arenaAgent.findUnique({ where: { id: agent2.id } });
    expect(loser!.bankroll).toBe(9800);

    // 7. Assert ELO changes
    expect(winner!.elo).toBeGreaterThan(1500);
    expect(loser!.elo).toBeLessThan(1500);

    // 8. Assert OpponentRecords updated
    const record = await prisma.opponentRecord.findUnique({
      where: { agentId_opponentId: { agentId: agent1.id, opponentId: agent2.id } },
    });
    expect(record).not.toBeNull();
    expect(record!.matchesPlayed).toBe(1);
    expect(record!.wins).toBe(1);

    const reverseRecord = await prisma.opponentRecord.findUnique({
      where: { agentId_opponentId: { agentId: agent2.id, opponentId: agent1.id } },
    });
    expect(reverseRecord!.losses).toBe(1);
  });
});
