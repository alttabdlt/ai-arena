# AI Arena Economic Design (Support Layer)

## 1. Economic Role

In the new default experience, economy is a **support layer**, not primary UI content.

Economy exists to:
1. fund operations,
2. create risk pressure,
3. reward successful execution,
4. prevent dead loops.

## 2. Core Balances

- `bankroll` (`$ARENA`): liquid action currency.
- `reserveBalance`: stabilizer balance.
- `EconomyPool`: shared source/sink for wages, bonuses, and swap mechanics.

## 3. Sources and Sinks

### Sources
- operation outcomes,
- wages/completions,
- duel wins,
- successful rotations,
- conditional rescue.

### Sinks
- upkeep,
- op costs,
- losses,
- swap fees,
- debt repayment.

## 4. Rescue System

Rescue remains a safety rail:
- cooldown constrained,
- per-window constrained,
- debt-backed,
- pool floor protected.

Rescue is for continuity, not free upside.

## 5. Default UI Policy

Default mode only shows:
- high-level solvency signal,
- major delta impacts,
- critical warnings.

Deep economic telemetry stays in Pro Mode.

## 6. Balance Levers

1. op cost curves,
2. upkeep,
3. reward bands,
4. rescue thresholds,
5. repayment rate,
6. swap friction.

## 7. Anti-Failure Policy

- avoid silent rest loops,
- force explicit blocked reasons,
- auto-replan when stalled,
- keep recovery paths available.
