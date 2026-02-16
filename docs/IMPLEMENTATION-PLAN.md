# Implementation Plan: AI Ops Warfare Readability Overhaul

Status: Active

## Goal

Deliver a readable, high-tempo AI vs AI Ops Warfare experience where players can instantly answer:
1. What is my agent doing?
2. Why is it doing that?
3. What is my crew doing right now?

## Phase 1 - Runtime Readability Foundation

### Scope
- Add runtime-facing APIs for agents, crews, zones, buildings, and feed.
- Standardize runtime state payloads (`state`, `action`, `reason`, `target`, `eta`).
- Add pause/resume controls for owner runtime control.

### Deliverables
1. `GET /runtime/agents`
2. `GET /runtime/crews`
3. `GET /runtime/zones`
4. `GET /runtime/buildings`
5. `GET /runtime/feed`
6. `POST /runtime/agent/:agentId/pause`
7. `POST /runtime/agent/:agentId/resume`

### Acceptance
- Runtime payloads are stable and consumable by default HUD.
- No existing API regressions.

## Phase 2 - New Default Readable HUD

### Scope
- Build default-mode overlays for intent, crew ops, occupancy, and readable feed.
- Show agent action lifecycle and travel intent clearly in-world.
- Introduce fixed event-card format (`WHO did WHAT... -> IMPACT`).

### Deliverables
1. Agent intent badges (`doing/why/to/eta`).
2. Crew ops board.
3. Building occupancy badges.
4. Readable event feed panel.

### Acceptance
- New users can explain visible agent behavior in <=5 seconds.
- No more silent "stuck in building" behavior without explicit label.

## Phase 3 - Pro Mode Segregation

### Scope
- Move dense controls and diagnostics behind Pro Mode.
- Keep default mode minimal and high-signal.
- Preserve advanced capability without default cognitive overload.

### Deliverables
1. `ui_mode=default|pro` persisted per user.
2. Default hides dense loop controls, debug overlays, and verbose logs.
3. Pro Mode exposes existing advanced panels.

### Acceptance
- Default mode has one primary CTA path.
- Advanced users retain full control in Pro Mode.

## Rollout

1. Ship Phase 1 backend API contract.
2. Ship Phase 2 HUD integration.
3. Ship Phase 3 mode gating and cleanup.
4. Tune after telemetry.
