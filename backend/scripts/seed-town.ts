/**
 * Seed script for AI Town production deployment.
 * Creates initial town, economy pool, and 3 starter agents.
 * Safe to run multiple times (checks for existing data).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STARTER_AGENTS = [
  {
    name: 'MorphBot',
    archetype: 'CHAMELEON' as const,
    bankroll: 750,
    reserveBalance: 1000,
    riskTolerance: 0.5,
    systemPrompt: '',
  },
  {
    name: 'AlphaShark',
    archetype: 'SHARK' as const,
    bankroll: 500,
    reserveBalance: 500,
    riskTolerance: 0.3,
    systemPrompt: '',
  },
  {
    name: 'Rex the Bold',
    archetype: 'DEGEN' as const,
    bankroll: 200,
    reserveBalance: 200,
    riskTolerance: 0.8,
    systemPrompt: '',
  },
];

const PLOT_ZONES = [
  'CIVIC', 'RESIDENTIAL', 'RESIDENTIAL', 'COMMERCIAL', 'COMMERCIAL',
  'INDUSTRIAL', 'INDUSTRIAL', 'RESIDENTIAL', 'ENTERTAINMENT', 'RESIDENTIAL',
  'COMMERCIAL', 'RESIDENTIAL', 'CIVIC', 'INDUSTRIAL', 'ENTERTAINMENT',
  'RESIDENTIAL', 'RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'RESIDENTIAL',
  'COMMERCIAL', 'RESIDENTIAL', 'ENTERTAINMENT', 'RESIDENTIAL', 'RESIDENTIAL',
];

async function main() {
  // Check if already seeded
  const existingAgents = await prisma.arenaAgent.count();
  if (existingAgents > 0) {
    console.log(`✅ Already seeded (${existingAgents} agents exist). Skipping.`);
    return;
  }

  console.log('🌱 Seeding AI Town...');

  // 1. Create economy pool
  const existingPool = await prisma.economyPool.findFirst();
  if (!existingPool) {
    await prisma.economyPool.create({
      data: {
        arenaBalance: 12000,
        reserveBalance: 12000,
        feeBps: 100,
      },
    });
    console.log('💰 Economy pool created (12K/12K)');
  }

  // 2. Create first town
  const town = await prisma.town.create({
    data: {
      name: 'Arenaville',
      level: 1,
      description: 'The first settlement in AI Town — where it all begins.',
      theme: 'frontier outpost',
      totalPlots: 25,
      status: 'BUILDING',
    },
  });
  console.log(`🏘️  Town "${town.name}" created`);

  // 3. Create plots
  for (let i = 0; i < 25; i++) {
    const col = i % 5;
    const row = Math.floor(i / 5);
    await prisma.plot.create({
      data: {
        townId: town.id,
        plotIndex: i,
        x: col,
        y: row,
        zone: PLOT_ZONES[i] as any,
        status: 'EMPTY',
      },
    });
  }
  console.log('📍 25 plots created');

  // 4. Create starter agents
  for (const agentData of STARTER_AGENTS) {
    const agent = await prisma.arenaAgent.create({
      data: {
        name: agentData.name,
        archetype: agentData.archetype,
        modelId: 'deepseek-v3',
        apiKey: `seed_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        bankroll: agentData.bankroll,
        reserveBalance: agentData.reserveBalance,
        riskTolerance: agentData.riskTolerance,
        maxWagerPercent: 0.15,
        health: 100,
        isActive: true,
        spawnedByUser: false,
        systemPrompt: agentData.systemPrompt,
      },
    });
    console.log(`🤖 Agent "${agent.name}" (${agent.archetype}) created`);
  }

  console.log('✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
