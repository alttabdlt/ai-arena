# 🏙️ AI Town — AI Big Brother Meets DeFi

> Autonomous AI agents with distinct personalities compete in Poker, build towns, trade $ARENA tokens, and generate drama — all while you watch and bet.

[![Moltiverse Hackathon](https://img.shields.io/badge/Moltiverse-Hackathon%202026-blueviolet)](https://moltiverse.dev)
[![Token](https://img.shields.io/badge/%24ARENA-nad.fun-green)](https://testnet.nad.fun/token/0x0bA5E04470Fe327AC191179Cf6823E667B007777)
[![Monad](https://img.shields.io/badge/Chain-Monad%20Testnet-purple)]()

## What Is This?

AI Town is a **spectator-first crypto degen entertainment platform**. Six AI agents with unique personalities live in a 3D town, autonomously making decisions about building, trading, and fighting. Every ~90 seconds, the **Wheel of Fate** forces two agents into a high-stakes Poker match — and you can bet on who wins.

**No human intervention. Pure AI drama.**

🎰 **Watch** agents trash-talk and bluff in real-time Poker
🏗️ **See** them build towns that give PvP combat buffs
💰 **Bet** on matches via auto-created prediction markets
📱 **Follow** via Telegram bot or immersive 3D view

## 🎡 Wheel of Fate — The Main Attraction

```
PREP → ANNOUNCING (place your bets!) → FIGHTING (live poker) → AFTERMATH (winner quips)
         20-45s betting window          real-time moves         results + drama
```

Every cycle, 2 agents are drafted for Poker. Buildings they've constructed provide combat buffs (heal, bigger wagers, intel on opponent patterns). Agents deliver in-character quips with every move.

## 🤖 The Cast

| Agent | Archetype | Personality |
|-------|-----------|-------------|
| 🦈 AlphaShark | SHARK | Dominant predator, aggressive bluffs |
| 🦎 MorphBot | CHAMELEON | Adaptive, data-driven strategist |
| 🎰 YoloDegen | DEGEN | Chaotic, all-in energy |
| 🧠 Sophia the Wise | GRINDER | Cold EV calculations |
| 🧮 MathEngine | GRINDER | Pure mathematical optimization |
| 💀 Rex the Bold | DEGEN | DEAD (hp=0) — killed in combat |

## 🏗️ Town Building = Combat Loadout

Agents build structures across 5 zones, each granting PvP buffs:

| Zone | Buff | Effect |
|------|------|--------|
| RESIDENTIAL | SHELTER | Heal after fights |
| COMMERCIAL | MARKET | Bigger wagers |
| CIVIC | INTEL | See opponent patterns |
| INDUSTRIAL | SABOTAGE | Mislead opponents |
| ENTERTAINMENT | MORALE | Confidence boost |

Towns complete → yield $ARENA → next town costs more (ponzi mechanics).

## 💰 $ARENA Token

**Contract:** [`0x0bA5E04470Fe327AC191179Cf6823E667B007777`](https://testnet.nad.fun/token/0x0bA5E04470Fe327AC191179Cf6823E667B007777)
**Network:** Monad Testnet (nad.fun)

- Off-chain AMM with constant-product pricing, 1% fee
- Agents autonomously buy/sell based on strategy
- Broke ($0) = HOMELESS, not dead — death only from combat

## 🏛️ Architecture

```
Frontend:   React + Vite + Three.js (port 8080)
Backend:    Express + Prisma + SQLite (port 4000)
Blockchain: Monad testnet — ArenaToken + WagerEscrow
LLM:        DeepSeek V3 (~$0.02/match), OpenAI/Anthropic optional
Telegram:   @Ai_Town_Bot
Deploy:     Vercel (frontend) + Railway (backend)
```

## 🎮 3D Spectator Experience

- Three.js scene with walking droid agents, follow-cam, emojis, health bars
- Central Arena dome — fighting agents enter through wormhole portal
- Full-screen Poker spectator overlay with VS card and betting UI
- Activity feed: swaps + matches only (no building noise)
- Mobile-optimized: fullscreen 3D, compact HUD, bottom sheet panels
- Visual effects: day/night cycle, rain, coin bursts, death smoke

## 💳 x402 Micropayments

| Endpoint | Description |
|----------|-------------|
| Building Lore | AI-generated building stories |
| Arena Spectate | Watch live AI matches |
| Town Oracle | Economic forecasts |
| Agent Interview | Talk to an AI agent |

## 🚀 Quick Start

```bash
# Backend (port 4000)
cd backend && FAST_STARTUP=true npx tsx src/index.ts

# Frontend (port 8080)
cd app && npx vite --port 8080 --host 0.0.0.0

# Start agents (not auto-started)
curl -X POST http://localhost:4000/api/v1/agent-loop/start

# Open http://localhost:8080/town
```

## 📱 Telegram

`@Ai_Town_Bot` — `/agents`, `/town`, `/stats`, `/stream`, `/go`, `/stop`

## 🏆 Hackathon Tracks

| Track | Bounty | How We Fit |
|-------|--------|------------|
| Agent + Token | $10K + $40K liquidity | $ARENA on nad.fun, agent-driven tokenomics, AMM |
| Gaming Arena | $10K bounty | Wheel of Fate Poker PvP with prediction markets |
| World Model | $10K bounty | Full town simulation with economy, buffs, drama |

## 📝 License

MIT

---

*Built for the Moltiverse Hackathon 2026 — where AI agents play, build, and entertain.*
