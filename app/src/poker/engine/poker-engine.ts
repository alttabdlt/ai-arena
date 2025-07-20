export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
export type Card = `${Rank}${Suit}`;

export type ActionType = 'check' | 'call' | 'bet' | 'raise' | 'fold' | 'all-in';

export interface PlayerAction {
  type: ActionType;
  amount?: number;
}

export interface Player {
  id: string;
  name: string;
  chips: number;
  cards: Card[];
  bet: number;
  folded: boolean;
  allIn: boolean;
  position: number;
  hasActed: boolean;
}

export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface PokerGameState {
  players: Player[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  minRaise: number;
  dealerPosition: number;
  smallBlindPosition: number;
  bigBlindPosition: number;
  currentPlayerIndex: number;
  phase: GamePhase;
  deck: Card[];
  sidePots: { amount: number; eligiblePlayers: string[] }[];
  winners: { playerId: string; amount: number; hand?: string }[];
  isHandComplete: boolean;
}

// Import pokersolver at the top of the file
import * as pokersolver from 'pokersolver';

export class PokerEngine {
  private state: PokerGameState;
  private readonly SMALL_BLIND = 50;
  private readonly BIG_BLIND = 100;
  private Hand: typeof pokersolver.Hand;

  constructor() {
    this.Hand = pokersolver.Hand;
    
    this.state = {
      players: [],
      communityCards: [],
      pot: 0,
      currentBet: 0,
      minRaise: this.BIG_BLIND,
      dealerPosition: 0,
      smallBlindPosition: 1,
      bigBlindPosition: 2,
      currentPlayerIndex: 0,
      phase: 'waiting',
      deck: [],
      sidePots: [],
      winners: [],
      isHandComplete: false
    };
  }

  getState(): PokerGameState {
    return {
      ...this.state,
      players: this.state.players.map(p => ({ ...p })),
      communityCards: [...this.state.communityCards],
      deck: [...this.state.deck],
      sidePots: this.state.sidePots.map(sp => ({ ...sp })),
      winners: this.state.winners.map(w => ({ ...w }))
    };
  }

  addPlayer(id: string, name: string, chips: number, position: number): void {
    if (this.state.phase !== 'waiting') {
      throw new Error('Cannot add players during active hand');
    }

    this.state.players.push({
      id,
      name,
      chips,
      cards: [],
      bet: 0,
      folded: false,
      allIn: false,
      position,
      hasActed: false
    });
  }

  private createDeck(): Card[] {
    const suits: Suit[] = ['♠', '♥', '♦', '♣'];
    const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
    const deck: Card[] = [];

    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push(`${rank}${suit}` as Card);
      }
    }

    return this.shuffleDeck(deck);
  }

  private shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  startNewHand(): void {
    if (this.state.players.length < 2) {
      throw new Error('Need at least 2 players to start');
    }

    // Reset for new hand
    this.state.deck = this.createDeck();
    this.state.communityCards = [];
    this.state.pot = 0;
    this.state.currentBet = 0;
    this.state.minRaise = this.BIG_BLIND;
    this.state.sidePots = [];
    this.state.winners = [];
    this.state.isHandComplete = false;

    // Move dealer button
    this.state.dealerPosition = (this.state.dealerPosition + 1) % this.state.players.length;
    this.state.smallBlindPosition = (this.state.dealerPosition + 1) % this.state.players.length;
    this.state.bigBlindPosition = (this.state.dealerPosition + 2) % this.state.players.length;

    // Reset players
    this.state.players.forEach(player => {
      player.cards = [];
      player.bet = 0;
      player.folded = false;
      player.allIn = false;
      player.hasActed = false;
    });

    // Post blinds
    this.postBlinds();

    // Deal cards
    this.dealHoleCards();

    // Set current player (first to act after big blind)
    this.state.currentPlayerIndex = (this.state.bigBlindPosition + 1) % this.state.players.length;
    this.state.phase = 'preflop';
  }

  private postBlinds(): void {
    const smallBlindPlayer = this.state.players[this.state.smallBlindPosition];
    const bigBlindPlayer = this.state.players[this.state.bigBlindPosition];

    // Post small blind
    const smallBlindAmount = Math.min(this.SMALL_BLIND, smallBlindPlayer.chips);
    smallBlindPlayer.chips -= smallBlindAmount;
    smallBlindPlayer.bet = smallBlindAmount;
    this.state.pot += smallBlindAmount;

    // Post big blind
    const bigBlindAmount = Math.min(this.BIG_BLIND, bigBlindPlayer.chips);
    bigBlindPlayer.chips -= bigBlindAmount;
    bigBlindPlayer.bet = bigBlindAmount;
    this.state.pot += bigBlindAmount;
    this.state.currentBet = bigBlindAmount;
  }

  private dealHoleCards(): void {
    // Deal 2 cards to each player
    for (let i = 0; i < 2; i++) {
      this.state.players.forEach(player => {
        if (!player.folded) {
          player.cards.push(this.state.deck.pop()!);
        }
      });
    }
  }

  private dealCommunityCards(count: number): void {
    for (let i = 0; i < count; i++) {
      this.state.communityCards.push(this.state.deck.pop()!);
    }
  }

  getCurrentPlayer(): Player | null {
    if (this.state.isHandComplete) return null;
    return this.state.players[this.state.currentPlayerIndex];
  }

  getValidActions(playerId: string): ActionType[] {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player || player.folded || player.allIn || this.state.isHandComplete) {
      return [];
    }

    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer?.id !== playerId) {
      return [];
    }

    const actions: ActionType[] = ['fold'];
    const callAmount = this.state.currentBet - player.bet;

    if (callAmount === 0) {
      actions.push('check');
    } else if (callAmount > 0 && player.chips > 0) {
      actions.push('call');
    }

    if (player.chips > callAmount) {
      if (this.state.currentBet === 0) {
        actions.push('bet');
      } else {
        actions.push('raise');
      }
    }

    if (player.chips > 0 && player.chips <= callAmount) {
      actions.push('all-in');
    }

    return actions;
  }

  executeAction(playerId: string, action: PlayerAction): void {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player || player.folded || player.allIn) return;

    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer?.id !== playerId) return;

    switch (action.type) {
      case 'fold':
        player.folded = true;
        break;

      case 'check':
        // Player checked - no betting action but still acted
        break;

      case 'call': {
        const callAmount = Math.min(this.state.currentBet - player.bet, player.chips);
        player.chips -= callAmount;
        player.bet += callAmount;
        this.state.pot += callAmount;
        if (player.chips === 0) player.allIn = true;
        // Store the call amount in the action for tracking
        if (action.amount === undefined) {
          action.amount = callAmount;
        }
        break;
      }

      case 'bet':
      case 'raise': {
        const raiseAmount = action.amount || this.state.minRaise;
        const totalBet = this.state.currentBet + raiseAmount;
        const playerBetAmount = Math.min(totalBet - player.bet, player.chips);
        
        player.chips -= playerBetAmount;
        player.bet += playerBetAmount;
        this.state.pot += playerBetAmount;
        
        if (player.chips === 0) player.allIn = true;
        
        this.state.currentBet = player.bet;
        this.state.minRaise = raiseAmount;
        
        // Reset hasActed for other players when someone raises
        this.state.players.forEach(p => {
          if (p.id !== playerId && !p.folded && !p.allIn) {
            p.hasActed = false;
          }
        });
        break;
      }

      case 'all-in': {
        this.state.pot += player.chips;
        player.bet += player.chips;
        player.chips = 0;
        player.allIn = true;
        
        if (player.bet > this.state.currentBet) {
          this.state.currentBet = player.bet;
          this.state.minRaise = player.bet - this.state.currentBet;
          
          // Reset hasActed for other players
          this.state.players.forEach(p => {
            if (p.id !== playerId && !p.folded && !p.allIn) {
              p.hasActed = false;
            }
          });
        }
        break;
      }
    }

    player.hasActed = true;
    this.moveToNextPlayer();
  }

  private moveToNextPlayer(): void {
    const activePlayers = this.state.players.filter(p => !p.folded && !p.allIn);
    
    // Check if betting round is complete
    const allPlayersActed = this.state.players
      .filter(p => !p.folded && !p.allIn)
      .every(p => p.hasActed && p.bet === this.state.currentBet);

    // Special case for pre-flop: Big blind gets option even if everyone called
    const bigBlindPlayer = this.state.players[this.state.bigBlindPosition];
    const isBigBlindOption = this.state.phase === 'preflop' && 
                           !bigBlindPlayer.hasActed && 
                           !bigBlindPlayer.folded && 
                           !bigBlindPlayer.allIn &&
                           this.state.currentBet === this.BIG_BLIND;

    if ((allPlayersActed && !isBigBlindOption) || activePlayers.length <= 1) {
      this.endBettingRound();
    } else {
      // Find next active player
      let nextIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;
      while (this.state.players[nextIndex].folded || this.state.players[nextIndex].allIn) {
        nextIndex = (nextIndex + 1) % this.state.players.length;
      }
      this.state.currentPlayerIndex = nextIndex;
    }
  }

  private endBettingRound(): void {
    // Reset player bets and hasActed for next round
    this.state.players.forEach(player => {
      player.bet = 0;
      player.hasActed = false;
    });
    this.state.currentBet = 0;
    this.state.minRaise = this.BIG_BLIND;

    // Check if hand should end (only one player left)
    const activePlayers = this.state.players.filter(p => !p.folded);
    if (activePlayers.length === 1) {
      this.endHand();
      return;
    }

    // Move to next phase
    switch (this.state.phase) {
      case 'preflop':
        this.state.phase = 'flop';
        this.dealCommunityCards(3);
        break;
      case 'flop':
        this.state.phase = 'turn';
        this.dealCommunityCards(1);
        break;
      case 'turn':
        this.state.phase = 'river';
        this.dealCommunityCards(1);
        break;
      case 'river':
        this.state.phase = 'showdown';
        this.endHand();
        return;
    }

    // Set first player to act (first active player after dealer)
    let nextIndex = (this.state.dealerPosition + 1) % this.state.players.length;
    while (this.state.players[nextIndex].folded || this.state.players[nextIndex].allIn) {
      nextIndex = (nextIndex + 1) % this.state.players.length;
      if (nextIndex === this.state.dealerPosition) break; // Prevent infinite loop
    }
    this.state.currentPlayerIndex = nextIndex;
  }

  private endHand(): void {
    const activePlayers = this.state.players.filter(p => !p.folded);
    
    if (activePlayers.length === 1) {
      // Only one player left, they win
      this.state.winners = [{
        playerId: activePlayers[0].id,
        amount: this.state.pot
      }];
      activePlayers[0].chips += this.state.pot;
    } else {
      // Showdown - evaluate hands
      const playerHands = activePlayers.map(player => {
        const cards = [...player.cards, ...this.state.communityCards];
        const cardStrings = cards.map(card => {
          // Convert our format to pokersolver format (e.g., "A♠" -> "As")
          const rank = card[0];
          const suit = card[1];
          const suitMap: { [key: string]: string } = {
            '♠': 's',
            '♥': 'h',
            '♦': 'd',
            '♣': 'c'
          };
          return `${rank}${suitMap[suit]}`;
        });
        
        return {
          player,
          hand: this.Hand.solve(cardStrings)
        };
      });

      // Find winners
      const winningHands = this.Hand.winners(playerHands.map(ph => ph.hand));
      const winners = playerHands.filter(ph => winningHands.includes(ph.hand));
      
      // Split pot among winners
      const winAmount = Math.floor(this.state.pot / winners.length);
      this.state.winners = winners.map(w => {
        w.player.chips += winAmount;
        return {
          playerId: w.player.id,
          amount: winAmount,
          hand: w.hand.descr
        };
      });
    }

    this.state.isHandComplete = true;
    this.state.phase = 'waiting';
  }

  resetForNewHand(): void {
    // Remove players with no chips
    this.state.players = this.state.players.filter(p => p.chips > 0);
    
    if (this.state.players.length >= 2) {
      this.startNewHand();
    }
  }
}