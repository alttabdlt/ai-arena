export interface TestScenario {
  id: string;
  name: string;
  description: string;
  gameState: {
    gameType: 'no_limit_holdem';
    bettingStructure: 'tournament';
    maxPlayers: number;
    currentPlayers: number;
    activePlayers: number;
    smallBlind: number;
    bigBlind: number;
    ante: number;
    level: number;
    handNumber: number;
    stage: 'preflop' | 'flop' | 'turn' | 'river';
    communityCards: string[];
    potSize: number;
    mainPot: number;
    sidePots: any[];
    currentBet: number;
    minRaise: number;
    totalChipsInPlay: number;
    averageStack: number;
    playersAllIn: number;
  };
  playerState: {
    holeCards: string[];
    stackSize: number;
    position: string;
    positionType: 'early' | 'middle' | 'late' | 'blinds';
    seatNumber: number;
    isAllIn: boolean;
    amountInvestedThisHand: number;
    amountInvestedThisRound: number;
    amountToCall: number;
    canCheck: boolean;
    canFold: boolean;
    canCall: boolean;
    canRaise: boolean;
    canAllIn: boolean;
    minBet: number;
    maxBet: number;
    potOdds: number;
    stackToPotRatio: number;
  };
  opponents: number;
  context: string;
  expectedPlay?: string;
}

export const TEST_SCENARIOS: TestScenario[] = [
  {
    id: 'big-river-bluff',
    name: 'Facing a Big River Bluff',
    description: 'You have a medium-strength hand and face a large river bet. Should you call or fold?',
    gameState: {
      gameType: 'no_limit_holdem',
      bettingStructure: 'tournament',
      maxPlayers: 6,
      currentPlayers: 4,
      activePlayers: 2,
      smallBlind: 100,
      bigBlind: 200,
      ante: 25,
      level: 8,
      handNumber: 45,
      stage: 'river',
      communityCards: ['Ah', 'Kd', '7s', '3c', '2h'],
      potSize: 4800,
      mainPot: 4800,
      sidePots: [],
      currentBet: 3600,
      minRaise: 7200,
      totalChipsInPlay: 60000,
      averageStack: 15000,
      playersAllIn: 0,
    },
    playerState: {
      holeCards: ['Kh', 'Qs'],
      stackSize: 12000,
      position: 'BTN',
      positionType: 'late',
      seatNumber: 3,
      isAllIn: false,
      amountInvestedThisHand: 1200,
      amountInvestedThisRound: 0,
      amountToCall: 3600,
      canCheck: false,
      canFold: true,
      canCall: true,
      canRaise: true,
      canAllIn: true,
      minBet: 7200,
      maxBet: 12000,
      potOdds: 30,
      stackToPotRatio: 1.8,
    },
    opponents: 1,
    context: 'Villain has been aggressive throughout the tournament. This is a 75% pot-sized bet on a dry board.',
    expectedPlay: 'This is a tough spot requiring careful consideration of villain\'s range and bluff frequency.',
  },
  {
    id: 'pocket-aces-preflop',
    name: 'Pocket Aces Facing 3-Bet',
    description: 'You have pocket aces and face a 3-bet. How do you maximize value?',
    gameState: {
      gameType: 'no_limit_holdem',
      bettingStructure: 'tournament',
      maxPlayers: 8,
      currentPlayers: 8,
      activePlayers: 3,
      smallBlind: 50,
      bigBlind: 100,
      ante: 10,
      level: 4,
      handNumber: 23,
      stage: 'preflop',
      communityCards: [],
      potSize: 950,
      mainPot: 950,
      sidePots: [],
      currentBet: 650,
      minRaise: 1300,
      totalChipsInPlay: 80000,
      averageStack: 10000,
      playersAllIn: 0,
    },
    playerState: {
      holeCards: ['As', 'Ac'],
      stackSize: 9500,
      position: 'CO',
      positionType: 'late',
      seatNumber: 5,
      isAllIn: false,
      amountInvestedThisHand: 300,
      amountInvestedThisRound: 300,
      amountToCall: 350,
      canCheck: false,
      canFold: true,
      canCall: true,
      canRaise: true,
      canAllIn: true,
      minBet: 1300,
      maxBet: 9500,
      potOdds: 37,
      stackToPotRatio: 10,
    },
    opponents: 2,
    context: 'You raised to 300, BTN 3-bet to 650. Action is on you with the best starting hand.',
    expectedPlay: '4-bet for value, typically to around 1500-1800 to build the pot.',
  },
  {
    id: 'short-stack-push',
    name: 'Short Stack All-In Decision',
    description: 'You\'re short-stacked with a marginal hand. Is this a good spot to push?',
    gameState: {
      gameType: 'no_limit_holdem',
      bettingStructure: 'tournament',
      maxPlayers: 6,
      currentPlayers: 5,
      activePlayers: 5,
      smallBlind: 200,
      bigBlind: 400,
      ante: 50,
      level: 10,
      handNumber: 67,
      stage: 'preflop',
      communityCards: [],
      potSize: 850,
      mainPot: 850,
      sidePots: [],
      currentBet: 0,
      minRaise: 800,
      totalChipsInPlay: 60000,
      averageStack: 12000,
      playersAllIn: 0,
    },
    playerState: {
      holeCards: ['Ad', '7c'],
      stackSize: 3200,
      position: 'CO',
      positionType: 'late',
      seatNumber: 4,
      isAllIn: false,
      amountInvestedThisHand: 50,
      amountInvestedThisRound: 0,
      amountToCall: 0,
      canCheck: false,
      canFold: true,
      canCall: false,
      canRaise: true,
      canAllIn: true,
      minBet: 800,
      maxBet: 3200,
      potOdds: 0,
      stackToPotRatio: 3.8,
    },
    opponents: 4,
    context: 'You have 8 big blinds and a decent ace. Folded to you in the cutoff.',
    expectedPlay: 'All-in is the standard play with 8BB and an ace from late position.',
  },
  {
    id: 'medium-stack-3bet',
    name: 'Facing 3-Bet with Medium Pair',
    description: 'You raised with pocket tens and face a 3-bet from a tight player.',
    gameState: {
      gameType: 'no_limit_holdem',
      bettingStructure: 'tournament',
      maxPlayers: 8,
      currentPlayers: 7,
      activePlayers: 2,
      smallBlind: 150,
      bigBlind: 300,
      ante: 30,
      level: 7,
      handNumber: 89,
      stage: 'preflop',
      communityCards: [],
      potSize: 3210,
      mainPot: 3210,
      sidePots: [],
      currentBet: 2100,
      minRaise: 4200,
      totalChipsInPlay: 80000,
      averageStack: 11428,
      playersAllIn: 0,
    },
    playerState: {
      holeCards: ['Ts', 'Th'],
      stackSize: 15600,
      position: 'HJ',
      positionType: 'middle',
      seatNumber: 2,
      isAllIn: false,
      amountInvestedThisHand: 900,
      amountInvestedThisRound: 900,
      amountToCall: 1200,
      canCheck: false,
      canFold: true,
      canCall: true,
      canRaise: true,
      canAllIn: true,
      minBet: 4200,
      maxBet: 15600,
      potOdds: 38,
      stackToPotRatio: 4.9,
    },
    opponents: 1,
    context: 'You raised to 900 from hijack, tight player in SB 3-bet to 2100. They\'ve been playing 15% of hands.',
    expectedPlay: 'Against a tight 3-betting range, calling or folding are both reasonable. 4-betting is too aggressive.',
  },
  {
    id: 'bluff-opportunity',
    name: 'Bluff Opportunity on Scary Board',
    description: 'The board is very draw-heavy and you have position. Good spot to bluff?',
    gameState: {
      gameType: 'no_limit_holdem',
      bettingStructure: 'tournament',
      maxPlayers: 6,
      currentPlayers: 6,
      activePlayers: 2,
      smallBlind: 100,
      bigBlind: 200,
      ante: 25,
      level: 6,
      handNumber: 34,
      stage: 'turn',
      communityCards: ['9h', '8h', '7c', 'Kh'],
      potSize: 2400,
      mainPot: 2400,
      sidePots: [],
      currentBet: 0,
      minRaise: 200,
      totalChipsInPlay: 60000,
      averageStack: 10000,
      playersAllIn: 0,
    },
    playerState: {
      holeCards: ['Qd', 'Jc'],
      stackSize: 8900,
      position: 'BTN',
      positionType: 'late',
      seatNumber: 5,
      isAllIn: false,
      amountInvestedThisHand: 1200,
      amountInvestedThisRound: 0,
      amountToCall: 0,
      canCheck: true,
      canFold: false,
      canCall: false,
      canRaise: true,
      canAllIn: true,
      minBet: 200,
      maxBet: 8900,
      potOdds: 0,
      stackToPotRatio: 3.7,
    },
    opponents: 1,
    context: 'You called pre-flop, c-bet the flop and got called. The turn brings a third heart. Villain checked to you.',
    expectedPlay: 'This is a good barrel spot with your straight draw and the scary turn card.',
  },
];