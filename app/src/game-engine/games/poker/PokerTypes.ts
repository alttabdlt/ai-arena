import { IGameState, IGameAction, IGameConfig, IGamePlayer } from '../../core/interfaces';
import { ITurnBasedGameState, ICardGameState } from '../../core/extensions';

export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
export type Card = `${Rank}${Suit}`;

export type PokerActionType = 'check' | 'call' | 'bet' | 'raise' | 'fold' | 'all-in';
export type PokerPhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface PokerPlayer extends IGamePlayer {
  chips: number;
  cards: Card[];
  bet: number;
  folded: boolean;
  allIn: boolean;
  position: number;
  hasActed: boolean;
  seatPosition?: number;
}

export interface PokerAction extends IGameAction {
  type: PokerActionType;
  amount?: number;
}

export interface PokerGameState extends ICardGameState, ITurnBasedGameState {
  phase: PokerPhase;
  players: PokerPlayer[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  minRaise: number;
  dealerPosition: number;
  smallBlindPosition: number;
  bigBlindPosition: number;
  currentPlayerIndex: number;
  deck: Card[];
  sidePots: SidePot[];
  winners: WinnerInfo[];
  isHandComplete: boolean;
  handNumber: number;
  blindLevel: number;
  smallBlind: number;
  bigBlind: number;
}

export interface SidePot {
  amount: number;
  eligiblePlayers: string[];
}

export interface WinnerInfo {
  playerId: string;
  amount: number;
  hand?: string;
  handRank?: number;
}

export interface PokerGameConfig extends IGameConfig {
  startingChips: number;
  smallBlind: number;
  bigBlind: number;
  blindIncreaseInterval?: number;
  maxHands?: number;
  speed: 'thinking' | 'normal' | 'fast';
  showAIThinking: boolean;
  showDecisionHistory: boolean;
}