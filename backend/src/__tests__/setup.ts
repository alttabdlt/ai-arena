/// <reference types="vitest/globals" />
/**
 * Global test setup — creates a per-worker test DB with `prisma db push`,
 * cleans all AI Town tables between tests, and tears down on exit.
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Each vitest fork gets its own worker id (1, 2, …).
const workerId = process.env.VITEST_POOL_ID ?? '1';
const dbFileName = `test-${workerId}.db`;
const dbPath = path.resolve(__dirname, '../../prisma', dbFileName);
const dbUrl = `file:${dbPath}`;

// Create a PrismaClient wired to the test DB.
const testPrisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
});

// Patch the shared `prisma` singleton used by all services so they hit the test DB.
// vi.mock would work, but services import at module level — this is simpler.
import { vi } from 'vitest';
vi.mock('../config/database', () => ({
  prisma: testPrisma,
}));

// ── lifecycle ────────────────────────────────────────────────────────

beforeAll(async () => {
  // Ensure the SQLite file exists (Prisma schema engine may not create it).
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (!fs.existsSync(dbPath)) fs.closeSync(fs.openSync(dbPath, 'w'));

  // Push the schema to the test DB (creates tables without migration history).
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: path.resolve(__dirname, '../../'),
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'pipe',
  });
  await testPrisma.$connect();
});

beforeEach(async () => {
  // Delete in leaf-first FK order to avoid constraint violations.
  await testPrisma.predictionBet.deleteMany();
  await testPrisma.predictionMarket.deleteMany();
  await testPrisma.agentStake.deleteMany();
  await testPrisma.userBalance.deleteMany();
  await testPrisma.priceSnapshot.deleteMany();
  await testPrisma.economySwap.deleteMany();
  await testPrisma.economyPool.deleteMany();
  await testPrisma.arenaMove.deleteMany();
  await testPrisma.opponentRecord.deleteMany();
  await testPrisma.arenaTournamentEntry.deleteMany();
  await testPrisma.arenaMatch.deleteMany();
  await testPrisma.arenaTournament.deleteMany();
  await testPrisma.agentRelationship.deleteMany();
  await testPrisma.workLog.deleteMany();
  await testPrisma.townContribution.deleteMany();
  await testPrisma.townEvent.deleteMany();
  await testPrisma.plot.deleteMany();
  await testPrisma.town.deleteMany();
  await testPrisma.arenaAgent.deleteMany();
});

afterAll(async () => {
  await testPrisma.$disconnect();
  // Clean up test DB files.
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const p = dbPath + suffix;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});
