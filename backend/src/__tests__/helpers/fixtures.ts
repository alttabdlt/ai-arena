/**
 * Test fixture factories — create DB entities with sensible defaults.
 */

import { PrismaClient, AgentArchetype } from '@prisma/client';

let agentCounter = 0;

export async function createTestAgent(
  prisma: PrismaClient,
  overrides: Partial<{
    name: string;
    archetype: AgentArchetype;
    bankroll: number;
    reserveBalance: number;
    elo: number;
    modelId: string;
  }> = {},
) {
  agentCounter++;
  const name = overrides.name ?? `TestAgent_${agentCounter}_${Date.now()}`;
  return prisma.arenaAgent.create({
    data: {
      name,
      archetype: overrides.archetype ?? 'CHAMELEON',
      modelId: overrides.modelId ?? 'mock-model',
      apiKey: `test_${name}_${Math.random().toString(36).slice(2)}`,
      bankroll: overrides.bankroll ?? 10000,
      reserveBalance: overrides.reserveBalance ?? 10000,
      elo: overrides.elo ?? 1500,
    },
  });
}

export async function createTestTown(
  prisma: PrismaClient,
  overrides: Partial<{
    name: string;
    totalPlots: number;
    level: number;
    theme: string;
  }> = {},
) {
  const name = overrides.name ?? `TestTown_${Date.now()}`;
  const totalPlots = overrides.totalPlots ?? 4;
  const level = overrides.level ?? 1;

  const town = await prisma.town.create({
    data: {
      name,
      level,
      theme: overrides.theme ?? 'test theme',
      totalPlots,
      yieldPerTick: 10,
    },
  });

  const zones = ['RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'ENTERTAINMENT'] as const;
  const plotData = Array.from({ length: totalPlots }, (_, i) => ({
    townId: town.id,
    plotIndex: i,
    x: i % 2,
    y: Math.floor(i / 2),
    zone: zones[i % zones.length],
  }));
  await prisma.plot.createMany({ data: plotData });

  return prisma.town.findUniqueOrThrow({
    where: { id: town.id },
    include: { plots: { orderBy: { plotIndex: 'asc' } } },
  });
}

export async function createTestUser(
  prisma: PrismaClient,
  wallet?: string,
  balance?: number,
) {
  const walletAddress = wallet ?? `0x${Math.random().toString(16).slice(2, 42)}`;
  return prisma.userBalance.create({
    data: {
      walletAddress,
      balance: balance ?? 10000,
    },
  });
}

export async function seedPool(
  prisma: PrismaClient,
  reserves?: { reserveBalance?: number; arenaBalance?: number; feeBps?: number },
) {
  return prisma.economyPool.create({
    data: {
      reserveBalance: reserves?.reserveBalance ?? 1_000_000,
      arenaBalance: reserves?.arenaBalance ?? 1_000_000,
      feeBps: reserves?.feeBps ?? 100,
    },
  });
}
