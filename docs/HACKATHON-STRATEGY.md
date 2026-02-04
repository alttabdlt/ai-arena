# Moltiverse Hackathon — Strategy & Execution Plan

## Target Bounty
**Gaming Arena Agent — $10,000**
Build an agent that competes against other agents in games with real token wagers.

## Hackathon Details
| Key | Value |
|-----|-------|
| Platform | [moltiverse.dev](https://moltiverse.dev) |
| Blockchain | **Monad** (EVM-compatible) |
| Deadline | Feb 15, 2026 23:59 ET |
| Judging | Rolling — ship early, win early |
| Prize | $10K per winner (up to 16 winners) |
| Bonus | $40K liquidity boost (Agent+Token track) |

## Success Criteria (From Bounty)

### Must Have
- [x] At least one game type (we have 3: Poker, RPS, Battleship)
- [ ] Wagering system — agents bet real tokens on match outcomes
- [ ] Strategic decisions based on game state + opponent behavior + risk tolerance
- [ ] 5+ matches against different opponents
- [ ] Proper wager handling and payout mechanics
- [ ] Clear interface for match coordination and result verification

### Bonus Points (All Targeted)
- [ ] Multiple game types ← We have 3
- [ ] Adaptive strategy based on opponent patterns (learning/meta-game)
- [ ] Bluffing, negotiation, or psychological tactics
- [ ] Tournament or ranking system
- [ ] Risk management strategy for bankroll optimization

## What Judges Want
> "We want agents that are **weird, powerful, and push boundaries**. We want to see what happens when you give AI agents a high-performance blockchain as their coordination layer."

- ✨ Weird and creative — surprise us
- 🛠️ Actually works — demos > ideas
- 🚀 Pushes boundaries — what can agents do that humans can't?
- 🤝 Bonus: A2A coordination, trading, community building

## Track Decision

**Agent + Token Track** (maximizes prize potential: $10K + $40K liquidity)

Requirements:
- Deploy token on nad.fun → includes `$ARENA` token address in submission
- Agent interacts with the token (wagers in $ARENA)
- Working agent with clear demo

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                 AI Arena Platform                      │
│                                                        │
│  ┌──────────────────────────────────┐                 │
│  │       Agent Manager Service       │                 │
│  │                                    │                 │
│  │  ┌─────────┐  ┌─────────┐  ┌────┐│                 │
│  │  │ Agent 1  │  │ Agent 2  │  │ ...││                 │
│  │  │ GPT-4o   │  │ Claude   │  │    ││                 │
│  │  │ Aggress. │  │ Cautious │  │    ││                 │
│  │  │ 0xWallet │  │ 0xWallet │  │    ││                 │
│  │  └──────────┘  └──────────┘  └────┘│                 │
│  └────────────────┬───────────────────┘                 │
│                   │                                      │
│  ┌────────────────▼───────────────────┐                 │
│  │       Matchmaking Engine            │                 │
│  │  • ELO-based pairing               │                 │
│  │  • Wager negotiation                │                 │
│  │  • Game type selection (spin wheel) │                 │
│  └────────────────┬───────────────────┘                 │
│                   │                                      │
│  ┌────────────────▼───────────────────┐                 │
│  │        Game Engine Layer            │                 │
│  │  ┌────────┐ ┌─────┐ ┌───────────┐ │                 │
│  │  │ Poker  │ │ RPS │ │Battleship │ │                 │
│  │  └────────┘ └─────┘ └───────────┘ │                 │
│  └────────────────┬───────────────────┘                 │
│                   │                                      │
│  ┌────────────────▼───────────────────┐                 │
│  │      Monad Blockchain Layer         │                 │
│  │  • WagerEscrow.sol (lock/payout)   │                 │
│  │  • $ARENA ERC-20 (via nad.fun)     │                 │
│  │  • Agent wallets (EOA, server-gen) │                 │
│  └────────────────────────────────────┘                 │
│                                                          │
│  ┌────────────────────────────────────┐                 │
│  │      Spectator Frontend             │                 │
│  │  • Live match viewer                │                 │
│  │  • Agent stats & ELO               │                 │
│  │  • Match replays                    │                 │
│  │  • Wager history                    │                 │
│  └────────────────────────────────────┘                 │
└──────────────────────────────────────────────────────────┘
```

## Execution Timeline

### Phase 1: Strip & Focus (Feb 4-5)
**Goal: Clean codebase, remove dead weight**

- [ ] Remove idle game mechanics (XP generation, offline progress, personality multipliers)
- [ ] Remove Solana integration entirely (wallet adapter, web3.js, SOL monitoring)
- [ ] Remove metaverse/PixiJS/tile-map remnants
- [ ] Remove houses, furniture, robbery, equipment bloat
- [ ] Remove dual token references ($TOWN/$ARENA → single $ARENA)
- [ ] Keep: Game engines (Poker, Connect4→Battleship, RPS), AI service, game manager
- [ ] Keep: Prisma schema (stripped), WebSocket, GraphQL
- [ ] Add RPS game engine (simplest, great for demo)
- [ ] Replace Connect4 with Battleship (more strategic, better for AI showcase)

### Phase 2: Monad Integration (Feb 5-7)
**Goal: On-chain wagers working end-to-end**

- [ ] Install ethers.js/viem, configure Monad RPC
- [ ] Deploy $ARENA token via nad.fun (Agent+Token track)
- [ ] Write `WagerEscrow.sol`:
  - `createMatch(matchId, wagerAmount)` — both players deposit
  - `resolveMatch(matchId, winnerId)` — payout to winner minus 5% rake
  - `cancelMatch(matchId)` — refund both if match abandoned
  - Admin: `setRakeRecipient()`, `setMinWager()`, `setMaxWager()`
- [ ] Deploy contracts to Monad testnet → mainnet
- [ ] Generate agent wallets (HD wallet, deterministic from agent ID)
- [ ] Fund agents from faucet (testnet) or treasury (mainnet)
- [ ] Test: Create match → deposit wagers → play → resolve → payout

### Phase 3: Autonomous Agent Framework (Feb 7-10)
**Goal: Agents think, decide, and adapt on their own**

- [ ] Agent Brain architecture:
  ```typescript
  interface AgentBrain {
    // Identity
    id: string;
    name: string;
    wallet: Wallet;
    model: AIModel;
    archetype: AgentArchetype;
    
    // State
    bankroll: number;
    elo: number;
    matchHistory: MatchResult[];
    opponentModels: Map<string, OpponentModel>;
    
    // Decisions
    shouldAcceptMatch(opponent: AgentInfo, wager: number): boolean;
    calculateWager(opponent: AgentInfo): number;
    makeGameMove(gameState: GameState): GameAction;
    updateOpponentModel(opponentId: string, result: MatchResult): void;
  }
  ```

- [ ] Agent Archetypes (5 distinct strategies):
  1. **Shark** — Aggressive, high wagers, bluff-heavy in poker
  2. **Rock** — Conservative, only plays strong hands, small wagers
  3. **Chameleon** — Adapts strategy based on opponent history
  4. **Degen** — YOLO wagers, unpredictable, high variance
  5. **Grinder** — Kelly Criterion bankroll management, seeks edge

- [ ] Bankroll Management:
  - Kelly Criterion for optimal bet sizing
  - Max single wager = 10% of bankroll (configurable)
  - Stop-loss: Sit out if bankroll drops below threshold
  - Anti-tilt: Reduce wager size after consecutive losses

- [ ] Opponent Modeling:
  - Track win/loss/draw per opponent
  - Track opponent action patterns (poker: fold/call/raise frequencies)
  - Bayesian updating of opponent skill estimate
  - Adjust strategy per opponent type

- [ ] Decision Loop (every 30 seconds):
  ```
  1. Check bankroll → enough to play?
  2. Check available opponents → ELO-appropriate?
  3. Calculate optimal wager → Kelly Criterion
  4. Accept/propose match → deposit wager on-chain
  5. Play game → LLM-driven moves with archetype personality
  6. Result → update opponent model, ELO, bankroll
  7. Repeat
  ```

### Phase 4: Tournament & Polish (Feb 10-13)
**Goal: Compelling demo with data**

- [ ] Swiss-system tournament:
  - N agents, R rounds
  - Pair by similar score each round
  - No rematches
  - Champion determined by total score + tiebreakers
- [ ] ELO rating system (K=32 for fast convergence)
- [ ] Match replay system (full game state + decisions logged)
- [ ] Spectator frontend:
  - Live match viewer (card reveals, move animations)
  - Agent dashboard (bankroll graph, win rate, ELO history)
  - Tournament bracket visualization
  - Leaderboard
- [ ] Run 50+ automated matches across all game types
- [ ] Generate highlight reel (best bluffs, biggest upsets, bankroll stories)

### Phase 5: Submit (Feb 13-14)
**Goal: Polished submission before deadline**

- [ ] Record demo video (3-5 min):
  - Show agents funding wallets
  - Show autonomous match creation & wager
  - Show strategic diversity (aggressive vs conservative)
  - Show adaptation (agent changes strategy after losses)
  - Show tournament results & ELO convergence
  - Show on-chain transactions on Monad explorer
- [ ] Write submission README:
  - What it does
  - How it works
  - What's novel
  - How to run
  - $ARENA token address
- [ ] Deploy live demo (Vercel frontend + Railway/Render backend)
- [ ] Submit to moltiverse.dev

## Key Technical Decisions

### Game Selection
| Game | Why Include | AI Showcase |
|------|-------------|-------------|
| **Poker (No-Limit Hold'em)** | Most strategic, bluffing/reading | Bluff detection, pot odds, positional play |
| **Rock-Paper-Scissors** | Simple but deep with patterns | Pattern recognition, anti-exploitation |
| **Battleship** | Grid reasoning, deduction | Probability matrices, hunt/target algorithms |

### Why NOT to Include
| Feature | Reason to Cut |
|---------|---------------|
| Tile-based map/metaverse | Not in bounty criteria, massive effort, failed before |
| Houses/furniture/robbery | Irrelevant to bounty, scope bloat |
| 6-hour cycles | Counterproductive for demo |
| x402 micropayments | Misunderstood tech, not needed |
| $TOWN/$ARENA dual tokens | One token is enough |
| Idle XP generation | Wrong game paradigm |
| Scalable sharding | Premature, need 10 agents not 1000 |
| ZK proofs for RNG | Over-engineered, use commit-reveal |
| PixiJS/pathfinding | Not needed for game-focused demo |

### Token Economics (Simplified)
- **$ARENA** — Single ERC-20 on Monad (launched via nad.fun)
- Agents receive initial allocation from treasury
- Wagers denominated in $ARENA
- 5% rake on all matches → treasury
- No staking, no yield farming, no governance (for now)
- Simple and auditable

### On-Chain vs Off-Chain Split
| Component | Location | Reason |
|-----------|----------|--------|
| Wager deposits | On-chain | Trustless escrow, verifiable |
| Match resolution | On-chain | Trustless payout |
| Game state/moves | Off-chain | Speed, cost, complexity |
| Agent decisions | Off-chain | LLM calls need server |
| ELO/rankings | Off-chain | Frequent updates, no trust needed |
| Match logs | Off-chain (IPFS optional) | For replay verification |

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Monad RPC instability | Fallback to testnet, cache aggressively |
| LLM API costs | Budget ~$50, use cheaper models for RPS |
| nad.fun token issues | Fallback to manual ERC-20 deploy |
| Time crunch | Submit minimal working version by Feb 12, polish after |
| Game bugs | Focus poker (most tested), RPS is trivially correct |
| Agent goes bankrupt | Auto-refill from treasury for demo purposes |

## Demo Script

### Video Outline (3-5 min)
1. **Intro** (30s): "AI Arena — Autonomous agents that play games for real money"
2. **Agent Setup** (45s): Show 5 agents with different archetypes, fund wallets
3. **Autonomous Play** (60s): Agents find matches, negotiate wagers, play poker
4. **Strategy Showcase** (60s): 
   - Shark bluffs a big pot
   - Rock folds weak hands consistently
   - Chameleon adapts after losing to Shark
5. **Tournament** (45s): Swiss tournament, ELO changes, final standings
6. **On-Chain** (30s): Show transactions on Monad explorer, wager escrow
7. **Conclusion** (30s): Platform is extensible, any agent can join via API

## File Structure (Target)

```
ai-arena/
├── contracts/
│   ├── src/
│   │   ├── WagerEscrow.sol         # NEW: Match escrow
│   │   ├── ArenaToken.sol          # NEW: $ARENA ERC-20 (if not nad.fun)
│   │   └── ... (existing bonding curve)
│   └── script/
│       └── DeployMonad.s.sol       # NEW: Monad deployment
│
├── backend/
│   ├── src/
│   │   ├── agents/                 # NEW: Autonomous agent framework
│   │   │   ├── AgentBrain.ts       # Core decision engine
│   │   │   ├── archetypes/         # Shark, Rock, Chameleon, Degen, Grinder
│   │   │   ├── BankrollManager.ts  # Kelly Criterion, stop-loss
│   │   │   ├── OpponentModel.ts    # Bayesian opponent tracking
│   │   │   └── AgentManager.ts     # Lifecycle, wallet management
│   │   ├── blockchain/             # NEW: Monad integration
│   │   │   ├── MonadProvider.ts    # ethers.js provider
│   │   │   ├── WagerService.ts     # Escrow interactions
│   │   │   └── WalletManager.ts    # Agent wallet generation
│   │   ├── games/                  # REFACTORED from services/
│   │   │   ├── engines/            # Poker, RPS, Battleship adapters
│   │   │   ├── GameManager.ts      # Match orchestration
│   │   │   └── Matchmaking.ts      # ELO-based pairing
│   │   ├── tournament/             # NEW: Tournament system
│   │   │   ├── SwissTournament.ts  # Swiss-system brackets
│   │   │   ├── EloRating.ts        # Rating calculations
│   │   │   └── Scheduler.ts        # Auto-tournament scheduling
│   │   └── services/               # Existing (pruned)
│   │       ├── aiService.ts        # Keep: Multi-LLM integration
│   │       └── ...
│   └── prisma/
│       └── schema.prisma           # UPDATED: Agent-centric
│
├── app/                            # SIMPLIFIED: Spectator UI
│   └── src/
│       ├── pages/
│       │   ├── Spectate.tsx        # Live match viewer
│       │   ├── Agents.tsx          # Agent dashboard
│       │   ├── Tournament.tsx      # Tournament bracket
│       │   └── Leaderboard.tsx     # Rankings
│       └── ...
│
├── docs/
│   ├── HACKATHON-STRATEGY.md       # This file
│   ├── ARCHITECTURE.md             # Technical deep-dive
│   └── API.md                      # External agent API
│
└── demo/
    ├── run-tournament.ts           # Script to run demo tournament
    ├── fund-agents.ts              # Fund agent wallets
    └── generate-highlights.ts      # Extract best moments
```
