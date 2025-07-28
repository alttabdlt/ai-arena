# Game Implementation Patterns and Pitfalls Analysis

## Executive Summary

After analyzing the core engine, poker, reverse-hangman, and connect4 implementations, along with the comprehensive NEW_GAME_IMPLEMENTATION.md guide, I've identified critical patterns that lead to success and common pitfalls that cause failures. This analysis will help prevent future implementation errors by understanding the root causes.

## Table of Contents
1. [Critical Success Patterns](#critical-success-patterns)
2. [Most Common Pitfalls](#most-common-pitfalls)
3. [Root Cause Analysis](#root-cause-analysis)
4. [Technical Anti-Patterns](#technical-anti-patterns)
5. [AI Integration Specific Issues](#ai-integration-specific-issues)
6. [Code Generation Mistakes](#code-generation-mistakes)
7. [Prevention Strategies](#prevention-strategies)

---

## Critical Success Patterns

### 1. Base Class Extension Pattern
**✅ Successful Pattern:**
```typescript
// ALWAYS extend base classes
export class YourGameEngine extends BaseGameEngine<YourGameState, YourGameAction> {
  // Only override REQUIRED abstract methods
  protected createInitialState(players: IGamePlayer[]): YourGameState
  protected applyAction(action: YourGameAction): void
  protected validateGameSpecificAction(action: YourGameAction): IGameValidationResult
  getValidActions(playerId: string): YourGameAction[]
  isGameOver(): boolean
  getWinners(): string[]
}
```

**Why it works:** Base classes handle 90% of the logic (turn management, event emission, state validation)

### 2. Turn Management Pattern
**✅ Successful Pattern:**
```typescript
// Let BaseGameEngine handle ALL turn management
protected applyAction(action: GameAction): void {
  // Apply game logic
  // DO NOT call switchTurn() or modify currentTurn
  // BaseGameEngine.executeAction() calls advanceTurn() automatically
}

// If you need currentPlayerIndex, sync from currentTurn
private updateCurrentPlayerIndex(): void {
  const playerIndex = this.state.players.findIndex(p => p.id === this.state.currentTurn);
  if (playerIndex !== -1) {
    this.state.currentPlayerIndex = playerIndex;
  }
}
```

**Why it works:** Prevents double turn switching that causes "No valid actions available" errors

### 3. AI Integration Pattern
**✅ Successful Pattern:**
```typescript
// EXACT prompt format - DO NOT MODIFY
const prompt = `Current game state:
${JSON.stringify(gameData, null, 2)}

Valid actions:
${JSON.stringify(validActions, null, 2)}

Choose your action.`;
```

**Why it works:** AIService uses specific regex to extract JSON - any deviation breaks parsing

### 4. Event Naming Pattern
**✅ Successful Pattern:**
```typescript
// Use colon separator for events
this.emit('game:started', data);
this.emit('turn:changed', data);
this.emit('action:executed', data);
```

**Why it works:** Consistent with framework expectations and event bus filtering

---

## Most Common Pitfalls

### 1. Double Turn Switching (CRITICAL - Most Common)
**❌ Problem:**
```typescript
protected applyAction(action: GameAction): void {
  // Game logic...
  this.switchTurn(); // DON'T DO THIS!
}

private switchTurn(): void {
  this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % 2;
  this.state.currentTurn = this.state.players[this.state.currentPlayerIndex].id;
}
```

**Impact:** 
- BaseGameEngine advances turn after applyAction
- Game advances turn again = skips players
- Results in "No valid actions available" errors

**Root Cause:** Not understanding BaseGameEngine lifecycle

### 2. Property Name Inconsistency
**❌ Problem:**
```typescript
// In game engine
interface LastMove {
  row: number;
  col: number;  // Sometimes 'col'
}

// In GraphQL schema
type LastMove {
  row: Int!
  column: Int!  // Sometimes 'column'
}

// In AI data collector
lastMove: {
  row: 0,
  column: 3  // Must match GraphQL exactly
}
```

**Impact:** GraphQL mutations fail with "Cannot read property 'column' of undefined"

**Root Cause:** No centralized type definitions across layers

### 3. AI Prompt Format Violations
**❌ Problem:**
```typescript
// WRONG - Modified prompt format
const prompt = `Current game state for reference:
${JSON.stringify(gameData)}

Valid actions you can take:
${JSON.stringify(validActions)}`;

// WRONG - Template variables in JSON
const prompt = `Current game state:
{{gameData}}

Valid actions:
{{validActions}}`;
```

**Impact:** AIService fails to extract game data, returns "Failed to parse game state"

**Root Cause:** Not understanding AIService's regex-based extraction

### 4. Creating Duplicate Functionality
**❌ Problem:**
```typescript
// Creating custom turn management instead of using BaseGameEngine
executeAction(action: Action): void {
  // Custom validation
  if (!this.validateAction(action)) {
    throw new Error('Invalid action');
  }
  
  // Custom state management
  this.applyAction(action);
  this.emitEvent('action', action);
  this.switchTurn();
}
```

**Impact:** Breaks framework integration, events don't fire correctly

**Root Cause:** Not reading base class implementation first

### 5. Import/Export Confusion
**❌ Problem:**
```typescript
// Assuming class-only export
import { AIService } from './AIService';
const service = new AIService(); // Error: AIService is not a constructor

// Reality: singleton export at file bottom
export const aiService = new AIService();
```

**Impact:** Runtime errors, "X is not a constructor" or "Cannot find module"

**Root Cause:** Not checking entire file for exports, especially at bottom

---

## Root Cause Analysis

### 1. Insufficient Base Class Understanding
**Symptoms:**
- Duplicate implementations of existing functionality
- Breaking framework conventions
- Custom event systems

**Root Causes:**
- Not reading BaseGameEngine.ts thoroughly
- Assuming how it works instead of verifying
- Copy-pasting without understanding

### 2. Cross-Layer Type Mismatches
**Symptoms:**
- GraphQL errors
- "Property undefined" in mutations
- AI decisions not parsing correctly

**Root Causes:**
- No shared type definitions
- Manual property mapping
- Evolution of code without updating all layers

### 3. Framework Lifecycle Ignorance
**Symptoms:**
- Double turn switching
- Events firing out of order
- State inconsistencies

**Root Causes:**
- Not understanding executeAction → applyAction → advanceTurn flow
- Custom lifecycle management
- Overriding methods unnecessarily

### 4. AI Service Integration Misunderstanding
**Symptoms:**
- "Failed to parse game state"
- AI timeouts
- No decisions returned

**Root Causes:**
- Not following exact prompt format
- Template variables in JSON
- Missing GraphQL mutations

---

## Technical Anti-Patterns

### 1. State Mutation Anti-Pattern
**❌ Bad:**
```typescript
this.state.players[0].score += 10; // Direct mutation
```

**✅ Good:**
```typescript
this.state = {
  ...this.state,
  players: this.state.players.map(p => 
    p.id === playerId ? { ...p, score: p.score + 10 } : p
  )
};
```

### 2. Synchronous Assumption Anti-Pattern
**❌ Bad:**
```typescript
this.makeMove();
const result = this.getResult(); // Assumes synchronous
```

**✅ Good:**
```typescript
await this.makeMove();
const result = this.getResult();
```

### 3. Event Emission Anti-Pattern
**❌ Bad:**
```typescript
this.emit('game-started'); // Wrong separator
this.eventBus.emit('gameStarted'); // Wrong format
```

**✅ Good:**
```typescript
this.emit('game:started', data);
this.context.eventBus.emit({
  type: 'game:started',
  timestamp: new Date(),
  data
});
```

---

## AI Integration Specific Issues

### 1. JSON Extraction Failures
**Problem:** AIService uses regex with brace counting
```typescript
// This regex looks for specific patterns
/Current game state(?:\s*\([^)]*\))?:\s*(\{[\s\S]*\})/
```

**Common Failures:**
- Adding text after "Current game state:"
- Using "Current game state for reference:"
- Template variables inside JSON

### 2. GraphQL Schema Mismatches
**Problem:** Frontend/backend field misalignment
```typescript
// Frontend sends
{ playerId: "123" }

// Backend expects
{ player_id: "123" }
```

**Prevention:** Always check GraphQL schema first

### 3. Model-Specific Agent Creation
**Problem:** Relying on UniversalAIAgent fallback
```typescript
// Bad: No game-specific agent
return new UniversalAIAgent(config);

// Good: Game-specific agent
return new YourGameAIAgent(config);
```

---

## Code Generation Mistakes

### 1. The "GameFactory" Lesson
**Mistake:** Assuming class names without verification
```typescript
// Generated based on assumption
import { GameFactory } from './GameDescriptor';

// Reality: It's BaseGameFactory
import { BaseGameFactory } from './GameDescriptor';
```

**Prevention Protocol:**
```bash
# ALWAYS verify exact names first
grep "export.*class.*Factory" GameDescriptor.ts
```

### 2. Method Signature Assumptions
**Mistake:** Guessing method parameters
```typescript
// Assumed
validateAction(action: Action): boolean

// Reality
validateAction(action: Action): IGameValidationResult
```

### 3. Import Path Fabrication
**Mistake:** Creating import paths that don't exist
```typescript
// Fabricated
import { SomeUtil } from '@/utils/game-utils';

// Should verify first
find . -name "*game-utils*"
```

---

## Prevention Strategies

### 1. Pre-Implementation Checklist
```bash
# 1. Study base classes
cat BaseGameEngine.ts | grep -E "(abstract|protected|public)"

# 2. Find existing patterns
grep -r "extends BaseGameEngine" --include="*.ts"

# 3. Check exports
tail -20 targetFile.ts | grep "export"

# 4. Verify types
grep "interface.*Action" interfaces.ts
```

### 2. During Implementation
1. **Copy structure, not code** from existing games
2. **Test incrementally** - compile after each method
3. **Log extensively** during development
4. **Verify GraphQL** schema matches exactly

### 3. Post-Implementation Verification
```typescript
// Add these debug logs
console.log('Creating AI agent:', playerConfig.id, playerConfig.aiModel);
console.log('Agent created:', agent.constructor.name);
console.log('Turn before action:', this.state.currentTurn);
console.log('Turn after action:', this.state.currentTurn);
```

### 4. Common Fix Patterns

#### Fix: Turn Management
```typescript
// In applyAction - sync index from turn
this.updateCurrentPlayerIndex();

// Remove any switchTurn() calls
// Let BaseGameEngine handle it
```

#### Fix: Property Names
```typescript
// Create shared types
interface Connect4LastMove {
  row: number;
  column: number; // Use 'column' everywhere
  playerId: string;
}
```

#### Fix: AI Prompts
```typescript
// Use EXACT format
const prompt = `Current game state:
${JSON.stringify(gameData, null, 2)}

Valid actions:
${JSON.stringify(validActions, null, 2)}

Choose your action.`;
```

---

## Conclusion

The most critical issues stem from:
1. **Not understanding BaseGameEngine's lifecycle** (causes double turn switching)
2. **Property name inconsistencies** across layers
3. **AI prompt format violations**
4. **Not verifying imports/exports** before using

Success comes from:
1. **Reading and understanding base classes first**
2. **Following existing patterns exactly**
3. **Maintaining type consistency** across all layers
4. **Testing incrementally** with extensive logging

The framework is well-designed but requires strict adherence to its patterns. Most failures come from trying to innovate rather than following established conventions.