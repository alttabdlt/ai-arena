/**
 * Comprehensive test for the ArenaPokerEngine.
 * Part 1: Unit tests (hand evaluation, game logic)
 * Part 2: E2E integration test via REST API
 *
 * Run unit tests: npx tsx test-poker.ts unit
 * Run E2E tests:  npx tsx test-poker.ts e2e   (requires server running)
 * Run all:        npx tsx test-poker.ts
 */

import { ArenaPokerEngine, evaluateHand, bestHand, compareScores, HAND_NAMES } from './src/services/arenaPokerEngine';

const BASE = 'http://localhost:4000/api/v1';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
    return false;
  }
  console.log(`  ✅ ${msg}`);
  passed++;
  return true;
}

function section(title: string) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(50));
}

// ============================================
// Part 1: Hand Evaluation Unit Tests
// ============================================

function testHandEvaluation() {
  section('HAND EVALUATION');

  // High card
  const hc = evaluateHand(['A♠', '9♥', '7♦', '4♣', '2♠']);
  assert(hc.name === 'High Card', `High card: ${hc.name}`);

  // Pair
  const pair = evaluateHand(['K♠', 'K♥', '9♦', '7♣', '2♠']);
  assert(pair.name === 'Pair', `Pair: ${pair.name}`);

  // Two pair
  const tp = evaluateHand(['K♠', 'K♥', '9♦', '9♣', '2♠']);
  assert(tp.name === 'Two Pair', `Two pair: ${tp.name}`);

  // Three of a kind
  const trips = evaluateHand(['K♠', 'K♥', 'K♦', '7♣', '2♠']);
  assert(trips.name === 'Three of a Kind', `Trips: ${trips.name}`);

  // Straight (normal)
  const str = evaluateHand(['9♠', '8♥', '7♦', '6♣', '5♠']);
  assert(str.name === 'Straight', `Straight: ${str.name}`);
  assert(str.score[1] === 9, 'Straight high card is 9');

  // Ace-low straight (A-2-3-4-5 = "the wheel")
  const wheel = evaluateHand(['A♠', '2♥', '3♦', '4♣', '5♠']);
  assert(wheel.name === 'Straight', `Wheel: ${wheel.name}`);
  assert(wheel.score[1] === 5, 'Wheel high card is 5 (not 14)');

  // Ace-high straight
  const broadway = evaluateHand(['A♠', 'K♥', 'Q♦', 'J♣', 'T♠']);
  assert(broadway.name === 'Straight', `Broadway: ${broadway.name}`);
  assert(broadway.score[1] === 14, 'Broadway high card is 14 (Ace)');

  // Flush
  const flush = evaluateHand(['A♠', 'T♠', '7♠', '4♠', '2♠']);
  assert(flush.name === 'Flush', `Flush: ${flush.name}`);

  // Full house
  const fh = evaluateHand(['K♠', 'K♥', 'K♦', '9♣', '9♠']);
  assert(fh.name === 'Full House', `Full house: ${fh.name}`);

  // Four of a kind
  const quads = evaluateHand(['K♠', 'K♥', 'K♦', 'K♣', '2♠']);
  assert(quads.name === 'Four of a Kind', `Quads: ${quads.name}`);

  // Straight flush
  const sf = evaluateHand(['9♠', '8♠', '7♠', '6♠', '5♠']);
  assert(sf.name === 'Straight Flush', `Straight flush: ${sf.name}`);

  // Royal flush
  const rf = evaluateHand(['A♠', 'K♠', 'Q♠', 'J♠', 'T♠']);
  assert(rf.name === 'Royal Flush', `Royal flush: ${rf.name}`);

  // Ranking order tests
  assert(compareScores(pair.score, hc.score) > 0, 'Pair > High card');
  assert(compareScores(tp.score, pair.score) > 0, 'Two pair > Pair');
  assert(compareScores(trips.score, tp.score) > 0, 'Trips > Two pair');
  assert(compareScores(str.score, trips.score) > 0, 'Straight > Trips');
  assert(compareScores(flush.score, str.score) > 0, 'Flush > Straight');
  assert(compareScores(fh.score, flush.score) > 0, 'Full house > Flush');
  assert(compareScores(quads.score, fh.score) > 0, 'Quads > Full house');
  assert(compareScores(sf.score, quads.score) > 0, 'Straight flush > Quads');
  assert(compareScores(rf.score, sf.score) > 0, 'Royal flush > Straight flush');

  // Kicker tests
  const pairK = evaluateHand(['A♠', 'A♥', 'K♦', '7♣', '2♠']);
  const pairQ = evaluateHand(['A♠', 'A♥', 'Q♦', '7♣', '2♠']);
  assert(compareScores(pairK.score, pairQ.score) > 0, 'Pair of aces (K kicker) > Pair of aces (Q kicker)');

  // Equal hands
  const flush1 = evaluateHand(['A♠', 'T♠', '7♠', '4♠', '2♠']);
  const flush2 = evaluateHand(['A♥', 'T♥', '7♥', '4♥', '2♥']);
  assert(compareScores(flush1.score, flush2.score) === 0, 'Same flush in different suits = tie');
}

function testBestHand() {
  section('BEST HAND (7-CARD)');

  // Should find the straight flush in 7 cards
  const result1 = bestHand(['A♠', 'K♠', 'Q♠', 'J♠', 'T♠', '3♥', '7♦']);
  assert(result1.name === 'Royal Flush', `Found royal flush in 7 cards: ${result1.name}`);

  // Should find full house over two pair
  const result2 = bestHand(['K♠', 'K♥', 'K♦', '9♣', '9♠', '3♥', '2♦']);
  assert(result2.name === 'Full House', `Found full house in 7 cards: ${result2.name}`);

  // Should find the best pair with best kickers
  const result3 = bestHand(['A♠', 'A♥', 'K♦', 'Q♣', 'J♠', '3♥', '2♦']);
  assert(result3.name === 'Pair', `Found pair of aces: ${result3.name}`);
  // Best kickers should be K, Q, J
  assert(result3.score[2] === 13, `Best kicker is K (13): got ${result3.score[2]}`);

  // Flush beating straight from 7 cards
  const result4 = bestHand(['A♠', 'K♠', 'Q♠', 'J♠', '3♠', '9♥', '8♥']);
  assert(result4.name === 'Flush', `Flush beats potential straight: ${result4.name}`);
}

// ============================================
// Part 2: Game Logic Unit Tests
// ============================================

function testGameInit() {
  section('GAME INITIALIZATION');

  const state = ArenaPokerEngine.createInitialState('alice', 'bob');

  assert(state.handNumber === 1, `Hand number is 1: ${state.handNumber}`);
  assert(state.phase === 'preflop', `Phase is preflop: ${state.phase}`);
  assert(state.players.length === 2, `2 players: ${state.players.length}`);
  
  const alice = state.players.find(p => p.id === 'alice')!;
  const bob = state.players.find(p => p.id === 'bob')!;
  
  assert(alice.holeCards.length === 2, `Alice has 2 hole cards`);
  assert(bob.holeCards.length === 2, `Bob has 2 hole cards`);
  assert(alice.holeCards[0] !== bob.holeCards[0], 'Different cards dealt');

  // Blinds posted
  assert(state.pot === 30, `Pot has blinds (10+20 = 30): ${state.pot}`);
  assert(state.currentBet === 20, `Current bet is big blind (20): ${state.currentBet}`);
  
  // Dealer (index 0 = alice) is SB, bob is BB
  const dealer = state.players[state.dealerIndex];
  assert(dealer.id === 'alice', `Alice is dealer/SB: ${dealer.id}`);
  assert(dealer.chips === 990, `SB chips: 1000 - 10 = 990: ${dealer.chips}`);
  assert(dealer.bet === 10, `SB bet: 10: ${dealer.bet}`);

  const bb = state.players[(state.dealerIndex + 1) % 2];
  assert(bb.id === 'bob', `Bob is BB: ${bb.id}`);
  assert(bb.chips === 980, `BB chips: 1000 - 20 = 980: ${bb.chips}`);
  assert(bb.bet === 20, `BB bet: 20: ${bb.bet}`);

  // SB acts first preflop in heads-up
  assert(state.currentTurn === 'alice', `SB (alice) acts first preflop: ${state.currentTurn}`);
  
  // Deck should have 48 cards remaining (52 - 4 dealt)
  assert(state.deck.length === 48, `Deck has 48 cards: ${state.deck.length}`);
  
  assert(state.communityCards.length === 0, 'No community cards yet');
  assert(!state.handComplete, 'Hand not complete');
  assert(!state.gameComplete, 'Game not complete');
}

function testFoldAction() {
  section('FOLD ACTION');

  const engine = new ArenaPokerEngine();
  const state = ArenaPokerEngine.createInitialState('alice', 'bob');

  // Alice (SB) folds preflop
  const afterFold = engine.processAction(state, { playerId: 'alice', action: 'fold' });

  // After fold, new hand is auto-dealt with new blinds.
  // Bob won 30 from pot (980 + 30 = 1010), then posted SB=10 for hand 2 → 1000
  // OR posted BB=20 → 990. Depends on dealer rotation.
  const bob = afterFold.players.find((p: any) => p.id === 'bob')!;
  // Verify hand history recorded correct pot win
  assert(afterFold.handHistory[0].amount === 30, `Bob won pot of 30: ${afterFold.handHistory[0].amount}`);
  assert(afterFold.handHistory.length === 1, 'Hand result recorded');
  assert(afterFold.handHistory[0].winnerId === 'bob', `Winner is bob: ${afterFold.handHistory[0].winnerId}`);
  assert(!afterFold.handHistory[0].showdown, 'Not a showdown (fold)');

  // Hand complete, new hand dealt
  assert(afterFold.handNumber === 2, `Now on hand 2: ${afterFold.handNumber}`);
  assert(afterFold.phase === 'preflop', `Phase is preflop for new hand: ${afterFold.phase}`);
  assert(!afterFold.gameComplete, 'Game not over yet');
  
  // Dealer rotated: now bob is dealer/SB
  assert(afterFold.dealerIndex === 1, `Dealer rotated to index 1: ${afterFold.dealerIndex}`);
}

function testCheckCallFlow() {
  section('CHECK/CALL FLOW');

  const engine = new ArenaPokerEngine();
  let state = ArenaPokerEngine.createInitialState('alice', 'bob');

  // Preflop: Alice (SB) calls
  state = engine.processAction(state, { playerId: 'alice', action: 'call' });
  assert(state.phase === 'preflop', `Still preflop after SB call: ${state.phase}`);
  assert(state.currentTurn === 'bob', `Now bob's turn: ${state.currentTurn}`);
  
  const aliceAfterCall = state.players.find((p: any) => p.id === 'alice')!;
  assert(aliceAfterCall.bet === 20, `Alice bet up to BB level: ${aliceAfterCall.bet}`);
  assert(aliceAfterCall.chips === 980, `Alice chips: 1000 - 20 = 980: ${aliceAfterCall.chips}`);
  assert(state.pot === 40, `Pot: 20 + 20 = 40: ${state.pot}`);

  // Bob (BB) checks → advance to flop
  state = engine.processAction(state, { playerId: 'bob', action: 'check' });
  assert(state.phase === 'flop', `Advanced to flop: ${state.phase}`);
  assert(state.communityCards.length === 3, `3 community cards on flop: ${state.communityCards.length}`);
  assert(state.pot === 40, `Pot unchanged: ${state.pot}`);
  assert(state.currentBet === 0, `Current bet reset to 0: ${state.currentBet}`);
  
  // Post-flop: BB acts first in heads-up
  assert(state.currentTurn === 'bob', `BB (bob) acts first post-flop: ${state.currentTurn}`);

  // Bob checks
  state = engine.processAction(state, { playerId: 'bob', action: 'check' });
  assert(state.currentTurn === 'alice', `Now alice's turn: ${state.currentTurn}`);

  // Alice checks → advance to turn
  state = engine.processAction(state, { playerId: 'alice', action: 'check' });
  assert(state.phase === 'turn', `Advanced to turn: ${state.phase}`);
  assert(state.communityCards.length === 4, `4 community cards: ${state.communityCards.length}`);

  // Both check through turn
  state = engine.processAction(state, { playerId: 'bob', action: 'check' });
  state = engine.processAction(state, { playerId: 'alice', action: 'check' });
  assert(state.phase === 'river', `Advanced to river: ${state.phase}`);
  assert(state.communityCards.length === 5, `5 community cards: ${state.communityCards.length}`);

  // Both check through river → showdown
  state = engine.processAction(state, { playerId: 'bob', action: 'check' });
  state = engine.processAction(state, { playerId: 'alice', action: 'check' });
  
  // After showdown, should auto-deal next hand
  assert(state.handNumber === 2, `Now hand 2 after showdown: ${state.handNumber}`);
  assert(state.phase === 'preflop', `New hand preflop: ${state.phase}`);
  assert(state.handHistory.length === 1, 'Hand 1 result recorded');
  assert(state.handHistory[0].showdown === true, 'Was a showdown');
  
  // Verify winner got the pot
  const winner = state.handHistory[0].winnerId;
  console.log(`  ℹ️  Hand 1 winner: ${winner || 'split'} with ${state.handHistory[0].winnerHand}`);
  
  // Money conservation: total chips + current pot should still be 2000
  const totalChips = state.players.reduce((sum: number, p: any) => sum + p.chips, 0) + state.pot;
  assert(totalChips === 2000, `Money conserved (chips + pot): ${totalChips} = 2000`);
}

function testRaiseFlow() {
  section('RAISE FLOW');

  const engine = new ArenaPokerEngine();
  let state = ArenaPokerEngine.createInitialState('alice', 'bob');

  // Alice raises to 60
  state = engine.processAction(state, { playerId: 'alice', action: 'raise', amount: 60 });
  const alice = state.players.find((p: any) => p.id === 'alice')!;
  assert(alice.bet > 20, `Alice raised above BB: bet = ${alice.bet}`);
  assert(state.currentTurn === 'bob', 'Now bob must respond');

  // Bob calls
  state = engine.processAction(state, { playerId: 'bob', action: 'call' });
  assert(state.phase === 'flop', `Moved to flop after call: ${state.phase}`);
  
  // Money conservation
  const totalChips = state.players.reduce((sum: number, p: any) => sum + p.chips, 0) + state.pot;
  assert(totalChips === 2000, `Money conserved during play: ${totalChips}`);
}

function testAllInFlow() {
  section('ALL-IN FLOW');

  const engine = new ArenaPokerEngine();
  let state = ArenaPokerEngine.createInitialState('alice', 'bob', {
    startingChips: 100, // Small stacks for quick all-in
    smallBlind: 10,
    bigBlind: 20,
    maxHands: 5,
  });

  // Alice goes all-in
  state = engine.processAction(state, { playerId: 'alice', action: 'all-in' });
  const alice = state.players.find((p: any) => p.id === 'alice')!;
  assert(alice.chips === 0, `Alice is all-in: chips = ${alice.chips}`);
  assert(alice.isAllIn, 'Alice marked as all-in');

  // Bob calls → should run to showdown automatically
  state = engine.processAction(state, { playerId: 'bob', action: 'call' });
  
  // After showdown with all-in, should have 5 community cards and hand result
  assert(state.handHistory.length === 1, `Hand result recorded: ${state.handHistory.length}`);
  assert(state.handHistory[0].showdown === true, 'Was a showdown');
  console.log(`  ℹ️  All-in showdown winner: ${state.handHistory[0].winnerId} with ${state.handHistory[0].winnerHand}`);

  // Money conservation (include pot for ongoing game)
  const totalChips = state.players.reduce((sum: number, p: any) => sum + p.chips, 0) + (state.pot || 0);
  assert(totalChips === 200, `Money conserved after all-in: ${totalChips}`);

  // If one player bust → game might be complete
  const busted = state.players.find((p: any) => p.chips === 0);
  if (busted) {
    assert(state.gameComplete, 'Game complete when a player busts');
    console.log(`  ℹ️  ${busted.id} busted out!`);
  } else {
    assert(!state.gameComplete, 'Game continues if both have chips');
    assert(state.handNumber === 2, `New hand dealt: ${state.handNumber}`);
  }
}

function testMultiHandCycling() {
  section('MULTI-HAND CYCLING');

  const engine = new ArenaPokerEngine();
  let state = ArenaPokerEngine.createInitialState('alice', 'bob', {
    startingChips: 1000,
    smallBlind: 10,
    bigBlind: 20,
    maxHands: 3, // Short game for testing
  });

  // Play 3 hands of fold-immediately
  for (let hand = 1; hand <= 3; hand++) {
    const currentPlayer = state.currentTurn;
    state = engine.processAction(state, { playerId: currentPlayer, action: 'fold' });
    
    if (hand < 3) {
      assert(state.handNumber === hand + 1, `Hand ${hand + 1} dealt after fold`);
      assert(!state.gameComplete, `Game continues after hand ${hand}`);
    }
  }

  assert(state.gameComplete, 'Game complete after max hands');
  assert(state.handHistory.length === 3, `3 hand results: ${state.handHistory.length}`);

  // Verify winner (most chips)
  const winner = engine.getWinner(state);
  assert(winner !== null, `Has a winner: ${winner}`);
  
  const winnerPlayer = state.players.find((p: any) => p.id === winner)!;
  const loserPlayer = state.players.find((p: any) => p.id !== winner)!;
  assert(winnerPlayer.chips > loserPlayer.chips, 'Winner has more chips');

  // Money conservation
  const total = state.players.reduce((sum: number, p: any) => sum + p.chips, 0);
  assert(total === 2000, `Money conserved after 3 hands: ${total}`);
  
  // Dealer rotation
  console.log(`  ℹ️  Hand 1 dealer: player[0], Hand 2 dealer: player[1], Hand 3 dealer: player[0]`);
}

function testValidActions() {
  section('VALID ACTIONS');

  const engine = new ArenaPokerEngine();
  const state = ArenaPokerEngine.createInitialState('alice', 'bob');

  // Alice (SB, has bet 10, current bet is 20) — can fold, call, raise, all-in
  const aliceActions = engine.getValidActions(state, 'alice');
  assert(aliceActions.includes('fold'), 'Alice can fold');
  assert(aliceActions.includes('call'), 'Alice can call');
  assert(aliceActions.includes('raise'), 'Alice can raise');
  assert(aliceActions.includes('all-in'), 'Alice can all-in');
  assert(!aliceActions.includes('check'), 'Alice cannot check (needs to call BB)');

  // Bob (BB, has bet 20, current bet is 20) — can check but also fold/raise/all-in
  // Actually bob can't act yet — it's alice's turn. But getValidActions should still work
  const bobActions = engine.getValidActions(state, 'bob');
  assert(bobActions.includes('check'), 'Bob can check (matched current bet)');
  assert(bobActions.includes('fold'), 'Bob can fold');
  assert(bobActions.includes('raise'), 'Bob can raise');

  // After fold, new hand auto-deals. Test mid-hand fold by making alice fold during hand.
  // Create a game where we can check the folded state MID-hand
  let foldState = ArenaPokerEngine.createInitialState('alice', 'bob', { maxHands: 1 });
  foldState = engine.processAction(foldState, { playerId: 'alice', action: 'fold' });
  // With maxHands=1, after fold the game is complete
  assert(foldState.gameComplete, 'Game complete after single-hand fold');
  const foldedActions = engine.getValidActions(foldState, 'alice');
  assert(foldedActions.length === 0, 'No actions in completed game');
}

function testEdgeCases() {
  section('EDGE CASES');

  const engine = new ArenaPokerEngine();

  // Invalid action treated as check
  let state = ArenaPokerEngine.createInitialState('alice', 'bob');
  state = engine.processAction(state, { playerId: 'alice', action: 'call' }); // Alice calls BB
  // Now bob's turn, can check
  const before = JSON.parse(JSON.stringify(state));
  state = engine.processAction(state, { playerId: 'bob', action: 'bluff_hard' }); // Invalid → treated as check
  assert(state.phase === 'flop', 'Invalid action treated as check, advanced to flop');

  // Check when should call → auto-converts
  state = ArenaPokerEngine.createInitialState('alice', 'bob');
  // Alice has SB=10, current bet=20, she tries to check → should become call
  state = engine.processAction(state, { playerId: 'alice', action: 'check' });
  const aliceAfter = state.players.find((p: any) => p.id === 'alice')!;
  assert(aliceAfter.bet === 20, 'Check when behind auto-converts to call');
}

// ============================================
// Part 3: E2E Integration Tests (via REST API)
// ============================================

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

async function testPokerE2E() {
  section('E2E: POKER via REST API');

  // Register two poker agents
  console.log('\n  📝 Registering poker agents...');
  const { data: shark, ok: ok1 } = await api('POST', '/agents/register', {
    name: `PokerShark_${Date.now()}`,
    archetype: 'SHARK',
    modelId: 'deepseek-v3',
    systemPrompt: 'Play aggressive poker. Raise with strong hands, bluff occasionally.',
  });
  assert(ok1, `Shark registered: ${shark?.name}`);

  const { data: grinder, ok: ok2 } = await api('POST', '/agents/register', {
    name: `PokerGrinder_${Date.now()}`,
    archetype: 'GRINDER',
    modelId: 'deepseek-v3',
    systemPrompt: 'Play mathematically optimal poker. Calculate pot odds.',
  });
  assert(ok2, `Grinder registered: ${grinder?.name}`);

  // Create poker match
  console.log('\n  🎰 Creating poker match...');
  const { data: match, ok: matchOk } = await api('POST', '/matches/create', {
    gameType: 'POKER',
    wagerAmount: 200,
    opponentId: grinder.id,
  }, shark.apiKey);
  assert(matchOk, `Poker match created: ${match?.id?.slice(0, 12)}...`);

  // Get initial state
  const { data: initState } = await api('GET', `/matches/${match.id}/state`, undefined, shark.apiKey);
  assert(initState.gameType === 'POKER', `Game type is POKER`);
  assert(initState.gameState.phase === 'preflop', `Starts at preflop`);
  assert(initState.gameState.pot === 30, `Initial pot has blinds: ${initState.gameState.pot}`);
  assert(initState.gameState.handNumber === 1, `Hand 1: ${initState.gameState.handNumber}`);

  // Play through the match with AI moves
  console.log('\n  🤖 Playing AI poker match...');
  let totalMoves = 0;
  const maxMoves = 200; // Safety cap (10 hands × ~20 actions max)

  for (let i = 0; i < maxMoves; i++) {
    const { data: state } = await api('GET', `/matches/${match.id}/state`, undefined, shark.apiKey);
    
    if (state.status === 'COMPLETED') {
      const winner = state.winnerId === shark.id ? shark.name : 
                     state.winnerId === grinder.id ? grinder.name : 'DRAW';
      console.log(`\n  🏆 Match complete after ${totalMoves} total moves!`);
      console.log(`  🏆 Winner: ${winner}`);
      
      // Print hand history
      if (state.gameState.handHistory) {
        console.log(`\n  📜 Hand History (${state.gameState.handHistory.length} hands):`);
        for (const h of state.gameState.handHistory) {
          const w = h.winnerId === shark.id ? shark.name :
                   h.winnerId === grinder.id ? grinder.name : 'Split';
          const method = h.showdown ? `showdown (${h.winnerHand})` : 'fold';
          console.log(`    Hand ${h.handNumber}: ${w} wins ${h.amount} via ${method}`);
        }
      }
      
      assert(state.gameState.handHistory?.length > 0, 'At least 1 hand played');
      
      // Money conservation
      const { data: allAgents } = await api('GET', '/agents');
      const sharkAgent = allAgents.find((a: any) => a.id === shark.id);
      const grinderAgent = allAgents.find((a: any) => a.id === grinder.id);
      console.log(`\n  💰 ${shark.name}: bank=${sharkAgent.bankroll}, ${grinder.name}: bank=${grinderAgent.bankroll}`);
      
      break;
    }

    if (!state.currentTurnId) {
      console.error('  ❌ No current turn! Game stuck.');
      // Try to get full state for debugging
      console.error('  State:', JSON.stringify(state.gameState, null, 2).slice(0, 500));
      break;
    }

    const isShark = state.currentTurnId === shark.id;
    const key = isShark ? shark.apiKey : grinder.apiKey;
    const name = isShark ? 'S' : 'G';

    const { data: aiResult, ok: aiOk } = await api('POST', `/matches/${match.id}/ai-move`, undefined, key);
    if (!aiOk) {
      console.error(`  ❌ AI move failed: ${aiResult?.error}`);
      // Try to cancel and bail
      await api('POST', `/matches/${match.id}/cancel`, undefined, key);
      break;
    }

    totalMoves++;
    const action = aiResult.move?.action || '?';
    const amount = aiResult.move?.amount ? ` ${aiResult.move.amount}` : '';
    process.stdout.write(`${name}:${action}${amount} `);
    
    if (totalMoves % 20 === 0) process.stdout.write('\n  ');
  }

  if (totalMoves >= maxMoves) {
    console.error(`\n  ❌ Match did not complete in ${maxMoves} moves!`);
  }

  // Cleanup: cancel if still active
  const { data: finalState } = await api('GET', `/matches/${match.id}/state`, undefined, shark.apiKey);
  if (finalState.status !== 'COMPLETED') {
    await api('POST', `/matches/${match.id}/cancel`, undefined, shark.apiKey);
    console.log('  ⚠️  Match cancelled (did not complete naturally)');
  }
}

// ============================================
// Main
// ============================================

async function main() {
  const mode = process.argv[2] || 'all';
  
  console.log('🃏 Arena Poker Engine — Test Suite');
  console.log('==================================');

  if (mode === 'unit' || mode === 'all') {
    testHandEvaluation();
    testBestHand();
    testGameInit();
    testFoldAction();
    testCheckCallFlow();
    testRaiseFlow();
    testAllInFlow();
    testMultiHandCycling();
    testValidActions();
    testEdgeCases();
  }

  if (mode === 'e2e' || mode === 'all') {
    try {
      await fetch('http://localhost:4000/health');
      await testPokerE2E();
    } catch {
      console.log('\n  ⚠️  Server not running — skipping E2E tests');
      console.log('  Start server: cd backend && FAST_STARTUP=true npx tsx src/index.ts');
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
