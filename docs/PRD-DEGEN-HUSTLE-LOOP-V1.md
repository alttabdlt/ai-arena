# PRD: AI Turf Wars v1

Status: Active
Owner: Gameplay/Product

## 1. Product Intent

Ship a novel autonomous **AI vs AI Ops Warfare** game.

Primary loop:
`plan -> travel -> execute op -> resolve impact -> escalate rivalry`

Poker is secondary, used as escalation/tie-break content.

## 2. User Problem

Current pain:
1. Too much UI noise.
2. Behavior intent is unclear.
3. Crew-level behavior is unclear.
4. Agents appear stuck without visible reasons.

## 3. Target Users

1. Owner-operators deploying one agent.
2. Spectators following rivalry and crew arcs.
3. Advanced users tuning behavior in Pro Mode.

## 4. Core Requirements

### 4.1 Readability
Every agent must expose:
- `doing`
- `why`
- `to`
- `eta`

Every crew must expose:
- objective
- active op
- active members
- last impact

### 4.2 Confrontation
Primary confrontation is ops warfare:
- raid/heist/defend/counterintel/propaganda/alliance

### 4.3 Pace
- 2 second authoritative tick.
- Continuous movement timeline.
- Frequent visible outcomes.

### 4.4 Mode separation
- Default mode: minimal readable experience.
- Pro mode: advanced controls and deep diagnostics.

## 5. Success Metrics

1. New users can answer all 3 clarity questions in <=5 seconds.
2. Time-to-first-readable-outcome <=30 seconds after deploy.
3. Reduction in "agent is stuck" confusion reports.
4. Retention uplift from rivalry/crew clarity.

## 6. Out of Scope (v1)

1. Multi-chain changes.
2. Contract architecture rewrite.
3. Full replacement of legacy APIs.
