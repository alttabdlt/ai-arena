/**
 * ArenaPokerEngine — Self-contained heads-up Texas Hold'em for the Arena PvP system.
 *
 * Features:
 * - Proper heads-up rules (button=SB, preflop: SB acts first, post-flop: BB acts first)
 * - Blind posting
 * - Full betting rounds: preflop → flop → turn → river → showdown
 * - Complete hand evaluation (best 5 from 7 cards)
 * - Multi-hand cycling with auto-transition
 * - All-in & split pot support
 * - Ace-low straights
 * - Game ends when one player is bust or max hands reached
 *
 * Implements GameEngineAdapter interface for arenaService integration.
 */

import { GameEngineAdapter } from './gameEngineAdapter';

// ============================================
// Types
// ============================================

export interface PokerState {
  // Players
  players: PokerPlayer[];

  // Deck & cards
  deck: string[];
  communityCards: string[];
  burnt: string[];

  // Betting
  pot: number;
  currentBet: number;
  minRaise: number;

  // Blinds
  smallBlind: number;
  bigBlind: number;

  // Blind escalation schedule (optional)
  blindSchedule?: { hand: number; sb: number; bb: number }[];

  // Positions
  dealerIndex: number; // Index into players array (button/SB in heads-up)

  // Phase tracking
  phase: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'handComplete';
  currentTurn: string; // Player ID whose turn it is

  // Multi-hand
  handNumber: number;
  maxHands: number;

  // History
  handHistory: HandResult[];
  actionLog: ActionLogEntry[];

  // Flags
  handComplete: boolean;
  gameComplete: boolean;
}

export interface PokerPlayer {
  id: string;
  chips: number;
  holeCards: string[];
  bet: number;       // Amount bet in current betting round
  totalBet: number;  // Total bet across all rounds this hand
  folded: boolean;
  isAllIn: boolean;
  hasActed: boolean;
}

export interface HandResult {
  handNumber: number;
  winnerId: string | null; // null = split pot
  winnerHand?: string;
  amount: number;
  showdown: boolean;
  players: Array<{
    id: string;
    holeCards: string[];
    handRank?: string;
    chipsAfter: number;
  }>;
}

interface ActionLogEntry {
  hand: number;
  phase: string;
  playerId: string;
  action: string;
  amount?: number;
}

// ============================================
// Card utilities
// ============================================

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♥', '♦', '♣'];
const RANK_VALUES: Record<string, number> = {};
RANKS.forEach((r, i) => RANK_VALUES[r] = i + 2); // 2=2, ..., A=14

function createShuffledDeck(): string[] {
  const deck: string[] = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      deck.push(r + s);
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardRank(card: string): number {
  return RANK_VALUES[card[0]] || 0;
}

function cardSuit(card: string): string {
  return card.slice(1);
}

// ============================================
// Hand evaluation
// ============================================

// Hand categories (higher = better)
const HAND_RANKS = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  THREE_OF_KIND: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR_OF_KIND: 7,
  STRAIGHT_FLUSH: 8,
};

const HAND_NAMES: Record<number, string> = {
  0: 'High Card',
  1: 'Pair',
  2: 'Two Pair',
  3: 'Three of a Kind',
  4: 'Straight',
  5: 'Flush',
  6: 'Full House',
  7: 'Four of a Kind',
  8: 'Straight Flush',
};

type HandScore = number[]; // [category, ...kickers] — compare lexicographically

function evaluateHand(cards: string[]): { score: HandScore; name: string } {
  if (cards.length !== 5) throw new Error(`evaluateHand expects 5 cards, got ${cards.length}`);

  const ranks = cards.map(cardRank).sort((a, b) => b - a); // Descending
  const suits = cards.map(cardSuit);

  const isFlush = suits.every(s => s === suits[0]);

  // Check straight (including ace-low A-2-3-4-5)
  let isStraight = false;
  let straightHigh = 0;

  // Normal straight check
  if (ranks[0] - ranks[4] === 4 && new Set(ranks).size === 5) {
    isStraight = true;
    straightHigh = ranks[0];
  }
  // Ace-low straight: A-2-3-4-5 → ranks sorted = [14, 5, 4, 3, 2]
  if (!isStraight && ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
    isStraight = true;
    straightHigh = 5; // 5-high straight
  }

  // Count rank frequencies
  const freq = new Map<number, number>();
  for (const r of ranks) freq.set(r, (freq.get(r) || 0) + 1);
  const groups = Array.from(freq.entries()).sort((a, b) => {
    // Sort by frequency desc, then rank desc
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  const counts = groups.map(g => g[1]); // e.g. [3, 1, 1] for trips

  // Straight flush
  if (isFlush && isStraight) {
    return { score: [HAND_RANKS.STRAIGHT_FLUSH, straightHigh], name: straightHigh === 14 ? 'Royal Flush' : 'Straight Flush' };
  }

  // Four of a kind
  if (counts[0] === 4) {
    return { score: [HAND_RANKS.FOUR_OF_KIND, groups[0][0], groups[1][0]], name: 'Four of a Kind' };
  }

  // Full house
  if (counts[0] === 3 && counts[1] === 2) {
    return { score: [HAND_RANKS.FULL_HOUSE, groups[0][0], groups[1][0]], name: 'Full House' };
  }

  // Flush
  if (isFlush) {
    return { score: [HAND_RANKS.FLUSH, ...ranks], name: 'Flush' };
  }

  // Straight
  if (isStraight) {
    return { score: [HAND_RANKS.STRAIGHT, straightHigh], name: 'Straight' };
  }

  // Three of a kind
  if (counts[0] === 3) {
    const kickers = groups.slice(1).map(g => g[0]).sort((a, b) => b - a);
    return { score: [HAND_RANKS.THREE_OF_KIND, groups[0][0], ...kickers], name: 'Three of a Kind' };
  }

  // Two pair
  if (counts[0] === 2 && counts[1] === 2) {
    const highPair = Math.max(groups[0][0], groups[1][0]);
    const lowPair = Math.min(groups[0][0], groups[1][0]);
    const kicker = groups[2][0];
    return { score: [HAND_RANKS.TWO_PAIR, highPair, lowPair, kicker], name: 'Two Pair' };
  }

  // Pair
  if (counts[0] === 2) {
    const kickers = groups.slice(1).map(g => g[0]).sort((a, b) => b - a);
    return { score: [HAND_RANKS.PAIR, groups[0][0], ...kickers], name: 'Pair' };
  }

  // High card
  return { score: [HAND_RANKS.HIGH_CARD, ...ranks], name: 'High Card' };
}

/**
 * Find the best 5-card hand from 7 cards.
 * C(7,5) = 21 combinations — brute force is fine.
 */
function bestHand(cards: string[]): { score: HandScore; name: string; cards: string[] } {
  if (cards.length < 5) throw new Error(`Need at least 5 cards, got ${cards.length}`);

  let best: { score: HandScore; name: string; cards: string[] } | null = null;

  // Generate all 5-card combinations
  const combos = combinations(cards, 5);
  for (const combo of combos) {
    const result = evaluateHand(combo);
    if (!best || compareScores(result.score, best.score) > 0) {
      best = { ...result, cards: combo };
    }
  }

  return best!;
}

function combinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];
  function recurse(start: number, current: T[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      recurse(i + 1, current);
      current.pop();
    }
  }
  recurse(0, []);
  return result;
}

/** Returns positive if a > b, negative if a < b, 0 if equal */
function compareScores(a: HandScore, b: HandScore): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

// ============================================
// Arena Poker Engine
// ============================================

export class ArenaPokerEngine implements GameEngineAdapter {
  /**
   * Initialize a new poker game state for two players.
   */
  static createInitialState(player1Id: string, player2Id: string, options?: {
    startingChips?: number;
    smallBlind?: number;
    bigBlind?: number;
    maxHands?: number;
    blindSchedule?: { hand: number; sb: number; bb: number }[];
  }): PokerState {
    const startingChips = options?.startingChips ?? 1000;
    const smallBlind = options?.smallBlind ?? 10;
    const bigBlind = options?.bigBlind ?? 20;
    const maxHands = options?.maxHands ?? 10;

    const state: PokerState = {
      players: [
        { id: player1Id, chips: startingChips, holeCards: [], bet: 0, totalBet: 0, folded: false, isAllIn: false, hasActed: false },
        { id: player2Id, chips: startingChips, holeCards: [], bet: 0, totalBet: 0, folded: false, isAllIn: false, hasActed: false },
      ],
      deck: [],
      communityCards: [],
      burnt: [],
      pot: 0,
      currentBet: 0,
      minRaise: bigBlind,
      smallBlind,
      bigBlind,
      blindSchedule: options?.blindSchedule,
      dealerIndex: 0, // Player 0 starts as dealer/SB
      phase: 'preflop',
      currentTurn: '',
      handNumber: 0,
      maxHands,
      handHistory: [],
      actionLog: [],
      handComplete: false,
      gameComplete: false,
    };

    // Deal the first hand
    return ArenaPokerEngine.dealNewHand(state);
  }

  /**
   * Deal a new hand: shuffle, deal hole cards, post blinds.
   */
  static dealNewHand(state: PokerState): PokerState {
    const s = JSON.parse(JSON.stringify(state)) as PokerState;
    s.handNumber++;
    s.handComplete = false;

    // Apply blind escalation if schedule exists
    if (s.blindSchedule && s.blindSchedule.length > 0) {
      // Find the highest matching schedule entry for this hand number
      let matched: { sb: number; bb: number } | null = null;
      for (const entry of s.blindSchedule) {
        if (s.handNumber >= entry.hand) matched = entry;
      }
      if (matched) {
        s.smallBlind = matched.sb;
        s.bigBlind = matched.bb;
      }
    }

    // Shuffle new deck
    s.deck = createShuffledDeck();
    s.communityCards = [];
    s.burnt = [];
    s.pot = 0;
    s.currentBet = 0;
    s.minRaise = s.bigBlind;
    s.phase = 'preflop';

    // Reset players
    for (const p of s.players) {
      p.holeCards = [];
      p.bet = 0;
      p.totalBet = 0;
      p.folded = false;
      p.isAllIn = false;
      p.hasActed = false;
    }

    // Rotate dealer (skip for hand 1)
    if (s.handNumber > 1) {
      s.dealerIndex = (s.dealerIndex + 1) % s.players.length;
    }

    // Heads-up positions:
    // dealerIndex = Button/SB
    // other = BB
    const sbIdx = s.dealerIndex;
    const bbIdx = (s.dealerIndex + 1) % s.players.length;

    // Post blinds
    const sbPlayer = s.players[sbIdx];
    const bbPlayer = s.players[bbIdx];

    const sbAmount = Math.min(s.smallBlind, sbPlayer.chips);
    sbPlayer.chips -= sbAmount;
    sbPlayer.bet = sbAmount;
    sbPlayer.totalBet = sbAmount;
    if (sbPlayer.chips === 0) sbPlayer.isAllIn = true;

    const bbAmount = Math.min(s.bigBlind, bbPlayer.chips);
    bbPlayer.chips -= bbAmount;
    bbPlayer.bet = bbAmount;
    bbPlayer.totalBet = bbAmount;
    if (bbPlayer.chips === 0) bbPlayer.isAllIn = true;

    s.pot = sbAmount + bbAmount;
    s.currentBet = bbAmount;

    // Deal hole cards (2 each)
    for (const p of s.players) {
      p.holeCards.push(s.deck.pop()!);
    }
    for (const p of s.players) {
      p.holeCards.push(s.deck.pop()!);
    }

    // Preflop: SB/Button acts first in heads-up
    // (BB already has the big blind posted, SB needs to act first)
    s.currentTurn = sbPlayer.isAllIn ? bbPlayer.id : sbPlayer.id;

    // If BOTH are all-in from blinds, go straight to showdown
    if (sbPlayer.isAllIn && bbPlayer.isAllIn) {
      return ArenaPokerEngine.runToShowdown(s);
    }

    return s;
  }

  /**
   * Run remaining community cards and resolve showdown.
   * Used when all players are all-in.
   */
  static runToShowdown(state: PokerState): PokerState {
    const s = JSON.parse(JSON.stringify(state)) as PokerState;

    // Deal remaining community cards
    while (s.communityCards.length < 5) {
      if (s.communityCards.length === 0) {
        // Flop: burn 1, deal 3
        s.burnt.push(s.deck.pop()!);
        s.communityCards.push(s.deck.pop()!, s.deck.pop()!, s.deck.pop()!);
      } else if (s.communityCards.length === 3) {
        // Turn: burn 1, deal 1
        s.burnt.push(s.deck.pop()!);
        s.communityCards.push(s.deck.pop()!);
      } else if (s.communityCards.length === 4) {
        // River: burn 1, deal 1
        s.burnt.push(s.deck.pop()!);
        s.communityCards.push(s.deck.pop()!);
      }
    }

    s.phase = 'showdown';
    return ArenaPokerEngine.resolveShowdown(s);
  }

  /**
   * Evaluate hands and award pot.
   */
  static resolveShowdown(state: PokerState): PokerState {
    const s = JSON.parse(JSON.stringify(state)) as PokerState;
    const activePlayers = s.players.filter(p => !p.folded);

    if (activePlayers.length === 1) {
      // Everyone else folded
      activePlayers[0].chips += s.pot;
      s.handHistory.push({
        handNumber: s.handNumber,
        winnerId: activePlayers[0].id,
        amount: s.pot,
        showdown: false,
        players: s.players.map(p => ({
          id: p.id,
          holeCards: p.holeCards,
          chipsAfter: p.chips + (p.id === activePlayers[0].id ? 0 : 0), // Already added
        })),
      });
    } else {
      // Evaluate each active player's hand
      const evals = activePlayers.map(p => {
        const allCards = [...p.holeCards, ...s.communityCards];
        const best = bestHand(allCards);
        return { player: p, ...best };
      });

      // Sort by hand strength (best first)
      evals.sort((a, b) => compareScores(b.score, a.score));

      // Check for split pot
      const bestScore = evals[0].score;
      const winners = evals.filter(e => compareScores(e.score, bestScore) === 0);

      if (winners.length === 1) {
        // Side pot calculation for unequal all-ins:
        // Short-stack can only win min(p1.totalBet, p2.totalBet) * 2
        const p1 = s.players[0];
        const p2 = s.players[1];
        const minTotalBet = Math.min(p1.totalBet, p2.totalBet);
        const mainPot = minTotalBet * 2;
        const sidePot = Math.abs(p1.totalBet - p2.totalBet);
        const winner = winners[0].player;
        const loser = s.players.find(p => p.id !== winner.id)!;

        // Winner always gets the main pot
        winner.chips += mainPot;

        // Side pot: if winner bet more (bigger stack), they get it back.
        // If winner bet less (short stack), the excess refunds to loser.
        if (winner.totalBet >= loser.totalBet) {
          // Winner was the bigger stack — they get the whole pot
          winner.chips += sidePot;
        } else {
          // Winner was the short stack — refund excess to loser
          loser.chips += sidePot;
        }

        s.handHistory.push({
          handNumber: s.handNumber,
          winnerId: winner.id,
          winnerHand: winners[0].name,
          amount: mainPot,
          showdown: true,
          players: evals.map(e => ({
            id: e.player.id,
            holeCards: e.player.holeCards,
            handRank: e.name,
            chipsAfter: e.player.chips,
          })),
        });
      } else {
        // Split pot
        const share = Math.floor(s.pot / winners.length);
        const remainder = s.pot - share * winners.length;
        winners.forEach((w, i) => {
          w.player.chips += share + (i === 0 ? remainder : 0); // First winner gets remainder
        });
        s.handHistory.push({
          handNumber: s.handNumber,
          winnerId: null, // split
          winnerHand: winners[0].name,
          amount: s.pot,
          showdown: true,
          players: evals.map(e => ({
            id: e.player.id,
            holeCards: e.player.holeCards,
            handRank: e.name,
            chipsAfter: e.player.chips,
          })),
        });
      }
    }

    s.pot = 0;
    s.phase = 'handComplete';
    s.handComplete = true;

    // Check if game is over
    const playersWithChips = s.players.filter(p => p.chips > 0);
    if (playersWithChips.length <= 1 || s.handNumber >= s.maxHands) {
      s.gameComplete = true;
      return s;
    }

    // Auto-deal next hand
    return ArenaPokerEngine.dealNewHand(s);
  }

  // ============================================
  // GameEngineAdapter interface
  // ============================================

  processAction(gameState: any, action: any): any {
    const state = gameState as PokerState;
    const s = JSON.parse(JSON.stringify(state)) as PokerState;
    const playerId = action.playerId;
    const playerIdx = s.players.findIndex(p => p.id === playerId);

    if (playerIdx === -1) {
      console.error(`[ArenaPoker] Player ${playerId} not found`);
      return s;
    }

    const player = s.players[playerIdx];
    const actionType = String(action.action).toLowerCase().trim();

    // Log the action
    s.actionLog.push({
      hand: s.handNumber,
      phase: s.phase,
      playerId,
      action: actionType,
      amount: action.amount,
    });

    // Mark player as having acted
    player.hasActed = true;

    switch (actionType) {
      case 'fold': {
        player.folded = true;
        // Award pot to the other player
        const otherPlayer = s.players.find(p => p.id !== playerId)!;
        otherPlayer.chips += s.pot;
        s.handHistory.push({
          handNumber: s.handNumber,
          winnerId: otherPlayer.id,
          amount: s.pot,
          showdown: false,
          players: s.players.map(p => ({
            id: p.id,
            holeCards: p.holeCards,
            chipsAfter: p.chips,
          })),
        });
        s.pot = 0;
        s.phase = 'handComplete';
        s.handComplete = true;

        // Check game completion or deal new hand
        const playersWithChips = s.players.filter(p => p.chips > 0);
        if (playersWithChips.length <= 1 || s.handNumber >= s.maxHands) {
          s.gameComplete = true;
          return s;
        }
        return ArenaPokerEngine.dealNewHand(s);
      }

      case 'check': {
        // Can only check if no bet to call
        if (player.bet < s.currentBet && !player.isAllIn) {
          // Invalid — treat as call
          return this.processAction(gameState, { ...action, action: 'call' });
        }
        break;
      }

      case 'call': {
        const toCall = Math.min(s.currentBet - player.bet, player.chips);
        if (toCall === 0) {
          // Nothing to call — treat as check
          break;
        }
        player.chips -= toCall;
        player.bet += toCall;
        player.totalBet += toCall;
        s.pot += toCall;
        if (player.chips === 0) player.isAllIn = true;
        break;
      }

      case 'raise':
      case 'bet': {
        let raiseAmount = action.amount;
        if (typeof raiseAmount !== 'number' || raiseAmount <= 0) {
          // Default raise: 2x current bet or big blind
          raiseAmount = Math.max(s.currentBet * 2, s.bigBlind * 2);
        }

        const toCall = s.currentBet - player.bet;
        const totalNeeded = toCall + Math.max(raiseAmount - s.currentBet, s.minRaise);
        const actualAmount = Math.min(totalNeeded, player.chips);

        player.chips -= actualAmount;
        player.bet += actualAmount;
        player.totalBet += actualAmount;
        s.pot += actualAmount;

        if (player.bet > s.currentBet) {
          s.minRaise = player.bet - s.currentBet; // Min raise = last raise size
          s.currentBet = player.bet;
          // Other players need to act again
          for (const p of s.players) {
            if (p.id !== playerId && !p.folded && !p.isAllIn) {
              p.hasActed = false;
            }
          }
        }

        if (player.chips === 0) player.isAllIn = true;
        break;
      }

      case 'all-in': {
        const allInAmount = player.chips;
        player.bet += allInAmount;
        player.totalBet += allInAmount;
        s.pot += allInAmount;
        player.chips = 0;
        player.isAllIn = true;

        if (player.bet > s.currentBet) {
          s.minRaise = player.bet - s.currentBet;
          s.currentBet = player.bet;
          for (const p of s.players) {
            if (p.id !== playerId && !p.folded && !p.isAllIn) {
              p.hasActed = false;
            }
          }
        }
        break;
      }

      default: {
        console.warn(`[ArenaPoker] Unknown action "${actionType}" from ${playerId}, treating as check`);
        break;
      }
    }

    // Check if betting round is complete
    if (this.isBettingRoundComplete(s)) {
      // Check if all active players are all-in → run to showdown
      const activePlayers = s.players.filter(p => !p.folded);
      const allAllIn = activePlayers.every(p => p.isAllIn);
      const oneActive = activePlayers.filter(p => !p.isAllIn).length <= 1;

      if (allAllIn || (oneActive && activePlayers.some(p => p.isAllIn))) {
        // Everyone (or all but one) is all-in — run out remaining cards
        return ArenaPokerEngine.runToShowdown(s);
      }

      // Advance to next phase
      return this.advancePhase(s);
    }

    // Move to next player's turn
    s.currentTurn = this.getNextPlayerToAct(s);
    return s;
  }

  getValidActions(gameState: any, playerId: string): any[] {
    const state = gameState as PokerState;
    const player = state.players.find(p => p.id === playerId);

    if (!player || player.folded || player.isAllIn || state.handComplete || state.gameComplete) {
      return [];
    }

    const toCall = state.currentBet - player.bet;
    const actions: string[] = [];

    // Can always fold
    actions.push('fold');

    if (toCall === 0) {
      actions.push('check');
    } else if (player.chips >= toCall) {
      actions.push('call');
    }

    // Can raise if they have chips beyond the call amount
    if (player.chips > toCall) {
      actions.push('raise');
    }

    // Can always go all-in if they have chips
    if (player.chips > 0) {
      actions.push('all-in');
    }

    return actions;
  }

  isGameComplete(gameState: any): boolean {
    const state = gameState as PokerState;
    return state.gameComplete;
  }

  getWinner(gameState: any): string | null {
    const state = gameState as PokerState;
    if (!state.gameComplete) return null;

    // Winner = player with most chips
    const sorted = [...state.players].sort((a, b) => b.chips - a.chips);
    if (sorted[0].chips === sorted[1].chips) return null; // Tie → draw
    return sorted[0].id;
  }

  getCurrentTurn(gameState: any): string | null {
    const state = gameState as PokerState;
    if (state.handComplete || state.gameComplete) return null;
    return state.currentTurn;
  }

  // ============================================
  // Internal helpers
  // ============================================

  private isBettingRoundComplete(state: PokerState): boolean {
    const activePlayers = state.players.filter(p => !p.folded && !p.isAllIn);

    // If no active players (all folded or all-in), round is complete
    if (activePlayers.length === 0) return true;

    // All active players must have acted and matched the current bet
    return activePlayers.every(p => p.hasActed && p.bet >= state.currentBet);
  }

  private getNextPlayerToAct(state: PokerState): string {
    const currentIdx = state.players.findIndex(p => p.id === state.currentTurn);

    for (let i = 1; i <= state.players.length; i++) {
      const idx = (currentIdx + i) % state.players.length;
      const p = state.players[idx];
      if (!p.folded && !p.isAllIn && (!p.hasActed || p.bet < state.currentBet)) {
        return p.id;
      }
    }

    // No one else needs to act — shouldn't reach here if isBettingRoundComplete is called first
    return state.currentTurn;
  }

  private advancePhase(state: PokerState): PokerState {
    const s = JSON.parse(JSON.stringify(state)) as PokerState;

    // Reset per-round state
    for (const p of s.players) {
      p.bet = 0;
      p.hasActed = false;
    }
    s.currentBet = 0;
    s.minRaise = s.bigBlind;

    // Post-flop: BB (non-dealer) acts first in heads-up
    const bbIdx = (s.dealerIndex + 1) % s.players.length;
    const sbIdx = s.dealerIndex;

    switch (s.phase) {
      case 'preflop': {
        // Deal flop: burn 1, deal 3
        s.burnt.push(s.deck.pop()!);
        s.communityCards.push(s.deck.pop()!, s.deck.pop()!, s.deck.pop()!);
        s.phase = 'flop';
        break;
      }
      case 'flop': {
        // Deal turn: burn 1, deal 1
        s.burnt.push(s.deck.pop()!);
        s.communityCards.push(s.deck.pop()!);
        s.phase = 'turn';
        break;
      }
      case 'turn': {
        // Deal river: burn 1, deal 1
        s.burnt.push(s.deck.pop()!);
        s.communityCards.push(s.deck.pop()!);
        s.phase = 'river';
        break;
      }
      case 'river': {
        // Showdown
        return ArenaPokerEngine.resolveShowdown(s);
      }
    }

    // Set current turn to first non-folded non-all-in player after dealer
    // In heads-up post-flop: BB acts first
    const firstActor = s.players[bbIdx];
    if (!firstActor.folded && !firstActor.isAllIn) {
      s.currentTurn = firstActor.id;
    } else {
      s.currentTurn = s.players[sbIdx].id;
    }

    return s;
  }
}

// ============================================
// Exports for testing
// ============================================
export { evaluateHand, bestHand, compareScores, createShuffledDeck, HAND_NAMES };
