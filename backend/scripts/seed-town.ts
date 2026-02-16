/**
 * Seed script for AI Arena production deployment.
 * Creates initial town, economy pool, and 3 house agents (from env vars).
 * Safe to run multiple times (checks for existing data).
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { privateKeyToAccount } from 'viem/accounts';

const prisma = new PrismaClient();

const HOUSE_AGENTS = [
  { envKey: 'HOUSE_AGENT_1_KEY', name: 'Arena Guardian', archetype: 'ROCK' as const },
  { envKey: 'HOUSE_AGENT_2_KEY', name: 'Arena Dealer', archetype: 'CHAMELEON' as const },
  { envKey: 'HOUSE_AGENT_3_KEY', name: 'Arena Wildcard', archetype: 'DEGEN' as const },
];

const PLOT_ZONES = [
  'CIVIC', 'RESIDENTIAL', 'RESIDENTIAL', 'COMMERCIAL', 'COMMERCIAL',
  'INDUSTRIAL', 'INDUSTRIAL', 'RESIDENTIAL', 'ENTERTAINMENT', 'RESIDENTIAL',
  'COMMERCIAL', 'RESIDENTIAL', 'CIVIC', 'INDUSTRIAL', 'ENTERTAINMENT',
  'RESIDENTIAL', 'RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'RESIDENTIAL',
  'COMMERCIAL', 'RESIDENTIAL', 'ENTERTAINMENT', 'RESIDENTIAL', 'RESIDENTIAL',
];

async function main() {
  console.log('🌱 Seeding AI Arena...');

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
  } else {
    console.log('💰 Economy pool already exists. Skipping.');
  }

  // 2. Create first town (if none exists)
  const existingTown = await prisma.town.findFirst();
  if (!existingTown) {
    const town = await prisma.town.create({
      data: {
        name: 'Arenaville',
        level: 1,
        description: 'The first settlement in AI Arena — where it all begins.',
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
  } else {
    console.log(`🏘️  Town "${existingTown.name}" already exists. Skipping.`);
  }

  // 4. Create house agents from env vars
  for (const ha of HOUSE_AGENTS) {
    const privateKey = process.env[ha.envKey];
    if (!privateKey) {
      console.log(`⚠️  ${ha.envKey} not set — skipping ${ha.name}`);
      continue;
    }

    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const walletAddress = account.address.toLowerCase();

    // Idempotent: skip if wallet already exists
    const existing = await prisma.arenaAgent.findFirst({
      where: { walletAddress },
    });
    if (existing) {
      console.log(`🤖 ${ha.name} already exists (wallet ${walletAddress.slice(0, 10)}...). Skipping.`);
      continue;
    }

    const agent = await prisma.arenaAgent.create({
      data: {
        name: ha.name,
        archetype: ha.archetype,
        modelId: 'or-gemini-2.0-flash',
        apiKey: `house_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        bankroll: 1000,
        reserveBalance: 1000,
        riskTolerance: ha.archetype === 'DEGEN' ? 0.8 : ha.archetype === 'ROCK' ? 0.2 : 0.5,
        maxWagerPercent: 0.15,
        health: 100,
        isActive: true,
        spawnedByUser: false,
        walletAddress,
        systemPrompt: '',
      },
    });
    console.log(`🤖 House agent "${agent.name}" (${agent.archetype}) created — wallet ${walletAddress.slice(0, 10)}...`);
  }

  console.log('✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
