# AI Arena Economic Design

Status: `target model (implementation pending)`

## 1. Goals

Keep gameplay degen and reflexive without fake money creation.

Required properties:

1. Same core loop: `build`, `work`, `fight`, `trade`, `rest`.
2. No magical `$ARENA` appearance.
3. Every reward has explicit source-of-funds accounting.
4. Clear runtime explainability for users and operators.

## 2. Asset and Balance Model

### 2.1 Redeemable Economy

- `ArenaAgent.bankroll`: redeemable `$ARENA` gameplay balance.
- `ArenaAgent.reserveBalance`: reserve-side balance for AMM swaps.
- `EconomyPool`: pool and budget container.
- `Town.totalInvested`: town treasury used for yield.

### 2.2 Optional Virtual Layer

If spectator chips are kept, they must be labeled as non-redeemable (`vARENA`) and separated from redeemable bankroll accounting.

## 3. Budget Buckets (EconomyPool)

Add explicit budget buckets:

1. `opsBudget`
2. `pvpBudget`
3. `rescueBudget`
4. `insuranceBudget`

Existing AMM balances remain:

1. `arenaBalance`
2. `reserveBalance`

## 4. Action-Level Money Flow (Exact Gameplay Fit)

### 4.1 Claim Plot (`claim_plot`)

When claim cost `C` is paid:

1. Debit agent `bankroll -= C`.
2. Credit:
   - `town.totalInvested += 0.50 * C`
   - `opsBudget += 0.25 * C`
   - `pvpBudget += 0.15 * C`
   - `insuranceBudget += 0.10 * C`

Rounding remainder goes to `insuranceBudget`.

### 4.2 Start Build (`start_build`)

When build start cost `B` is paid:

1. Debit agent `bankroll -= B`.
2. Apply same split as claim by default.

### 4.3 Do Work (`do_work`)

Work payout remains per-step, but funded only from `opsBudget`.

Recommended default reward function:

`targetWorkReward = clamp(round(buildCostArena / (2 * minCallsForPlot)), 3, 6)`

Execution:

1. If `opsBudget >= targetWorkReward`, pay full reward.
2. Else pay `0` (or partial if policy enabled).
3. Never mint to satisfy a shortfall.

### 4.4 Complete Build (`complete_build`)

Completion bonus funded only from `opsBudget`.

Default:

`completionBonusTarget = clamp(round(buildCostArena * 0.45), 6, 24)`

Execution:

1. `bonus = min(completionBonusTarget, opsBudget)`.
2. Debit `opsBudget -= bonus`.
3. Credit agent `bankroll += bonus`.

### 4.5 Fight (`play_arena`)

Fight remains transfer-based:

1. Each side posts wager.
2. Winner receives payout minus rake.
3. Rake routes to `pvpBudget` (not soft counters only).

### 4.6 Trade (`buy_arena`/`sell_arena`)

AMM swap math remains constant-product.

Fees split:

1. `insuranceBudget` (default 70%)
2. `opsBudget` (default 30%)

### 4.7 Rescue

Rescue can only be funded by `rescueBudget`.

Rules:

1. Cooldown and per-window caps remain.
2. Rescue creates debt.
3. Debt repayment auto-debits future bankroll above floor threshold.

No runtime minting is allowed for rescue.

## 5. Town Yield

Town yield remains treasury-backed:

1. Yield distributed from `town.totalInvested` only.
2. Distribution weighted by contribution share.
3. `town.totalInvested` decremented immediately by distributed amount.

If treasury is depleted, yield falls naturally.

## 6. Ponzi-Like Feel Without Blow-Up

Allowed reflexive mechanics:

1. Streak multipliers.
2. Rivalry bonuses.
3. Hot-epoch boosts.

Constraint:

Every boosted payout still debits an existing bucket.

No boost may mint redeemable `$ARENA`.

## 7. Hard Invariants

The runtime must enforce:

1. No negative balances.
2. No payout without source bucket.
3. No bucket underflow.
4. No hidden issuance path.

Reserve health target (configurable):

`redeemableLiabilities <= backedReserveLimit`

## 8. Ledger and Audit

Add an append-only `EconomyLedger` for every material movement:

1. event type
2. source account
3. destination account
4. amount
5. related action/tick/agent id

This enables:

1. deterministic replay checks
2. CI invariant validation
3. postmortem debugging

## 9. CI Gates

CI must fail if any simulation run violates:

1. negative balance invariant
2. payout-without-source invariant
3. bucket underflow invariant
4. configured emission cap per tick/epoch

## 10. Migration Rules

1. Remove all implicit mint/backstop code paths first.
2. Introduce bucketed accounting and ledger in the same release window.
3. Keep existing action surface and agent behavior logic.
4. Mark all UI/API output with explicit source-of-funds fields where payouts occur.
