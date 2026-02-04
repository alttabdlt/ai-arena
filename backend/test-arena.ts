/**
 * End-to-end integration test for the Arena PvP API.
 * Run: npx tsx test-arena.ts
 */

const BASE = 'http://localhost:4000/api/v1';

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

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✅ ${msg}`);
}

async function playAIMatch(name: string, key1: string, id1: string, key2: string, id2: string, gameType: string, wager: number) {
  console.log(`\n⚔️  ${name} (wager: ${wager})`);
  
  const { data: match, ok } = await api('POST', '/matches/create', { gameType, wagerAmount: wager, opponentId: id2 }, key1);
  assert(ok, `Match created: ${match?.id?.slice(0, 12)}...`);
  
  const matchId = match.id;
  let rounds = 0;
  
  for (let i = 0; i < 20; i++) { // Safety cap
    const { data: state } = await api('GET', `/matches/${matchId}/state`, undefined, key1);
    if (state.status === 'COMPLETED') {
      const gs = state.gameState;
      const p1Score = gs.scores?.[id1] ?? '?';
      const p2Score = gs.scores?.[id2] ?? '?';
      rounds = gs.history?.length ?? 0;
      const winner = state.winnerId === id1 ? state.player1.name
        : state.winnerId === id2 ? state.player2.name 
        : 'DRAW';
      console.log(`  🏆 ${state.player1.name} ${p1Score}-${p2Score} ${state.player2.name} → ${winner} wins! (${rounds} rounds)`);
      
      if (gs.history) {
        for (const h of gs.history) {
          const moves = Object.entries(h.moves).map(([k, v]) => `${(k as string).slice(0, 6)}=${v}`).join(' vs ');
          console.log(`     R${h.round}: ${moves} → ${h.winner ? h.winner.slice(0, 6) : 'draw'}`);
        }
      }
      return { matchId, winnerId: state.winnerId };
    }
    
    const turn = state.currentTurnId;
    const key = turn === id1 ? key1 : key2;
    const playerName = turn === id1 ? state.player1.name : state.player2.name;
    
    const { data: aiResult, ok: aiOk } = await api('POST', `/matches/${matchId}/ai-move`, undefined, key);
    if (!aiOk) {
      console.error(`  ❌ AI move failed for ${playerName}: ${aiResult?.error}`);
      // Cancel the match to free agents
      await api('POST', `/matches/${matchId}/cancel`, undefined, key);
      return null;
    }
    
    process.stdout.write(`  ${playerName[0]}→${aiResult.move.action} `);
  }
  
  console.error('\n  ❌ Match did not complete in 20 turns!');
  return null;
}

async function main() {
  console.log('🏟️  AI Arena — Integration Test');
  console.log('================================\n');

  // 1. Health check
  const health = await fetch('http://localhost:4000/health').then(r => r.json());
  assert(health.status === 'ok', `Server healthy (uptime: ${health.uptime})`);

  // 2. Register agents
  console.log('\n📝 Registering agents...');
  const agents: Array<{ name: string; key: string; id: string }> = [];
  
  const configs = [
    { name: 'SharkBot', archetype: 'SHARK', systemPrompt: 'Vary moves unpredictably. Never repeat.' },
    { name: 'RockWall', archetype: 'ROCK', systemPrompt: 'Analyze patterns. Counter opponent.' },
    { name: 'DegenKing', archetype: 'DEGEN', systemPrompt: 'Pure chaos. Random moves.' },
  ];
  
  for (const cfg of configs) {
    const { data, ok } = await api('POST', '/agents/register', { ...cfg, modelId: 'deepseek-v3' });
    assert(ok, `${cfg.name} registered (bank: ${data.bankroll}, ELO: ${data.elo})`);
    agents.push({ name: cfg.name, key: data.apiKey, id: data.id });
  }

  // 3. Validation tests
  console.log('\n🛡️  Validation tests...');
  
  const { status: s1 } = await api('POST', '/agents/register', { name: 'SharkBot', archetype: 'SHARK' });
  assert(s1 === 400, 'Duplicate name rejected');
  
  const { status: s2 } = await api('GET', '/me');
  assert(s2 === 401, 'No auth returns 401');
  
  const { status: s3 } = await api('GET', '/me', undefined, 'fake_key');
  assert(s3 === 401, 'Bad key returns 401');
  
  const { data: models } = await api('GET', '/models');
  assert(models.length > 0, `${models.length} models available`);
  
  const { data: lb } = await api('GET', '/leaderboard');
  assert(lb.length === 3, 'Leaderboard has 3 agents');

  // 4. Invalid move test (create match, try bad move, then cancel)
  console.log('\n🧪 Invalid move test...');
  const { data: testMatch } = await api('POST', '/matches/create', 
    { gameType: 'RPS', wagerAmount: 50, opponentId: agents[1].id }, agents[0].key);
  
  const { data: badMove, status: badStatus } = await api('POST', `/matches/${testMatch.id}/move`,
    { action: 'lizard' }, agents[0].key);
  assert(badStatus === 400, `Invalid move rejected: "${badMove.error}"`);
  
  // Cancel the test match to free agents
  const { data: cancelResult } = await api('POST', `/matches/${testMatch.id}/cancel`, undefined, agents[0].key);
  assert(cancelResult.status === 'cancelled', 'Test match cancelled, agents freed');

  // 5. AI-powered matches
  console.log('\n🤖 AI-Powered Matches');
  console.log('---------------------');
  
  const result1 = await playAIMatch(
    'Shark vs Degen',
    agents[0].key, agents[0].id,
    agents[2].key, agents[2].id,
    'RPS', 500
  );
  
  const result2 = await playAIMatch(
    'Rock vs Degen',
    agents[1].key, agents[1].id,
    agents[2].key, agents[2].id,
    'RPS', 300
  );

  const result3 = await playAIMatch(
    'Shark vs Rock',
    agents[0].key, agents[0].id,
    agents[1].key, agents[1].id,
    'RPS', 400
  );

  // 6. Final leaderboard
  console.log('\n\n🏅 Final Leaderboard:');
  const { data: finalLb } = await api('GET', '/leaderboard');
  let totalCost = 0;
  for (const [i, e] of finalLb.entries()) {
    totalCost += parseFloat(e.apiCostDollars);
    console.log(`  #${i + 1} ${e.name.padEnd(12)} ELO ${e.elo} | ${e.wins}W-${e.losses}L | bank: ${e.bankroll.toLocaleString().padStart(6)} | profit: ${(e.profit >= 0 ? '+' : '') + e.profit} | cost: $${e.apiCostDollars}`);
  }
  console.log(`  Total API cost: $${totalCost.toFixed(3)}`);

  // 7. Money conservation
  console.log('\n💰 Money conservation:');
  const { data: allAgents } = await api('GET', '/agents');
  const totalBank = allAgents.reduce((s: number, a: any) => s + a.bankroll, 0);
  const starting = allAgents.length * 10000;
  const rake = starting - totalBank;
  console.log(`  Starting: ${starting.toLocaleString()}`);
  console.log(`  Current:  ${totalBank.toLocaleString()}`);
  console.log(`  Rake:     ${rake.toLocaleString()}`);
  assert(totalBank + rake === starting, 'Money conserved ✅');

  console.log('\n✅ All tests passed!');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
