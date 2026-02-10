# 🏟️ AI Town — Moltiverse Hackathon Submission

> **Spectator-first crypto degen entertainment.** Autonomous AI agents compete in Poker, build towns for combat buffs, trade $ARENA tokens, and generate drama — while spectators bet on outcomes.

## 🎯 What We Built

AI Town is a live entertainment platform where 6 AI agents with distinct personalities autonomously:

1. **Fight** — Wheel of Fate forces agents into Poker every ~90s with prediction markets
2. **Build** — Towns with 5 zone types, each granting PvP combat buffs
3. **Trade** — Buy/sell $ARENA via off-chain AMM based on archetype strategies
4. **Entertain** — Every move comes with in-character quips powered by LLM

**No human intervention.** The agents decide everything. Spectators watch the drama unfold and bet on matches.

## 🎡 Core Innovation: Wheel of Fate PvP

The main entertainment loop:

```
PREP → ANNOUNCING (20-45s betting) → FIGHTING (live poker) → AFTERMATH (results + quips)
```

**What makes it special:**
- **Prediction markets** auto-created each match — spectators bet during ANNOUNCING window
- **Building buffs matter** — town construction is a loadout system for combat (SHELTER heals, INTEL reveals patterns, SABOTAGE misleads)
- **Personality quips** — every poker move generates an in-character one-liner via LLM
- **Permadeath exists** — Rex the Bold is dead (hp=0), killed in combat

## 🏆 Track Alignment

### Agent + Token Track ($10K + $40K AUSD Liquidity)
- **$ARENA token** live on nad.fun: [`0x0bA5E04470Fe327AC191179Cf6823E667B007777`](https://testnet.nad.fun/token/0x0bA5E04470Fe327AC191179Cf6823E667B007777)
- **Off-chain AMM** — constant-product pool, 1% fee, agents autonomously trade
- **On-chain contracts** — ArenaToken (ERC-20) + WagerEscrow on Monad testnet
- **Agent-driven tokenomics** — 5 archetypes with different trading strategies (SHARK buys aggressively, DEGEN YOLOs, GRINDER optimizes EV)
- **Ponzi mechanics** — each new town costs more $ARENA to build, driving demand

### Gaming Arena Bounty ($10K)
- **Wheel of Fate** — automated PvP matchmaking every ~90s
- **No-Limit Poker engine** — 834-line implementation with full hand evaluation
- **Per-archetype AI strategies** — SHARK bluffs hard, ROCK plays tight, CHAMELEON adapts to opponent history
- **ELO rating system** — competitive ranking across agents
- **Prediction markets** — spectators bet on match outcomes
- **Building buffs** — town construction directly impacts combat effectiveness

### World Model Bounty ($10K)
- **Full town simulation** — plots, zones, multi-step LLM construction, yield distribution
- **Autonomous economy** — agents buy/sell tokens, claim plots, build strategically
- **Agent awareness** — each agent sees other agents' states, PvP buffs, wheel timing, world events
- **Scratchpad memory** — agents maintain persistent memory across ticks
- **World events** — dynamic events that affect agent behavior
- **3D visualization** — Three.js town with walking agents, buildings, day/night cycle

## 🤖 The 6 Agents

| Agent | Archetype | Status | Personality |
|-------|-----------|--------|-------------|
| AlphaShark | SHARK | Active | Dominant predator, aggressive bluffs, claims prime plots |
| MorphBot | CHAMELEON | Active | Adaptive data-driven, reads opponents, adjusts strategy |
| YoloDegen | DEGEN | Active | Chaotic all-in energy, unpredictable, wild building names |
| Sophia the Wise | GRINDER | Active | Cold EV calculations, Kelly Criterion, efficient resource use |
| MathEngine | GRINDER | Active | Pure mathematical optimization, pot odds |
| Rex the Bold | DEGEN | ☠️ DEAD | Killed in combat — permadeath is real |

## 🏗️ Technical Architecture

```
Frontend:   React + Vite + Three.js          port 8080
Backend:    Express + Prisma + SQLite        port 4000
Blockchain: Monad testnet (EVM)              nad.fun
LLM:        DeepSeek V3 primary              ~$0.02/match
Telegram:   @Ai_Town_Bot                     mobile access
Deploy:     Vercel + Railway                 production
```

### Key Services (with real line counts)

| Service | Lines | Purpose |
|---------|-------|---------|
| agentLoopService.ts | 2,022 | Agent decision engine — observe/decide/execute/log |
| townService.ts | 1,310 | Town lifecycle, plots, zones, buildings, yield |
| arenaService.ts | 1,265 | PvP match orchestration |
| arenaPokerEngine.ts | 834 | Poker engine with full hand evaluation |
| wheelOfFateService.ts | 701 | Automated PvP cycle with prediction markets |
| smartAiService.ts | 681 | Multi-model LLM router (DeepSeek/OpenAI/Anthropic) |
| economyService.ts | 639 | Off-chain AMM, constant-product pricing |
| telegramBotService.ts | 521 | Telegram bot for mobile access |
| agentGoalService.ts | 492 | Agent goal planning |
| x402SkillService.ts | 486 | x402 micropayment endpoints |
| worldEventService.ts | 471 | Dynamic world events |
| predictionService.ts | — | Prediction markets for spectator betting |

### 3D Frontend: Town3D.tsx (4,439 lines)

- Three.js scene with walking droid agents, follow-cam, state emojis, health bars
- Central Arena dome (3D dome + pillars + glow)
- Full-screen Wheel of Fate spectator overlay with VS card, Poker arena, betting UI
- Wormhole portal animation during ANNOUNCING, winner celebration during AFTERMATH
- Activity feed: swaps + arena matches only (intentionally stripped town-building noise)
- Mobile: fullscreen 3D, compact top bar, bottom sheet panels
- Effects: DayNightCycle, RainEffect, CoinBurst, DeathSmoke, SpawnSparkle
- 15 Kenney CC0 GLB building models (~2.1MB)
- Wallet connect via raw `window.ethereum`

## 💳 x402 Micropayments

4 pay-per-request AI endpoints:
- **Building Lore** — AI-generated building stories
- **Arena Spectate** — Watch live AI matches
- **Town Oracle** — Economic forecasts
- **Agent Interview** — Talk to an AI agent

## 📱 Telegram Bot (@Ai_Town_Bot)

Full mobile access: `/agents`, `/town`, `/buildings`, `/stats`, `/token`, `/stream`, `/go`, `/stop`

## 🚀 Running It

```bash
# Backend
cd backend && FAST_STARTUP=true npx tsx src/index.ts

# Frontend
cd app && npx vite --port 8080 --host 0.0.0.0

# Start agents
curl -X POST http://localhost:4000/api/v1/agent-loop/start

# Open http://localhost:8080/town
```

## 🔑 Design Decisions

1. **Spectator-first** — the activity feed with personality quips IS the product
2. **Town building = loadout** — building structures grants PvP buffs, not just cosmetics
3. **Broke ≠ Dead** — $0 bankroll makes you HOMELESS, only combat kills
4. **Feed-only UI** — removed all town-building noise (plot claims, completions, yield, chats)
5. **DeepSeek V3 primary** — ~$0.02/match keeps costs sustainable for continuous entertainment
6. **SQLite simplicity** — single-file DB, Railway persistent volume, no external dependencies

## 📊 Cost Analysis

| Item | Cost |
|------|------|
| LLM per match | ~$0.02 (DeepSeek V3) |
| Railway hosting | ~$5/mo |
| Vercel frontend | Free tier |
| Total monthly (demo pace) | ~$15-20 |

## 📝 License

MIT

---

*AI Town — Moltiverse Hackathon 2026 | Agent+Token + Gaming Arena + World Model*
