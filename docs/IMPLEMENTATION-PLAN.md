# Implementation Plan: Economy Integrity + Decision Transparency

Status: Active

## Goal

Implement the documented launch model without changing the core gameplay action set.

Required outcome:

1. No implicit `$ARENA` issuance.
2. Bucketed source-of-funds accounting for payouts.
3. Runtime right-panel decision clarity.
4. CI gates that fail on economic invariant breaks.

## Phase 0 - Docs Lock (Complete)

### Scope

1. Align root and `/app` docs with target model.
2. Mark live vs planned API behavior.

### Acceptance

1. `README`, `docs/*`, `app/README`, and `app/CLAUDE` all reflect same economic rules.

## Phase 1 - Schema and Accounting Backbone

### Scope

1. Extend `EconomyPool` with budget buckets:
   - `opsBudget`
   - `pvpBudget`
   - `rescueBudget`
   - `insuranceBudget`
2. Add append-only `EconomyLedger`.
3. Add shared accounting helpers for debit/credit/ledger append.

### Deliverables

1. Prisma migration for bucket + ledger schema.
2. Service layer helpers used by town/arena/loop paths.

### Acceptance

1. No direct balance mutation in payout code without ledger event.
2. Unit tests for helper behavior and rollback safety.

## Phase 2 - Remove Implicit Issuance and Route Flows

### Scope

1. Remove backstop mint behavior.
2. Route existing claim/start-build proceeds into configured split buckets.
3. Route `do_work` and `complete_build` payouts to `opsBudget`.
4. Route fight rake to `pvpBudget`.
5. Route AMM fees to `insuranceBudget` and `opsBudget`.
6. Keep rescue debt logic, but fund rescue from `rescueBudget` only.

### Deliverables

1. Updated `agentLoopService`, `townService`, `arenaService`, `offchainAmmService`.
2. Migration-safe defaults and caps.

### Acceptance

1. Existing action surface unchanged.
2. No payout path can execute if source bucket is empty.

## Phase 3 - Runtime Transparency Contract

### Scope

1. Enrich runtime payloads with decision reasoning structure:
   - candidates
   - blocked reasons
   - chosen action
   - payout source (when applicable)
2. Update frontend right rail to render these fields clearly.

### Deliverables

1. Runtime API payload additions.
2. Frontend panels with deterministic field mapping.

### Acceptance

1. Operator can explain an agent decision from payload alone.
2. Economic source shown for rewarding actions.

## Phase 4 - CI Invariants and Soak Gates

### Scope

1. Add invariant checker service for simulation runs.
2. Add CI tests for:
   - no negative balances
   - no payout without source
   - no bucket underflow
   - emission cap compliance
3. Include short smoke + longer soak coverage.

### Deliverables

1. New tests and CI workflow updates.
2. Failure summaries in CI artifacts.

### Acceptance

1. Build fails on first invariant violation.
2. Invariant reports are readable and actionable.

## Rollout Order

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4

Do not ship later phases before Phase 2 is stable.
