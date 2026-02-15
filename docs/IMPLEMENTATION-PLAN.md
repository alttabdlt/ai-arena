# Implementation Plan: Close the 3 Biggest Gaps

Status: Implemented

## 0. Current Baseline

Already implemented in runtime:
- Claim/build fallback hardening and reduced dead-rest loops.
- Solvency rescue with cooldown + per-window cap + debt repayment.
- Poker action normalization/fallback to prevent wheel stalls.
- Operator identity and command queue foundations (`/link`, `/myagent`, `/command`, operator API).

## 1. Gap A — Player Agency via Telegram (Highest Priority)

### Goal
Give owners frictionless control/communication with their own agent, not generic spectator prompts.

### Current Progress
- `/say` command path implemented (owner-targeted messaging).
- NL router supports "my agent ..." intent routing.
- Owner messaging is ownership-gated through linked Telegram identity.
- Receipts now include queue status, target, expected tick window, and completion callback.

### Deliverables
1. Direct “message my agent” flow in Telegram without requiring agent name. ✅
2. Ownership-gated path using linked Telegram identity. ✅
3. Better receipts:
   - queued instruction ✅
   - target agent ✅
   - expected tick window ✅
   - final agent reply/action summary ✅
4. Natural language router support for owner-targeted phrasing. ✅

### Technical Tasks
- Update `telegramBotService.ts`:
  - add owner-targeted message handler
  - add parser for “my agent ...”/`/say` command
  - resolve active linked agent from `operatorIdentityService`
- Keep `/tell` for public/spectator suggestions.
- Add tests for linked vs unlinked user behavior.

### Done Definition
Owner can reliably message their linked agent and receive reply/action feedback with no manual agent lookup.

## 2. Gap B — Economy Pacing and Balance

### Goal
Make progression tight enough to feel rewarding while avoiding rescue dependency and passive drift.

### Deliverables
1. Rescue/debt dashboard usage in balancing workflow.
2. Tuning pass on:
   - upkeep
   - work wage curve
   - completion bonus
   - claim/build cost progression
3. Balance guardrails documented in config constants.

### Technical Tasks
- Add lightweight metrics snapshot endpoint(s) where missing.
- Run scripted tick simulations and compare action mix before/after tuning.
- Record recommended default constants in docs.

### Shipped
- `GET /agent-loop/economy-metrics` now returns action mix, non-rest rate, positive delta hit rate, command outcome rates, rescue debt, pool balances, and warnings.
- Rescue parameters tuned (`trigger bankroll`, grant size, cooldown, max rescues per window).
- Work/completion rewards tuned to reduce rescue dependence and improve action momentum.
- Added anti-idle rest redirects so feasible `work/build/claim/trade/fight` actions are preferred over passive rest.

### Done Definition
Non-rest action mix stays high without rescue overuse; debt trends downward over sustained runs.

## 3. Gap C — Retention Layer

### Goal
Make the game sticky over repeated sessions, not just mechanically functional.

### Deliverables
1. Daily/rolling streak objective framework.
2. Rivalry progression with visible score and rewards.
3. Recurring short goals with payout hooks.

### Technical Tasks
- Extend goal/relationship surfaces already present in town APIs.
- Add user-visible streak/rival counters in Telegram + frontend surfaces.
- Tie rewards to completed streak/goal milestones.

### Shipped
- Non-rest streak milestones now award bonus ARENA (`x3/x5/x8/x13`) with solvency-pool guardrails.
- `GET /agent/:id/retention` exposes streak, rivals/friends, and active goal snapshot.
- `/myagent` now includes retention summary (streak, active goals, top rival).

### Done Definition
Users have clear reasons to return and monitor outcomes over multiple cycles.

## 4. Execution Order

1. Gap A (Telegram agency)
2. Gap B (economy tuning using telemetry)
3. Gap C (retention systems)

## 5. Verification Checklist

- [x] `backend` build clean
- [x] key backend tests clean
- [x] live agent-loop run shows no high-frequency failure regressions
- [x] wheel fights still complete under load
- [x] docs and API references updated with shipped behavior
