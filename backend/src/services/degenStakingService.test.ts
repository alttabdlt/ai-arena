import { describe, it, expect } from 'vitest';
import { prisma } from '../config/database';
import { createTestAgent, createTestUser } from '../__tests__/helpers/fixtures';
import { degenStakingService } from './degenStakingService';

describe('degenStakingService', () => {
  // ── getOrCreateUserBalance ───────────────────────────────────

  describe('getOrCreateUserBalance', () => {
    it('creates user with 10K on first call', async () => {
      const user = await degenStakingService.getOrCreateUserBalance('0xABC');
      expect(user.balance).toBe(10000);
      expect(user.walletAddress).toBe('0xABC');
    });

    it('is idempotent — second call returns existing', async () => {
      const first = await degenStakingService.getOrCreateUserBalance('0xABC');
      const second = await degenStakingService.getOrCreateUserBalance('0xABC');
      expect(first.id).toBe(second.id);
    });
  });

  // ── backAgent ────────────────────────────────────────────────

  describe('backAgent', () => {
    it('debits user balance and creates AgentStake', async () => {
      await createTestUser(prisma, '0xSTAKER', 10000);
      const agent = await createTestAgent(prisma);

      const stake = await degenStakingService.backAgent('0xSTAKER', agent.id, 3000);
      expect(stake.amount).toBe(3000);
      expect(stake.isActive).toBe(true);

      const updated = await prisma.userBalance.findUnique({ where: { walletAddress: '0xSTAKER' } });
      expect(updated!.balance).toBe(7000);
      expect(updated!.totalStaked).toBe(3000);
    });

    it('errors on insufficient balance', async () => {
      await createTestUser(prisma, '0xPOOR', 100);
      const agent = await createTestAgent(prisma);

      await expect(degenStakingService.backAgent('0xPOOR', agent.id, 500)).rejects.toThrow(
        'Insufficient balance',
      );
    });

    it('errors on bad agent', async () => {
      await createTestUser(prisma, '0xUSER', 10000);
      await expect(degenStakingService.backAgent('0xUSER', 'nonexistent', 100)).rejects.toThrow(
        'Agent not found',
      );
    });

    it('errors on non-positive amount', async () => {
      await createTestUser(prisma, '0xUSER', 10000);
      const agent = await createTestAgent(prisma);
      await expect(degenStakingService.backAgent('0xUSER', agent.id, 0)).rejects.toThrow(
        'Amount must be positive',
      );
    });
  });

  // ── unbackAgent ──────────────────────────────────────────────

  describe('unbackAgent', () => {
    it('returns principal + yield, deactivates stake', async () => {
      await createTestUser(prisma, '0xW', 10000);
      const agent = await createTestAgent(prisma);
      const stake = await degenStakingService.backAgent('0xW', agent.id, 5000);

      // Simulate yield earned
      await prisma.agentStake.update({
        where: { id: stake.id },
        data: { totalYieldEarned: 200 },
      });

      const result = await degenStakingService.unbackAgent('0xW', stake.id);
      expect(result.principal).toBe(5000);
      expect(result.yieldEarned).toBe(200);
      expect(result.refund).toBe(5200);

      const user = await prisma.userBalance.findUnique({ where: { walletAddress: '0xW' } });
      expect(user!.balance).toBe(10000 - 5000 + 5200); // 10200
    });

    it('errors on already inactive stake', async () => {
      await createTestUser(prisma, '0xW', 10000);
      const agent = await createTestAgent(prisma);
      const stake = await degenStakingService.backAgent('0xW', agent.id, 1000);
      await degenStakingService.unbackAgent('0xW', stake.id);

      await expect(degenStakingService.unbackAgent('0xW', stake.id)).rejects.toThrow(
        'Stake is already inactive',
      );
    });
  });

  // ── distributeYieldToBackers ─────────────────────────────────

  describe('distributeYieldToBackers', () => {
    it('splits proportionally (1K + 3K staked, 100 yield → 25 + 75)', async () => {
      const agent = await createTestAgent(prisma);
      await createTestUser(prisma, '0xA', 10000);
      await createTestUser(prisma, '0xB', 10000);

      const s1 = await degenStakingService.backAgent('0xA', agent.id, 1000);
      const s2 = await degenStakingService.backAgent('0xB', agent.id, 3000);

      await degenStakingService.distributeYieldToBackers(agent.id, 100);

      const updated1 = await prisma.agentStake.findUnique({ where: { id: s1.id } });
      const updated2 = await prisma.agentStake.findUnique({ where: { id: s2.id } });

      expect(updated1!.totalYieldEarned).toBe(25); // floor(1000/4000 * 100)
      expect(updated2!.totalYieldEarned).toBe(75); // floor(3000/4000 * 100)
    });

    it('no-op when no active stakes', async () => {
      const agent = await createTestAgent(prisma);
      // Should not throw
      await degenStakingService.distributeYieldToBackers(agent.id, 100);
    });
  });

  // ── getPositions ─────────────────────────────────────────────

  describe('getPositions', () => {
    it('returns active stakes with agent info', async () => {
      await createTestUser(prisma, '0xP', 20000);
      const agent = await createTestAgent(prisma, { name: 'StakeTarget' });
      await degenStakingService.backAgent('0xP', agent.id, 2000);

      const positions = await degenStakingService.getPositions('0xP');
      expect(positions).toHaveLength(1);
      expect(positions[0].agentName).toBe('StakeTarget');
      expect(positions[0].amount).toBe(2000);
    });
  });

  // ── getLeaderboard ───────────────────────────────────────────

  describe('getLeaderboard', () => {
    it('ranks by yield earned', async () => {
      const agent = await createTestAgent(prisma);
      await createTestUser(prisma, '0xHigh', 20000);
      await createTestUser(prisma, '0xLow', 20000);

      const s1 = await degenStakingService.backAgent('0xHigh', agent.id, 5000);
      const s2 = await degenStakingService.backAgent('0xLow', agent.id, 1000);

      // Simulate different yields
      await prisma.agentStake.update({ where: { id: s1.id }, data: { totalYieldEarned: 500 } });
      await prisma.agentStake.update({ where: { id: s2.id }, data: { totalYieldEarned: 50 } });

      const lb = await degenStakingService.getLeaderboard();
      expect(lb[0].walletAddress).toBe('0xHigh');
      expect(lb[0].totalPnL).toBe(500);
      expect(lb[1].walletAddress).toBe('0xLow');
    });
  });
});
