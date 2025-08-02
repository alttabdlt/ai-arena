import { BaseGameEngine } from '../../../base/BaseGameEngine';
import { IGamePlayer, IGameValidationResult } from '../../../core/interfaces';
import { IGameContext } from '../../../core/context';
import { PokerGameState, PokerAction, PokerPlayer, Card, Suit, Rank, PokerPhase } from '../PokerTypes';
import * as pokersolver from 'pokersolver';

export class PokerGameEngine extends BaseGameEngine<PokerGameState, PokerAction> {
  private readonly Hand: typeof pokersolver.Hand;
  private smallBlind: number;
  private bigBlind: number;

  constructor(context: IGameContext, smallBlind: number = 50, bigBlind: number = 100) {
    super(context);
    this.Hand = pokersolver.Hand;
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;
  }

  protected createInitialState(players: IGamePlayer[]): PokerGameState {
    const pokerPlayers: PokerPlayer[] = players.map((player, index) => ({
      ...player,
      chips: (player as any).chips || 0,  // Use chips from player if available
      cards: [],
      bet: 0,
      folded: false,
      allIn: false,
      position: index,
      hasActed: false,
      seatPosition: index
    }));

    // Ensure button positions are valid for the number of players
    const dealerPos = 0;
    const smallBlindPos = players.length === 2 ? 1 : 1;
    const bigBlindPos = players.length === 2 ? 0 : (players.length > 2 ? 2 : 1);

    return {
      gameId: this.context.gameId,
      phase: 'waiting',
      startTime: new Date(),
      turnCount: 0,
      players: pokerPlayers,
      currentTurn: undefined,
      currentPlayerIndex: 0,
      communityCards: [],
      pot: 0,
      currentBet: 0,
      minRaise: this.bigBlind,
      dealerPosition: dealerPos,
      smallBlindPosition: smallBlindPos,
      bigBlindPosition: bigBlindPos,
      deck: [],
      sidePots: [],
      winners: [],
      isHandComplete: false,
      handNumber: 0,
      blindLevel: 1,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      playerHands: new Map(),
      discardPile: []
    };
  }

  startNewHand(startingChips?: number): void {
    if (this.state.players.length < 2) {
      throw new Error('Need at least 2 players to start');
    }

    this.state.handNumber++;
    this.state.deck = this.createDeck();
    this.state.communityCards = [];
    this.state.pot = 0;
    this.state.currentBet = 0;
    this.state.minRaise = this.bigBlind;
    this.state.sidePots = [];
    this.state.winners = [];
    this.state.isHandComplete = false;

    this.moveButtons();
    this.resetPlayers(startingChips);
    this.postBlinds();
    this.dealHoleCards();

    this.state.currentPlayerIndex = this.getFirstToAct();
    this.state.currentTurn = this.state.players[this.state.currentPlayerIndex].id;
    this.state.phase = 'preflop';

    this.context.eventBus.emit({
      type: 'hand:started',
      timestamp: new Date(),
      data: { handNumber: this.state.handNumber, phase: 'preflop' }
    });
  }

  protected applyAction(action: PokerAction): void {
    const player = this.state.players.find(p => p.id === action.playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    switch (action.type) {
      case 'fold':
        this.handleFold(player);
        break;
      case 'check':
        this.handleCheck(player);
        break;
      case 'call':
        this.handleCall(player);
        break;
      case 'bet':
        if (action.amount === undefined) {
          throw new Error('Bet amount required');
        }
        this.handleBet(player, action.amount);
        break;
      case 'raise':
        if (action.amount === undefined) {
          throw new Error('Raise amount required');
        }
        this.handleRaise(player, action.amount);
        break;
      case 'all-in':
        this.handleAllIn(player);
        break;
    }

    player.hasActed = true;
    this.checkForPhaseEnd();
  }

  protected validateGameSpecificAction(action: PokerAction): IGameValidationResult {
    const errors: string[] = [];
    const player = this.state.players.find(p => p.id === action.playerId);
    
    if (!player) {
      errors.push('Player not found');
      return { isValid: false, errors };
    }

    if (player.folded) {
      errors.push('Player has folded');
    }

    switch (action.type) {
      case 'check':
        if (this.state.currentBet > player.bet) {
          errors.push('Cannot check when there is a bet');
        }
        break;
      case 'call':
        if (this.state.currentBet === player.bet) {
          errors.push('Nothing to call');
        }
        break;
      case 'bet':
        if (this.state.currentBet > 0) {
          errors.push('Cannot bet when there is already a bet');
        }
        if (action.amount !== undefined && action.amount < this.bigBlind) {
          errors.push('Bet must be at least big blind');
        }
        break;
      case 'raise':
        if (this.state.currentBet === 0) {
          errors.push('Nothing to raise');
        }
        if (action.amount !== undefined && action.amount < this.state.minRaise) {
          errors.push(`Raise must be at least ${this.state.minRaise}`);
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  getValidActions(playerId: string): PokerAction[] {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player || player.folded || this.state.currentTurn !== playerId) {
      if (player && !player.folded && this.state.currentTurn !== playerId) {
        this.context.logger.warn('Player attempted action out of turn', {
          playerId,
          currentTurn: this.state.currentTurn,
          phase: this.state.phase
        });
      }
      return [];
    }

    const actions: PokerAction[] = [
      { playerId, type: 'fold', timestamp: new Date() }
    ];

    const callAmount = this.state.currentBet - player.bet;

    if (callAmount === 0) {
      actions.push({ playerId, type: 'check', timestamp: new Date() });
    } else if (player.chips >= callAmount) {
      actions.push({ playerId, type: 'call', timestamp: new Date() });
    }

    if (this.state.currentBet === 0 && player.chips >= this.bigBlind) {
      actions.push({ 
        playerId, 
        type: 'bet', 
        amount: this.bigBlind,
        timestamp: new Date() 
      });
    }

    if (this.state.currentBet > 0 && player.chips > callAmount) {
      actions.push({ 
        playerId, 
        type: 'raise', 
        amount: this.state.minRaise,
        timestamp: new Date() 
      });
    }

    if (player.chips > 0) {
      actions.push({ playerId, type: 'all-in', timestamp: new Date() });
    }

    return actions;
  }

  isGameOver(): boolean {
    const activePlayers = this.state.players.filter(p => p.chips > 0);
    return activePlayers.length < 2;
  }

  getWinners(): string[] {
    const activePlayers = this.state.players.filter(p => p.chips > 0);
    if (activePlayers.length === 1) {
      return [activePlayers[0].id];
    }
    return this.state.winners.map(w => w.playerId);
  }

  protected cloneState(state: PokerGameState): PokerGameState {
    return {
      ...state,
      players: state.players.map(p => ({ ...p, cards: [...p.cards] })),
      communityCards: [...state.communityCards],
      deck: [...state.deck],
      sidePots: state.sidePots.map(sp => ({ ...sp })),
      winners: state.winners.map(w => ({ ...w })),
      playerHands: new Map(state.playerHands),
      discardPile: [...state.discardPile]
    };
  }

  protected getGameDefinition() {
    return { minPlayers: 2, maxPlayers: 8 };
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

    return this.context.randomizer.shuffle(deck);
  }

  private moveButtons(): void {
    const activePlayers = this.state.players.filter(p => p.chips > 0);
    if (activePlayers.length < 2) return;

    // Move dealer button to next active player
    this.state.dealerPosition = (this.state.dealerPosition + 1) % this.state.players.length;
    while (this.state.players[this.state.dealerPosition].chips === 0) {
      this.state.dealerPosition = (this.state.dealerPosition + 1) % this.state.players.length;
    }

    // In heads-up (2 players), dealer is small blind
    if (activePlayers.length === 2) {
      this.state.smallBlindPosition = this.state.dealerPosition;
      this.state.bigBlindPosition = this.getNextActivePosition(this.state.dealerPosition);
    } else {
      this.state.smallBlindPosition = this.getNextActivePosition(this.state.dealerPosition);
      this.state.bigBlindPosition = this.getNextActivePosition(this.state.smallBlindPosition);
    }
  }

  private getNextActivePosition(currentPosition: number): number {
    let position = (currentPosition + 1) % this.state.players.length;
    while (this.state.players[position].chips === 0) {
      position = (position + 1) % this.state.players.length;
    }
    return position;
  }

  private resetPlayers(startingChips?: number): void {
    this.state.players.forEach(player => {
      if (startingChips !== undefined && player.chips === 0) {
        player.chips = startingChips;
      }
      player.cards = [];
      player.bet = 0;
      // Only fold players who have no chips
      player.folded = player.chips === 0;
      player.allIn = false;
      player.hasActed = false;
    });
  }

  private postBlinds(): void {
    const smallBlindPlayer = this.state.players[this.state.smallBlindPosition];
    const bigBlindPlayer = this.state.players[this.state.bigBlindPosition];

    const smallBlindAmount = Math.min(this.smallBlind, smallBlindPlayer.chips);
    smallBlindPlayer.chips -= smallBlindAmount;
    smallBlindPlayer.bet = smallBlindAmount;
    this.state.pot += smallBlindAmount;
    if (smallBlindPlayer.chips === 0) {
      smallBlindPlayer.allIn = true;
    }

    const bigBlindAmount = Math.min(this.bigBlind, bigBlindPlayer.chips);
    bigBlindPlayer.chips -= bigBlindAmount;
    bigBlindPlayer.bet = bigBlindAmount;
    this.state.pot += bigBlindAmount;
    this.state.currentBet = bigBlindAmount;
    if (bigBlindPlayer.chips === 0) {
      bigBlindPlayer.allIn = true;
    }
  }

  private dealHoleCards(): void {
    for (let i = 0; i < 2; i++) {
      this.state.players.forEach(player => {
        if (!player.folded) {
          const card = this.state.deck.pop()!;
          player.cards.push(card);
        }
      });
    }
  }

  private getFirstToAct(): number {
    if (this.state.phase === 'preflop') {
      return this.getNextActivePosition(this.state.bigBlindPosition);
    } else {
      return this.getNextActivePosition(this.state.dealerPosition);
    }
  }

  private handleFold(player: PokerPlayer): void {
    player.folded = true;
    this.state.discardPile.push(...player.cards);
    player.cards = [];
  }

  private handleCheck(player: PokerPlayer): void {
    // Nothing to do
  }

  private handleCall(player: PokerPlayer): void {
    const callAmount = Math.min(this.state.currentBet - player.bet, player.chips);
    player.chips -= callAmount;
    player.bet += callAmount;
    this.state.pot += callAmount;
    
    if (player.chips === 0) {
      player.allIn = true;
    }
  }

  private handleBet(player: PokerPlayer, amount: number): void {
    const betAmount = Math.min(amount, player.chips);
    player.chips -= betAmount;
    player.bet = betAmount;
    this.state.pot += betAmount;
    this.state.currentBet = betAmount;
    this.state.minRaise = betAmount * 2;
    
    if (player.chips === 0) {
      player.allIn = true;
    }
  }

  private handleRaise(player: PokerPlayer, amount: number): void {
    const totalBet = this.state.currentBet + amount;
    const raiseAmount = Math.min(totalBet - player.bet, player.chips);
    player.chips -= raiseAmount;
    player.bet += raiseAmount;
    this.state.pot += raiseAmount;
    
    if (player.bet > this.state.currentBet) {
      this.state.minRaise = player.bet - this.state.currentBet;
      this.state.currentBet = player.bet;
    }
    
    if (player.chips === 0) {
      player.allIn = true;
    }
  }

  private handleAllIn(player: PokerPlayer): void {
    const allInAmount = player.chips;
    player.chips = 0;
    player.bet += allInAmount;
    this.state.pot += allInAmount;
    player.allIn = true;
    
    if (player.bet > this.state.currentBet) {
      this.state.minRaise = player.bet - this.state.currentBet;
      this.state.currentBet = player.bet;
    }
  }

  private checkForPhaseEnd(): void {
    const activePlayers = this.state.players.filter(p => !p.folded);
    
    if (activePlayers.length === 1) {
      this.handleHandEnd();
      return;
    }

    const needToAct = activePlayers.filter(p => !p.allIn && (!p.hasActed || p.bet < this.state.currentBet));
    
    if (needToAct.length === 0) {
      this.moveToNextPhase();
    } else {
      // Double-check that we can find a valid next player before proceeding
      const validNextPlayer = this.findNextValidPlayer();
      if (validNextPlayer === null) {
        this.context.logger.warn('No valid next player found, moving to next phase');
        this.moveToNextPhase();
      } else {
        this.moveToNextPlayer();
      }
    }
  }

  private findNextValidPlayer(): number | null {
    let nextIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;
    let attempts = 0;
    
    while (attempts < this.state.players.length) {
      const player = this.state.players[nextIndex];
      
      if (!player.folded && !player.allIn && 
          (!player.hasActed || player.bet < this.state.currentBet)) {
        return nextIndex;
      }
      
      nextIndex = (nextIndex + 1) % this.state.players.length;
      attempts++;
    }
    
    return null;
  }

  private moveToNextPlayer(): void {
    const activePlayers = this.state.players.filter(p => !p.folded && !p.allIn);
    if (activePlayers.length === 0) {
      this.moveToNextPhase();
      return;
    }

    // Find players who still need to act
    const playersNeedingAction = this.state.players.filter(
      p => !p.folded && !p.allIn && (!p.hasActed || p.bet < this.state.currentBet)
    );
    
    if (playersNeedingAction.length === 0) {
      this.moveToNextPhase();
      return;
    }
    
    let nextIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;
    let attempts = 0;
    
    while (attempts < this.state.players.length) {
      const player = this.state.players[nextIndex];
      
      // Check if this player needs to act
      if (!player.folded && !player.allIn && 
          (!player.hasActed || player.bet < this.state.currentBet)) {
        this.state.currentPlayerIndex = nextIndex;
        this.state.currentTurn = player.id;
        console.log('Next turn assigned to:', {
          playerId: player.id,
          playerName: player.name,
          hasActed: player.hasActed,
          bet: player.bet,
          currentBet: this.state.currentBet
        });
        return;
      }
      
      nextIndex = (nextIndex + 1) % this.state.players.length;
      attempts++;
    }
    
    // If we've checked all players and none need to act, move to next phase
    this.context.logger.warn('No valid next player found after checking all players');
    this.moveToNextPhase();
  }

  private moveToNextPhase(): void {
    this.calculateSidePots();
    this.resetBettingRound();

    // Clear current turn during phase transition to prevent invalid turn assignments
    this.state.currentTurn = undefined;

    switch (this.state.phase) {
      case 'preflop':
        this.dealCommunityCards(3);
        this.state.phase = 'flop';
        break;
      case 'flop':
        this.dealCommunityCards(1);
        this.state.phase = 'turn';
        break;
      case 'turn':
        this.dealCommunityCards(1);
        this.state.phase = 'river';
        break;
      case 'river':
        this.state.phase = 'showdown';
        this.handleHandEnd();
        return;
    }

    const activePlayers = this.state.players.filter(p => !p.folded && !p.allIn);
    if (activePlayers.length <= 1) {
      this.handleHandEnd();
    } else {
      const firstToActIndex = this.getFirstToAct();
      const firstToActPlayer = this.state.players[firstToActIndex];
      
      // Ensure we don't assign turn to a folded player
      if (!firstToActPlayer.folded && !firstToActPlayer.allIn) {
        this.state.currentPlayerIndex = firstToActIndex;
        this.state.currentTurn = firstToActPlayer.id;
      } else {
        // If first to act is folded/all-in, find next valid player
        this.moveToNextPlayer();
      }
    }
  }

  private dealCommunityCards(count: number): void {
    for (let i = 0; i < count; i++) {
      this.state.communityCards.push(this.state.deck.pop()!);
    }
  }

  private resetBettingRound(): void {
    this.state.players.forEach(player => {
      player.bet = 0;
      player.hasActed = false;
    });
    this.state.currentBet = 0;
    this.state.minRaise = this.bigBlind;
  }

  private calculateSidePots(): void {
    const players = this.state.players.filter(p => !p.folded && p.bet > 0);
    if (players.length === 0) return;

    players.sort((a, b) => a.bet - b.bet);

    let previousBet = 0;
    for (const player of players) {
      if (player.bet > previousBet) {
        const potAmount = (player.bet - previousBet) * players.filter(p => p.bet >= player.bet).length;
        if (potAmount > 0) {
          this.state.sidePots.push({
            amount: potAmount,
            eligiblePlayers: players.filter(p => p.bet >= player.bet).map(p => p.id)
          });
        }
        previousBet = player.bet;
      }
    }
  }

  private handleHandEnd(): void {
    this.state.phase = 'showdown';
    const winners = this.determineWinners();
    this.state.winners = winners;
    this.distributePots(winners);
    this.state.isHandComplete = true;
    this.state.currentTurn = undefined;

    this.context.eventBus.emit({
      type: 'hand:completed',
      timestamp: new Date(),
      data: { 
        winners,
        handNumber: this.state.handNumber,
        phase: 'showdown'
      }
    });
  }

  private determineWinners(): { playerId: string; amount: number; hand?: string; handRank?: number; }[] {
    const activePlayers = this.state.players.filter(p => !p.folded);
    if (activePlayers.length === 1) {
      return [{
        playerId: activePlayers[0].id,
        amount: this.state.pot,
        hand: 'Won by default'
      }];
    }

    const playerHands = activePlayers.map(player => {
      const cards = [...player.cards, ...this.state.communityCards];
      const hand = this.Hand.solve(cards.map(c => this.convertCardFormat(c)));
      return { player, hand };
    });

    const winners = this.Hand.winners(playerHands.map(ph => ph.hand));
    
    return winners.map((winningHand: any) => {
      const playerHand = playerHands.find(ph => ph.hand === winningHand);
      return {
        playerId: playerHand!.player.id,
        amount: 0,
        hand: winningHand.descr,
        handRank: winningHand.rank
      };
    });
  }

  private distributePots(winners: { playerId: string; amount: number; }[]): void {
    if (this.state.sidePots.length > 0) {
      for (const sidePot of this.state.sidePots) {
        const potWinners = winners.filter(w => sidePot.eligiblePlayers.includes(w.playerId));
        if (potWinners.length > 0) {
          const amountPerWinner = Math.floor(sidePot.amount / potWinners.length);
          potWinners.forEach(winner => {
            winner.amount += amountPerWinner;
            const player = this.state.players.find(p => p.id === winner.playerId)!;
            player.chips += amountPerWinner;
          });
        }
      }
    } else {
      const amountPerWinner = Math.floor(this.state.pot / winners.length);
      winners.forEach(winner => {
        winner.amount = amountPerWinner;
        const player = this.state.players.find(p => p.id === winner.playerId)!;
        player.chips += amountPerWinner;
      });
    }
  }

  private convertCardFormat(card: Card): string {
    const rank = card[0];
    const suit = card[1];
    const suitMap: Record<string, string> = {
      '♠': 's',
      '♥': 'h',
      '♦': 'd',
      '♣': 'c'
    };
    return rank + suitMap[suit];
  }

  protected advanceTurn(): void {
    // Override base class advanceTurn to do nothing
    // PokerGameEngine manages turns through checkForPhaseEnd()
    // which is called from applyAction after each action
  }
}