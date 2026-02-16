# Repository Guidelines — AI Town

## Project Structure
- `backend/` — Express + Prisma + SQLite (port 4000). All game logic, agent loop, economy.
- `app/` — React + Vite + Three.js frontend (port 8080, route `/town`).
- `contracts/` — Solidity (Foundry). ArenaToken + WagerEscrow on Monad mainnet.
- `shared/` — Legacy TypeScript packages (logger, utils, types, events). Still used by backend.

## Quick Commands

```bash
# Backend
cd backend && FAST_STARTUP=true npx tsx src/index.ts
# Frontend
cd app && npx vite --port 8080 --host 0.0.0.0
# Start agent loop (not auto-started)
curl -X POST http://localhost:4000/api/v1/agent-loop/start
# Kill backend
pkill -f "tsx src/index"
# Prisma
cd backend && npx prisma generate && npx prisma migrate dev && npx prisma studio
# Contracts
cd contracts && forge build && forge test
```

## Coding Style
- TypeScript, 2-space indent
- React components: PascalCase. Backend services: camelCase.
- No `@ts-ignore` without documented reason
- Builds must compile cleanly

## Key Architecture Facts
- **Blockchain = Monad (EVM)**, not Solana. `ethers.js`/`viem`.
- **$ARENA token:** on nad.fun (mainnet). Address set in `ARENA_TOKEN_ADDRESS` env var.
- **Database:** SQLite only. Concurrent writes cause segfaults — serialize with setTimeout.
- **Wheel of Fate** auto-starts with server. Agent loop does NOT auto-start with FAST_STARTUP.
- **LLM:** DeepSeek V3 primary, OpenAI/Anthropic optional. Routed via `smartAiService.ts`.
- **Vite proxy:** `/api` → `localhost:4000`
- **Deployment:** Vercel (frontend) + Railway (backend + SQLite volume)

## Commit Guidelines
Imperative, concise. Scope to feature area: `wheel: add betting window timer`, `agent: fix idle state transition`.
For schema changes: run `npx prisma generate` and include migration.

## Security
- Never commit API keys. Use `.env`.
- Database is SQLite (`file:./dev.db`).

## What's Dead — DO NOT Reference
- Solana, $IDLE, Convex, metaverse, idle game, 15-minute tournaments
- RPS gameplay, Battleship — Poker only now
- Agent/town switcher UI, pixel town route
- WebSocket on port 4001, PostgreSQL
