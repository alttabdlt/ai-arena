// Updated: 2025-01-24 - Fixed JSON extraction for nested objects
import { IGameState, IGameAction } from '../core/interfaces';
import { ApolloClient, NormalizedCacheObject } from '@apollo/client';
import { GET_AI_POKER_DECISION, GET_AI_REVERSE_HANGMAN_DECISION, GET_AI_CONNECT4_DECISION } from './graphql/mutations';

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
  private activeRequests: Map<string, Promise<any>> = new Map();

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
    
    // Log the first 500 chars of the prompt to debug JSON extraction issues
    console.log('User prompt preview (first 500 chars):', request.userPrompt.substring(0, 500));
    console.log('User prompt includes "Current game state":', request.userPrompt.includes('Current game state'));
    
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
        console.error(`AI request attempt ${attempt + 1} failed:`, {
          error: lastError.message,
          model: request.model,
          attempt: attempt + 1
        });
        
        if (attempt < this.config.retryAttempts - 1) {
          console.log(`Retrying in ${Math.pow(2, attempt)} seconds...`);
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
        console.log('Detected game type:', gameType);
        
        if (!gameType) {
          console.error('Could not detect game type from prompt');
          throw new Error('Unable to detect game type from prompt. Prompt must contain game-specific keywords or JSON structure.');
        }
        
        if (gameType === 'poker' || gameType === 'reverse-hangman' || gameType === 'connect4') {
          return await this.sendGraphQLRequest(request, modelConfig, gameType);
        } else {
          throw new Error(`Unsupported game type: ${gameType}`);
        }
      } catch (error) {
        console.error('Failed to use GraphQL:', error);
        throw error; // Don't fall back to REST - it doesn't exist
      }
    }

    // This should never be reached now, but keeping for safety
    throw new Error('AI request failed: No GraphQL client available');
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
        
        // Check for Connect4 specific fields
        if (gameData.gameType === 'connect4' || 
            (gameData.board !== undefined && 
             gameData.validColumns !== undefined && 
             gameData.playerNumber !== undefined)) {
          console.log('Detected game type from structure: connect4');
          return 'connect4';
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
    
    // Check for Connect4 keywords
    if (promptLower.includes('connect4') || promptLower.includes('connect 4') || 
        promptLower.includes('column') || promptLower.includes('disc') ||
        promptLower.includes('7-column') || promptLower.includes('6-row') ||
        promptLower.includes('four in a row')) {
      console.log('Detected game type from keywords: connect4');
      return 'connect4';
    }
    
    console.log('Could not detect game type from prompt');
    return null;
  }

  private async sendGraphQLRequest(request: AIRequest, modelConfig: any, gameType: string): Promise<AIResponse> {
    console.log('=== GRAPHQL REQUEST START (v2) ===');
    console.log('Code version: 2.0 - With fixes for JSON extraction');
    console.log('Timestamp:', new Date().toISOString());
    
    if (!this.apolloClient) {
      throw new Error('Apollo client not configured');
    }

    let requestKey = ''; // Declare at method scope for error cleanup
    
    try {
      // Log the full prompt for debugging
      console.log('Full AI prompt (first 500 chars):', request.userPrompt.substring(0, 500));
      console.log('Detected game type:', gameType);
      
      // Extract game data and valid actions from the complex prompt structure
      let gameData: any;
      let validActions: any[] = [];
      
      // First, try to extract the game state JSON object
      // Extract everything between "Current game state:" (with optional text after) and "Valid actions"
      const gameStateSection = request.userPrompt.match(/Current game state(?:\s*\([^)]*\))?:\s*([\s\S]*?)(?:Valid actions|$)/);
      console.log('=== JSON EXTRACTION DEBUG ===');
      console.log('Prompt contains "Current game state":', request.userPrompt.includes('Current game state'));
      console.log('Prompt contains "(for reference)":', request.userPrompt.includes('(for reference)'));
      console.log('Game state section match:', {
        found: !!gameStateSection,
        hasCurrentGameState: request.userPrompt.includes('Current game state'),
        hasValidActions: request.userPrompt.includes('Valid actions')
      });
      
      // Check if the prompt contains template variables that weren't replaced
      if (request.userPrompt.includes('{{')) {
        console.error('Prompt contains unreplaced template variables');
        const unresolved = request.userPrompt.match(/\{\{[^}]+\}\}/g);
        console.error('Unresolved template variables:', unresolved);
        throw new Error('Prompt contains unresolved template variables: ' + unresolved?.join(', '));
      }
      
      if (gameStateSection) {
        const jsonText = gameStateSection[1].trim();
        console.log('Extracted game state section length:', jsonText.length);
        console.log('First 100 chars of extracted section:', jsonText.substring(0, 100));
        
        // Find the complete JSON object by counting braces
        let braceCount = 0;
        let startIndex = jsonText.indexOf('{');
        let endIndex = -1;
        
        if (startIndex !== -1) {
          for (let i = startIndex; i < jsonText.length; i++) {
            if (jsonText[i] === '{') braceCount++;
            else if (jsonText[i] === '}') {
              braceCount--;
              if (braceCount === 0) {
                endIndex = i + 1;
                break;
              }
            }
          }
          
          if (endIndex !== -1) {
            try {
              const extractedJson = jsonText.substring(startIndex, endIndex);
              console.log('Extracted JSON length:', extractedJson.length);
              console.log('First 100 chars of JSON:', extractedJson.substring(0, 100));
              console.log('Last 100 chars of JSON:', extractedJson.substring(Math.max(0, extractedJson.length - 100)));
              gameData = JSON.parse(extractedJson);
            } catch (e) {
              console.error('Failed to parse extracted game state:', e);
              console.error('Parse error details:', (e as any).message);
              console.error('Extracted JSON preview:', jsonText.substring(startIndex, Math.min(endIndex, startIndex + 200)) + '...');
              const extractedJson = jsonText.substring(startIndex, endIndex);
              // Check for common JSON issues
              if (extractedJson.includes('undefined')) {
                console.error('JSON contains "undefined" which is not valid JSON');
              }
              if (extractedJson.includes('NaN')) {
                console.error('JSON contains "NaN" which is not valid JSON');
              }
              throw new Error(`Failed to parse game state JSON: ${(e as any).message}`);
            }
          } else {
            console.error('Could not find matching closing brace for game state JSON');
          }
        }
      }
      
      // Then extract valid actions array - handle different formats
      const actionsSection = request.userPrompt.match(/Valid actions(?:\s+you can take)?:\s*([\s\S]*?)$/);
      console.log('Valid actions section match:', {
        found: !!actionsSection
      });
      
      if (actionsSection) {
        const actionsText = actionsSection[1].trim();
        console.log('Actions text length:', actionsText.length);
        console.log('First 100 chars of actions text:', actionsText.substring(0, 100));
        
        // Find the complete array by counting brackets
        let bracketCount = 0;
        let startIndex = actionsText.indexOf('[');
        let endIndex = -1;
        
        if (startIndex !== -1) {
          for (let i = startIndex; i < actionsText.length; i++) {
            if (actionsText[i] === '[') bracketCount++;
            else if (actionsText[i] === ']') {
              bracketCount--;
              if (bracketCount === 0) {
                endIndex = i + 1;
                break;
              }
            }
          }
          
          if (endIndex !== -1) {
            try {
              const extractedJson = actionsText.substring(startIndex, endIndex);
              validActions = JSON.parse(extractedJson);
              console.log('Extracted valid actions count:', validActions.length);
            } catch (e) {
              console.error('Failed to parse valid actions:', e);
            }
          }
        }
      }
      
      // If extraction failed, try a more general approach with proper brace counting
      if (!gameData) {
        console.warn('Primary game data extraction failed, attempting fallback extraction');
        console.warn('Full prompt:', request.userPrompt);
        console.warn('Prompt length:', request.userPrompt.length);
        
        // Find the first JSON object or array in the prompt
        let jsonStart = -1;
        let jsonEnd = -1;
        let isArray = false;
        
        // Look for the first { or [
        for (let i = 0; i < request.userPrompt.length; i++) {
          if (request.userPrompt[i] === '{' || request.userPrompt[i] === '[') {
            jsonStart = i;
            isArray = request.userPrompt[i] === '[';
            break;
          }
        }
        
        if (jsonStart !== -1) {
          // Count braces/brackets to find the complete JSON
          let count = 0;
          const openChar = isArray ? '[' : '{';
          const closeChar = isArray ? ']' : '}';
          
          for (let i = jsonStart; i < request.userPrompt.length; i++) {
            if (request.userPrompt[i] === openChar) count++;
            else if (request.userPrompt[i] === closeChar) {
              count--;
              if (count === 0) {
                jsonEnd = i + 1;
                break;
              }
            }
          }
          
          if (jsonEnd !== -1) {
            try {
              const extractedJson = request.userPrompt.substring(jsonStart, jsonEnd);
              const parsed = JSON.parse(extractedJson);
              
              // If we got an array, it's probably valid actions, not game data
              if (isArray) {
                console.warn('Fallback extraction found an array, not game data. Looking for an object instead.');
                // Continue searching for an object after this array
                for (let i = jsonEnd; i < request.userPrompt.length; i++) {
                  if (request.userPrompt[i] === '{') {
                    jsonStart = i;
                    // Count braces for the object
                    count = 0;
                    for (let j = jsonStart; j < request.userPrompt.length; j++) {
                      if (request.userPrompt[j] === '{') count++;
                      else if (request.userPrompt[j] === '}') {
                        count--;
                        if (count === 0) {
                          jsonEnd = j + 1;
                          const objJson = request.userPrompt.substring(jsonStart, jsonEnd);
                          gameData = JSON.parse(objJson);
                          break;
                        }
                      }
                    }
                    break;
                  }
                }
              } else {
                gameData = parsed;
              }
              
              if (gameData) {
                console.log('Fallback extraction successful, found game data');
              }
            } catch (e) {
              console.error('Failed to parse fallback JSON. Parse error:', e);
              console.error('JSON Start position:', jsonStart);
              console.error('JSON End position:', jsonEnd);
              console.error('Attempted to parse:', request.userPrompt.substring(jsonStart, Math.min(jsonEnd, jsonStart + 200)) + '...');
              console.error('Parse error at position:', (e as any).message);
              // Try to identify the exact character causing the issue
              if (jsonStart !== -1 && jsonEnd !== -1) {
                const problemJson = request.userPrompt.substring(jsonStart, jsonEnd);
                console.error('Full extracted JSON:', problemJson);
                console.error('Character at position 328:', problemJson.charAt(328), 'Code:', problemJson.charCodeAt(328));
              }
              throw new Error(`Could not extract game data from prompt. Failed to parse JSON at position ${(e as any).message?.match(/position (\d+)/)?.at(1) || 'unknown'}`);
            }
          } else {
            console.error('Could not find complete JSON structure in prompt');
            throw new Error('Incomplete JSON structure in prompt');
          }
        } else {
          console.error('No JSON structure found in prompt. Prompt structure:', {
            length: request.userPrompt.length,
            hasCurrentGameState: request.userPrompt.includes('Current game state:'),
            hasValidActions: request.userPrompt.includes('Valid actions'),
            first200Chars: request.userPrompt.substring(0, 200)
          });
          throw new Error('No JSON structure found in prompt');
        }
      }
      
      console.log('Extracted game data:', gameData);
      console.log('Extracted valid actions:', validActions);
      
      // Use player ID from game data for consistent bot ID
      const playerId = gameData.currentPlayer?.id || gameData.player?.id || `player-${Date.now()}`;
      const botId = playerId.startsWith('player-') ? playerId : `game-bot-${playerId}`;
      
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
      } else if (gameType === 'connect4') {
        const { gameState, playerState } = this.transformConnect4DataForGraphQL(gameData);

        // Create a unique key for deduplication
        requestKey = `connect4-${botId}-${gameState.move_count}-${playerState.player_number}`;
        
        // Check if there's already an active request for this state
        const activeRequest = this.activeRequests.get(requestKey);
        if (activeRequest) {
          console.log('Found active Connect4 request, reusing:', requestKey);
          const result = await activeRequest;
          return result;
        }

        console.log('Sending Connect4 GraphQL mutation with variables:', {
          botId,
          model: modelName,
          gameStateKeys: Object.keys(gameState),
          playerStateKeys: Object.keys(playerState),
          requestKey
        });

        // Create the mutation promise and store it
        const mutationPromise = this.apolloClient.mutate({
          mutation: GET_AI_CONNECT4_DECISION,
          variables: {
            botId,
            model: modelName,
            gameState,
            playerState
          },
          fetchPolicy: 'no-cache',
          errorPolicy: 'all'
        });

        // Store the promise to prevent duplicate requests
        this.activeRequests.set(requestKey, mutationPromise);

        try {
          const result = await mutationPromise;

        console.log('Connect4 GraphQL mutation result:', {
          hasData: !!result.data,
          hasErrors: !!result.errors,
          errors: result.errors,
          dataKeys: result.data ? Object.keys(result.data) : []
        });

        if (!result.data || !result.data.getAIConnect4Decision) {
          console.error('Invalid GraphQL response for connect4:', result);
          // Clean up the active request on error
          this.activeRequests.delete(requestKey);
          throw new Error('No AI decision returned from GraphQL mutation');
        }

        const decision = result.data.getAIConnect4Decision;
        
        // Transform response to expected format
        const responseObj = {
          action: {
            type: 'place',
            column: decision.column,
            playerId: gameData.currentPlayer?.id || '',
            timestamp: new Date().toISOString()
          },
          reasoning: decision.reasoning,
          confidence: decision.confidence,
          analysis: decision.analysis
        };

        console.log('GraphQL Connect4 Decision:', {
          action: decision.action,
          column: decision.column,
          model: request.model,
          transformedAction: responseObj.action
        });

        // Clean up the active request on success
        this.activeRequests.delete(requestKey);
        
        return {
          content: JSON.stringify(responseObj),
          model: request.model,
          metadata: {
            analysis: decision.analysis
          }
        };
        } catch (innerError: any) {
          // Clean up the active request on error
          this.activeRequests.delete(requestKey);
          throw innerError;
        }
      }

      throw new Error(`Unsupported game type: ${gameType}`);
    } catch (error: any) {
      // Clean up any active Connect4 requests on error
      if (gameType === 'connect4' && this.activeRequests.has(requestKey)) {
        console.log('Cleaning up failed Connect4 request:', requestKey);
        this.activeRequests.delete(requestKey);
      }
      
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
        
        // Check if it's a connection refused error (server down)
        if (error.networkError.message?.includes('ERR_CONNECTION_REFUSED') || 
            error.networkError.message?.includes('Failed to fetch') ||
            error.networkError.message?.includes('NetworkError')) {
          throw new Error('Backend server is not running. Please ensure the backend is started on port 4000.');
        }
        
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

  private transformConnect4DataForGraphQL(gameData: any): { gameState: any; playerState: any } {
    console.log('Transforming Connect4 data:', {
      hasBoard: !!gameData.board,
      playerNumber: gameData.playerNumber,
      validColumns: gameData.validColumns,
      boardMetrics: gameData.boardMetrics
    });
    
    // Transform the neutral game data format to match GraphQL schema
    const boardStrings = gameData.board || [];
    const playerNumber = gameData.playerNumber || 1;
    const opponentNumber = playerNumber === 1 ? 2 : 1;
    
    // Convert board from array of strings to 2D array for processing
    const board: number[][] = boardStrings.map((rowStr: string) => 
      rowStr.split('').map((cell: string) => cell === '.' ? 0 : parseInt(cell))
    );
    
    // Format board for GraphQL (convert to 2D array of strings)
    const formattedBoard = board.map((row: number[]) => 
      row.map((cell: number) => cell === 0 ? '.' : cell.toString())
    );
    
    // Count pieces
    let playerPieces = 0;
    let opponentPieces = 0;
    let topHalf = 0;
    let bottomHalf = 0;
    let leftSide = 0;
    let center = 0;
    let rightSide = 0;
    
    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board[row].length; col++) {
        const piece = board[row][col];
        if (piece === playerNumber) {
          playerPieces++;
          // Distribution tracking
          if (row < 3) topHalf++;
          else bottomHalf++;
          
          if (col < 2) leftSide++;
          else if (col >= 2 && col <= 4) center++;
          else rightSide++;
        } else if (piece === opponentNumber) {
          opponentPieces++;
        }
      }
    }
    
    // Center column control
    let centerYours = 0;
    let centerOpponent = 0;
    const centerCol = 3;
    
    for (let row = 0; row < board.length; row++) {
      if (board[row] && board[row][centerCol] === playerNumber) {
        centerYours++;
      } else if (board[row] && board[row][centerCol] === opponentNumber) {
        centerOpponent++;
      }
    }
    
    // Build gameState according to Connect4GameStateInput schema
    const gameState = {
      game_type: 'connect_four',
      board: formattedBoard,
      current_player_index: playerNumber - 1,
      move_count: gameData.moveCount || 0,
      game_phase: gameData.gamePhase || 'playing',
      valid_columns: gameData.validColumns || [],
      last_move: gameData.lastMove ? {
        column: gameData.lastMove.column,
        row: gameData.lastMove.row,
        was_yours: gameData.lastMove.playerId === (gameData.currentPlayer?.id || `player-${playerNumber}`)
      } : null
    };
    
    // Build playerState according to Connect4PlayerStateInput schema
    const playerState = {
      player_id: gameData.currentPlayer?.id || `player-${playerNumber}`,
      player_pieces: playerPieces,
      opponent_pieces: opponentPieces,
      board_metrics: {
        center_column_control: {
          yours: centerYours,
          opponent: centerOpponent
        },
        piece_distribution: {
          top_half: topHalf,
          bottom_half: bottomHalf,
          left_side: leftSide,
          center: center,
          right_side: rightSide
        }
      },
      threat_analysis: {
        immediate_win_opportunities: gameData.boardMetrics?.immediateWinOpportunities > 0 ? 
          gameData.validColumns || [] : [],
        must_block_positions: gameData.boardMetrics?.opponentWinThreats > 0 ? 
          gameData.validColumns || [] : [],
        total_threats_created: gameData.boardMetrics?.immediateWinOpportunities || 0,
        total_threats_against: gameData.boardMetrics?.opponentWinThreats || 0
      },
      calculations: {
        moves_remaining: 42 - (gameData.moveCount || 0),
        board_fill_percentage: ((gameData.moveCount || 0) / 42) * 100,
        column_availability: gameData.validColumns || []
      }
    };
    
    console.log('Transformed Connect4 data:', {
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
    
    // For connect4 actions
    if (a.type === 'place') {
      // Column validation happens in game engine
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