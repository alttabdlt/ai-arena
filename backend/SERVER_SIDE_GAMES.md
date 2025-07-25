# Server-Side Game Execution Architecture

## Overview

This architecture moves game execution from the client to the server, preventing issues where games continue running when users navigate away from the page. It uses a spectator pattern where the server runs the game and clients subscribe to updates via GraphQL subscriptions.

## Key Components

### Backend

1. **GameManagerService** (`backend/src/services/gameManagerService.ts`)
   - Manages all active games in memory
   - Runs game loops with configurable delays
   - Handles game lifecycle (create, start, pause, resume, destroy)
   - Manages spectators for each game
   - Publishes updates via GraphQL subscriptions
   - Persists game state to Redis

2. **Game Engine Adapters** (`backend/src/services/gameEngineAdapter.ts`)
   - Adapter pattern for integrating different game types
   - Provides uniform interface for:
     - Processing player actions
     - Getting valid actions
     - Checking game completion
     - Determining winners
   - Implementations for Poker and Reverse Hangman

3. **GraphQL Schema & Resolvers**
   - Mutations: createGame, startGame, pauseGame, resumeGame, addSpectator, removeSpectator
   - Queries: activeGames, gameById, gameStats
   - Subscriptions: gameStateUpdate, gameEvent, allGameUpdates

### Frontend

1. **useServerSideGame Hook** (`app/src/hooks/useServerSideGame.ts`)
   - Generic hook for any server-side game
   - Handles game initialization and cleanup
   - Subscribes to game updates
   - Manages spectator registration
   - Provides pause/resume controls

2. **useServerSideReverseHangman Hook** (`app/src/hooks/useServerSideReverseHangman.ts`)
   - Specialized for Reverse Hangman game
   - Transforms server state to UI state
   - Manages animation phases
   - Tracks tournament statistics

3. **ReverseHangmanServerView** (`app/src/pages/ReverseHangmanServerView.tsx`)
   - Example implementation using server-side execution
   - Shows pause/resume controls
   - Displays "Server-Side Execution" indicator

## Architecture Flow

1. **Game Creation**
   ```
   Client → createGame mutation → GameManagerService
   GameManagerService creates game instance → Stores in memory + Redis
   ```

2. **Game Loop**
   ```
   GameManagerService runs interval → Checks current turn
   → Calls AI service for decision → Updates game state via adapter
   → Publishes state update → Clients receive via subscription
   ```

3. **Spectator Pattern**
   ```
   Client joins → addSpectator mutation → Added to game's spectator set
   Client leaves → removeSpectator mutation → Removed from set
   No spectators for 30s → Game auto-pauses
   ```

## Benefits

1. **Resource Management**: Games don't consume client resources when user navigates away
2. **Consistency**: Single source of truth for game state
3. **Scalability**: Server can run many games concurrently
4. **Reliability**: Games continue even if clients disconnect
5. **Monitoring**: Centralized game stats and monitoring

## Usage

To test the server-side execution:

1. Create a tournament as usual
2. Navigate to `/tournament/{id}/hangman-server` instead of `/tournament/{id}/hangman`
3. Notice the "Server-Side Execution" indicator and pause/resume controls
4. Navigate away and return - the game continues on the server

## Configuration

- Game loop delays configured per game type in `getLoopDelay()`
- Redis TTL for game state: 1 hour
- Auto-pause delay when no spectators: 30 seconds
- Cleanup interval for completed games: 5 minutes

## Future Enhancements

1. Horizontal scaling with Redis pub/sub
2. Game state snapshots for replay
3. Server-side game recording
4. Load balancing across multiple game servers
5. WebRTC for lower latency updates