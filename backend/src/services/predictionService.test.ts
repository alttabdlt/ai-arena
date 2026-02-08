import { describe, it, expect } from 'vitest';
import { prisma } from '../config/database';
import { createTestAgent, createTestUser } from '../__tests__/helpers/fixtures';
import { predictionService } from './predictionService';

describe('predictionService', () => {
  // ── createMarket ─────────────────────────────────────────────

  describe('createMarket', () => {
    it('creates with correct question and agent IDs', async () => {
      const p1 = await createTestAgent(prisma, { name: 'SharkBot' });
      const p2 = await createTestAgent(prisma, { name: 'RockBot' });

      const market = await predictionService.createMarket('match-1', p1.id, p2.id);
      expect(market.matchId).toBe('match-1');
      expect(market.question).toContain('SharkBot');
      expect(market.question).toContain('RockBot');
      expect(market.optionAAgentId).toBe(p1.id);
      expect(market.optionBAgentId).toBe(p2.id);
      expect(market.status).toBe('OPEN');
    });

    it('is idempotent — second call returns existing', async () => {
      const p1 = await createTestAgent(prisma);
      const p2 = await createTestAgent(prisma);

      const first = await predictionService.createMarket('match-2', p1.id, p2.id);
      const second = await predictionService.createMarket('match-2', p1.id, p2.id);
      expect(first.id).toBe(second.id);
    });
  });

  // ── placeBet ─────────────────────────────────────────────────

  describe('placeBet', () => {
    it('debits user and increments pool', async () => {
      const p1 = await createTestAgent(prisma);
      const p2 = await createTestAgent(prisma);
      const market = await predictionService.createMarket('m1', p1.id, p2.id);
      await createTestUser(prisma, '0xBETTOR', 10000);

      const bet = await predictionService.placeBet('0xBETTOR', market.id, 'A', 500);
      expect(bet.side).toBe('A');
      expect(bet.amount).toBe(500);

      const user = await prisma.userBalance.findUnique({ where: { walletAddress: '0xBETTOR' } });
      expect(user!.balance).toBe(9500);

      const updated = await prisma.predictionMarket.findUnique({ where: { id: market.id } });
      expect(updated!.poolA).toBe(500);
    });

    it('errors when market not OPEN', async () => {
      const p1 = await createTestAgent(prisma);
      const p2 = await createTestAgent(prisma);
      const market = await predictionService.createMarket('m2', p1.id, p2.id);
      await prisma.predictionMarket.update({ where: { id: market.id }, data: { status: 'RESOLVED' } });
      await createTestUser(prisma, '0xU', 10000);

      await expect(predictionService.placeBet('0xU', market.id, 'A', 100)).rejects.toThrow(
        'Market is not open',
      );
    });

    it('errors on insufficient balance', async () => {
      const p1 = await createTestAgent(prisma);
      const p2 = await createTestAgent(prisma);
      const market = await predictionService.createMarket('m3', p1.id, p2.id);
      await createTestUser(prisma, '0xPOOR', 50);

      await expect(predictionService.placeBet('0xPOOR', market.id, 'B', 100)).rejects.toThrow(
        'Insufficient balance',
      );
    });

    it('errors on non-positive amount', async () => {
      await expect(predictionService.placeBet('0x', 'x', 'A', 0)).rejects.toThrow(
        'Amount must be positive',
      );
    });
  });

  // ── resolve ──────────────────────────────────────────────────

  describe('resolve', () => {
    it('winning bettors get proportional payout minus 5% rake', async () => {
      const p1 = await createTestAgent(prisma);
      const p2 = await createTestAgent(prisma);
      const market = await predictionService.createMarket('m4', p1.id, p2.id);

      await createTestUser(prisma, '0xWIN1', 10000);
      await createTestUser(prisma, '0xWIN2', 10000);
      await createTestUser(prisma, '0xLOSE', 10000);

      await predictionService.placeBet('0xWIN1', market.id, 'A', 1000);
      await predictionService.placeBet('0xWIN2', market.id, 'A', 3000);
      await predictionService.placeBet('0xLOSE', market.id, 'B', 6000);

      // Total pool = 10000, winning pool (A) = 4000, losing = 6000
      // Rake = 500 (5% of 10000), payout pool = 9500
      await predictionService.resolve('m4', p1.id);

      const updatedMarket = await prisma.predictionMarket.findUnique({ where: { id: market.id } });
      expect(updatedMarket!.status).toBe('RESOLVED');
      expect(updatedMarket!.outcome).toBe('A');

      // WIN1 gets floor(1000/4000 * 9500) = 2375
      const bet1 = await prisma.predictionBet.findFirst({ where: { walletAddress: '0xWIN1' } });
      expect(bet1!.payout).toBe(2375);

      // WIN2 gets floor(3000/4000 * 9500) = 7125
      const bet2 = await prisma.predictionBet.findFirst({ where: { walletAddress: '0xWIN2' } });
      expect(bet2!.payout).toBe(7125);

      // LOSE gets 0
      const betLose = await prisma.predictionBet.findFirst({ where: { walletAddress: '0xLOSE' } });
      expect(betLose!.payout).toBe(0);
    });

    it('draw: all bets refunded via cancelMarket', async () => {
      const p1 = await createTestAgent(prisma);
      const p2 = await createTestAgent(prisma);
      const market = await predictionService.createMarket('m5', p1.id, p2.id);

      await createTestUser(prisma, '0xD1', 10000);
      await predictionService.placeBet('0xD1', market.id, 'A', 500);

      // Resolve with no winner (draw)
      await predictionService.resolve('m5', null);

      const user = await prisma.userBalance.findUnique({ where: { walletAddress: '0xD1' } });
      expect(user!.balance).toBe(10000); // refunded

      const updatedMarket = await prisma.predictionMarket.findUnique({ where: { id: market.id } });
      expect(updatedMarket!.status).toBe('CANCELLED');
    });
  });

  // ── cancelMarket ─────────────────────────────────────────────

  describe('cancelMarket', () => {
    it('refunds all bets', async () => {
      const p1 = await createTestAgent(prisma);
      const p2 = await createTestAgent(prisma);
      const market = await predictionService.createMarket('m6', p1.id, p2.id);

      await createTestUser(prisma, '0xC1', 10000);
      await createTestUser(prisma, '0xC2', 10000);
      await predictionService.placeBet('0xC1', market.id, 'A', 300);
      await predictionService.placeBet('0xC2', market.id, 'B', 700);

      await predictionService.cancelMarket(market.id);

      const u1 = await prisma.userBalance.findUnique({ where: { walletAddress: '0xC1' } });
      const u2 = await prisma.userBalance.findUnique({ where: { walletAddress: '0xC2' } });
      expect(u1!.balance).toBe(10000);
      expect(u2!.balance).toBe(10000);
    });
  });

  // ── getActiveMarkets ─────────────────────────────────────────

  describe('getActiveMarkets', () => {
    it('returns only OPEN markets', async () => {
      const p1 = await createTestAgent(prisma);
      const p2 = await createTestAgent(prisma);

      await predictionService.createMarket('open1', p1.id, p2.id);
      const m2 = await predictionService.createMarket('open2', p1.id, p2.id);
      // Resolve second one
      await prisma.predictionMarket.update({ where: { id: m2.id }, data: { status: 'RESOLVED' } });

      const active = await predictionService.getActiveMarkets();
      expect(active).toHaveLength(1);
      expect(active[0].matchId).toBe('open1');
    });
  });
});
