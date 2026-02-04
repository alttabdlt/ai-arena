/**
 * Tournament Runner — Registers 5 agents with different archetypes and
 * runs a round-robin of matches across RPS and Poker.
 *
 * Usage: npx tsx run-tournament.ts [--matches N] [--game RPS|POKER|BOTH]
 *
 * Requires server running: FAST_STARTUP=true npx tsx src/index.ts
 */

const BASE = 'http://localhost:4000/api/v1';

interface Agent {
  id: string;
  name: string;
  apiKey: string;
  archetype: string;
}

async function api(method: string, path: string, body?: any, apiKey?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data, ok: res.ok };
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// Agent Definitions
// ============================================

const AGENT_CONFIGS = [
  {
    name: 'AlphaShark',
    archetype: 'SHARK',
    modelId: 'deepseek-v3',
    systemPrompt: 'You are AlphaShark, a feared predator in the arena. Attack relentlessly. Exploit any weakness. In poker, raise pre-flop with any decent hand and c-bet aggressively. In RPS, be unpredictable.',
    riskTolerance: 0.8,
    maxWagerPercent: 0.2,
  },
  {
    name: 'SteadyEddie',
    archetype: 'ROCK',
    modelId: 'deepseek-v3',
    systemPrompt: 'You are SteadyEddie, a patient disciplined player. Wait for good spots. In poker, value bet strong hands and fold trash. In RPS, stick to randomized strategy.',
    riskTolerance: 0.3,
    maxWagerPercent: 0.1,
  },
  {
    name: 'MorphBot',
    archetype: 'CHAMELEON',
    modelId: 'deepseek-v3',
    systemPrompt: 'You are MorphBot, the adaptive genius. Study every opponent move and adjust. In poker, start neutral then exploit their tendencies. Track their patterns in RPS.',
    riskTolerance: 0.5,
    maxWagerPercent: 0.15,
  },
  {
    name: 'YoloDegen',
    archetype: 'DEGEN',
    modelId: 'deepseek-v3',
    systemPrompt: 'You are YoloDegen, chaos incarnate! Every hand is playable, every pot is yours. Go big or go home. Variety is key — be completely random and unpredictable.',
    riskTolerance: 1.0,
    maxWagerPercent: 0.25,
  },
  {
    name: 'MathEngine',
    archetype: 'GRINDER',
    modelId: 'deepseek-v3',
    systemPrompt: 'You are MathEngine, a cold calculating optimizer. Every move is based on expected value. In poker, always calculate pot odds before calling. In heads-up, play a wide range — most hands have enough equity.',
    riskTolerance: 0.4,
    maxWagerPercent: 0.12,
  },
];

// ============================================
// Match Runner
// ============================================

async function playMatch(
  a1: Agent,
  a2: Agent,
  gameType: 'RPS' | 'POKER',
  wager: number,
): Promise<{ winnerId: string | null; moves: number; error?: string }> {
  // Create match
  const { data: match, ok } = await api('POST', '/matches/create', {
    gameType,
    wagerAmount: wager,
    opponentId: a2.id,
  }, a1.apiKey);

  if (!ok) {
    return { winnerId: null, moves: 0, error: match?.error || 'Create failed' };
  }

  const matchId = match.id;
  let totalMoves = 0;
  const maxMoves = gameType === 'POKER' ? 200 : 30;

  for (let i = 0; i < maxMoves; i++) {
    const { data: state } = await api('GET', `/matches/${matchId}/state`, undefined, a1.apiKey);
    
    if (state.status === 'COMPLETED') {
      return { winnerId: state.winnerId, moves: totalMoves };
    }

    if (!state.currentTurnId) {
      // Game stuck
      await api('POST', `/matches/${matchId}/cancel`, undefined, a1.apiKey);
      return { winnerId: null, moves: totalMoves, error: 'No current turn' };
    }

    const isA1 = state.currentTurnId === a1.id;
    const key = isA1 ? a1.apiKey : a2.apiKey;

    const { data: aiResult, ok: aiOk } = await api('POST', `/matches/${matchId}/ai-move`, undefined, key);
    if (!aiOk) {
      await api('POST', `/matches/${matchId}/cancel`, undefined, a1.apiKey);
      return { winnerId: null, moves: totalMoves, error: aiResult?.error || 'AI move failed' };
    }

    totalMoves++;
  }

  // Timeout — cancel
  await api('POST', `/matches/${matchId}/cancel`, undefined, a1.apiKey);
  return { winnerId: null, moves: totalMoves, error: 'Timeout' };
}

// ============================================
// Main
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const matchCount = parseInt(args.find(a => a.startsWith('--matches='))?.split('=')[1] || '1');
  const gameFilter = (args.find(a => a.startsWith('--game='))?.split('=')[1] || 'BOTH').toUpperCase();

  console.log('🏟️  AI Arena — Tournament Runner');
  console.log('================================');
  console.log(`  Matches per pairing: ${matchCount}`);
  console.log(`  Games: ${gameFilter}`);
  console.log();

  // Health check
  try {
    await fetch('http://localhost:4000/health');
  } catch {
    console.error('❌ Server not running! Start with: FAST_STARTUP=true npx tsx src/index.ts');
    process.exit(1);
  }

  // Register agents (or find existing ones)
  console.log('📝 Registering agents...');
  const agents: Agent[] = [];

  const suffix = `_${Date.now().toString(36)}`;
  for (const cfg of AGENT_CONFIGS) {
    // First try the exact name, fall back to timestamped name
    let { data, ok } = await api('POST', '/agents/register', cfg);
    if (!ok && data?.error?.includes('already taken')) {
      const uniqueCfg = { ...cfg, name: `${cfg.name}${suffix}` };
      ({ data, ok } = await api('POST', '/agents/register', uniqueCfg));
    }
    if (ok) {
      console.log(`  ✅ ${data.name} (${cfg.archetype}) — bank: ${data.bankroll}, ELO: ${data.elo}`);
      agents.push({ id: data.id, name: data.name, apiKey: data.apiKey, archetype: cfg.archetype });
    } else {
      console.log(`  ⚠️  ${cfg.name}: ${data?.error || 'Failed'} — skipping`);
    }
  }

  if (agents.length < 2) {
    console.error('❌ Need at least 2 agents to run tournament');
    process.exit(1);
  }

  console.log(`\n🎯 ${agents.length} agents ready. Running round-robin...`);

  // Generate pairings
  const gameTypes: Array<'RPS' | 'POKER'> = [];
  if (gameFilter === 'BOTH' || gameFilter === 'RPS') gameTypes.push('RPS');
  if (gameFilter === 'BOTH' || gameFilter === 'POKER') gameTypes.push('POKER');

  let matchNum = 0;
  let totalErrors = 0;

  for (const gameType of gameTypes) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`  ${gameType} MATCHES`);
    console.log('═'.repeat(50));

    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        for (let round = 0; round < matchCount; round++) {
          matchNum++;
          const a1 = agents[i];
          const a2 = agents[j];
          const wager = gameType === 'POKER' ? 200 : 300;

          process.stdout.write(`\n  #${matchNum} ${a1.name} vs ${a2.name} (${gameType}, ${wager}$)... `);

          const result = await playMatch(a1, a2, gameType, wager);

          if (result.error) {
            console.log(`❌ ${result.error}`);
            totalErrors++;
          } else {
            const winner = result.winnerId === a1.id ? a1.name :
                          result.winnerId === a2.id ? a2.name : 'DRAW';
            console.log(`${winner} wins (${result.moves} moves)`);
          }
        }
      }
    }
  }

  // Final leaderboard
  console.log(`\n\n${'═'.repeat(60)}`);
  console.log('  🏆 FINAL LEADERBOARD');
  console.log('═'.repeat(60));

  const { data: lb } = await api('GET', '/leaderboard?limit=50');
  let totalCost = 0;
  for (const [i, e] of lb.entries()) {
    totalCost += parseFloat(e.apiCostDollars);
    const record = `${e.wins}W-${e.losses}L-${e.draws}D`;
    const profit = e.profit >= 0 ? `+${e.profit}` : `${e.profit}`;
    console.log(
      `  #${String(i + 1).padStart(2)} ${e.name.padEnd(15)} ` +
      `ELO ${String(e.elo).padStart(4)} | ${record.padEnd(10)} | ` +
      `bank: ${String(e.bankroll).padStart(6)} | profit: ${profit.padStart(6)} | ` +
      `cost: $${e.apiCostDollars}`
    );
  }

  console.log(`\n  📊 Total matches: ${matchNum} (${totalErrors} errors)`);
  console.log(`  💰 Total API cost: $${totalCost.toFixed(3)}`);
  console.log();
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
