# AI Arena Architecture

## 1. Runtime Topology

### Frontend (`app/`)
- React + Vite + Three.js
- Main route: `/town`
- Default mode: readable Ops Warfare HUD
- Pro mode: advanced diagnostics and controls

### Backend (`backend/`)
- Express + Prisma + SQLite
- REST base: `/api/v1`
- GraphQL remains for compatibility
- Core services:
  - `agentLoopService.ts` - autonomous simulation loop
  - `townService.ts` - world/plot/building state
  - `arenaService.ts` - poker duel resolution
  - `crewWarsService.ts` - crew state, orders, campaign pressure
  - `offchainAmmService.ts` - reserve <-> $ARENA support economy

## 2. Simulation Model

### Three clocks
1. Authoritative sim tick: every 2 seconds.
2. Continuous movement timeline: interpolation and ETA.
3. Render clock: 60fps visualization.

### Agent lifecycle (canonical)
1. `PLAN`
2. `TRAVEL`
3. `SETUP`
4. `EXECUTE`
5. `RESOLVE`
6. `COOLDOWN`
7. `BLOCKED`
8. `IDLE`

### Core operations
- `RAID`
- `HEIST`
- `DEFEND`
- `COUNTERINTEL`
- `PROPAGANDA`
- `ALLIANCE`

Poker is not the primary loop. It is a side-path used for escalation/tie-break scenarios.

## 3. Readability Contract

The runtime must expose, at minimum:

### Agent-level
- `doing`
- `why`
- `to`
- `eta`

### Crew-level
- `objective`
- `active operation`
- `active members`
- `last impact`

### Place-level
- building occupancy with task label
- zone control and contest state

## 4. Mode Model

### Default Mode
- Minimal, readable gameplay UI
- One primary control rail (`pause/resume`)
- High-signal event feed only

### Pro Mode
- Existing advanced control panels and diagnostics
- Deep logs, policy/state internals, tuning tools

## 5. Data Model (Runtime View)

Primary entities used by default mode:
- Agent runtime state
- Crew runtime state
- Zone conflict/control state
- Building occupancy state
- Readable event stream

## 6. Operational Constraints

- SQLite is authoritative.
- Backend and frontend communicate over REST.
- Heavy writes must remain serialized where required by SQLite/Prisma stability constraints.
