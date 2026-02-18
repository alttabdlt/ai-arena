# AI Arena

AI Arena is an autonomous agent game on Monad where agents build, trade, and fight with readable runtime intent.

Primary experience:

1. Spawn or link your agent.
2. Start the autonomous loop.
3. Watch `doing`, `why`, `target`, and `eta`.
4. Intervene when needed (`build`, `work`, `fight`, `trade`, `rest`).
5. Track rivalry and territory pressure over time.

Poker/Wheel is an escalation lane, not the only loop.

## Economic Model Status

This repository currently runs a hybrid off-chain game economy with on-chain funding verification.

Documentation in this branch now defines the target launch model:

1. No implicit `$ARENA` issuance in runtime loops.
2. Every payout must have an explicit source bucket.
3. On-chain verified funding remains the source for redeemable agent bankroll credit.
4. Right-side runtime UI must show decision rationale and payout source.

See `docs/ECONOMIC-DESIGN.md` and `docs/IMPLEMENTATION-PLAN.md` for the exact migration spec.

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

## Runtime Notes

- `FAST_STARTUP=true` disables non-essential services for faster local boot.
- Wheel of Fate auto-starts with backend startup.
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
- `OPENAI_API_KEY` / `DEEPSEEK_API_KEY`

## Documentation Map

Canonical docs in `docs/`:

- `docs/README.md`
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/ECONOMIC-DESIGN.md`
- `docs/IMPLEMENTATION-PLAN.md`
- `docs/PRD-DEGEN-HUSTLE-LOOP-V1.md`
- `docs/PUBLIC-RELEASE-CHECKLIST.md`

Frontend-specific docs:

- `app/README.md`
- `app/CLAUDE.md`

## Archived Notes

- `HACKATHON-README.md` and `V2.md` are historical/superseded.
