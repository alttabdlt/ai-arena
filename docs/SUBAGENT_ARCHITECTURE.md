# AI Arena Subagent Architecture

This document outlines the subagent architecture for automated game integration and testing in the AI Arena platform.

## Overview

The subagent system consists of two specialized agents that work together to rapidly add new games to the platform while maintaining quality and neutrality in AI decision-making.

## Subagent 1: Game Discovery & Integration Agent

### Purpose
Discover game implementations on GitHub and integrate them into the AI Arena game engine architecture.

### Workflow

#### 1. Discovery Phase
```bash
# Search patterns for GitHub
- "{game_name} javascript implementation"
- "{game_name} typescript game logic"
- "{game_name} react component"
- "{game_name} game engine"
```

#### 2. Analysis Phase
- **Extract Core Logic**:
  - Game rules and win conditions
  - Valid move generation
  - Board/state representation
  - Player turn management
  
- **Map to Interfaces**:
  ```typescript
  IGame → Game definition and factory
  IGameEngine → Core game logic
  IGameManager → Game orchestration
  IGamePlayer → Player representation
  IGameState → Game state structure
  IGameAction → Player actions
  ```

#### 3. Integration Phase

##### File Structure Creation:
```
app/src/game-engine/games/{game-name}/
├── {GameName}Types.ts         # Type definitions
├── {GameName}GameManager.ts   # Game orchestration
├── engine/
│   └── {GameName}GameEngine.ts # Game logic
├── ai/
│   ├── {GameName}AIDataCollector.ts
│   └── {GameName}AIAgentFactory.ts
└── index.ts                    # Barrel exports
```

##### Implementation Checklist:
- [ ] Extend `BaseGameEngine` for game logic
- [ ] Extend `BaseGameManager` for orchestration
- [ ] Implement required abstract methods only
- [ ] Use event naming convention: `game:started`, `round:complete`
- [ ] Create immutable state updates
- [ ] Add proper TypeScript types
- [ ] Export everything in index.ts

#### 4. Validation Phase
- [ ] TypeScript compilation: `npx tsc --noEmit`
- [ ] Import verification: All imports resolve
- [ ] Event testing: Log and verify event flow
- [ ] Integration test: 2+ AI players complete a game

### Example Integration Pattern (from Connect4):

```typescript
// 1. Types (Connect4Types.ts)
export interface Connect4GameState extends IGameState {
  board: Connect4Board;
  currentPlayerIndex: number;
  lastMove?: { row: number; col: number; playerId: string; };
  // ... game-specific state
}

// 2. Engine (Connect4GameEngine.ts)
export class Connect4GameEngine extends BaseGameEngine<Connect4GameState, Connect4GameAction> {
  protected createInitialState(players: IGamePlayer[]): Connect4GameState {
    // Initialize empty board
  }
  
  protected validateGameSpecificAction(action: Connect4GameAction): IGameValidationResult {
    // Validate column is not full
  }
  
  // ... other required methods
}

// 3. Manager (Connect4GameManager.ts)
export class Connect4GameManager extends BaseGameManager<Connect4GameState, Connect4GameConfig> {
  // Orchestrate game flow
}
```

## Subagent 2: AI Testing & Integration Agent

### Purpose
Create unbiased AI integration with comprehensive testing to ensure AI models can play the game effectively without coaching.

### Workflow

#### 1. Context Design Phase

##### Neutral Game State Representation:
```typescript
{
  gameType: "connect4",
  board: [[...]], // Raw board state
  validMoves: [0, 1, 2, 3, 4, 5, 6], // Unordered
  moveCount: 15,
  
  // Mathematical context only
  calculations: {
    boardFillPercentage: 35.7,
    movesRemaining: 27,
    columnAvailability: [6, 5, 4, 3, 6, 2, 6]
  },
  
  // Threat analysis without bias
  threatAnalysis: {
    immediateWinOpportunities: [3], // Just the facts
    mustBlockPositions: [5],
    threatsCreated: 2,
    threatsAgainst: 1
  }
}
```

##### AI Prompt Requirements:
- ✅ Include word "json" for DeepSeek compatibility
- ✅ Provide all valid actions unordered
- ✅ Include mathematical/percentage context
- ✅ State win conditions objectively
- ❌ NO strategic hints ("consider", "should", "might want to")
- ❌ NO move preferences or ordering
- ❌ NO coaching language

#### 2. Test Scenario Creation

##### Scenario Categories:
1. **Critical Decisions** (must pass)
   - Must win in 1 move
   - Must block opponent win
   - Forced moves

2. **Strategic Choices** (acceptable variations)
   - Opening moves
   - Mid-game positioning
   - Multiple valid options

3. **Edge Cases**
   - Nearly full board
   - Multiple threats
   - Complex positions

##### Test Structure:
```typescript
interface TestScenario {
  id: string;
  name: string;
  description: string;
  gameState: GameState;
  playerInfo: PlayerSpecificInfo;
  criticalActions?: number[]; // Must choose one
  acceptableActions?: number[]; // Any is fine
  expectedBehavior: string;
}
```

#### 3. Backend Integration

##### GraphQL Schema:
```graphql
type AIConnect4Decision {
  action: String!
  column: Int!
  reasoning: String!
  confidence: Float!
  analysis: Connect4Analysis!
}

input Connect4GameStateInput {
  game_type: String!
  board: [[String!]!]!
  current_player_index: Int!
  move_count: Int!
  valid_columns: [Int!]!
  # ... other fields
}

mutation getAIConnect4Decision(
  $botId: String!
  $model: String!
  $gameState: Connect4GameStateInput!
  $playerState: Connect4PlayerStateInput!
): AIConnect4Decision!
```

##### AI Service Integration:
```typescript
// In aiService.ts
async getConnect4Decision(
  botId: string,
  gameState: any,
  playerState: any,
  model: AIModel,
  customPrompt?: string
): Promise<AIDecision> {
  const prompt = this.buildNeutralConnect4Prompt(gameState, playerState);
  
  try {
    // Call appropriate AI API
    switch(model) {
      case 'deepseek-chat':
        return await this.getDeepseekConnect4Decision(prompt);
      // ... other models
    }
  } catch (error) {
    // Log full error for debugging
    console.error('AI API Error:', error);
    // Use fallback logic
    return this.getFallbackConnect4Decision(gameState);
  }
}
```

#### 4. Testing & Validation

##### Test Execution Flow:
1. Create test script that calls GraphQL API directly
2. Test each AI model with all scenarios
3. Verify actual AI responses (not fallback)
4. Check decision logic and reasoning
5. Ensure no timeout or API errors

##### Success Criteria:
- ✅ All critical scenarios pass
- ✅ AI provides logical reasoning
- ✅ Confidence scores are reasonable
- ✅ No API errors or fallbacks
- ✅ Response times are acceptable

### Key Learnings from Connect4 Implementation

1. **DeepSeek API Requirement**: Must include "json" in prompt when using JSON response format
2. **Error Handling**: Always log full error details to identify API vs logic issues
3. **Testing**: Use actual API calls, not mocks or fallback logic
4. **Prompts**: Keep strictly neutral - no coaching or strategic hints
5. **Context**: Provide mathematical/percentage-based context
6. **Validation**: Test with multiple scenarios covering critical and strategic decisions

## Implementation Order

1. **Phase 1**: Implement core subagent logic
2. **Phase 2**: Test with simple game (Tic-Tac-Toe)
3. **Phase 3**: Apply to complex games (Chess, Go)
4. **Phase 4**: Automate the entire pipeline

## Success Metrics

- Time to integrate new game: < 2 hours
- Test coverage: 100% of critical scenarios
- AI success rate: > 90% on critical decisions
- No bias detection: 0 coaching phrases in prompts
- API reliability: < 5% fallback usage