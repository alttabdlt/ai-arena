import { IGameState, IGameAction } from '../core/interfaces';
import { ApolloClient, NormalizedCacheObject } from '@apollo/client';
import { GET_AI_POKER_DECISION, GET_AI_REVERSE_HANGMAN_DECISION } from './graphql/mutations';

export interface AIServiceConfig {
  apiEndpoint: string;
  timeout: number;
  retryAttempts: number;
  models: {
    [key: string]: {
      name: string;
      endpoint?: string;
      apiKey?: string;
      maxTokens?: number;
    };
  };
}

export interface AIRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, any>;
}

export class GameAIService {
  private config: AIServiceConfig;
  private requestCache: Map<string, AIResponse> = new Map();
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes
  private apolloClient?: ApolloClient<NormalizedCacheObject>;

  constructor(config: AIServiceConfig, apolloClient?: ApolloClient<NormalizedCacheObject>) {
    this.config = config;
    this.apolloClient = apolloClient;
    console.log('GameAIService initialized with:', {
      hasApolloClient: !!apolloClient,
      apiEndpoint: config.apiEndpoint,
      models: Object.keys(config.models),
      timeout: config.timeout,
      retryAttempts: config.retryAttempts
    });
  }

  async makeRequest(request: AIRequest): Promise<AIResponse> {
    console.log('GameAIService.makeRequest called:', {
      model: request.model,
      hasApolloClient: !!this.apolloClient,
      promptLength: request.userPrompt.length,
      systemPromptLength: request.systemPrompt.length
    });
    
    const cacheKey = this.getCacheKey(request);
    const cachedResponse = this.requestCache.get(cacheKey);
    
    if (cachedResponse) {
      console.log('Returning cached response for model:', request.model);
      return cachedResponse;
    }

    const modelConfig = this.config.models[request.model];
    if (!modelConfig) {
      console.error('Unknown AI model:', request.model, 'Available models:', Object.keys(this.config.models));
      throw new Error(`Unknown AI model: ${request.model}`);
    }

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        const response = await this.sendRequest(request, modelConfig);
        
        this.requestCache.set(cacheKey, response);
        setTimeout(() => this.requestCache.delete(cacheKey), this.cacheTimeout);
        
        return response;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.retryAttempts - 1) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw new Error(`AI request failed after ${this.config.retryAttempts} attempts: ${lastError?.message}`);
  }

  async collectNeutralGameData<TState extends IGameState>(
    state: TState, 
    playerId: string
  ): Promise<any> {
    const player = state.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    return {
      gameId: state.gameId,
      phase: state.phase,
      turnCount: state.turnCount,
      players: state.players.map(p => ({
        id: p.id,
        name: p.name,
        isActive: p.isActive,
        score: p.score
      })),
      currentPlayer: {
        id: player.id,
        name: player.name,
        score: player.score
      },
      gameSpecificData: this.extractGameSpecificData(state)
    };
  }

  parseAIResponse(response: AIResponse): any {
    console.log('parseAIResponse called with:', {
      contentLength: response.content.length,
      contentPreview: response.content.substring(0, 100),
      model: response.model
    });
    
    try {
      if (response.content.startsWith('{') || response.content.startsWith('[')) {
        const parsed = JSON.parse(response.content);
        console.log('Successfully parsed JSON directly:', parsed);
        return parsed;
      }
      
      const jsonMatch = response.content.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        console.log('Successfully parsed JSON from code block:', parsed);
        return parsed;
      }
      
      const objectMatch = response.content.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        const parsed = JSON.parse(objectMatch[0]);
        console.log('Successfully parsed JSON from object match:', parsed);
        return parsed;
      }
      
      throw new Error('No valid JSON found in response');
    } catch (error) {
      console.error('Failed to parse AI response:', {
        error,
        content: response.content
      });
      throw new Error(`Failed to parse AI response: ${error}`);
    }
  }

  validateAction<TAction extends IGameAction>(
    parsedResponse: any, 
    validActions: TAction[]
  ): TAction | null {
    if (!parsedResponse || !parsedResponse.action) {
      console.error('No action found in parsed response:', parsedResponse);
      return null;
    }

    // Transform AI response format to match expected action structure
    // Handle various response formats:
    // 1. {action: "fold", amount: 0} -> {type: "fold", amount: 0}
    // 2. {action: {type: "fold", amount: 0}} -> {type: "fold", amount: 0}
    let responseAction;
    
    if (typeof parsedResponse.action === 'string') {
      // Format 1: action is a string
      responseAction = { 
        type: parsedResponse.action, 
        amount: parsedResponse.amount 
      };
    } else if (parsedResponse.action && typeof parsedResponse.action === 'object') {
      // Format 2: action is already an object
      responseAction = parsedResponse.action;
    } else {
      console.error('Invalid action format:', parsedResponse.action);
      return null;
    }
    
    // Log for debugging
    console.log('Validating action:', {
      responseAction,
      validActions: validActions.map(a => ({ type: (a as any).type, amount: (a as any).amount }))
    });
    
    for (const validAction of validActions) {
      if (this.actionsMatch(responseAction, validAction)) {
        // For reverse hangman guess actions, we need to include the guess text
        if (validAction.type === 'guess' && responseAction.guess) {
          return { ...validAction, guess: responseAction.guess };
        }
        return validAction;
      }
    }

    console.error('No matching valid action found for:', responseAction);
    return null;
  }

  clearCache(): void {
    this.requestCache.clear();
  }

  private async sendRequest(request: AIRequest, modelConfig: any): Promise<AIResponse> {
    // If Apollo client is available and we can detect the game type, use GraphQL
    if (this.apolloClient) {
      try {
        const gameType = this.detectGameType(request.userPrompt);
        
        if (gameType === 'poker' || gameType === 'reverse-hangman') {
          return await this.sendGraphQLRequest(request, modelConfig, gameType);
        }
      } catch (error) {
        console.warn('Failed to use GraphQL, falling back to REST:', error);
      }
    }

    // Fallback to REST API (will fail with 404, but preserves original behavior)
    const endpoint = modelConfig.endpoint || this.config.apiEndpoint;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${modelConfig.apiKey || import.meta.env.VITE_AI_API_KEY}`
        },
        body: JSON.stringify({
          model: modelConfig.name,
          messages: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.userPrompt }
          ],
          temperature: request.temperature || 0.7,
          max_tokens: request.maxTokens || modelConfig.maxTokens || 1000,
          response_format: request.responseFormat === 'json' ? { type: 'json_object' } : undefined
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        content: data.choices[0].message.content,
        model: request.model,
        usage: data.usage,
        metadata: {
          requestId: data.id,
          created: data.created
        }
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('AI request timed out');
      }
      
      throw error;
    }
  }

  private detectGameType(userPrompt: string): string | null {
    // First try to extract and examine the game data structure
    try {
      // Look for game state JSON in the prompt
      const gameStateMatch = userPrompt.match(/Current game state:\s*(\{[\s\S]*?\})\s*Valid actions/);
      if (gameStateMatch) {
        const gameData = JSON.parse(gameStateMatch[1]);
        
        // Check for explicit gameType field in gameSpecific
        if (gameData.gameSpecific && (gameData.gameSpecific.gameType === 'reverse-hangman' || gameData.gameSpecific.gameType === 'reverse_hangman')) {
          console.log('Detected game type from gameSpecific.gameType field: reverse-hangman');
          return 'reverse-hangman';
        }
        
        // Check for reverse hangman specific fields
        if (gameData.gameSpecific && (
          gameData.gameSpecific.currentOutput !== undefined ||
          gameData.gameSpecific.previousGuesses !== undefined ||
          gameData.gameSpecific.attemptsRemaining !== undefined ||
          gameData.gameSpecific.phase === 'playing' ||
          gameData.gameSpecific.phase === 'selecting'
        )) {
          console.log('Detected game type from structure: reverse-hangman');
          return 'reverse-hangman';
        }
        
        // Check for explicit gameType field at root level
        if (gameData.gameType === 'reverse-hangman' || gameData.gameType === 'reverse_hangman') {
          console.log('Detected game type from root gameType field: reverse-hangman');
          return 'reverse-hangman';
        }
        
        // Check for poker specific fields
        if (gameData.gameSpecific && (
          gameData.gameSpecific.communityCards !== undefined ||
          gameData.gameSpecific.pot !== undefined ||
          gameData.gameSpecific.currentBet !== undefined ||
          gameData.gameSpecific.phase === 'preflop' ||
          gameData.gameSpecific.phase === 'flop' ||
          gameData.gameSpecific.phase === 'turn' ||
          gameData.gameSpecific.phase === 'river'
        )) {
          console.log('Detected game type from structure: poker');
          return 'poker';
        }
      }
    } catch (e) {
      // If JSON parsing fails, fall back to keyword detection
      console.log('Failed to parse game data for type detection:', e);
    }
    
    // Fallback to keyword detection in prompt text
    const promptLower = userPrompt.toLowerCase();
    
    // Check for reverse hangman keywords - including template placeholders
    if (promptLower.includes('reverse-engineer') || promptLower.includes('output you need to reverse-engineer') ||
        promptLower.includes('previous guesses') || promptLower.includes('attempts remaining') ||
        promptLower.includes('guess the exact prompt') || promptLower.includes('match percentages') ||
        promptLower.includes('{{gamedata.gamespecific.currentoutput}}') || 
        promptLower.includes('{{gamedata.gamespecific.previousguesses}}')) {
      console.log('Detected game type from keywords: reverse-hangman');
      return 'reverse-hangman';
    }
    
    // Check for poker keywords
    if (promptLower.includes('poker') || promptLower.includes('cards') || promptLower.includes('bet') || 
        promptLower.includes('fold') || promptLower.includes('call') || promptLower.includes('raise') ||
        promptLower.includes('hole cards') || promptLower.includes('community cards')) {
      console.log('Detected game type from keywords: poker');
      return 'poker';
    }
    
    console.log('Could not detect game type from prompt');
    return null;
  }

  private async sendGraphQLRequest(request: AIRequest, modelConfig: any, gameType: string): Promise<AIResponse> {
    if (!this.apolloClient) {
      throw new Error('Apollo client not configured');
    }

    try {
      // Log the full prompt for debugging
      console.log('Full AI prompt (first 500 chars):', request.userPrompt.substring(0, 500));
      console.log('Detected game type:', gameType);
      
      // Extract game data and valid actions from the complex prompt structure
      let gameData: any;
      let validActions: any[] = [];
      
      // First, try to extract the game state JSON object
      const gameStateMatch = request.userPrompt.match(/Current game state:\s*(\{[\s\S]*?\})\s*Valid actions/);
      if (gameStateMatch) {
        try {
          gameData = JSON.parse(gameStateMatch[1]);
        } catch (e) {
          console.error('Failed to parse game state:', gameStateMatch[1]);
          throw new Error(`Failed to parse game state JSON: ${e}`);
        }
      }
      
      // Then extract valid actions array
      const actionsMatch = request.userPrompt.match(/Valid actions you can take:\s*(\[[\s\S]*?\])/);
      if (actionsMatch) {
        try {
          validActions = JSON.parse(actionsMatch[1]);
        } catch (e) {
          console.error('Failed to parse valid actions:', actionsMatch[1]);
        }
      }
      
      // If extraction failed, try a more general approach
      if (!gameData) {
        // Look for any JSON object in the prompt
        const jsonMatches = request.userPrompt.match(/\{[\s\S]*?\}/g);
        if (jsonMatches && jsonMatches.length > 0) {
          try {
            gameData = JSON.parse(jsonMatches[0]);
          } catch (e) {
            console.error('Failed to parse any JSON from prompt');
            throw new Error('Could not extract game data from prompt');
          }
        } else {
          throw new Error('No JSON game data found in prompt');
        }
      }
      
      console.log('Extracted game data:', gameData);
      console.log('Extracted valid actions:', validActions);
      
      // Generate a temporary bot ID
      const botId = `game-bot-${Date.now()}`;
      
      // Format model name for backend (e.g., "gpt-4o" -> "gpt-4o")
      const modelName = request.model;

      if (gameType === 'poker') {
        const { gameState, playerState } = this.transformPokerDataForGraphQL(gameData);
        // Count opponents from the players array
        const opponents = (gameData.players?.length || 1) - 1;

        console.log('Sending GraphQL mutation with variables:', {
          botId,
          model: modelName,
          opponents,
          gameStateKeys: Object.keys(gameState),
          playerStateKeys: Object.keys(playerState)
        });

        console.log('Sending Apollo mutation with timeout...'); 
        const result = await this.apolloClient.mutate({
          mutation: GET_AI_POKER_DECISION,
          variables: {
            botId,
            model: modelName,
            gameState,
            playerState,
            opponents
          },
          fetchPolicy: 'no-cache',
          errorPolicy: 'all'
        });

        console.log('GraphQL mutation result:', {
          hasData: !!result.data,
          hasErrors: !!result.errors,
          errors: result.errors,
          dataKeys: result.data ? Object.keys(result.data) : []
        });

        if (!result.data || !result.data.getAIPokerDecision) {
          console.error('Invalid GraphQL response:', result);
          throw new Error('No AI decision returned from GraphQL mutation');
        }

        const decision = result.data.getAIPokerDecision;
        
        // Transform response to expected format
        // GraphQL returns action as a string, but we need it as an object with type
        const responseObj = {
          action: {
            type: decision.action,
            amount: decision.amount
          },
          reasoning: decision.reasoning,
          confidence: decision.confidence
        };

        // Log the decision for debugging
        console.log('GraphQL Poker Decision:', {
          action: decision.action,
          amount: decision.amount,
          model: request.model,
          transformedAction: responseObj.action
        });

        return {
          content: JSON.stringify(responseObj),
          model: request.model,
          metadata: {
            handMisread: decision.handMisread,
            illogicalPlay: decision.illogicalPlay,
            details: decision.details
          }
        };
      } else if (gameType === 'reverse-hangman') {
        const { gameState, playerState } = this.transformReverseHangmanDataForGraphQL(gameData);

        console.log('Sending Reverse Hangman GraphQL mutation with variables:', {
          botId,
          model: modelName,
          gameStateKeys: Object.keys(gameState),
          playerStateKeys: Object.keys(playerState),
          outputShown: gameState.output_shown?.substring(0, 50) + '...'
        });

        console.log('Sending Apollo mutation for reverse hangman with timeout...');
        let result;
        try {
          result = await this.apolloClient.mutate({
            mutation: GET_AI_REVERSE_HANGMAN_DECISION,
            variables: {
              botId,
              model: modelName,
              gameState,
              playerState
            },
            fetchPolicy: 'no-cache',
            errorPolicy: 'all'
          });
        } catch (mutationError) {
          console.error('GraphQL mutation error for reverse hangman:', {
            error: mutationError,
            message: (mutationError as Error).message,
            stack: (mutationError as Error).stack,
            botId,
            model: modelName
          });
          throw new Error(`GraphQL mutation failed: ${(mutationError as Error).message}`);
        }

        console.log('Reverse Hangman GraphQL mutation result:', {
          hasData: !!result.data,
          hasErrors: !!result.errors,
          errors: result.errors,
          dataKeys: result.data ? Object.keys(result.data) : []
        });
        
        // Log detailed error information
        if (result.errors && result.errors.length > 0) {
          console.error('GraphQL errors for reverse hangman:', result.errors.map((err: any) => ({
            message: err.message,
            path: err.path,
            extensions: err.extensions
          })));
        }

        if (!result.data || !result.data.getAIReverseHangmanDecision) {
          console.error('Invalid GraphQL response for reverse hangman:', {
            data: result.data,
            errors: result.errors
          });
          
          // Include error details in the thrown error
          const errorDetails = result.errors ? 
            result.errors.map((e: any) => e.message).join('; ') : 
            'No data returned';
          throw new Error(`GraphQL mutation failed: ${errorDetails}`);
        }

        const decision = result.data.getAIReverseHangmanDecision;
        
        // Transform response to expected format for reverse hangman
        // The AI expects action to be an object with type and guess properties
        // Normalize 'guess_prompt' to 'guess' to match game engine expectations
        const responseObj = {
          action: {
            type: decision.action === 'guess_prompt' ? 'guess' : (decision.action || 'guess'),
            guess: decision.prompt_guess || '',
            playerId: gameData.currentPlayer?.id || '',
            timestamp: new Date().toISOString()
          },
          reasoning: decision.reasoning,
          confidence: decision.confidence,
          analysis: decision.analysis
        };
        
        console.log('GraphQL Reverse Hangman Decision:', {
          action: decision.action,
          prompt_guess: decision.prompt_guess,
          model: request.model,
          transformedAction: responseObj.action
        });

        return {
          content: JSON.stringify(responseObj),
          model: request.model,
          metadata: {
            analysis: decision.analysis
          }
        };
      }

      throw new Error(`Unsupported game type: ${gameType}`);
    } catch (error: any) {
      console.error('GraphQL request failed with full error:', {
        message: error.message,
        networkError: error.networkError,
        graphQLErrors: error.graphQLErrors,
        stack: error.stack,
        fullError: error
      });
      
      // Check for specific error types
      if (error.networkError) {
        console.error('Network error details:', {
          message: error.networkError.message,
          statusCode: error.networkError.statusCode,
          result: error.networkError.result,
          fullError: error.networkError
        });
        throw new Error(`GraphQL network error: ${error.networkError.message || error.networkError}`);
      }
      
      if (error.graphQLErrors && error.graphQLErrors.length > 0) {
        console.error('GraphQL errors detailed:', error.graphQLErrors.map((e: any) => ({
          message: e.message,
          path: e.path,
          extensions: e.extensions,
          locations: e.locations
        })));
        const errorMessages = error.graphQLErrors.map((e: any) => e.message).join('; ');
        throw new Error(`GraphQL errors: ${errorMessages}`);
      }
      
      // Log any other error details
      console.error('Unknown GraphQL error:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      throw new Error(`GraphQL request failed: ${error.message || 'Unknown error'}`);
    }
  }

  private transformPokerDataForGraphQL(gameData: any): { gameState: any; playerState: any } {
    // Log the structure we're transforming
    console.log('Transforming game data structure:', {
      hasGameSpecific: !!gameData.gameSpecific,
      hasPlayers: !!gameData.players,
      hasCurrentPlayer: !!gameData.currentPlayer,
      keys: Object.keys(gameData)
    });
    
    // Handle the neutral game data format from PokerAIDataCollector
    const gameSpecific = gameData.gameSpecific || {};
    const playerSpecific = gameSpecific.playerSpecific || {};
    const currentPlayer = gameData.currentPlayer || {};
    const players = gameData.players || [];
    
    // Find current player's data from players array
    const currentPlayerData = players.find((p: any) => p.id === currentPlayer.id) || currentPlayer;
    
    // Transform the neutral game data to match GraphQL schema
    const gameState = {
      gameType: 'no_limit_holdem',
      bettingStructure: 'tournament',
      maxPlayers: 8,
      currentPlayers: players.length,
      activePlayers: players.filter((p: any) => p.isActive).length,
      smallBlind: 50,
      bigBlind: 100,
      ante: 0,
      level: gameSpecific.blindLevel || 1,
      handNumber: gameSpecific.handNumber || 1,
      dealerPosition: gameSpecific.positions?.dealer || 0,
      smallBlindPosition: gameSpecific.positions?.smallBlind || 1,
      bigBlindPosition: gameSpecific.positions?.bigBlind || 2,
      bettingRound: gameSpecific.phase || 'preflop',
      communityCards: gameSpecific.communityCards || [],
      potSize: gameSpecific.pot || 0,
      sidePots: gameSpecific.sidePots || [],
      currentBet: gameSpecific.currentBet || 0,
      minRaise: gameSpecific.minRaise || 100,
      opponents: players.filter((p: any) => p.id !== currentPlayer.id).map((p: any, index: number) => ({
        seat: p.position || index,
        id: p.id,
        name: p.name,
        stackSize: p.resources?.chips || p.stackSize || 0,
        position: p.position?.toString() || index.toString(),
        positionType: this.getPositionType(p.position || index, players.length),
        status: this.getPlayerStatus(p),
        amountInPot: p.resources?.investedThisHand || p.amountInPot || 0,
        amountInRound: p.resources?.bet || p.bet || 0,
        isAllIn: p.resources?.allIn || p.isAllIn || false,
        holeCardsKnown: false,
        holeCards: [],
        lastAction: p.resources?.lastAction || p.lastAction ? {
          action: (p.resources?.lastAction || p.lastAction).action,
          amount: (p.resources?.lastAction || p.lastAction).amount,
          timestamp: (p.resources?.lastAction || p.lastAction).timestamp || Date.now()
        } : null
      })),
      actionHistory: {
        preflop: [],
        flop: [],
        turn: [],
        river: []
      },
      mainPot: gameSpecific.pot || 0,
      totalPot: gameSpecific.pot || 0,
      effectiveStackSize: currentPlayerData.resources?.chips || playerSpecific.stackSize || 10000,
      potOdds: {
        toCall: playerSpecific.amountToCall || 0,
        potSize: gameSpecific.pot || 0,
        oddsRatio: playerSpecific.potOdds ? `1:${(1/playerSpecific.potOdds - 1).toFixed(1)}` : '0:0',
        percentage: (playerSpecific.potOdds || 0) * 100,
        breakEvenPercentage: (playerSpecific.potOdds || 0) * 100
      }
    };

    const playerState = {
      holeCards: playerSpecific.holeCards || [],
      stackSize: currentPlayerData.resources?.chips || currentPlayerData.stackSize || playerSpecific.stackSize || 10000,
      position: playerSpecific.positionName || 'BTN',
      positionType: playerSpecific.positionType || 'LP',
      seatNumber: currentPlayerData.position || 0,
      isAllIn: currentPlayerData.resources?.allIn || currentPlayerData.isAllIn || false,
      amountInvestedThisHand: currentPlayerData.resources?.investedThisHand || currentPlayerData.amountInPot || playerSpecific.investedThisHand || 0,
      amountInvestedThisRound: currentPlayerData.resources?.bet || currentPlayerData.bet || 0,
      amountToCall: playerSpecific.amountToCall || 0,
      canCheck: playerSpecific.amountToCall === 0,
      canFold: true,
      canCall: playerSpecific.amountToCall > 0,
      canRaise: (currentPlayerData.resources?.chips || currentPlayerData.stackSize || 0) > playerSpecific.amountToCall,
      minRaiseAmount: gameSpecific.minRaise || 100,
      maxRaiseAmount: currentPlayerData.resources?.chips || currentPlayerData.stackSize || 10000,
      seatsToActAfter: 0,
      relativePosition: 'ip',
      playersLeftToAct: [],
      isClosingAction: false,
      isOpenAction: gameSpecific.currentBet === 0,
      effectiveStacks: '{}',
      stackToPoRatio: playerSpecific.stackToPotRatio || 10,
      commitmentLevel: 0
    };

    return { gameState, playerState };
  }

  private transformReverseHangmanDataForGraphQL(gameData: any): { gameState: any; playerState: any } {
    console.log('Transforming reverse hangman data:', {
      hasGameSpecific: !!gameData.gameSpecific,
      gameSpecificKeys: gameData.gameSpecific ? Object.keys(gameData.gameSpecific) : [],
      phase: gameData.phase,
      currentOutput: gameData.gameSpecific?.currentOutput
    });
    
    // Transform the neutral game data format to match GraphQL schema
    const gameSpecific = gameData.gameSpecific || {};
    const currentPlayer = gameData.currentPlayer || {};
    const playerSpecific = gameSpecific.playerSpecific || {};
    
    // Build gameState according to ReverseHangmanGameStateInput schema
    const gameState = {
      game_type: 'reverse_prompt_engineering',
      output_shown: gameSpecific.currentOutput || '',
      constraints: {
        max_word_count: 50,  // Default max word count
        exact_word_count: 10, // Default exact word count
        difficulty: gameSpecific.difficulty || 'medium',
        category: gameSpecific.category || 'general',
        max_attempts: gameSpecific.maxAttempts || 7
      },
      previous_guesses: (gameSpecific.previousGuesses || []).map((g: any, index: number) => ({
        attempt_number: index + 1,
        prompt_guess: g.guess,
        similarity_score: g.matchPercentage || 0,
        feedback: `${g.matchType || 'incorrect'} - ${g.matchPercentage || 0}% match`
      })),
      game_phase: gameSpecific.phase || 'guessing',
      time_elapsed_seconds: Math.floor((Date.now() - (gameData.startTime || Date.now())) / 1000)
    };
    
    // Build playerState according to ReverseHangmanPlayerStateInput schema
    const playerState = {
      player_id: currentPlayer.id || '',
      current_round: gameSpecific.roundNumber || 1,
      total_rounds: gameSpecific.maxRounds || 5,
      current_score: currentPlayer.score || playerSpecific.totalScore || 0,
      rounds_won: playerSpecific.roundsWon || 0,
      rounds_lost: Math.max(0, (gameSpecific.roundNumber || 1) - 1 - (playerSpecific.roundsWon || 0))
    };
    
    console.log('Transformed reverse hangman data:', {
      gameState,
      playerState
    });
    
    return { gameState, playerState };
  }

  private getCacheKey(request: AIRequest): string {
    return `${request.model}:${request.systemPrompt}:${request.userPrompt}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private extractGameSpecificData(state: IGameState): any {
    const stateAny = state as any;
    const commonKeys = ['gameId', 'phase', 'startTime', 'endTime', 'currentTurn', 'turnCount', 'players', 'metadata'];
    
    const gameSpecific: any = {};
    for (const key in stateAny) {
      if (!commonKeys.includes(key)) {
        gameSpecific[key] = stateAny[key];
      }
    }
    
    return gameSpecific;
  }

  private actionsMatch(a: any, b: any): boolean {
    // Basic type matching
    if (a.type !== b.type) return false;
    
    // For poker actions, we only need to match type and optionally amount
    // Don't require exact object structure match
    if (a.type === 'fold' || a.type === 'check') {
      // These actions don't require amount
      return true;
    }
    
    if (a.type === 'call' || a.type === 'bet' || a.type === 'raise' || a.type === 'all-in') {
      // These actions may have amount, but it's not always required for matching
      // The game engine will handle amount validation
      return true;
    }
    
    // For reverse hangman actions
    if (a.type === 'guess' || a.type === 'skip') {
      // For guess actions, the AI response will include the guess text
      // For skip actions, no additional data needed
      // We'll copy over any additional fields from the AI response to the valid action
      if (a.type === 'guess' && a.guess && b.type === 'guess') {
        // Copy the guess from AI response to the valid action template
        b.guess = a.guess;
      }
      return true;
    }
    
    // For other action types, do a more thorough comparison
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    
    if (aKeys.length !== bKeys.length) return false;
    
    for (let i = 0; i < aKeys.length; i++) {
      if (aKeys[i] !== bKeys[i]) return false;
      
      const aVal = a[aKeys[i]];
      const bVal = b[bKeys[i]];
      
      if (typeof aVal !== typeof bVal) return false;
      
      if (typeof aVal === 'object' && aVal !== null) {
        if (!this.actionsMatch(aVal, bVal)) return false;
      } else if (aVal !== bVal) {
        return false;
      }
    }
    
    return true;
  }

  private getPositionType(position: number, totalPlayers: number): string {
    if (totalPlayers <= 2) return 'HU';
    
    const dealerPosition = totalPlayers - 1;
    const sbPosition = 0;
    const bbPosition = 1;
    
    if (position === sbPosition) return 'SB';
    if (position === bbPosition) return 'BB';
    
    const positionsFromButton = (dealerPosition - position + totalPlayers) % totalPlayers;
    
    if (positionsFromButton <= 1) return 'LP';
    if (positionsFromButton <= Math.floor(totalPlayers / 2)) return 'MP';
    return 'EP';
  }

  private getPlayerStatus(player: any): string {
    if (player.resources?.allIn || player.isAllIn) return 'all_in';
    if (player.resources?.folded || player.folded || !player.isActive) return 'folded';
    if (player.resources?.sittingOut || player.sittingOut) return 'sitting_out';
    return 'active';
  }
}