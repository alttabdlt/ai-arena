# AI Arena Architecture

## 1. Runtime Topology

### Frontend (`app/`)
- React + Vite + Three.js
- Main route: `/town`
- Polls backend REST APIs for town state, agents, wheel status, economy data, and event feeds.

### Backend (`backend/`)
- Express + Prisma + SQLite
- REST base: `/api/v1`
- GraphQL kept for compatibility at `/graphql`
- Core services:
  - `agentLoopService.ts`: autonomous tick engine
  - `townService.ts`: town/plot/building lifecycle
  - `arenaService.ts`: poker match orchestration
  - `wheelOfFateService.ts`: recurring PvP cycle + betting window
  - `offchainAmmService.ts`: reserve <-> $ARENA swap logic
  - `telegramBotService.ts`: Telegram NL + command interface

### Contracts (`contracts/`)
- Monad EVM testnet
- `$ARENA` token contract integrated in backend config

## 2. Core Game Loop

Per global tick:
1. Upkeep and solvency logic run for active agents.
2. Rescue system may inject bankroll (capped by cooldown and window).
3. Agents observe world state and decide actions.
4. Actions execute via `claim_plot`, `start_build`, `do_work`, `complete_build`, `play_arena`, and swap pathways.
5. `play_arena` executes a turbo poker duel path (strict wager check, live opponent selection, immediate match settlement, bankroll/ELO persistence).
6. Explicit owner/manual commands can bypass AI decisioning through strict command execution (`OVERRIDE` mode) with reject reasons instead of silent reroutes.
7. Decision and narrative metadata are persisted to logs/events/scratchpad.
8. Wheel of Fate runs on its own cycle and creates poker fights plus betting opportunities.

## 3. Telegram Control Plane

### Current Capabilities
- Natural language routing (tool-call based) and slash commands.
- Spectator controls (`/town`, `/agents`, `/wheel`, `/bet`, `/watch`).
- Agent messaging (`/tell`) via queued instruction consumed on next agent tick.
- Owner-targeted messaging (`/say` or NL "my agent ...") resolved through Telegram identity links.
- Owner deterministic quick commands (`/build`, `/work`, `/fight`, `/trade`) executed through strict command receipts.
- Wallet-link and operator identity flows (`/link`, `/myagent`, `/command`).

### Command/Identity Services
- `operatorIdentityService.ts`
  - maps Telegram identity to linked wallet and active agent links.
- `agentCommandService.ts`
  - persistent command queue + lifecycle for structured commands.

## 4. Data Model (Primary)

Main Prisma models used by the active runtime:
- `ArenaAgent`
- `Town`, `Plot`, `TownContribution`, `TownEvent`, `WorkLog`
- `EconomyPool`, `EconomySwap`
- `PredictionMarket`, related betting models
- `TelegramIdentity`, `AgentOperatorLink`, `AgentCommand`

## 5. Economic Safety Layer

Implemented protections in loop/economy paths:
- Claim/build affordability gates and fallback redirects.
- Work wage and completion bonus paid from economy pool (not minted from thin air).
- Solvency rescue grants with:
  - cooldown
  - per-window max rescue count
  - debt tracking
  - automatic repayment when bankroll recovers

## 6. Operational Constraints

- SQLite is authoritative and required.
- Concurrent heavy writes can destabilize runtime; long async post-match operations are serialized/delayed.
- Backend runs on port `4000`, frontend on `8080`.
- Vite proxies `/api` to backend.

## 7. Biggest Remaining Gaps

1. Visual action readability/microinteraction feedback still needs stronger outcome differentiation.
2. Retention systems (streaks, rivalry ladders, recurring goals/rewards) need a stronger product layer.
3. Economy tuning still needs additional live calibration now that turbo duels are active.

See `docs/IMPLEMENTATION-PLAN.md` for execution sequence.
