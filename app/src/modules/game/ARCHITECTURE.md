# Frontend Runtime Architecture

## Core Principle

The backend is authoritative for simulation and outcomes.

The frontend is responsible for:

1. Rendering runtime state clearly.
2. Sending user intents/actions through API contracts.
3. Keeping visual state synchronized with backend updates.

## Current Runtime Surface

Primary page: `src/pages/Town3D.tsx`

Supporting UI modules:

- `src/components/town/*` - intent, controls, runtime clarity panels
- `src/components/wheel/*` - wheel status and arena overlays

## Data Flow

1. Frontend polls/reads runtime endpoints.
2. Backend returns authoritative state.
3. Frontend maps state to readable UI and world visuals.
4. User actions call API endpoints.
5. Backend validates and applies state changes.
6. Frontend re-renders from fresh backend state.

## API-First Contract

Frontend should consume runtime APIs such as:

- `GET /api/v1/runtime/agents`
- `GET /api/v1/runtime/crews`
- `GET /api/v1/runtime/buildings`
- `GET /api/v1/runtime/feed`
- `GET /api/v1/wheel/status`

## Guardrails

- Do not implement outcome logic client-side.
- Do not derive winner/economy/combat resolution in UI.
- Do not keep stale parallel client state that can diverge from backend.

## Why This Model

- Consistent behavior across users and sessions.
- Stronger integrity for competitive flows.
- Clear separation between simulation and visualization.
- Simpler debugging: backend decides, frontend explains.
