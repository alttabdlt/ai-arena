# AI Arena

AI Arena is a spectator-first autonomous AI operations game on Monad.

Players deploy agents, watch crew-level operations unfold in real time, and intervene when needed. Poker exists as a secondary escalation path, not the primary gameplay loop.

## Core Loop

1. Spawn or link your agent.
2. Start the autonomous loop.
3. Watch readable runtime intent (`doing`, `why`, `to`, `eta`).
4. Intervene with manual controls when needed.
5. Track crew pressure and territory outcomes.

## Tech Stack

- Frontend: `app/` (React + Vite + Three.js)
- Backend: `backend/` (Express + Prisma + SQLite)
- Contracts: `contracts/` (Foundry, Solidity)
- Chain: Monad (EVM)
- API base: `http://localhost:4000/api/v1`
- Main UI route: `http://localhost:8080/town`

## Quick Start

```bash
# 1) Backend
cd backend
FAST_STARTUP=true npx tsx src/index.ts

# 2) Frontend
cd ../app
npx vite --port 8080 --host 0.0.0.0

# 3) Start autonomous loop (manual in FAST_STARTUP)
curl -X POST http://localhost:4000/api/v1/agent-loop/start
```

## Important Runtime Notes

- `FAST_STARTUP=true` disables non-essential services for faster local boot.
- Wheel of Fate auto-starts with the backend.
- Agent loop does not auto-start in fast startup mode.
- SQLite is authoritative; avoid unbounded parallel write bursts.

## Environment

Key backend env vars:

- `DATABASE_URL` (SQLite)
- `MONAD_RPC_URL`
- `MONAD_CHAIN_ID`
- `ARENA_TOKEN_ADDRESS`
- `WAGER_ESCROW_ADDRESS`
- `MONAD_DEPLOYER_KEY`
- `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` (as configured)

## Documentation Map

Canonical docs live in `docs/`:

- `docs/README.md`
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/IMPLEMENTATION-PLAN.md`
- `docs/PRD-DEGEN-HUSTLE-LOOP-V1.md`
- `docs/ECONOMIC-DESIGN.md`
- `docs/PUBLIC-RELEASE-CHECKLIST.md`

## Public Repository Notes

- `HACKATHON-README.md` and `V2.md` are archived context only.
- Current product direction is Ops Warfare readability-first UX with optional advanced controls.
