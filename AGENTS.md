# Repository Guidelines — AI Arena / AI Town

## Project Structure
- `backend/` — Express + Prisma backend (TypeScript). Arena + Town systems + agent loop.
- `app/` — React + Vite frontend (TypeScript). Primary UI (Three.js town view).
- `contracts/` — Solidity smart contracts (Foundry). ERC-20 $ARENA token + WagerEscrow on Monad testnet.
- `shared/` — Legacy TypeScript packages (`logger/`, `utils/`, `types/`, `events/`). Still used by backend.

## Build & Development Commands

### Backend (port 4000)
```bash
cd backend && npm run dev
```
Prisma: `npx prisma generate`, `npx prisma migrate dev`, `npx prisma studio`

### Frontend (port 8080)
```bash
cd app && npm run dev
```
Key routes:
- `/town` — AI Town 3D view (primary UI). All other routes redirect here.

### Contracts
```bash
cd contracts && forge build    # Build
cd contracts && forge test     # Test
```

### Shared Packages
```bash
cd shared/<pkg> && npm run build   # Rebuild after changes
```

## Coding Style
- TypeScript, 2-space indentation.
- React components: `PascalCase`. Backend services: `camelCase`.
- No `@ts-ignore` without documented reason. Builds must compile cleanly.

## Key Architecture Notes
- **Blockchain is Monad (EVM)**, not Solana. Use `ethers.js`/`viem` where relevant.
- **$ARENA token** on nad.fun: `0x0bA5E04470Fe327AC191179Cf6823E667B007777`
- **Agent loop** in `agentLoopService.ts`: observe → LLM decides → execute → log
- **Town system** in `townService.ts`: plots, buildings, zones, yield, completion
- **LLM routing** via `smartAiService.ts`: OpenAI, Anthropic, DeepSeek
- **Telegram bot** starts automatically with backend when `TELEGRAM_BOT_TOKEN` is set

## Commit Guidelines
- Imperative, concise commits. Scope to feature area (e.g., "town: add yield distribution", "agent: fix decision loop timeout").
- For schema changes, run `npx prisma generate` and include migration.

## Security
- Never commit API keys. Use `.env` files.
- Database is SQLite (`file:./dev.db`), no external DB dependency.

## What's Dead (DO NOT reference)
- ~~Solana~~, ~~$IDLE token~~, ~~metaverse~~, ~~idle game~~, ~~15-minute tournaments~~
- ~~Convex~~
