# Subagent Implementation Guide

## Subagent 1: Game Discovery & Integration

### Implementation Pseudocode

```python
class GameIntegrationAgent:
    def __init__(self):
        self.github_searcher = GitHubSearcher()
        self.code_analyzer = CodeAnalyzer()
        self.file_generator = FileGenerator()
        
    def integrate_game(self, game_name: str):
        # 1. Discovery
        repos = self.github_searcher.search(f"{game_name} typescript implementation")
        best_repo = self.analyze_repos(repos)
        
        # 2. Extract game logic
        game_logic = self.code_analyzer.extract_logic(best_repo)
        
        # 3. Generate AI Arena compatible files
        self.generate_types_file(game_name, game_logic)
        self.generate_engine_file(game_name, game_logic)
        self.generate_manager_file(game_name, game_logic)
        self.generate_ai_files(game_name, game_logic)
        
        # 4. Validate
        self.run_typescript_check()
        self.run_integration_test()
```

### Key Patterns to Follow

#### 1. Type Definitions Pattern
```typescript
// From existing games, always include:
export interface {GameName}GameState extends IGameState {
  // Game-specific state
  board: any; // Game board representation
  currentPlayerIndex: number;
  moveCount: number;
  gamePhase: 'setup' | 'playing' | 'ended';
  winner?: string;
  
  // Required from IGameState
  gameId: string;
  players: IGamePlayer[];
  status: GameStatus;
  phase: string;
}

export interface {GameName}GameAction extends IGameAction {
  type: string; // Game-specific action types
  // Action-specific data
  
  // Required from IGameAction
  playerId: string;
  timestamp: string;
}
```

#### 2. Engine Implementation Pattern
```typescript
export class {GameName}GameEngine extends BaseGameEngine<State, Action> {
  // Only implement required abstract methods
  protected createInitialState(players: IGamePlayer[]): State {
    return {
      gameId: this.gameId,
      players,
      status: 'active',
      phase: 'playing',
      // ... game-specific initialization
    };
  }
  
  protected validateGameSpecificAction(action: Action): IGameValidationResult {
    // Game-specific validation
    return { isValid: true };
  }
  
  protected applyAction(action: Action): void {
    // Mutate this.state (it's cloned in base class)
  }
  
  getValidActions(playerId: string): Action[] {
    // Return all legal moves for player
  }
  
  isGameOver(): boolean {
    // Check win/draw conditions
  }
  
  getWinners(): string[] {
    // Return winner IDs
  }
}
```

#### 3. Common Pitfalls to Avoid
- ❌ Don't create new base functionality
- ❌ Don't use hyphenated event names
- ❌ Don't mutate state directly (except in applyAction)
- ❌ Don't forget barrel exports in index.ts
- ❌ **Don't assume class/interface names - VERIFY THEY EXIST**
- ❌ **Don't guess method signatures - CHECK THE ACTUAL INTERFACE**
- ✅ Always extend base classes
- ✅ Use colon-separated events: `game:started`
- ✅ Clone state before mutations
- ✅ Export all public classes
- ✅ **ALWAYS verify exact export names before importing**
- ✅ **ALWAYS check how existing code uses the module**

#### 4. CRITICAL: Pre-Code Generation Verification
```bash
# Before writing ANY import statement:
# 1. Check what's actually exported
grep "export" /path/to/target/file.ts

# 2. See how others import it
grep -r "from.*target-module" src/

# 3. If extending a class, check ALL abstract methods
grep -A 20 "abstract class BaseClassName" /path/to/base.ts

# Example that would have prevented the GameFactory error:
grep "export.*Factory" GameDescriptor.ts
# Shows: BaseGameFactory (NOT GameFactory!)
```

## Subagent 2: AI Testing & Integration

### Implementation Pseudocode

```python
class AITestingAgent:
    def __init__(self):
        self.prompt_builder = NeutralPromptBuilder()
        self.scenario_generator = ScenarioGenerator()
        self.api_tester = APITester()
        
    def create_ai_integration(self, game_name: str, game_rules: dict):
        # 1. Design neutral context
        context_structure = self.design_game_context(game_rules)
        
        # 2. Create test scenarios
        scenarios = self.generate_test_scenarios(game_rules)
        
        # 3. Build GraphQL schema
        graphql_types = self.create_graphql_types(context_structure)
        
        # 4. Implement AI service method
        ai_method = self.create_ai_service_method(game_name, context_structure)
        
        # 5. Test with real APIs
        test_results = self.run_api_tests(scenarios)
        
        return test_results
```

### Neutral Prompt Building

#### Template Structure
```typescript
const buildNeutralPrompt = (gameState: any, playerState: any): string => {
  const prompt = {
    game_type: gameState.game_type,
    
    // Objective state only
    current_state: {
      board: gameState.board,
      turn_number: gameState.move_count,
      valid_actions: gameState.valid_moves, // Unordered!
    },
    
    // Mathematical context
    calculations: {
      moves_remaining: 42 - gameState.move_count,
      action_space_size: gameState.valid_moves.length,
      game_progress_percentage: (gameState.move_count / 42) * 100,
    },
    
    // Factual analysis
    analysis: {
      immediate_win_available: playerState.can_win_now,
      must_respond_count: playerState.threats_to_block.length,
      // NO strategic guidance!
    },
    
    instructions: `You are playing ${gameState.game_type}. 
Select your next action based on the provided game state.
Respond with valid JSON format containing your decision.`
  };
  
  return JSON.stringify(prompt, null, 2);
};
```

### Test Scenario Generation

#### Scenario Types Template
```typescript
const generateTestScenarios = (gameName: string) => {
  return [
    // 1. Critical - Must Win
    {
      id: `${gameName}-must-win`,
      name: "Must Take Winning Move",
      gameState: createWinInOneState(),
      expectedActions: [winningMove],
      isRequired: true,
    },
    
    // 2. Critical - Must Block
    {
      id: `${gameName}-must-block`,
      name: "Must Block Opponent Win",
      gameState: createBlockRequiredState(),
      expectedActions: [blockingMove],
      isRequired: true,
    },
    
    // 3. Strategic - Opening
    {
      id: `${gameName}-opening`,
      name: "Opening Move Selection",
      gameState: createOpeningState(),
      acceptableActions: getReasonableOpenings(),
      isRequired: false,
    },
    
    // 4. Complex - Multiple Threats
    {
      id: `${gameName}-complex`,
      name: "Handle Multiple Threats",
      gameState: createComplexState(),
      acceptableActions: getPriorityMoves(),
      isRequired: false,
    },
  ];
};
```

### GraphQL Integration Template

```graphql
# Schema additions
type AI${GameName}Decision {
  action: String!
  # Game-specific fields (e.g., position, column, etc.)
  reasoning: String!
  confidence: Float!
  analysis: ${GameName}Analysis!
}

type ${GameName}Analysis {
  position_evaluation: String!
  considered_moves: [String!]!
  threat_assessment: String!
}

input ${GameName}GameStateInput {
  game_type: String!
  board: String! # Or appropriate structure
  valid_actions: [String!]!
  turn_count: Int!
  # Other game-specific fields
}

extend type Mutation {
  getAI${GameName}Decision(
    botId: String!
    model: String!
    gameState: ${GameName}GameStateInput!
    playerState: ${GameName}PlayerStateInput!
  ): AI${GameName}Decision!
}
```

### AI Service Method Template

```typescript
async get${GameName}Decision(
  botId: string,
  gameState: any,
  playerState: any,
  model: AIModel,
  customPrompt?: string
): Promise<any> {
  console.log(`🎮 ${GameName} AI Decision Request - Bot: ${botId}, Model: ${model}`);
  
  const prompt = this.buildNeutral${GameName}Prompt(gameState, playerState, customPrompt);
  
  try {
    let decision: any;
    
    switch(model) {
      case 'deepseek-chat':
        decision = await this.getDeepseek${GameName}Decision(prompt);
        break;
      // ... other models
    }
    
    return decision;
  } catch (error) {
    console.error(`AI model error for ${model} in ${GameName}:`, error);
    return this.getFallback${GameName}Decision(gameState);
  }
}

private buildNeutral${GameName}Prompt(
  gameState: any,
  playerState: any,
  customPrompt?: string
): string {
  const prompt = {
    // ... neutral prompt structure
    instructions: `... Respond with valid JSON format: {...}` // Include "json"!
  };
  
  if (customPrompt) {
    prompt.instructions += ` Additional strategy: ${customPrompt}`;
  }
  
  return JSON.stringify(prompt, null, 2);
}
```

### Testing Checklist

1. **API Configuration**
   - [ ] Verify API keys are set in .env
   - [ ] Test each AI model individually
   - [ ] Check for "json" word in prompts (DeepSeek requirement)

2. **Scenario Coverage**
   - [ ] All critical scenarios have expected actions
   - [ ] Strategic scenarios have acceptable actions
   - [ ] Edge cases are included

3. **Response Validation**
   - [ ] AI returns valid game actions
   - [ ] Reasoning is logical
   - [ ] Confidence scores are reasonable
   - [ ] No fallback logic unless API fails

4. **Performance**
   - [ ] Response time < 15 seconds
   - [ ] No timeout errors
   - [ ] Graceful fallback on API errors

## Integration Testing Script Template

```javascript
async function testGameIntegration(gameName) {
  console.log(`Testing ${gameName} integration...`);
  
  // 1. Test TypeScript compilation
  const tsResult = await exec('npx tsc --noEmit');
  if (tsResult.error) {
    console.error('TypeScript compilation failed');
    return false;
  }
  
  // 2. Test game engine
  const engine = new ${gameName}GameEngine('test-game-1');
  const testState = engine.startGame([
    { id: 'p1', name: 'Player 1' },
    { id: 'p2', name: 'Player 2' }
  ]);
  
  // 3. Test AI integration
  const scenarios = generateTestScenarios(gameName);
  for (const scenario of scenarios) {
    const result = await testAIResponse(scenario);
    if (scenario.isRequired && !result.passed) {
      console.error(`Critical scenario failed: ${scenario.name}`);
      return false;
    }
  }
  
  console.log(`✅ ${gameName} integration complete!`);
  return true;
}
```

## UI Component Animation Requirements

All game UI components must include framer-motion animations:

### 1. **Import framer-motion**
```typescript
import { motion, AnimatePresence } from 'framer-motion';
```

### 2. **Required Animations**
- **Game piece movements**: Smooth transitions with spring physics
- **Win/loss animations**: Celebration effects (scale, pulse, glow)
- **Player turn indicators**: Smooth transitions between players
- **Interactive hover states**: Visual feedback for user interactions
- **AI thinking indicators**: Animated loading states

### 3. **Animation Patterns**

#### Piece Placement Animation
```typescript
// Connect4 disc drop example
<motion.div
  key={`disc-${row}-${col}`}
  initial={{ y: -400 }}
  animate={{ y: 0 }}
  transition={{ 
    type: "spring",
    damping: 15,
    stiffness: 200,
    bounce: 0.3
  }}
/>
```

#### Win Celebration
```typescript
// Winning pieces animation
<motion.div
  animate={isWinning ? {
    scale: [1, 1.2, 1],
    rotate: [0, 10, -10, 0]
  } : {}}
  transition={{ 
    duration: 0.5,
    repeat: Infinity,
    repeatDelay: 1
  }}
/>
```

#### Hover Effects
```typescript
// Interactive column hover
<motion.div
  whileHover={{ scale: 1.05, backgroundColor: "rgba(0,0,0,0.1)" }}
  whileTap={{ scale: 0.95 }}
  transition={{ type: "spring", stiffness: 400 }}
/>
```

### 4. **Implementation Checklist**
- [ ] All game pieces use motion components
- [ ] Entry/exit animations with AnimatePresence
- [ ] Win conditions trigger celebration animations
- [ ] AI thinking has smooth loading animation
- [ ] Hover states provide visual feedback
- [ ] Turn transitions are animated
- [ ] No jarring instant state changes

### 5. **Performance Considerations**
- Use `layout` prop for automatic layout animations
- Implement `will-change` CSS for heavy animations
- Use `useReducedMotion` hook for accessibility
- Batch animations with `staggerChildren`

## Automation Pipeline

```bash
# Full automation script
./add-game.sh chess

# Which runs:
1. node subagent1.js discover chess
2. node subagent1.js integrate chess
3. node subagent2.js create-ai chess
4. node subagent2.js test chess
5. git add -A && git commit -m "Add chess game integration"
```

This implementation guide provides the concrete patterns and templates the subagents need to successfully integrate new games into the AI Arena platform.