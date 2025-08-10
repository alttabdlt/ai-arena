# Game Architecture - Server-Authoritative Design

## Core Principle
**ALL game logic runs on the backend server**. The frontend is purely presentational.

## Directory Structure
```
/modules/game/
├── shared/
│   ├── types/      # Type definitions ONLY (no implementations)
│   │   ├── interfaces.ts         # Core game interfaces
│   │   ├── extensions.ts         # Extended interfaces
│   │   ├── PokerTypes.ts         # Poker-specific types
│   │   ├── Connect4Types.ts      # Connect4-specific types
│   │   ├── ReverseHangmanTypes.ts # ReverseHangman types
│   │   └── game-specific-types.ts # Additional type definitions
│   └── utils/      # Utility functions (formatting, helpers)
│       └── poker-helpers.ts      # Poker display utilities
├── poker/          # Poker UI components
├── connect4/       # Connect4 UI components  
└── reverse-hangman/ # ReverseHangman UI components
```

## Data Flow
1. **User Action** → Frontend UI
2. **Send Action** → GraphQL Mutation to Backend
3. **Process Action** → Backend GameEngineAdapter validates and applies
4. **Update State** → Backend broadcasts new state
5. **Receive Update** → Frontend via GraphQL Subscription
6. **Display State** → Frontend renders new state

## Backend Architecture
The backend (`/backend/src/services/`) contains:
- `gameManagerService.ts` - Orchestrates game sessions
- `gameEngineAdapter.ts` - Contains all game logic implementations
  - `PokerEngineAdapter`
  - `Connect4EngineAdapter`
  - `ReverseHangmanAdapter`

## Frontend Responsibilities
- Display game state
- Capture user input
- Send actions to backend
- Subscribe to state updates
- NO game logic execution

## Adding New Games
1. **Backend**: Create adapter in `gameEngineAdapter.ts`
2. **Backend**: Register in `gameManagerService.ts`
3. **Frontend**: Create UI components in `/modules/game/{game-name}/`
4. **Frontend**: Use GraphQL subscriptions for state updates
5. **Frontend**: Send actions via GraphQL mutations

## Why Server-Authoritative?
- **Security**: Prevents client-side manipulation
- **Consistency**: Single source of truth for all players
- **Integrity**: Essential for tournaments with rewards
- **AI Integration**: AI decisions happen server-side
- **Anti-cheat**: Server validates all actions

## Key Files
- Backend game logic: `/backend/src/services/gameEngineAdapter.ts`
- Frontend hooks: `/modules/game/{game}/hooks/useServerSide{Game}.ts`
- Shared types: `/modules/game/shared/types/`

## Important Notes
- NEVER implement game logic in the frontend
- ALWAYS validate actions on the backend
- Frontend should only display what backend sends
- All game state changes must go through the backend
- Frontend shared/types should contain ONLY type definitions, NO class implementations
- Any file extending base classes or containing game logic belongs in the backend