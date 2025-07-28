# New Game Implementation Guide

This guide provides a **complete, step-by-step checklist** for implementing a new game in the AI Arena platform. Follow EVERY step in order. Do NOT skip steps or create custom implementations.

## Pre-Implementation Checklist

### 1. Read and Understand Existing Games
- [ ] Read `/app/src/game-engine/core/interfaces.ts` completely
- [ ] Study poker implementation: `/app/src/game-engine/games/poker/`
- [ ] Study reverse-hangman implementation: `/app/src/game-engine/games/reverse-hangman/`
- [ ] Study connect4 implementation: `/app/src/game-engine/games/connect4/`
- [ ] Read base classes: `BaseGameEngine.ts`, `BaseGameManager.ts`, `BaseAIAgent.ts`

### 2. Verify Game Requirements
- [ ] Game name in lowercase with hyphens (e.g., `tic-tac-toe`, not `TicTacToe`)
- [ ] Game supports 1-8 players
- [ ] Game has clear win/lose/draw conditions
- [ ] Game has discrete actions/moves
- [ ] Game state can be represented as JSON

## ⚠️ CRITICAL: TOP 5 FAILURE POINTS (READ FIRST!)

Based on analysis of multiple game implementations, these are the most common causes of failures:

### 1. **Double Turn Switching (Causes "No valid actions available")**
**Problem**: Your game switches turns in `applyAction()`, then BaseGameEngine also switches turns
**Solution**: NEVER call `switchTurn()` or modify `currentTurn` in your `applyAction()` method
```typescript
// ❌ WRONG - Don't do this in applyAction
this.state.currentTurn = nextPlayer.id;
this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % 2;

// ✅ CORRECT - Let BaseGameEngine handle it
// Just apply the action, BaseGameEngine will call advanceTurn()
```

### 2. **Property Name Mismatches (Causes GraphQL errors)**
**Problem**: Using different property names in engine vs GraphQL schema
**Solution**: Use EXACT same property names everywhere
```typescript
// ❌ WRONG
Engine: lastMove: { row: 0, col: 3 }
GraphQL: lastMove: { row: 0, column: 3 }

// ✅ CORRECT - Consistent everywhere
lastMove: { row: 0, column: 3 }
```

### 3. **Import/Export Pattern Blindness**
**Problem**: Assuming exports without checking, missing singleton instances
**Solution**: ALWAYS check entire file, especially bottom 20 lines
```bash
# Check for singleton exports at file bottom
tail -20 targetFile.ts | grep -E "export|new"
```

### 4. **Creating Methods That Don't Exist**
**Problem**: Inventing method names instead of checking base classes
**Solution**: Read base class FIRST, only implement abstract methods
```bash
# Find what methods you MUST implement
grep -A 5 "abstract" BaseGameEngine.ts
```

### 5. **AI Prompt Format Violations**
**Problem**: Modifying the standard prompt format breaks JSON extraction
**Solution**: Use EXACT format - no modifications allowed
```typescript
// ✅ ONLY acceptable format:
`Current game state:
${JSON.stringify(gameData, null, 2)}

Valid actions:
${JSON.stringify(validActions, null, 2)}

[Instructions here]`
```

## ⚠️ CRITICAL AI INTEGRATION REQUIREMENTS

Before implementing ANY game, understand these MANDATORY requirements:

### 1. Prompt Format (EXACT - DO NOT MODIFY)
```
Current game state:
[JSON object]

Valid actions:
[JSON array]

[Additional instructions]
```

**CRITICAL Rules**:
- Use EXACTLY "Current game state:" (with colon, followed by newline)
- Use EXACTLY "Valid actions:" (NOT "Valid actions you can take:")
- NO template variables inside JSON sections (no {{gameData.field}})
- Extract all values BEFORE stringifying JSON

### 2. JSON Extraction Compatibility
The AIService uses regex with brace counting to extract game data. Your prompts MUST:
- Have complete, valid JSON after "Current game state:"
- Have complete, valid JSON array after "Valid actions:"
- Handle nested objects properly (test with 3+ levels)
- Escape special characters in strings

### 3. AI Agent Creation Requirements
- ALWAYS create game-specific AI agents (extend BaseAIAgent)
- DO NOT rely on UniversalAIAgent fallback
- Implement proper data collector pattern
- Add console.log in createAIAgent to verify correct agent type

### 4. GraphQL Integration (No REST API)
- There is NO REST API endpoint (/api/ai doesn't exist)
- ALL AI requests must go through GraphQL
- Add game mutation to backend GraphQL schema
- Implement data transformation in AIService.sendGraphQLRequest
- Add game detection in AIService.detectGameType

### 5. Common Failures to Avoid
- ❌ Using "Valid actions you can take:" instead of "Valid actions:"
- ❌ Template variables in JSON ({{gameData.gameSpecific.field}})
- ❌ Not creating game-specific AI agent
- ❌ Missing GraphQL mutation in backend
- ❌ Not testing with nested JSON objects

### 6. Mandatory Testing Before Completion
- [ ] Test with complex nested JSON (3+ levels deep)
- [ ] Test with special characters (" ' \n \t)
- [ ] Test all 4 AI models work without timeout
- [ ] Verify logs show correct agent type (not UniversalAIAgent)
- [ ] Confirm no "Failed to parse game state" errors
- [ ] Check game completes full cycle with AI decisions

## Part 1: Game Engine Implementation

### Step 1: Create Game Types File
**File**: `/app/src/game-engine/games/your-game/YourGameTypes.ts`

```typescript
import {
  IGameState,
  IGameAction,
  IGameConfig,
  IGamePlayer,
  IGameValidationResult,
} from '../../core/interfaces';

// Define game-specific constants
export const YOUR_GAME_CONSTANT = value;

// Define game state interface
export interface YourGameState extends IGameState {
  // Add game-specific state fields
  board?: any;
  currentPlayerIndex: number;
  gameSpecificField: any;
}

// Define game action interface  
export interface YourGameAction extends IGameAction {
  type: 'move' | 'pass' | 'timeout'; // Your action types
  // Add action-specific fields
  position?: any;
}

// Define game config interface
export interface YourGameConfig extends IGameConfig {
  // Add game-specific config
  timeLimit: number;
  gameSpecificConfig: any;
}

// Define game player interface
export interface YourGamePlayer extends IGamePlayer {
  // Add player-specific fields
  playerNumber?: number;
  gameSpecificPlayerField?: any;
}
```

### Step 2: Create Game Engine
**File**: `/app/src/game-engine/games/your-game/engine/YourGameEngine.ts`

```typescript
import { BaseGameEngine } from '../../../base/BaseGameEngine';
import { IGamePlayer, IGameValidationResult } from '../../../core/interfaces';
import { IGameContext } from '../../../core/context';
import { YourGameState, YourGameAction, YourGamePlayer } from '../YourGameTypes';

export class YourGameEngine extends BaseGameEngine<YourGameState, YourGameAction> {
  constructor(context: IGameContext) {
    super(context);
  }

  // REQUIRED: Override these 6 methods ONLY
  
  protected createInitialState(players: IGamePlayer[]): YourGameState {
    // Create and return initial game state
  }

  protected applyAction(action: YourGameAction): void {
    // Apply the action to current state
    // Use this.state to access/modify state
  }

  protected validateGameSpecificAction(action: YourGameAction): IGameValidationResult {
    // Validate game-specific rules
    // Return { isValid: true } or { isValid: false, errors: ['...'] }
  }

  getValidActions(playerId: string): YourGameAction[] {
    // Return array of valid actions for player
    // Always include timeout action as fallback
  }

  isGameOver(): boolean {
    // Return true if game has ended
  }

  getWinners(): string[] {
    // Return array of winner player IDs (empty if draw/no winners)
  }
}
```

### Step 3: Create Game Manager
**File**: `/app/src/game-engine/games/your-game/YourGameManager.ts`

```typescript
import { BaseGameManager } from '../../base/BaseGameManager';
import { IGamePlayer, IPlayerConfig } from '../../core/interfaces';
import { IGameContext } from '../../core/context';
import { IGameAIAgent } from '../../core/interfaces';
import { GameAIService } from '../../services/AIService';
import { YourGameState, YourGameAction, YourGameConfig, YourGamePlayer } from './YourGameTypes';
import { YourGameEngine } from './engine/YourGameEngine';
import { YourGameAIAgentFactory } from './ai/YourGameAIAgentFactory';
import { YourGameScoringSystem } from './scoring/YourGameScoringSystem';

export class YourGameManager extends BaseGameManager<YourGameState, YourGameConfig> {
  private aiService: GameAIService;

  constructor(config: YourGameConfig, context: IGameContext, aiService: GameAIService) {
    const engine = new YourGameEngine(context);
    const scoringSystem = new YourGameScoringSystem(context);
    super(engine, config, context, scoringSystem);
    this.aiService = aiService;
  }

  // REQUIRED: Override these 5 methods ONLY

  protected async initializePlayers(): Promise<IGamePlayer[]> {
    // Convert config player configs to game players
    // Validate player count
    // Return array of initialized players
  }

  protected async createAIAgent(config: IPlayerConfig): Promise<IGameAIAgent<YourGameState, YourGameAction>> {
    // Import aiModels from games index
    const { aiModels } = await import('../index');
    
    const agentFactory = new YourGameAIAgentFactory(
      {
        aiService: this.aiService,
        models: aiModels,
        defaultModel: config.aiModel || 'gpt-4o'
      },
      this.context
    );
    
    return agentFactory.createAgent(config);
  }

  protected async processGameTick(): Promise<void> {
    // Handle any time-based game logic
    // Check for game end conditions
    // Usually just check if game is over and call endGame()
  }

  protected getFallbackAction(playerId: string): YourGameAction | null {
    // Return a timeout/default action for player
    return {
      type: 'timeout',
      playerId,
      timestamp: new Date(),
    };
  }

  protected async cleanup(): Promise<void> {
    // Clean up resources
    // Clear timers, AI agents, etc.
    this.aiAgents.clear();
  }
}
```

### Step 4: Create AI Data Collector
**File**: `/app/src/game-engine/games/your-game/ai/YourGameAIDataCollector.ts`

```typescript
import { BaseGameDataCollector } from '../../../ai/AIDataCollector';
import { YourGameState, YourGamePlayer } from '../YourGameTypes';

export class YourGameAIDataCollector extends BaseGameDataCollector<YourGameState> {
  collectNeutralData(state: YourGameState, playerId: string): any {
    const player = state.players.find(p => p.id === playerId) as YourGamePlayer;
    const opponent = state.players.find(p => p.id !== playerId) as YourGamePlayer;
    
    if (!player || !opponent) {
      throw new Error('Player not found');
    }

    // CRITICAL: Return EXACT structure for AI service compatibility
    return {
      // Required standard fields
      gameType: 'your-game',
      gameId: state.gameId,
      phase: state.phase,
      turnCount: state.turnCount,
      
      // Players array (required for prompt parsing)
      players: state.players.map(p => ({
        id: p.id,
        name: p.name,
        isActive: p.isActive,
        resources: p.resources || {}
      })),
      
      // Current player info
      currentPlayer: {
        id: player.id,
        name: player.name,
        isActive: player.isActive,
        resources: player.resources || {}
      },
      
      // Game-specific data (NO nested template variables!)
      gameSpecific: {
        // Extract ALL values here - do NOT use {{gameData.field}} patterns
        // Example: boardSize: state.config.boardSize (NOT {{gameData.gameSpecific.boardSize}})
      },
      
      // Calculations (mathematical only)
      calculations: {
        // Example: movesRemaining: this.calculateMovesRemaining(state)
      }
    };
  }

  private getValidActions(state: YourGameState, playerId: string): any[] {
    // Return list of valid actions that will be passed to AI
    // These MUST match what the engine's getValidActions returns
  }
}
```

### Step 5: Create AI Agent Factory
**File**: `/app/src/game-engine/games/your-game/ai/YourGameAIAgentFactory.ts`

```typescript
import { DefaultAIAgentFactory, AIAgentFactoryConfig } from '../../../ai/AIAgentFactory';
import { YourGameState, YourGameAction } from '../YourGameTypes';
import { IGameAIAgent, IPlayerConfig } from '../../../core/interfaces';
import { IGameContext } from '../../../core/context';
import { AIModelConfig, AIPromptTemplate } from '../../../ai/AIDecisionStructure';
import { YourGameAIDataCollector } from './YourGameAIDataCollector';

export class YourGameAIAgentFactory extends DefaultAIAgentFactory<YourGameState, YourGameAction> {
  private dataCollector: YourGameAIDataCollector;

  constructor(config: AIAgentFactoryConfig, context: IGameContext) {
    super(config, context);
    this.dataCollector = new YourGameAIDataCollector();
  }

  createAgent(playerConfig: IPlayerConfig): IGameAIAgent<YourGameState, YourGameAction> {
    const modelConfig = this.getModelConfig(playerConfig.aiModel!);
    return this.createModelSpecificAgent(playerConfig, modelConfig);
  }
  
  protected getModelConfig(modelId: string): AIModelConfig {
    const config = this.config.models.get(modelId);
    if (!config) {
      return {
        id: modelId,
        name: modelId,
        provider: 'openai',
        model: modelId,
        maxTokens: 1000,
        temperature: 0.7
      };
    }
    return config;
  }

  getPromptTemplate(modelConfig: AIModelConfig): AIPromptTemplate {
    return {
      system: `You are an AI playing Your Game Name using the {{modelName}} model.
Your strategy is: {{aiStrategy}}

[Game rules in neutral language]

Respond with a valid JSON object containing:
{
  "action": {
    "type": "action_type",
    // other required fields
  },
  "confidence": number between 0 and 1,
  "reasoning": "Brief explanation"
}`,

      // CRITICAL: Use EXACT format - DO NOT MODIFY!
      user: `Current game state:
{{gameData}}

Valid actions:
{{validActions}}

Make your move.`,

      responseFormat: 'json'
    };
  }

  protected getDataCollector() {
    return this.dataCollector;
  }
}
```

### Step 6: Create Scoring System
**File**: `/app/src/game-engine/games/your-game/scoring/YourGameScoringSystem.ts`

```typescript
import { BaseGameScoringSystem } from '../../../scoring/BaseGameScoringSystem';
import { IScoreCategory, IScoreBreakdown } from '../../../scoring/interfaces';
import { YourGameState } from '../YourGameTypes';
import { IGameContext } from '../../../core/context';

export class YourGameScoringSystem extends BaseGameScoringSystem<YourGameState> {
  constructor(context: IGameContext) {
    super(context);
  }

  calculateScore(state: YourGameState): Map<string, IScoreBreakdown> {
    const scores = new Map<string, IScoreBreakdown>();
    
    for (const player of state.players) {
      const breakdown: IScoreBreakdown = {
        playerId: player.id,
        categories: this.calculateCategories(state, player.id),
        totalScore: 0,
        rank: 0
      };
      
      breakdown.totalScore = breakdown.categories.reduce((sum, cat) => sum + cat.score, 0);
      scores.set(player.id, breakdown);
    }
    
    this.calculateRanks(scores);
    return scores;
  }

  private calculateCategories(state: YourGameState, playerId: string): IScoreCategory[] {
    return [
      {
        name: 'Base Score',
        score: this.calculateBaseScore(state, playerId),
        weight: 0.6
      },
      {
        name: 'Style Score',
        score: this.calculateStyleScore(state, playerId),
        weight: 0.4
      }
    ];
  }

  private calculateBaseScore(state: YourGameState, playerId: string): number {
    // Calculate base game score
    return 0;
  }

  private calculateStyleScore(state: YourGameState, playerId: string): number {
    // Calculate style/bonus points
    return 0;
  }
}
```

### Step 7: Create Game Class and Factory
**File**: `/app/src/game-engine/games/your-game/YourGame.ts`

```typescript
import { IGame, IGameEngine, IGameManager, IGameScoringSystem, IGameAIAgent, IPlayerConfig, IGameValidationResult } from '../../core/interfaces';
import { IGameContext } from '../../core/context';
import { GameAIService } from '../../services/AIService';
import { YourGameState, YourGameAction, YourGameConfig } from './YourGameTypes';
import { YourGameEngine } from './engine/YourGameEngine';
import { YourGameManager } from './YourGameManager';
import { YourGameScoringSystem } from './scoring/YourGameScoringSystem';
import { YourGameAIAgentFactory } from './ai/YourGameAIAgentFactory';
import { GameDescriptorBuilder, BaseGameFactory } from '../../registry/GameDescriptor';
import { AIModelConfig } from '../../ai/AIDecisionStructure';

export class YourGame implements IGame<YourGameState, YourGameAction, YourGameConfig> {
  id = 'your-game';
  name = 'Your Game Name';
  description = 'Brief game description';
  minPlayers = 2; // Set appropriate min
  maxPlayers = 4; // Set appropriate max
  category: 'strategy' | 'card' | 'word' | 'puzzle' | 'other' = 'strategy';
  tags = ['tag1', 'tag2'];
  
  createEngine(): IGameEngine<YourGameState, YourGameAction> {
    throw new Error('Use factory method');
  }
  
  createManager(config: YourGameConfig): IGameManager<YourGameState, YourGameConfig> {
    throw new Error('Use factory method');
  }
  
  createAIAgent(config: IPlayerConfig): IGameAIAgent<YourGameState, YourGameAction> {
    throw new Error('Use factory method');
  }
  
  createScoringSystem(): IGameScoringSystem<YourGameState> {
    throw new Error('Use factory method');
  }
  
  getDefaultConfig(): YourGameConfig {
    return {
      maxPlayers: this.maxPlayers,
      thinkingTime: 30000,
      playerConfigs: [],
      // Add game-specific defaults
      timeLimit: 60000,
    };
  }
  
  validateConfig(config: YourGameConfig): IGameValidationResult {
    const errors: string[] = [];
    
    // Validate player count
    if (config.playerConfigs.length < this.minPlayers || config.playerConfigs.length > this.maxPlayers) {
      errors.push(`Game requires ${this.minPlayers}-${this.maxPlayers} players`);
    }
    
    // Add game-specific validation
    
    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

export class YourGameFactory extends BaseGameFactory<YourGameState, YourGameAction, YourGameConfig> {
  constructor(
    private aiService: GameAIService,
    private aiModels: Map<string, AIModelConfig>
  ) {
    super();
  }

  createGame(): IGame<YourGameState, YourGameAction, YourGameConfig> {
    return new YourGame();
  }

  createEngine(context: IGameContext): IGameEngine<YourGameState, YourGameAction> {
    return new YourGameEngine(context);
  }

  createManager(config: YourGameConfig, context: IGameContext): IGameManager<YourGameState, YourGameConfig> {
    return new YourGameManager(config, context, this.aiService);
  }

  createAIAgent(config: IPlayerConfig, context: IGameContext): IGameAIAgent<YourGameState, YourGameAction> {
    const factory = new YourGameAIAgentFactory(
      {
        aiService: this.aiService,
        models: this.aiModels,
        defaultModel: config.aiModel || 'gpt-4o'
      },
      context
    );
    
    return factory.createAgent(config);
  }

  createScoringSystem(context: IGameContext): IGameScoringSystem<YourGameState> {
    return new YourGameScoringSystem(context);
  }

  getDefaultConfig(): YourGameConfig {
    return new YourGame().getDefaultConfig();
  }

  protected validateGameSpecificConfig(config: YourGameConfig): IGameValidationResult {
    return new YourGame().validateConfig(config);
  }
}

export function createYourGameDescriptor(aiService: GameAIService, aiModels: Map<string, AIModelConfig>) {
  const factory = new YourGameFactory(aiService, aiModels);
  
  return new GameDescriptorBuilder<YourGameState, YourGameAction, YourGameConfig>()
    .setId('your-game')
    .setName('Your Game Name')
    .setDescription('Detailed game description for players')
    .setCategory('strategy') // or appropriate category
    .setPlayerLimits(2, 4) // Set appropriate limits
    .setThumbnail('/images/games/your-game.png')
    .setVersion('1.0.0')
    .setAuthor('AI Arena Team')
    .setTags(['tag1', 'tag2', 'tag3'])
    .setRules(`
      Your Game Rules:
      - Rule 1
      - Rule 2
      - Rule 3
    `)
    .setAverageGameDuration(15) // in minutes
    .setComplexity('medium') // 'simple' | 'medium' | 'complex'
    .setFactory(factory)
    .build();
}
```

### Step 8: Create Index File
**File**: `/app/src/game-engine/games/your-game/index.ts`

```typescript
export * from './YourGameTypes';
export * from './YourGame';
export * from './YourGameManager';
export * from './engine/YourGameEngine';
export * from './scoring/YourGameScoringSystem';
export * from './ai/YourGameAIAgentFactory';
export * from './ai/YourGameAIDataCollector';
```

### Step 9: Register Game
**File**: `/app/src/game-engine/games/index.ts`

Add import:
```typescript
import { createYourGameDescriptor } from './your-game';
```

Add registration:
```typescript
// Register Your Game
const yourGameDescriptor = createYourGameDescriptor(aiService, aiModels);
gameRegistry.register(yourGameDescriptor);
```

Add export:
```typescript
export * from './your-game';
```

## Part 2: Frontend Integration

### Step 10: Add Game Type
**File**: `/app/src/types/tournament.ts`

1. Add to GameType union:
```typescript
export type GameType = 'poker' | 'reverse-hangman' | 'connect4' | 'your-game' | 'chess' | 'go';
```

2. Add to GameConfig interface:
```typescript
// Your Game config
yourGameField?: any;
yourGameTimeLimit?: number;
```

3. Add to GAME_TYPE_INFO:
```typescript
'your-game': {
  name: 'Your Game Name',
  description: 'Game description for UI',
  icon: '🎮', // Choose appropriate emoji
  minPlayers: 2,
  maxPlayers: 4,
  defaultConfig: {
    timeLimit: 60,
    // Add default config values
  }
},
```

### Step 11: Create Hook Adapter
**File**: `/app/src/hooks/useYourGameAdapter.ts`

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  gameRegistry, 
  ContextFactory
} from '@/game-engine';
import {
  YourGameManager,
  YourGameState,
  YourGameConfig,
  YourGameAction
} from '@/game-engine/games/your-game';
import { registerGames } from '@/game-engine/games';
import { Tournament } from '@/types';
import { toast } from 'sonner';

interface YourGamePlayer {
  id: string;
  name: string;
  // Add UI-specific player fields
  isAI: boolean;
  aiModel?: string;
}

export interface UseYourGameProps {
  tournament: Tournament | null;
}

export interface UseYourGameReturn {
  gameState: YourGameState | null;
  isAIThinking: boolean;
  currentPlayer: YourGamePlayer | null;
  // Add game-specific return values
  makeMove: (move: any) => void;
  isGameComplete: boolean;
  winner: YourGamePlayer | null;
}

class YourGameAdapter {
  private manager: YourGameManager;
  private context: any;
  private eventHandlers: Map<string, (data: any) => void> = new Map();
  private eventSubscription: any;

  constructor(config: any) {
    if (gameRegistry.getAll().length === 0) {
      registerGames();
    }

    const descriptor = gameRegistry.get('your-game');
    if (!descriptor) {
      throw new Error('Your game not registered');
    }

    this.context = ContextFactory.create({ gameId: 'your-game-' + Date.now() });
    const factory = descriptor.factory;
    
    const gameConfig: YourGameConfig = {
      thinkingTime: config.thinkingTime || 30000,
      playerConfigs: config.playerConfigs || [],
      maxPlayers: config.maxPlayers || 4,
      // Map other config
    };

    this.manager = factory.createManager(gameConfig, this.context) as unknown as YourGameManager;
    
    this.eventSubscription = this.context.eventBus.on((event: any) => {
      const handler = this.eventHandlers.get(event.type);
      if (handler) {
        handler(event.data);
      }
    });
  }

  on(event: string, handler: (data: any) => void): void {
    this.eventHandlers.set(event, handler);
  }

  off(event: string): void {
    this.eventHandlers.delete(event);
  }

  async start(): Promise<void> {
    await this.manager.startGame();
  }

  async makeMove(move: any): Promise<void> {
    const currentPlayer = this.manager.getCurrentPlayer();
    if (!currentPlayer) return;

    const action: YourGameAction = {
      type: 'move',
      // Map move to action
      playerId: currentPlayer.id,
      timestamp: new Date()
    };

    await this.manager.handleAction(action);
  }

  getState(): YourGameState | null {
    return this.manager.getState();
  }

  getCurrentPlayer() {
    return this.manager.getCurrentPlayer();
  }

  dispose(): void {
    this.eventHandlers.clear();
    if (this.eventSubscription) {
      this.eventSubscription();
    }
  }
}

export function useYourGame({ tournament }: UseYourGameProps): UseYourGameReturn {
  const [gameState, setGameState] = useState<YourGameState | null>(null);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<YourGamePlayer | null>(null);
  const [isGameComplete, setIsGameComplete] = useState(false);
  const [winner, setWinner] = useState<YourGamePlayer | null>(null);
  
  const adapterRef = useRef<YourGameAdapter | null>(null);

  useEffect(() => {
    if (!tournament || tournament.gameType !== 'your-game') {
      return;
    }

    const config = {
      thinkingTime: tournament.config.speed === 'thinking' ? 60000 : 
                    tournament.config.speed === 'normal' ? 30000 : 10000,
      playerConfigs: tournament.players.map((player, index) => ({
        id: player.id,
        name: player.name,
        isHuman: false,
        aiModel: player.aiModel,
        aiStrategy: player.strategy || '',
      }))
    };

    const adapter = new YourGameAdapter(config);
    adapterRef.current = adapter;

    // Set up event handlers
    adapter.on('game:started', () => {
      const state = adapter.getState();
      if (state) {
        setGameState(state);
        updateCurrentPlayer(state);
      }
    });

    adapter.on('action:applied', () => {
      const state = adapter.getState();
      if (state) {
        setGameState(state);
        updateCurrentPlayer(state);
      }
    });

    adapter.on('game:complete', (data: any) => {
      setIsGameComplete(true);
      // Handle winner
    });

    adapter.on('ai:thinking', (data: { playerId: string }) => {
      setIsAIThinking(true);
    });

    adapter.on('ai:decision', () => {
      setIsAIThinking(false);
    });

    // Start the game
    adapter.start().catch(error => {
      console.error('Failed to start game:', error);
      toast.error('Failed to start game');
    });

    return () => {
      adapter.dispose();
    };
  }, [tournament]);

  const updateCurrentPlayer = useCallback((state: YourGameState) => {
    if (!tournament || state.gamePhase !== 'playing') {
      setCurrentPlayer(null);
      return;
    }

    // Update current player based on state
  }, [tournament]);

  const makeMove = useCallback((move: any) => {
    if (!adapterRef.current || isAIThinking || isGameComplete) {
      return;
    }

    adapterRef.current.makeMove(move);
  }, [isAIThinking, isGameComplete]);

  return {
    gameState,
    isAIThinking,
    currentPlayer,
    makeMove,
    isGameComplete,
    winner
  };
}
```

### Step 12: Create Hook Re-export
**File**: `/app/src/hooks/useYourGame.ts`

```typescript
export { 
  useYourGame,
  type UseYourGameProps,
  type UseYourGameReturn 
} from './useYourGameAdapter';
```

### Step 13: Create Game View Component
**File**: `/app/src/pages/YourGameView.tsx`

```typescript
import * as React from 'react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { YourGameBoard } from '@/components/game/your-game/YourGameBoard';
import { YourGameStatus } from '@/components/game/your-game/YourGameStatus';
import { useYourGame } from '@/hooks/useYourGame';
import { Tournament } from '@/types/tournament';
import { ArrowLeft, Trophy } from 'lucide-react';

export default function YourGameView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTournament = async () => {
      try {
        const tournamentData = sessionStorage.getItem(`tournament-${id}`);
        
        if (!tournamentData) {
          setLoadingError('Tournament not found');
          setIsLoading(false);
          return;
        }

        const loadedTournament = JSON.parse(tournamentData);
        if (loadedTournament.gameType !== 'your-game') {
          setLoadingError(`This tournament is for ${loadedTournament.gameType}`);
          setIsLoading(false);
          
          // Redirect to correct game view
          setTimeout(() => {
            if (loadedTournament.gameType === 'poker') {
              navigate(`/tournament/${id}`);
            } else if (loadedTournament.gameType === 'reverse-hangman') {
              navigate(`/tournament/${id}/hangman`);
            } else if (loadedTournament.gameType === 'connect4') {
              navigate(`/tournament/${id}/connect4`);
            } else {
              navigate('/tournaments');
            }
          }, 2000);
          return;
        }

        setTournament(loadedTournament);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading tournament:', error);
        setLoadingError('Failed to load tournament');
        setIsLoading(false);
      }
    };

    loadTournament();
  }, [id, navigate]);

  const {
    gameState,
    isAIThinking,
    currentPlayer,
    makeMove,
    isGameComplete,
    winner
  } = useYourGame({ tournament });
  
  // Loading state
  if (isLoading && !loadingError) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Card className="p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Loading Tournament...</h2>
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Error state
  if (loadingError || !tournament) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Card className="p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4 text-destructive">Error</h2>
              <p className="text-muted-foreground mb-6">{loadingError}</p>
              <Button onClick={() => navigate('/tournaments')}>
                Return to Tournaments
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Main game view
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate('/tournaments')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold">{tournament.name}</h1>
            <p className="text-muted-foreground">{tournament.description}</p>
          </div>
          
          <div className="w-24" /> {/* Spacer for centering */}
        </div>

        {/* Game Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Game Area */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              {gameState ? (
                <>
                  <YourGameBoard
                    gameState={gameState}
                    onMove={makeMove}
                    isAIThinking={isAIThinking}
                    disabled={isGameComplete || isAIThinking}
                  />
                  
                  <div className="mt-6">
                    <YourGameStatus
                      currentPlayer={currentPlayer}
                      isAIThinking={isAIThinking}
                      winner={winner}
                      isGameComplete={isGameComplete}
                      players={tournament.players}
                    />
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    Initializing game...
                  </p>
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                </div>
              )}
            </Card>
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            {/* Players */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Players</h3>
              <div className="space-y-3">
                {tournament.players.map((player, index) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      currentPlayer?.id === player.id
                        ? 'bg-primary/10 border border-primary'
                        : 'bg-muted'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-sm font-semibold">
                          {index + 1}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium">{player.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {player.aiModel}
                        </div>
                      </div>
                    </div>
                    {winner?.id === player.id && (
                      <Trophy className="h-5 w-5 text-yellow-500" />
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Game Info */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Game Info</h3>
              <div className="space-y-2 text-sm">
                {/* Add game-specific info */}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Step 14: Create UI Components
**File**: `/app/src/components/game/your-game/YourGameBoard.tsx`

```typescript
import * as React from 'react';
import { motion } from 'framer-motion';
import { YourGameState } from '@/game-engine/games/your-game';

interface YourGameBoardProps {
  gameState: YourGameState;
  onMove: (move: any) => void;
  isAIThinking: boolean;
  disabled: boolean;
}

export function YourGameBoard({
  gameState,
  onMove,
  isAIThinking,
  disabled
}: YourGameBoardProps) {
  // Implement your game board UI with framer-motion animations
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="relative"
    >
      {/* Game board implementation */}
    </motion.div>
  );
}
```

**File**: `/app/src/components/game/your-game/YourGameStatus.tsx`

```typescript
import * as React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trophy } from 'lucide-react';

interface YourGameStatusProps {
  currentPlayer: any | null;
  isAIThinking: boolean;
  winner: any | null;
  isGameComplete: boolean;
  players: any[];
}

export function YourGameStatus({
  currentPlayer,
  isAIThinking,
  winner,
  isGameComplete,
  players
}: YourGameStatusProps) {
  if (isGameComplete && winner) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="flex items-center justify-center space-x-2 mb-2">
          <Trophy className="h-6 w-6 text-yellow-500" />
          <h3 className="text-2xl font-bold">Game Over!</h3>
        </div>
        <p className="text-lg">{winner.name} wins!</p>
      </motion.div>
    );
  }

  if (isAIThinking) {
    return (
      <div className="flex items-center justify-center space-x-3">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-muted-foreground">
          {currentPlayer?.name} is thinking...
        </span>
      </div>
    );
  }

  return (
    <div className="text-center">
      <span className="text-muted-foreground">Current turn: </span>
      <span className="font-semibold">{currentPlayer?.name}</span>
    </div>
  );
}
```

### Step 15: Add Route
**File**: `/app/src/App.tsx`

1. Import the view:
```typescript
import YourGameView from './pages/YourGameView';
```

2. Add route:
```typescript
<Route path="/tournament/:id/your-game" element={<YourGameView />} />
```

### Step 16: Update Navigation
**File**: `/app/src/pages/CreateTournament.tsx`

Update navigation logic:
```typescript
const path = formData.gameType === 'reverse-hangman' 
  ? `/tournament/${tournamentId}/hangman`
  : formData.gameType === 'connect4'
  ? `/tournament/${tournamentId}/connect4`
  : formData.gameType === 'your-game'
  ? `/tournament/${tournamentId}/your-game`
  : `/tournament/${tournamentId}`;
```

**File**: `/app/src/pages/WaitingRoom.tsx`

Add navigation case:
```typescript
} else if (tournament.gameType === 'your-game') {
  navigate(`/tournament/${id}/your-game`);
}
```

## Part 3: Backend Integration

### Step 17: Add GraphQL Schema
**File**: `/backend/src/graphql/schema/index.ts`

Add types:
```typescript
# Your Game Types
type YourGameState {
  game_type: String!
  # Add game state fields
}

input YourGameStateInput {
  game_type: String!
  # Add game state input fields
}

type YourPlayerState {
  player_id: String!
  # Add player state fields
}

input YourPlayerStateInput {
  player_id: String!
  # Add player state input fields
}

type YourGameAnalysis {
  # Add analysis fields
}

type AIYourGameDecision {
  action: String!
  # Add decision fields
  reasoning: String!
  confidence: Float!
  analysis: YourGameAnalysis!
}
```

Add mutation:
```typescript
# AI Your Game mutation
getAIYourGameDecision(
  botId: String!
  model: String!
  gameState: YourGameStateInput!
  playerState: YourPlayerStateInput!
): AIYourGameDecision!
```

### Step 18: Add GraphQL Resolver
**File**: `/backend/src/graphql/resolvers/index.ts`

Add resolver:
```typescript
getAIYourGameDecision: async (
  _: any,
  { botId, model, gameState, playerState }: any,
  ctx: Context
) => {
  console.log('\n=== getAIYourGameDecision Resolver Called ===');
  console.log('Input parameters:', {
    botId,
    model,
    gameStateKeys: Object.keys(gameState || {}),
    playerStateKeys: Object.keys(playerState || {})
  });
  
  try {
    // Check if this is a test bot or demo player request
    let prompt: string | undefined;
    const isTestBot = botId.startsWith('test-bot-') || botId.startsWith('game-bot-');
    const isDemoPlayer = botId.startsWith('player-');
    
    if (!isTestBot && !isDemoPlayer) {
      // Load bot from database
      const bot = await ctx.prisma.bot.findUnique({
        where: { id: botId }
      });
      
      if (!bot) {
        throw new Error(`Bot not found: ${botId}`);
      }
      
      prompt = bot.prompt;
    } else {
      // For test bots and demo players, use a default prompt
      prompt = "You are an AI playing a game. Make strategic decisions.";
    }
    
    console.log('Making AI decision with model:', model);
    
    const startTime = Date.now();
    const decision = await aiService.getYourGameDecision(
      botId,
      gameState,
      playerState,
      model,
      prompt
    );
    const elapsedTime = Date.now() - startTime;
    
    console.log(`AI decision received in ${elapsedTime}ms`);
    
    return decision;
  } catch (error: any) {
    console.error('\n=== ERROR in getAIYourGameDecision ===');
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      botId,
      model
    });
    
    throw error;
  }
}
```

### Step 19: Update AI Service
**File**: `/backend/src/services/aiService.ts`

Add method (following existing pattern):
```typescript
async getYourGameDecision(
  botId: string,
  gameState: any,
  playerState: any,
  model: string,
  prompt?: string
): Promise<any> {
  // Follow the same pattern as getPokerDecision or getReverseHangmanDecision
  // Transform gameState and playerState to prompt
  // Call AI model
  // Parse and return decision
}
```

## Part 4: AI Service Frontend Integration

### Step 20: Add GraphQL Mutation
**File**: `/app/src/game-engine/services/graphql/mutations.ts`

```typescript
export const GET_AI_YOUR_GAME_DECISION = gql`
  mutation GetAIYourGameDecision(
    $botId: String!
    $model: String!
    $gameState: YourGameStateInput!
    $playerState: YourPlayerStateInput!
  ) {
    getAIYourGameDecision(
      botId: $botId
      model: $model
      gameState: $gameState
      playerState: $playerState
    ) {
      action
      # Add other fields
      reasoning
      confidence
      analysis {
        # Add analysis fields
      }
    }
  }
`;
```

### Step 21: Update AI Service Detection
**File**: `/app/src/game-engine/services/AIService.ts`

1. Import mutation:
```typescript
import { GET_AI_POKER_DECISION, GET_AI_REVERSE_HANGMAN_DECISION, GET_AI_CONNECT4_DECISION, GET_AI_YOUR_GAME_DECISION } from './graphql/mutations';
```

2. Add game detection in `detectGameType`:
```typescript
// Check for your game specific fields
if (gameData.gameType === 'your-game' || 
    (gameData.yourGameSpecificField !== undefined)) {
  console.log('Detected game type from structure: your-game');
  return 'your-game';
}
```

3. Add keyword detection:
```typescript
// Check for your game keywords
if (promptLower.includes('your-game') || promptLower.includes('specific keyword')) {
  console.log('Detected game type from keywords: your-game');
  return 'your-game';
}
```

4. Update `sendRequest` to include your game:
```typescript
if (gameType === 'poker' || gameType === 'reverse-hangman' || gameType === 'connect4' || gameType === 'your-game') {
  return await this.sendGraphQLRequest(request, modelConfig, gameType);
}
```

5. Add case in `sendGraphQLRequest`:
```typescript
} else if (gameType === 'your-game') {
  const { gameState, playerState } = this.transformYourGameDataForGraphQL(gameData);

  const result = await this.apolloClient.mutate({
    mutation: GET_AI_YOUR_GAME_DECISION,
    variables: {
      botId,
      model: modelName,
      gameState,
      playerState
    },
    fetchPolicy: 'no-cache',
    errorPolicy: 'all'
  });

  if (!result.data || !result.data.getAIYourGameDecision) {
    throw new Error('No AI decision returned');
  }

  const decision = result.data.getAIYourGameDecision;
  
  const responseObj = {
    action: {
      type: decision.action,
      // Map other fields
      playerId: gameData.currentPlayer?.id || '',
      timestamp: new Date().toISOString()
    },
    reasoning: decision.reasoning,
    confidence: decision.confidence,
    analysis: decision.analysis
  };

  return {
    content: JSON.stringify(responseObj),
    model: request.model,
    metadata: {
      analysis: decision.analysis
    }
  };
}
```

6. Add transformation method:
```typescript
private transformYourGameDataForGraphQL(gameData: any): { gameState: any; playerState: any } {
  console.log('Transforming your game data:', {
    // Log relevant fields
  });
  
  // Transform to match GraphQL schema
  const gameState = {
    game_type: 'your_game_type',
    // Map fields
  };
  
  const playerState = {
    player_id: gameData.currentPlayer?.id || '',
    // Map fields
  };
  
  return { gameState, playerState };
}
```

7. Update `actionsMatch` to handle your game:
```typescript
// For your game actions
if (a.type === 'move' || a.type === 'your-action-type') {
  return true;
}
```

## Part 5: Testing and Validation

### Step 22: TypeScript Compilation
```bash
cd app && npx tsc --noEmit
```
Fix any TypeScript errors.

### Step 23: Test Game Flow
1. Create a tournament with your game type
2. Add AI players
3. Start the tournament
4. Verify game loads and AI players make moves
5. Verify game completes properly

### Step 24: Verify Integration Points
- [ ] Game appears in tournament creation
- [ ] Game type routes correctly from waiting room
- [ ] AI decisions are made via GraphQL
- [ ] Game state updates in UI
- [ ] Winners are determined correctly
- [ ] All animations work with framer-motion

## Common Pitfalls to Avoid

1. **DO NOT** create custom implementations that don't extend base classes
2. **DO NOT** skip the actionsMatch update in AIService
3. **DO NOT** use string timestamps - use Date objects
4. **DO NOT** forget to dispose event subscriptions
5. **DO NOT** use direct state mutation - always create new objects
6. **DO NOT** add strategic hints in AI prompts
7. **DO NOT** skip framer-motion animations in UI components
8. **DO NOT** create files without proper exports in index.ts
9. **DO NOT** forget to handle all game phases (playing, won, draw)
10. **DO NOT** use hardcoded player IDs or game IDs
11. **DO NOT** forget to update BOTH currentPlayerIndex AND currentTurn when switching turns
12. **DO NOT** mix property names (e.g., col vs column, playerId vs playerNumber)
13. **DO NOT** assume GraphQL data structure - verify against schema exactly

### Critical Lessons from Connect4 Debug:

#### Turn Management Issue (CRITICAL)
```typescript
// WRONG - Only updating game-specific state
private switchTurn(): void {
  this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;
}

// CORRECT - Update both game-specific AND base state
private switchTurn(): void {
  this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;
  this.state.currentTurn = this.state.players[this.state.currentPlayerIndex].id;
}
```

#### Property Name Consistency
```typescript
// WRONG - Inconsistent property names
lastMove: { row: 0, col: 3 }  // In game engine
lastMove: { row: 0, column: 3 }  // In GraphQL schema

// CORRECT - Consistent across all layers
lastMove: { row: 0, column: 3 }  // Same everywhere
```

#### GraphQL Data Transformation
```typescript
// WRONG - Using wrong property
was_yours: gameData.lastMove.playerNumber === playerNumber

// CORRECT - Using correct property
was_yours: gameData.lastMove.playerId === currentPlayerId
```

#### Double Turn Switching (CRITICAL - Causes "No valid actions available")
```typescript
// WRONG - Game engine switches turns, then BaseGameEngine does too
protected applyAction(action: GameAction): void {
  // ... game logic ...
  this.switchTurn(); // DON'T DO THIS!
}

// CORRECT - Let BaseGameEngine handle all turn switching
protected applyAction(action: GameAction): void {
  // ... game logic ...
  // BaseGameEngine will call advanceTurn() automatically
}

// If you need currentPlayerIndex, sync it from currentTurn:
private updateCurrentPlayerIndex(): void {
  const playerIndex = this.state.players.findIndex(p => p.id === this.state.currentTurn);
  if (playerIndex !== -1) {
    this.state.currentPlayerIndex = playerIndex;
  }
}
```

## Final Checklist

- [ ] All TypeScript files compile without errors
- [ ] Game follows exact same structure as poker/reverse-hangman/connect4
- [ ] All imports use @ alias paths
- [ ] All components have framer-motion animations
- [ ] AI integration works with all supported models
- [ ] Game completes full lifecycle from start to finish
- [ ] No console errors during gameplay
- [ ] All files are properly exported in index files
- [ ] Documentation reflects actual implementation