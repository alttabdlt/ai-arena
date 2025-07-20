import { apolloClient, gql } from '../../lib/apollo-client';

const GET_AI_POKER_DECISION = gql`
  mutation GetAIPokerDecision(
    $botId: String!
    $model: String!
    $gameState: PokerGameStateInput!
    $playerState: PlayerStateInput!
    $opponents: Int!
  ) {
    getAIPokerDecision(
      botId: $botId
      model: $model
      gameState: $gameState
      playerState: $playerState
      opponents: $opponents
    ) {
      action
      amount
      reasoning
      confidence
      details {
        handEvaluation
        potOdds
        expectedValue
        bluffProbability
        modelUsed
      }
      handMisread
      illogicalPlay
    }
  }
`;

export interface AIModelConfig {
  botId: string;
  model: 'gpt-4o' | 'deepseek-chat' | 'claude-3-5-sonnet' | 'claude-3-opus';
  personality?: string;
  useRealAPI?: boolean;
}

export interface PokerGameStateAPI {
  // Table info
  gameType: 'no_limit_holdem';
  bettingStructure: 'tournament' | 'cash_game';
  maxPlayers: number;
  currentPlayers: number;
  activePlayers: number;
  
  // Blinds
  smallBlind: number;
  bigBlind: number;
  ante: number;
  level: number;
  
  // Current hand
  handNumber: number;
  dealerPosition: number;
  smallBlindPosition: number;
  bigBlindPosition: number;
  bettingRound: 'preflop' | 'flop' | 'turn' | 'river';
  communityCards: string[];
  potSize: number;
  sidePots: {
    amount: number;
    eligiblePlayers: string[];
    createdByPlayer?: string;
  }[];
  currentBet: number;
  minRaise: number;
  
  // Players
  opponents: {
    seat: number;
    id: string;
    name: string;
    stackSize: number;
    position: string;
    positionType: string;
    status: string;
    amountInPot: number;
    amountInRound: number;
    isAllIn: boolean;
    holeCardsKnown: boolean;
    holeCards?: string[];
    lastAction?: {
      action: string;
      amount?: number;
      timestamp: number;
    };
  }[];
  
  // Action history
  actionHistory: {
    preflop: HandAction[];
    flop: HandAction[];
    turn: HandAction[];
    river: HandAction[];
  };
  
  // Pot breakdown
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

interface HandAction {
  player: string;
  playerId: string;
  seat: number;
  action: string;
  amount?: number;
  stackBefore: number;
  stackAfter: number;
  potAfter: number;
}

export interface PlayerStateAPI {
  // Personal data
  holeCards: string[];
  stackSize: number;
  position: string;
  positionType: 'EP' | 'MP' | 'LP' | 'SB' | 'BB';
  seatNumber: number;
  isAllIn: boolean;
  amountInvestedThisHand: number;
  amountInvestedThisRound: number;
  amountToCall: number;
  
  // Available actions
  canCheck: boolean;
  canFold: boolean;
  canCall: boolean;
  canRaise: boolean;
  minRaiseAmount: number;
  maxRaiseAmount: number;
  
  // Position data
  seatsToActAfter: number;
  relativePosition: string;
  playersLeftToAct: string[];
  isClosingAction: boolean;
  isOpenAction: boolean;
  
  // Stack dynamics
  effectiveStacks: string; // JSON string for GraphQL compatibility
  stackToPoRatio: number;
  commitmentLevel: number;
  
  // Hand evaluation
  handEvaluation?: string; // Current hand strength (e.g., "Straight (9 high)")
}

export interface AIDecisionAPI {
  action: 'fold' | 'check' | 'call' | 'raise' | 'all-in';
  amount?: number;
  reasoning: string;
  confidence: number;
  details: {
    handEvaluation: string;
    potOdds: string;
    expectedValue: string;
    bluffProbability: number;
    modelUsed: string;
  };
  handMisread?: boolean;
  illogicalPlay?: boolean;
}

export class AIApiService {
  private static instance: AIApiService;
  
  private constructor() {}
  
  static getInstance(): AIApiService {
    if (!AIApiService.instance) {
      AIApiService.instance = new AIApiService();
    }
    return AIApiService.instance;
  }

  async getAIDecision(
    modelConfig: AIModelConfig,
    gameState: PokerGameStateAPI,
    playerState: PlayerStateAPI,
    opponents: number
  ): Promise<AIDecisionAPI> {
    // Validate playerState has required fields
    if (!playerState || playerState.holeCards === undefined || playerState.stackSize === undefined) {
      console.error('❌ AI API called with invalid playerState:', playerState);
      return this.getFallbackDecision(gameState, playerState);
    }
    
    console.log('🎯 AI API Service called with:', {
      botId: modelConfig.botId,
      model: modelConfig.model,
      hand: playerState.holeCards,
      chips: playerState.stackSize,
    });

    try {
      const { data } = await apolloClient.mutate({
        mutation: GET_AI_POKER_DECISION,
        variables: {
          botId: modelConfig.botId,
          model: modelConfig.model,
          gameState,
          playerState,
          opponents,
        },
      });

      console.log('✅ GraphQL mutation successful, response:', data);
      return data.getAIPokerDecision;
    } catch (error) {
      console.error('❌ AI API Service Error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        networkError: (error as any)?.networkError,
        graphQLErrors: (error as any)?.graphQLErrors,
        variables: {
          botId: modelConfig.botId,
          model: modelConfig.model,
        }
      });
      
      // Fallback response for development
      return {
        action: 'check',
        reasoning: 'Unable to connect to AI service. Using fallback logic.',
        confidence: 0.5,
        details: {
          handEvaluation: 'Connection error',
          potOdds: 'N/A',
          expectedValue: 'N/A',
          bluffProbability: 0,
          modelUsed: 'fallback',
        },
      };
    }
  }

  private getFallbackDecision(
    gameState: PokerGameStateAPI,
    playerState: PlayerStateAPI
  ): AIDecisionAPI {
    // Handle undefined playerState gracefully
    if (!playerState || !gameState) {
      return {
        action: 'fold',
        reasoning: 'Invalid game state - folding for safety',
        confidence: 0.1,
        details: {
          handEvaluation: 'No data available',
          potOdds: 'N/A',
          expectedValue: 'N/A',
          bluffProbability: 0,
          modelUsed: 'emergency-fallback',
        },
      };
    }
    
    const playerChips = playerState.stackSize || 0;
    const playerBet = playerState.amountInvestedThisRound || 0;
    const canAffordCall = playerChips >= (gameState.currentBet - playerBet);
    const potOdds = gameState.currentBet > 0 ? gameState.currentBet / (gameState.totalPot + gameState.currentBet) : 0;
    
    let action: AIDecisionAPI['action'] = 'fold';
    let reasoning = 'Using fallback logic (API unavailable)';

    if (playerState.canCheck) {
      action = 'check';
      reasoning = 'Checking to see more cards';
    } else if (canAffordCall && potOdds < 0.3) {
      action = 'call';
      reasoning = 'Pot odds favorable for a call';
    }

    return {
      action,
      reasoning,
      confidence: 0.3,
      details: {
        handEvaluation: 'Fallback evaluation',
        potOdds: `${(potOdds * 100).toFixed(1)}%`,
        expectedValue: 'Unable to calculate',
        bluffProbability: 0,
        modelUsed: 'Fallback Logic (API Error)',
      },
    };
  }
}

export const aiApiService = AIApiService.getInstance();