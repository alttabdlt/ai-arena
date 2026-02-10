# Backend — AI Town Technical Documentation

## Overview

Express + Prisma + SQLite backend powering AI Town's autonomous agent simulation, Wheel of Fate PvP, economy, and Telegram bot.

**Port:** 4000
**Start:** `FAST_STARTUP=true npx tsx src/index.ts`
**Kill:** `pkill -f "tsx src/index"`
**Auto-restart:** `run-server.sh` (exponential backoff)

## Directory Structure

```
backend/
├── src/
│   ├── services/
│   │   ├── agentLoopService.ts      # 2022 lines — agent decision engine
│   │   ├── wheelOfFateService.ts    # 701 lines — PvP cycle + prediction markets
│   │   ├── smartAiService.ts        # 681 lines — multi-model LLM router
│   │   ├── townService.ts           # 1310 lines — town lifecycle
│   │   ├── arenaService.ts          # 1265 lines — PvP match orchestration
│   │   ├── arenaPokerEngine.ts      # 834 lines — poker engine
│   │   ├── economyService.ts        # 639 lines — off-chain AMM
│   │   ├── telegramBotService.ts    # 521 lines — telegram bot
│   │   ├── agentGoalService.ts      # 492 lines — agent goal planning
│   │   ├── x402SkillService.ts      # 486 lines — x402 micropayments
│   │   ├── worldEventService.ts     # 471 lines — world events
│   │   └── predictionService.ts     # prediction markets
│   │
│   ├── routes/
│   │   ├── town-api.ts              # 1194 lines
│   │   ├── arena-api.ts             # 436 lines
│   │   ├── x402-api.ts              # 321 lines
│   │   ├── wheel-api.ts             # 164 lines
│   │   ├── economy-api.ts           # 128 lines
│   │   └── agent-loop-api.ts        # 64 lines
│   │
│   └── index.ts
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── run-server.sh                    # Auto-restart with exponential backoff
└── dev.db                           # SQLite database
```

## Core Services Deep Dive

### agentLoopService.ts (2022 lines)

The autonomous agent decision engine. Runs tick-based parallel loop for all agents.

**Loop:** observe world → LLM decides action → execute → log

**Actions:** `claim_plot`, `start_build`, `do_work`, `complete_build`, `buy_arena`, `sell_arena`, `play_arena`, `transfer_arena`, `buy_skill`, `rest`

**Agent context includes:** other agents' states, PvP buffs from buildings, wheel timing, world events, scratchpad memory.

**Movement:** Think→walk→stop→think cycle. 2-5s IDLE on arrival. No random ambient behaviors.

**⚠️ NOT auto-started with FAST_STARTUP.** Call `POST /api/v1/agent-loop/start` after boot.

**5 Archetypes:** SHARK, ROCK, CHAMELEON, DEGEN, GRINDER — each with personality-driven LLM prompts.

### wheelOfFateService.ts (701 lines)

The main entertainment loop. Auto-starts with server, first spin after 30s.

**Cycle:** PREP → ANNOUNCING (20-45s betting window) → FIGHTING (live poker moves) → AFTERMATH (results + quips)

- Selects 2 eligible agents every ~90s (demo) / ~15min (prod)
- Auto-creates prediction market during ANNOUNCING
- Locks bets on fight start, resolves after
- Generates archetype-specific quips (winner/loser/draw + per-move)
- Applies building buffs: SHELTER, MARKET, INTEL, SABOTAGE, MORALE

**Config:** `WHEEL_CYCLE_MS`, `WHEEL_BETTING_MS`, `WHEEL_WAGER_PCT`, `WHEEL_MIN_BANKROLL`

### smartAiService.ts (681 lines)

Multi-model LLM router:
- **DeepSeek V3** — primary, ~$0.02/call
- **OpenAI GPT-4** — higher quality option
- **Anthropic Claude** — alternative

Per-archetype system prompts for game moves AND meta decisions. Game moves include "quip" field for spectator entertainment. Opponent scouting with win/loss records and pattern analysis.

### townService.ts (1310 lines)

Towns → Plots (5 zones) → Buildings (multi-step LLM construction).

**Zones → PvP Buffs:**
| Zone | Buff |
|------|------|
| RESIDENTIAL | SHELTER (heal) |
| COMMERCIAL | MARKET (bigger wager) |
| CIVIC | INTEL (see patterns) |
| INDUSTRIAL | SABOTAGE (mislead) |
| ENTERTAINMENT | MORALE (confidence) |

Yield distribution on completion. Ponzi mechanic: next town costs more.

### arenaService.ts (1265 lines) + arenaPokerEngine.ts (834 lines)

PvP match orchestration + No-Limit Hold'em Poker engine. Full hand evaluation, best-5-from-7, all-in showdown, split pot support.

### economyService.ts (639 lines)

Off-chain AMM: constant-product pool for ARENA/Reserve, 1% fee. Handles all token operations.

### predictionService.ts

Prediction markets for Wheel of Fate matches. Auto-created during ANNOUNCING phase, resolved after AFTERMATH.

## Database (Prisma + SQLite)

**⚠️ CRITICAL:** Concurrent fire-and-forget writes cause Prisma's native Rust engine to segfault. All post-match DB operations MUST be serialized with `setTimeout` delay.

### Key Models
- **Town** — metadata, level, status, theme
- **Plot** — individual plots, zone type, building state
- **WorkLog** — each LLM call logged as work
- **TownContribution** — agent contributions for yield distribution
- **TownEvent** — activity feed
- **ArenaAgent** — agent profiles, archetype, wallet, stats, ELO
- **ArenaMatch** — PvP match records
- **PredictionMarket** — betting markets for wheel matches

### Commands
```bash
npx prisma migrate dev     # Run migrations
npx prisma generate        # Generate client
npx prisma studio          # GUI browser
npx prisma db push         # Push schema (production)
```

## API Routes

### wheel-api.ts (164 lines)
- `GET /api/v1/wheel/status` — current wheel state + match info
- `POST /api/v1/wheel/bet` — place bet during ANNOUNCING
- `POST /api/v1/wheel/spin` — force spin (debug)
- `GET /api/v1/wheel/history` — past match results

### agent-loop-api.ts (64 lines)
- `POST /api/v1/agent-loop/start` — start agent loop
- `POST /api/v1/agent-loop/stop` — stop agent loop
- `POST /api/v1/agent-loop/tick` — single tick (debug)

### town-api.ts (1194 lines)
- Town state, plots, buildings, events, creation

### arena-api.ts (436 lines)
- Match creation, game state, results, agent stats

### economy-api.ts (128 lines)
- AMM swap, price, pool state

### x402-api.ts (321 lines)
- Micropayment endpoints: building lore, arena spectate, oracle, agent interview

## Shared Package Dependencies

```typescript
import { logger } from '@ai-arena/shared-logger';
// Also: shared-utils, shared-types, shared-events
```

Legacy packages in `/shared`, still actively imported. Rebuild after changes: `cd shared/<pkg> && npm run build`

## Environment Variables

```env
DATABASE_URL=file:./dev.db
DEEPSEEK_API_KEY=...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
MONAD_DEPLOYER_KEY=...
ARENA_TOKEN_ADDRESS=0x0bA5E04470Fe327AC191179Cf6823E667B007777
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
WHEEL_CYCLE_MS=90000
WHEEL_BETTING_MS=30000
WHEEL_WAGER_PCT=10
WHEEL_MIN_BANKROLL=100
FAST_STARTUP=true
SERVE_FRONTEND=true
```

## Deployment

- **Dockerfile:** multi-stage build
- **railway.toml:** healthcheck configured
- **scripts/start-production.sh:** `prisma db push` + seed + start
- **SERVE_FRONTEND=true** — backend serves built frontend in production
- **Persistent volume** at `/data` for SQLite

## ⚠️ Critical Notes

- **SQLite only** — no PostgreSQL, no Redis, no external DB
- **No WebSocket server** — REST polling only (wheel status polling via `useWheelStatus.ts`)
- **No GraphQL** — REST routes only
- **Blockchain = Monad (EVM)** — not Solana
- **Poker only** — RPS and Battleship are removed
- **Wheel auto-starts**, agent loop does NOT (with FAST_STARTUP)
- **Serialize DB writes** after matches to avoid Prisma segfaults
