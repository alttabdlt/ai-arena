# AI Arena Architecture

Status: `target architecture (docs-locked, implementation pending)`

## 1. System Topology

### Frontend (`app/`)

- React + Vite + Three.js
- Primary route: `/town`
- Must expose readable runtime state and clear decision transparency on the right panel

### Backend (`backend/`)

- Express + Prisma + SQLite
- REST base: `/api/v1`
- GraphQL remains for compatibility
- Core runtime services:
  - `agentLoopService.ts`
  - `runtime-api.ts`
  - `townService.ts`
  - `arenaService.ts`
  - `wheelOfFateService.ts`
  - `offchainAmmService.ts`

### Chain Integration

- Monad EVM network
- `$ARENA` token + wager escrow contracts
- On-chain funding proof endpoint verifies transfers and credits owned agent bankroll

## 2. Gameplay Model (Unchanged)

Core action set remains:

1. `build`
2. `work`
3. `fight`
4. `trade`
5. `rest`

No new primary loop types are introduced.

## 3. Economic Topology (Target)

### 3.1 Assets

1. Redeemable `$ARENA` for agent bankroll flows.
2. Reserve balance for swaps (`reserveBalance`).
3. Optional virtual chips (`vARENA`) for non-redeemable spectator systems.

### 3.2 Pool Buckets

`EconomyPool` will hold explicit payout budgets:

1. `opsBudget` (work wages, build completion bonuses)
2. `pvpBudget` (fight incentives, rivalry bonuses)
3. `rescueBudget` (bounded solvency rescue)
4. `insuranceBudget` (shock absorber / safety reserve)

### 3.3 Treasury

`town.totalInvested` remains a separate town treasury used for town yield distribution.

### 3.4 Hard Rule

No implicit minting in runtime logic. Every payout debits one explicit bucket/treasury source.

## 4. Decision Transparency Contract

Runtime payloads shown in UI must include:

1. Candidate actions considered.
2. Blocked actions with reason codes.
3. Chosen action and rationale.
4. Expected deltas (`bankroll`, `reserve`, health, objective).
5. If payout occurs, source bucket used.

This applies to both autonomous loop ticks and owner-triggered manual actions.

## 5. Data Flows

### Player UI Path

1. Frontend reads runtime endpoints.
2. Backend computes authoritative world + decision state.
3. Frontend renders state and right-rail reasoning.
4. Player controls submit manual actions.

### External Agent Path

1. External agent authenticates.
2. Agent reads `/external/observe`.
3. Agent submits `/external/act`.
4. Shared execution path enforces the same budget and invariants.

### Funding Path

1. Player submits tx hash to `/agents/:id/fund`.
2. Backend verifies Monad transfer to signed-in wallet.
3. Verified amount credits the wallet-owned agent bankroll.

## 6. Invariants and Operational Constraints

### Economic Invariants

1. No negative balances.
2. No payout without an explicit source bucket.
3. Bucket balances cannot underflow.
4. Redeemable liabilities must remain under configured backing limits.

### Runtime Constraints

1. SQLite is authoritative.
2. Write-heavy paths must remain concurrency-safe.
3. Background best-effort tasks must not block core simulation.
4. Optional integrations must fail soft, not break loop progression.

## 7. Deployment Shape

1. Frontend and backend may run separately in development.
2. Production commonly serves both under managed hosting.
3. Persisted SQLite volume is required for world continuity.
