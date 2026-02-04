#!/usr/bin/env npx tsx
/**
 * Arena DB Reset Script
 * 
 * Usage:
 *   npx tsx reset-arena.ts              # Full reset (delete everything)
 *   npx tsx reset-arena.ts --keep-agents # Keep agents, reset stats + delete matches
 *   npx tsx reset-arena.ts --unstick     # Just unstick agents (no data deletion)
 */

import { prisma } from './src/config/database';

const args = process.argv.slice(2);
const keepAgents = args.includes('--keep-agents');
const unstickOnly = args.includes('--unstick');

async function main() {
  console.log('🏟️  Arena DB Reset Tool\n');

  if (unstickOnly) {
    // Just unstick agents
    const result = await prisma.arenaAgent.updateMany({
      where: { isInMatch: true },
      data: { isInMatch: false, currentMatchId: null },
    });
    console.log(`✅ Unstuck ${result.count} agent(s)`);
    
    // Cancel active/waiting matches
    const cancelled = await prisma.arenaMatch.updateMany({
      where: { status: { in: ['ACTIVE', 'WAITING'] } },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
    console.log(`✅ Cancelled ${cancelled.count} stale match(es)`);
    
    await prisma.$disconnect();
    return;
  }

  // Count before
  const before = {
    agents: await prisma.arenaAgent.count(),
    matches: await prisma.arenaMatch.count(),
    moves: await prisma.arenaMove.count(),
    records: await prisma.opponentRecord.count(),
  };
  console.log('Before:', before);

  // Delete in order (respecting foreign keys)
  console.log('\n🗑️  Deleting...');
  
  const deletedMoves = await prisma.arenaMove.deleteMany();
  console.log(`  Moves: ${deletedMoves.count}`);
  
  const deletedRecords = await prisma.opponentRecord.deleteMany();
  console.log(`  Opponent records: ${deletedRecords.count}`);
  
  const deletedMatches = await prisma.arenaMatch.deleteMany();
  console.log(`  Matches: ${deletedMatches.count}`);

  if (keepAgents) {
    // Reset agent stats but keep them
    await prisma.arenaAgent.updateMany({
      data: {
        elo: 1500,
        wins: 0,
        losses: 0,
        draws: 0,
        bankroll: 10000,
        totalWagered: 0,
        totalWon: 0,
        apiCostCents: 0,
        isInMatch: false,
        currentMatchId: null,
      },
    });
    console.log(`  Agents: stats reset (${before.agents} kept)`);
  } else {
    const deletedAgents = await prisma.arenaAgent.deleteMany();
    console.log(`  Agents: ${deletedAgents.count}`);
  }

  // Count after
  const after = {
    agents: await prisma.arenaAgent.count(),
    matches: await prisma.arenaMatch.count(),
    moves: await prisma.arenaMove.count(),
    records: await prisma.opponentRecord.count(),
  };
  console.log('\nAfter:', after);
  console.log('\n✅ Arena reset complete!');

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
