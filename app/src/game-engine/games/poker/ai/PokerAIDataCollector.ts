import { BaseGameDataCollector, NeutralGameData, GameHistoryEntry } from '../../../ai/AIDataCollector';
import { PokerGameState, PokerPlayer, Card } from '../PokerTypes';
import { IGamePlayer } from '../../../core/interfaces';

export interface PokerNeutralData extends NeutralGameData {
  gameSpecific: {
    phase: string;
    communityCards: string[];
    pot: number;
    currentBet: number;
    minRaise: number;
    positions: {
      dealer: number;
      smallBlind: number;
      bigBlind: number;
    };
    handNumber: number;
    blindLevel: number;
    sidePots: Array<{
      amount: number;
      eligibleCount: number;
    }>;
  };
}

export interface PokerPlayerData {
  cards: string[];
  chips: number;
  bet: number;
  folded: boolean;
  allIn: boolean;
  hasActed: boolean;
  investedThisHand: number;
  position: string;
  seatNumber: number;
}

export class PokerAIDataCollector extends BaseGameDataCollector<PokerGameState> {
  constructor() {
    super();
    this.obfuscateHiddenInfo = true;
  }

  getGameType(): string {
    return 'poker';
  }

  collectGameSpecificData(state: PokerGameState, playerId: string): Record<string, any> {
    const player = state.players.find(p => p.id === playerId) as PokerPlayer;
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    const amountToCall = Math.max(0, state.currentBet - player.bet);
    const potOdds = this.calculatePotOdds(state.pot, amountToCall);
    const stackToPotRatio = state.pot > 0 ? player.chips / state.pot : 0;

    return {
      phase: state.phase,
      communityCards: this.convertCardsForAI(state.communityCards),
      pot: state.pot,
      currentBet: state.currentBet,
      minRaise: state.minRaise,
      positions: {
        dealer: state.dealerPosition,
        smallBlind: state.smallBlindPosition,
        bigBlind: state.bigBlindPosition
      },
      handNumber: state.handNumber,
      blindLevel: state.blindLevel,
      sidePots: state.sidePots.map(sp => ({
        amount: sp.amount,
        eligiblePlayers: sp.eligiblePlayers
      })),
      playerSpecific: {
        holeCards: this.convertCardsForAI(player.cards),
        amountToCall,
        potOdds,
        stackToPotRatio,
        positionName: this.getPositionName(player.position, state),
        positionType: this.getPositionType(player.position, state),
        investedThisHand: this.calculateInvestedThisHand(player, state)
      }
    };
  }

  getPlayerSpecificData(player: IGamePlayer, state: PokerGameState): {
    position?: number;
    resources?: Record<string, any>;
  } {
    const pokerPlayer = player as PokerPlayer;
    
    return {
      position: pokerPlayer.position,
      resources: {
        chips: pokerPlayer.chips,
        bet: pokerPlayer.bet,
        folded: pokerPlayer.folded,
        allIn: pokerPlayer.allIn,
        hasActed: pokerPlayer.hasActed,
        investedThisHand: this.calculateInvestedThisHand(pokerPlayer, state),
        stackSize: this.categorizeStackSize(pokerPlayer.chips, state),
        isActive: !pokerPlayer.folded && pokerPlayer.chips > 0
      }
    };
  }

  obfuscateHiddenInformation(data: Record<string, any>, playerId: string): Record<string, any> {
    const obfuscated = { ...data };
    
    if (data.playerSpecific) {
      obfuscated.playerSpecific = { ...data.playerSpecific };
    }

    return obfuscated;
  }

  obfuscatePlayerResources(
    resources: Record<string, any>,
    resourceOwnerId: string,
    viewerId: string
  ): Record<string, any> {
    if (resourceOwnerId === viewerId) {
      return resources;
    }

    const obfuscated = { ...resources };
    delete obfuscated.cards;
    
    return obfuscated;
  }

  collectHistory(state: PokerGameState, playerId: string): GameHistoryEntry[] {
    return [];
  }

  private convertCardsForAI(cards: Card[]): string[] {
    return cards.map(card => {
      const rank = card[0];
      const suit = card[1];
      const suitMap: Record<string, string> = {
        '♠': 's',
        '♥': 'h', 
        '♦': 'd',
        '♣': 'c'
      };
      return rank + suitMap[suit];
    });
  }

  private calculatePotOdds(pot: number, amountToCall: number): number {
    if (amountToCall === 0) return 0;
    return amountToCall / (pot + amountToCall);
  }

  private calculateInvestedThisHand(player: PokerPlayer, state: PokerGameState): number {
    let invested = player.bet;
    
    if (state.phase !== 'preflop' && state.sidePots.length > 0) {
      for (const sidePot of state.sidePots) {
        if (sidePot.eligiblePlayers.includes(player.id)) {
          invested += sidePot.amount / sidePot.eligiblePlayers.length;
        }
      }
    }
    
    return invested;
  }

  private getPositionName(position: number, state: PokerGameState): string {
    if (position === state.dealerPosition) return 'BTN';
    if (position === state.smallBlindPosition) return 'SB';
    if (position === state.bigBlindPosition) return 'BB';
    
    const activePlayers = state.players.filter(p => !p.folded);
    const dealerIndex = activePlayers.findIndex(p => p.position === state.dealerPosition);
    const playerIndex = activePlayers.findIndex(p => p.position === position);
    
    const positionsFromDealer = (playerIndex - dealerIndex + activePlayers.length) % activePlayers.length;
    const positionsFromEnd = activePlayers.length - positionsFromDealer;
    
    if (positionsFromEnd === 4) return 'UTG';
    if (positionsFromEnd === 3) return 'MP';
    if (positionsFromEnd === 2) return 'CO';
    
    return `MP${positionsFromDealer}`;
  }

  private getPositionType(position: number, state: PokerGameState): 'early' | 'middle' | 'late' | 'blinds' {
    const positionName = this.getPositionName(position, state);
    
    if (['SB', 'BB'].includes(positionName)) return 'blinds';
    if (['BTN', 'CO'].includes(positionName)) return 'late';
    if (positionName.includes('UTG')) return 'early';
    return 'middle';
  }

  private categorizeStackSize(chips: number, state: PokerGameState): string {
    const bigBlind = state.bigBlind;
    const bbCount = chips / bigBlind;
    
    if (bbCount < 10) return 'micro';
    if (bbCount < 20) return 'short';
    if (bbCount < 50) return 'medium';
    if (bbCount < 100) return 'deep';
    return 'very deep';
  }

  collectValidActions(state: PokerGameState, playerId: string): string[] {
    const player = state.players.find(p => p.id === playerId) as PokerPlayer;
    if (!player || player.folded || state.currentTurn !== playerId) {
      return [];
    }

    const actions: string[] = ['fold'];
    const callAmount = state.currentBet - player.bet;

    if (callAmount === 0) {
      actions.push('check');
    } else if (player.chips >= callAmount) {
      actions.push('call');
    }

    if (state.currentBet === 0 && player.chips >= state.bigBlind) {
      actions.push('bet');
    }

    if (state.currentBet > 0 && player.chips > callAmount) {
      actions.push('raise');
    }

    if (player.chips > 0) {
      actions.push('all-in');
    }

    return actions;
  }
}