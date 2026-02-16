/**
 * Retire old mock agents that have no wallet address.
 *
 * Sets isActive = false and health = 0 for all agents where:
 *   - spawnedByUser = false
 *   - walletAddress IS NULL
 *
 * Safe to run on existing databases with old seeded agents.
 *
 * Usage:
 *   cd backend && npx tsx scripts/retire-mock-agents.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.arenaAgent.updateMany({
    where: {
      spawnedByUser: false,
      walletAddress: null,
    },
    data: {
      isActive: false,
      health: 0,
    },
  });

  console.log(`🪦 Retired ${result.count} mock agent(s) (no wallet, not user-spawned).`);
}

main()
  .catch((e) => {
    console.error('❌ Retire failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
