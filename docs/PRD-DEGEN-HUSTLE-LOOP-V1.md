# PRD: Degen Hustle Loop v1

Status: Active
Owner: Gameplay/Product

## 1. Product Intent

Deliver a fast, addictive loop where every cycle has a meaningful decision:

`build / work / fight / trade -> bankroll change -> next decision`

The loop should feel like high-conviction degen strategy, not admin chores.

## 2. User Problem

Current pain points:
1. Player agency is still too indirect.
2. Economy is healthier than before but still not fully tuned for sticky session play.
3. Retention loops (streaks, rivalry arcs, recurring goals) are too weak.

## 3. Target Users

1. Spectators betting/watching Wheel fights.
2. Owners controlling their linked agents through Telegram.
3. Power users optimizing action cadence and bankroll growth.

## 4. Core Experience Requirements

### 4.1 Decision cadence
- One high-signal decision every ~20-30 seconds.
- `rest` should be rare and explicitly explained.

### 4.2 Legibility
- Every action should expose:
  - reason
  - expected outcome
  - actual outcome
  - next intended move

### 4.3 Agency
- Telegram owner should be able to talk to and steer their own linked agent quickly.
- Commands must return concrete receipts (queued, applied, rejected).

## 5. Gameplay Pillars

### Work
- stable baseline income and progression momentum

### Fight
- high-variance, high-drama bankroll pressure/recovery path

### Trade
- liquidity/risk rebalance

### Build
- medium-term multiplier and territory pressure

### Claim
- strategic gate, not forced default opener

## 6. Success Metrics (v1)

1. `non_rest_rate >= 80%` in active loops.
2. median `time_to_first_positive_delta <= 2 ticks`.
3. owner-issued Telegram messages receive agent reply receipt in next tick window.
4. manual intervention rate for stuck loops reduced by >= 50%.

## 7. Acceptance Criteria

1. Linked Telegram owner can issue direct “talk to my agent” instructions without typing agent name.
2. Agent returns a direct in-character reply and executed action context.
3. Rescue/debt telemetry is visible and operational for balancing.
4. Wheel matches continue without invalid poker action stalls.
5. Docs and API surfaces remain aligned with implementation.

## 8. Out of Scope (v1)

1. New game modes beyond poker-based wheel fights.
2. Full redesign of contract/token architecture.
3. Multi-chain or non-Monad migration.

## 9. Release Checklist

- [x] Telegram owner-to-agent direct messaging shipped
- [x] Player-facing command receipts improved
- [x] Economy tuning pass completed with live metrics
- [x] Retention hooks implemented (streaks/rivals/goals)
- [x] QA on backend loop stability and frontend usability
