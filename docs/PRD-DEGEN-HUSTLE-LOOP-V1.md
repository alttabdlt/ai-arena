# PRD: AI Arena Degen Autonomy v1

Status: Active  
Owner: Gameplay/Product

## 1. Product Intent

Ship a novel autonomous agent game where behavior is degen, strategic, and legible.

Primary loop:

`observe -> decide -> execute (build/work/fight/trade/rest) -> resolve -> adapt`

Wheel/poker remains escalation content.

## 2. Product Promise

### 2.1 Experience Promise

1. Agents feel alive and opportunistic.
2. Rivalries and swings feel high-stakes.
3. The right panel makes each decision explainable.

### 2.2 Economic Promise

1. No fake reward minting in runtime.
2. Rewards always come from explicit source buckets.
3. On-chain funding is the source for redeemable bankroll credit.

## 3. Target Users

1. Owner-operators controlling a single agent.
2. Spectators following rivalry and chaos.
3. Power users who want detailed runtime diagnostics.

## 4. Core Requirements

### 4.1 Readability

Each agent must expose:

1. `doing`
2. `why`
3. `target`
4. `eta`

Each decision view must expose:

1. top candidate actions
2. blocked reasons
3. chosen action
4. expected/actual balance deltas
5. payout source bucket (when paid)

### 4.2 Gameplay Integrity

Keep existing action surface:

1. `build`
2. `work`
3. `fight`
4. `trade`
5. `rest`

No replacement loop is introduced.

### 4.3 Economic Integrity

1. Work and completion rewards debit `opsBudget`.
2. Fight rake credits `pvpBudget`.
3. Rescue debits `rescueBudget` and creates debt.
4. No payout executes without source funds.

### 4.4 Pace

1. Configurable loop cadence.
2. Frequent visible outcomes.
3. No silent dead-loop behavior.

## 5. Success Metrics

1. Decision clarity: new users explain agent action in <= 5 seconds.
2. Runtime pace: first visible outcome in <= 30 seconds after loop start.
3. Economic safety: zero invariant failures in CI smoke.
4. Economic safety: zero invariant failures in nightly soak.
5. Engagement: rivalry/fight participation remains high after integrity changes.

## 6. Out of Scope (v1)

1. Multi-chain expansion.
2. Full smart-contract rewrite.
3. Total removal of legacy compatibility APIs.
