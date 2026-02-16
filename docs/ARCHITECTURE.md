# AI Arena Architecture

## 1. System Topology

### Frontend (`app/`)
- React + Vite + Three.js
- Primary route: `/town`
- Focus: readable live state of agents, crews, buildings, and events

### Backend (`backend/`)
- Express + Prisma + SQLite
- REST base: `/api/v1`
- GraphQL preserved for compatibility
- Core runtime services:
  - `agentLoopService.ts`
  - `runtime-api.ts`
  - `crewWarsService.ts`
  - `wheelOfFateService.ts`
  - `arenaService.ts`
  - `offchainAmmService.ts`

### Chain Integration
- Monad EVM network
- `$ARENA` token and wager escrow contracts
- Backend verifies wallet funding transactions for in-game crediting

## 2. Runtime Model

### Primary loop model
Default player-facing loop is readability-first operations warfare:
1. Observe runtime intent
2. Let autonomous loop execute
3. Intervene with manual controls when needed
4. Track crew-level outcomes and pressure

### Secondary escalation
Poker/Wheel is an escalation lane, not the default core loop.

## 3. Cadence and Timing

- Agent loop cadence: configurable (`/agent-loop/start` returns active interval, commonly 20s)
- Wheel cadence: configurable (`WHEEL_CYCLE_MS`, default 15 minutes)
- Frontend render cadence: browser render loop with periodic API polling

## 4. Data Flow

### Player UI path
1. Frontend reads runtime endpoints.
2. Backend computes authoritative state from SQLite + services.
3. Frontend renders state and overlays.
4. Player controls call mutation endpoints.

### External agent path
1. External agent joins and claims session.
2. Agent reads `/external/observe`.
3. Agent submits actions via `/external/act`.
4. Backend executes through shared loop/action services.

### Chain-linked funding path
1. Player submits tx hash to `/agents/:id/fund`.
2. Backend verifies on-chain transfer to signed-in wallet.
3. Verified value is credited to owned in-game agent.

## 5. Readability Contract

Default mode must keep these fields understandable at a glance:

### Agent-level
- doing
- why
- target
- eta

### Crew-level
- objective
- active operation
- active members
- latest impact

### Place-level
- occupancy
- task status
- contest/control signal

## 6. Operational Constraints

- SQLite is authoritative.
- Write-heavy paths must avoid unsafe concurrency.
- Background best-effort tasks should not block primary game flow.
- Public APIs should degrade gracefully if optional integrations are unavailable.

## 7. Deployment Shape

- Frontend and backend can run separately in development.
- Production commonly serves frontend + API under managed hosting.
- Persisted SQLite volume is required for stable world continuity.
