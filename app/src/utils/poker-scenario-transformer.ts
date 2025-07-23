import { TestScenario } from '@/data/poker-scenarios';

interface GraphQLGameState {
  gameType: string;
  bettingStructure: string;
  maxPlayers: number;
  currentPlayers: number;
  activePlayers: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  level: number;
  handNumber: number;
  dealerPosition: number;
  smallBlindPosition: number;
  bigBlindPosition: number;
  bettingRound: string;
  communityCards: string[];
  potSize: number;
  sidePots: any[];
  currentBet: number;
  minRaise: number;
  opponents: any[];
  actionHistory: {
    preflop: any[];
    flop: any[];
    turn: any[];
    river: any[];
  };
  mainPot: number;
  totalPot: number;
  effectiveStackSize: number;
  potOdds: {
    toCall: number;
    potSize: number;
    oddsRatio: string;
    percentage: number;
    breakEvenPercentage: number;
  };
}

interface GraphQLPlayerState {
  holeCards: string[];
  stackSize: number;
  position: string;
  positionType: string;
  seatNumber: number;
  isAllIn: boolean;
  amountInvestedThisHand: number;
  amountInvestedThisRound: number;
  amountToCall: number;
  canCheck: boolean;
  canFold: boolean;
  canCall: boolean;
  canRaise: boolean;
  minRaiseAmount: number;
  maxRaiseAmount: number;
  seatsToActAfter: number;
  relativePosition: string;
  playersLeftToAct: string[];
  isClosingAction: boolean;
  isOpenAction: boolean;
  effectiveStacks: string;
  stackToPoRatio: number;
  commitmentLevel: number;
}

export function transformScenarioToGraphQL(scenario: TestScenario): {
  gameState: GraphQLGameState;
  playerState: GraphQLPlayerState;
  opponents: number;
} {
  const { gameState, playerState, opponents } = scenario;

  // Map stage to bettingRound
  const bettingRoundMap: Record<string, string> = {
    preflop: 'PREFLOP',
    flop: 'FLOP',
    turn: 'TURN',
    river: 'RIVER'
  };

  // Calculate positions based on player count
  const dealerPosition = gameState.currentPlayers - 1;
  const smallBlindPosition = 0;
  const bigBlindPosition = 1;

  // Calculate pot odds
  const potOddsPercentage = playerState.amountToCall > 0
    ? (playerState.amountToCall / (gameState.potSize + playerState.amountToCall)) * 100
    : 0;
  const breakEvenPercentage = playerState.amountToCall > 0
    ? (playerState.amountToCall / (gameState.potSize + playerState.amountToCall)) * 100
    : 0;

  // Generate opponent info based on count
  const opponentInfos = Array.from({ length: opponents }, (_, i) => {
    const seatNumber = (playerState.seatNumber + i + 1) % gameState.maxPlayers;
    return {
      seat: seatNumber,
      id: `opponent-${i + 1}`,
      name: `Opponent ${i + 1}`,
      stackSize: Math.floor(gameState.totalChipsInPlay / gameState.currentPlayers),
      position: getPositionName(seatNumber, dealerPosition, gameState.currentPlayers),
      positionType: getPositionType(seatNumber, dealerPosition, gameState.currentPlayers),
      status: 'ACTIVE',
      amountInPot: 0,
      amountInRound: 0,
      isAllIn: false,
      holeCardsKnown: false,
      holeCards: [],
      lastAction: null
    };
  });

  // Calculate effective stack size
  const effectiveStackSize = Math.min(
    playerState.stackSize,
    ...opponentInfos.map(o => o.stackSize)
  );

  // Transform to GraphQL format
  const transformedGameState: GraphQLGameState = {
    ...gameState,
    dealerPosition,
    smallBlindPosition,
    bigBlindPosition,
    bettingRound: bettingRoundMap[gameState.stage] || 'PREFLOP',
    opponents: opponentInfos,
    actionHistory: {
      preflop: [],
      flop: [],
      turn: [],
      river: []
    },
    totalPot: gameState.potSize,
    effectiveStackSize,
    potOdds: {
      toCall: playerState.amountToCall,
      potSize: gameState.potSize,
      oddsRatio: playerState.amountToCall > 0 
        ? `${playerState.amountToCall}:${gameState.potSize}`
        : '0:0',
      percentage: potOddsPercentage,
      breakEvenPercentage
    }
  };

  // Calculate min/max raise amounts
  const minRaiseAmount = Math.min(
    gameState.currentBet * 2,
    playerState.stackSize
  );
  const maxRaiseAmount = playerState.stackSize;

  // Determine relative position and action status
  const isLastToAct = playerState.seatNumber === dealerPosition;
  const playersLeftToAct = opponentInfos
    .filter(o => o.seat > playerState.seatNumber)
    .map(o => o.id);

  const transformedPlayerState: GraphQLPlayerState = {
    ...playerState,
    minRaiseAmount,
    maxRaiseAmount,
    seatsToActAfter: playersLeftToAct.length,
    relativePosition: getRelativePosition(playerState.seatNumber, dealerPosition, gameState.currentPlayers),
    playersLeftToAct,
    isClosingAction: isLastToAct && gameState.currentBet > 0,
    isOpenAction: gameState.currentBet === 0,
    effectiveStacks: JSON.stringify({
      [`opponent-1`]: effectiveStackSize
    }),
    stackToPoRatio: playerState.stackSize / gameState.potSize,
    commitmentLevel: playerState.amountInvestedThisHand / playerState.stackSize
  };

  // Remove fields that don't exist in GraphQL schema
  const cleanedGameState = { ...transformedGameState };
  delete (cleanedGameState as any).stage;
  delete (cleanedGameState as any).totalChipsInPlay;
  delete (cleanedGameState as any).averageStack;
  delete (cleanedGameState as any).playersAllIn;

  const cleanedPlayerState = { ...transformedPlayerState };
  delete (cleanedPlayerState as any).canAllIn;
  delete (cleanedPlayerState as any).minBet;
  delete (cleanedPlayerState as any).maxBet;
  delete (cleanedPlayerState as any).potOdds;
  delete (cleanedPlayerState as any).stackToPotRatio;

  return {
    gameState: cleanedGameState,
    playerState: cleanedPlayerState,
    opponents
  };
}

function getPositionName(seat: number, dealerPosition: number, playerCount: number): string {
  if (seat === dealerPosition) return 'BTN';
  if (seat === (dealerPosition + 1) % playerCount) return 'SB';
  if (seat === (dealerPosition + 2) % playerCount) return 'BB';
  
  const positionsFromButton = (dealerPosition - seat + playerCount) % playerCount;
  if (positionsFromButton === playerCount - 1) return 'CO';
  if (positionsFromButton === playerCount - 2) return 'HJ';
  
  return `UTG+${seat}`;
}

function getPositionType(seat: number, dealerPosition: number, playerCount: number): string {
  const positionsFromButton = (dealerPosition - seat + playerCount) % playerCount;
  
  if (positionsFromButton <= 1) return 'late';
  if (positionsFromButton <= 3) return 'middle';
  if (seat <= 2) return 'blinds';
  return 'early';
}

function getRelativePosition(seat: number, dealerPosition: number, playerCount: number): string {
  const positionsFromButton = (dealerPosition - seat + playerCount) % playerCount;
  
  if (positionsFromButton === 0) return 'IN_POSITION';
  if (positionsFromButton === playerCount - 1) return 'OUT_OF_POSITION';
  return 'MIDDLE_POSITION';
}