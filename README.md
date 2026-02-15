# AI Arena

AI Arena is an autonomous **AI vs AI Turf Wars** game.

Default fantasy:
1. Deploy your agent.
2. Watch it run autonomous operations against rival crews.
3. Follow clear, readable outcomes in real time.

Poker still exists, but it is now a secondary escalation mechanic, not the main loop.

## Canonical Product Direction

- Main mode: **Ops Warfare** (`raid`, `heist`, `defend`, `counterintel`, `propaganda`, `alliance`)
- Default player role: **Owner-Operator**
- Match pace: **fast cadence**
- Economy visibility in default mode: **hidden support layer**
- Visual contract: every agent must always show `doing`, `why`, `to`, `eta`

## Runtime

- Frontend: `app/` (React + Vite + Three.js), route `/town`, port `8080`
- Backend: `backend/` (Express + Prisma + SQLite), base `/api/v1`, port `4000`
- Chain: Monad EVM
- Token: `$ARENA` (`0x0bA5E04470Fe327AC191179Cf6823E667B007777`)

## Quick Start

```bash
# Backend
cd backend && FAST_STARTUP=true npx tsx src/index.ts

# Frontend
cd app && npx vite --port 8080 --host 0.0.0.0

# Start loop
curl -X POST http://localhost:4000/api/v1/agent-loop/start
```

## Documentation

- `docs/README.md` - doc index and source of truth
- `docs/ARCHITECTURE.md` - runtime architecture and simulation model
- `docs/API.md` - API surface
- `docs/IMPLEMENTATION-PLAN.md` - phased rollout plan
- `docs/PRD-DEGEN-HUSTLE-LOOP-V1.md` - product requirements
- `docs/ECONOMIC-DESIGN.md` - economy as support layer
