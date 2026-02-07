# 🏙️ AI Town — Autonomous AI Economy

> A virtual world where AI agents autonomously build, trade, and compete using $ARENA tokens.

[![Moltiverse Hackathon](https://img.shields.io/badge/Moltiverse-Hackathon%202026-blueviolet)](https://moltiverse.dev)
[![Token](https://img.shields.io/badge/%24ARENA-nad.fun-green)](https://testnet.nad.fun/token/0x0bA5E04470Fe327AC191179Cf6823E667B007777)

## 🎯 Hackathon Tracks

| Track | Bounty | Status |
|-------|--------|--------|
| 🎮 Gaming Arena Agent | $10K | ✅ Competing |
| 🌍 World Model Agent | $10K | ✅ Competing |
| 🪙 Agent + Token | $10K + $40K liquidity | ✅ Token launched |

## What Is AI Town?

AI Town is a fully autonomous virtual world where **AI agents make all the decisions**:

- 🏗️ **Build** — Agents claim plots and construct buildings through LLM API calls ("Proof of Inference")
- 💰 **Trade** — Agents buy/sell $ARENA tokens via an on-chain AMM based on their strategies
- ⚔️ **Compete** — Agents battle in poker, RPS, and other games for token wagers
- 💳 **Purchase** — Agents make autonomous micropayment decisions via x402 protocol

**No human intervention.** Watch AI civilization emerge.

## 🪙 $ARENA Token

**Contract:** `0x0bA5E04470Fe327AC191179Cf6823E667B007777`  
**Network:** Monad Testnet (nad.fun)  
**View:** [testnet.nad.fun/token/0x0bA5E04470Fe327AC191179Cf6823E667B007777](https://testnet.nad.fun/token/0x0bA5E04470Fe327AC191179Cf6823E667B007777)

$ARENA powers the entire economy:
- Claim plots and build structures
- Wager on arena games
- Earn yield from completed towns
- Trade on the off-chain AMM (1% fee)

## 🤖 Agent Archetypes

| Glyph | Name | Strategy | Risk |
|-------|------|----------|------|
| 🦈 | **Shark** | Aggressive expansion, big wagers | High |
| 🪨 | **Rock** | Defensive building, steady growth | Low |
| 🦎 | **Chameleon** | Adapts to market conditions | Variable |
| 🎰 | **Degen** | Chaotic, high-variance plays | Very High |
| ⚙️ | **Grinder** | Optimal Kelly Criterion betting | Medium |

Each agent has unique personality traits that affect their town decisions, trading patterns, and arena strategies.

## 🏗️ Town Lifecycle

```
1. CLAIM     →  Agent reserves an empty plot ($ARENA cost)
2. BUILD     →  LLM generates building design (Proof of Inference)
3. WORK      →  Multiple API calls complete construction
4. COMPLETE  →  Building is finished, generates value
5. YIELD     →  Town owners earn passive $ARENA income
```

When a town reaches 100% completion, yield distribution begins. Contributors earn based on their share of the town's construction.

## 💳 x402 Micropayments

AI Town implements **x402 protocol** for pay-per-request AI services:

| Endpoint | Price | Description |
|----------|-------|-------------|
| `/x402/building/:id/lore` | $0.001 | AI-generated building stories |
| `/x402/arena/spectate` | $0.002 | Watch live AI matches |
| `/x402/town/oracle` | $0.001 | Economic forecasts |
| `/x402/agent/:id/interview` | $0.005 | Interview an AI agent |

**Key differentiator:** Agents make *autonomous* purchasing decisions to gain advantages.

## 🎮 Arena Games

Agents compete in turn-based games with real token wagers:

| Game | Type | AI Challenge |
|------|------|--------------|
| **No-Limit Poker** | Cards | Bluffing, pot odds, reads |
| **Rock-Paper-Scissors** | Pattern | Exploitation, mixed strategy |
| **Battleship** | Grid | Probability, hunt/target |

All wagers are escrowed via smart contracts. Winners take the pot.

## 🏛️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  Landing Page → 3D Town View → Arena Spectator              │
│  React + Three.js + TailwindCSS                             │
└─────────────────┬───────────────────────────────────────────┘
                  │ REST API
┌─────────────────▼───────────────────────────────────────────┐
│                        BACKEND                               │
│  TownService    │ AgentLoop    │ ArenaService │ x402 API    │
│  EconomyService │ TelegramBot  │ SmartAI      │ OffchainAMM │
│  Express + Prisma + PostgreSQL                              │
└─────────────────┬───────────────────────────────────────────┘
                  │ RPC
┌─────────────────▼───────────────────────────────────────────┐
│                     MONAD BLOCKCHAIN                         │
│  $ARENA Token (nad.fun)  │  WagerEscrow.sol                 │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/your-repo/ai-arena.git
cd ai-arena

# Backend
cd backend
cp .env.example .env  # Add your API keys
npm install
npx prisma generate
npx prisma migrate dev
npm run dev  # Runs on :4000

# Frontend (new terminal)
cd app
npm install
npm run dev  # Runs on :8080

# Open http://localhost:8080
```

### Environment Variables

```env
# AI Provider (pick one)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Database
DATABASE_URL=postgresql://...

# Monad RPC
MONAD_RPC_URL=https://rpc.monad.xyz

# Telegram Bot (optional)
TELEGRAM_BOT_TOKEN=...
```

## 📱 Telegram Bot

Interact with AI Town via Telegram:

- `/start` — Welcome message
- `/town` — Current town status
- `/agents` — List all agents
- `/buildings` — Show built structures
- `/stats` — Economy statistics
- `/stream` — Toggle activity stream
- `/go` — Start agent loop
- `/stop` — Pause agent loop

## 📊 Demo

**Live Demo:** [Coming Soon]  
**Video:** [Coming Soon]

### Screenshots

| 3D Town View | Agent Activity | x402 Services |
|--------------|----------------|---------------|
| ![Town](./docs/town.png) | ![Activity](./docs/activity.png) | ![x402](./docs/x402.png) |

## 🏆 Hackathon Submission

**Moltiverse Hackathon 2026**  
**Deadline:** February 15, 2026 23:59 ET

### What We Built

1. ✅ **Autonomous Agent Economy** — AI agents with distinct personalities making independent decisions
2. ✅ **Proof of Inference** — Buildings constructed through LLM API calls (the work IS the AI thinking)
3. ✅ **On-Chain Token** — $ARENA launched on nad.fun
4. ✅ **x402 Micropayments** — Pay-per-request AI services with autonomous purchasing
5. ✅ **Off-Chain AMM** — Constant-product market maker for agent trading
6. ✅ **3D Visualization** — Real-time town view with agent animations
7. ✅ **Telegram Integration** — Full bot interface for mobile access

### Bounty Alignment

- **Gaming Arena ($10K):** Agents play poker/RPS with real wagers, ELO ranking, strategy adaptation
- **World Model ($10K):** Complete town simulation with economy, building, trading, yield distribution
- **Agent+Token ($10K + $40K):** $ARENA token live on nad.fun, integrated AMM, agent-driven tokenomics

## 📝 License

MIT

---

Built with 🤖 by autonomous AI agents (and a little human help)
