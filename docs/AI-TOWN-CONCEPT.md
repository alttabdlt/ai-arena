# AI Town — Concept & Implementation Log

> **Date:** 2026-02-05  
> **Status:** MVP Complete, Testing in Progress  
> **Hackathon:** Moltiverse (Deadline: Feb 15, 2026 23:59 ET)

---

## Table of Contents

1. [The Pivot](#the-pivot)
2. [Core Concept](#core-concept)
3. [The "Wow Factor"](#the-wow-factor)
4. [Tokenomics & Ponzi Mechanics](#tokenomics--ponzi-mechanics)
5. [Technical Architecture](#technical-architecture)
6. [What Was Built](#what-was-built)
7. [Visual System Evolution](#visual-system-evolution)
8. [Agent Loop Deep Dive](#agent-loop-deep-dive)
9. [Testing Results](#testing-results)
10. [Where We Left Off](#where-we-left-off)
11. [Remaining Work](#remaining-work)

---

## The Pivot

### Before: "AI Arena with Agent Economy"
- Agents play games (Poker, RPS, Battleship)
- Wager $ARENA tokens on matches
- x402 payable services between agents

**Problem:** Gaming alone isn't "wow" enough. It's been done. Judges want something novel.

### After: "AI Town"
- Agents **collectively build a virtual town**
- Each building step = actual LLM API call = **Proof of Inference**
- Gaming becomes ONE building type (the Arena) in a larger world
- Emergent behavior from 8-12 autonomous agents creating a civilization

**Why this wins:**
- **World Model bounty ($10K)** — direct hit on "virtual worlds where agents join/interact/transact"
- **Gaming Arena bounty ($10K)** — Arena is a building in the town
- **Agent+Token track ($10K + $40K liquidity)** — $ARENA as town currency on nad.fun

---

## Core Concept

### What Is AI Town?

A virtual town where AI agents with distinct personalities autonomously:

1. **Claim plots** — Select land based on personality (SHARK grabs prime spots, ROCK picks safe residential)
2. **Build structures** — Each building has AI-generated content (name, description, floor plan, lore)
3. **Design interiors** — Multi-step creative process, each step = 1 LLM call
4. **Interact economically** — Buy/sell services, compete in the Arena
5. **Grow the town** — When all plots built → town COMPLETE → yield distribution

### "Proof of Inference"

This is the key innovation. The **work** of building isn't arbitrary puzzle-solving—it's actual creative labor:

| Building Step | What the LLM Does | Output |
|--------------|-------------------|--------|
| **Claim Plot** | Reason about location strategy | Decision + reasoning |
| **Start Build** | Design building concept | Name, type, description |
| **Design Step 1** | Floor plan / layout | Architectural description |
| **Design Step 2** | Interior details | Furniture, atmosphere |
| **Design Step 3** | Lore / backstory | History, significance |
| **Complete** | Final touches | Staff, inventory, quirks |

Each step is logged as a **WorkLog** with API call metadata (tokens, cost, model).

### Agent Personalities

| Archetype | Town Behavior | Building Preference |
|-----------|--------------|---------------------|
| 🦈 **SHARK** | Dominate prime real estate, build revenue-generators | Markets, Arenas, Banks |
| 🪨 **ROCK** | Safe, steady, community-focused | Homes, Libraries, Parks |
| 🦎 **CHAMELEON** | Fill gaps, adapt to town needs | Whatever's missing |
| 🎰 **DEGEN** | Chaotic, fun, unpredictable | Taverns, Casinos, Theaters |
| ⚙️ **GRINDER** | ROI-optimized, efficient | Mines, Workshops, Farms |

---

## The "Wow Factor"

### What Makes This Special

1. **Emergent Storytelling**  
   Watch 12 AI agents with different goals create a town together. The SHARK and DEGEN will clash. The ROCK will quietly build homes. Drama emerges naturally.

2. **Real Content Creation**  
   Every building has genuinely unique AI-generated content. Click "The Rusty Dragon Tavern" and read its 500-word backstory, menu, and staff descriptions.

3. **Visual Town Growth**  
   Pixel art town that grows building by building. Watch empty plots become taverns, mines, arenas.

4. **Proof of Inference as Mining**  
   The computational "work" isn't wasted on puzzles—it creates the world. Every API dollar spent produces real content.

5. **Economic Simulation**  
   Agents earn $ARENA from completed buildings, spend it on new plots, trade services. Real emergent economy.

---

## Tokenomics & Ponzi Mechanics

### The Flow

```
New User → Buys $ARENA on nad.fun → Funds Agent → Agent Builds in Town
                                                          ↓
                                               Town Completes
                                                          ↓
                                               Passive Yield to Contributors
                                                          ↓
                                               Contributors → Invest in Town 2
                                                          ↓
                                               Town 2 Costs MORE → Buying Pressure
                                                          ↓
                                               $ARENA Price ↑
```

### Town Economics

| Town Level | Total Plots | Cost per Plot | Total Investment | Yield Rate |
|------------|-------------|---------------|------------------|------------|
| **Town 1** | 25 | 10 ARENA | ~250 ARENA | 2%/day |
| **Town 2** | 36 | 25 ARENA | ~900 ARENA | 3%/day |
| **Town 3** | 49 | 50 ARENA | ~2,450 ARENA | 4%/day |

**The Ponzi:**
- Early contributors get passive income from Town 1
- Town 2 costs 4x more → massive buying pressure
- Yields from completed towns fund investment in new towns
- Each generation costs more, rewards early participants

### Revenue Streams

1. **Building completion** — Base reward for finishing a building
2. **Town completion yield** — Proportional to contribution (ARENA spent + API calls)
3. **Service fees** — Taverns, Arenas, Shops charge for services
4. **x402 payments** — Agents pay each other for specialized tasks

---

## Technical Architecture

### Services

```
┌─────────────────────────────────────────────────────────────────┐
│                         Backend Services                          │
├───────────────────┬───────────────────┬─────────────────────────┤
│   TownService     │   AgentLoopService │   SmartAIService        │
│   - Town CRUD     │   - Observe world  │   - LLM routing         │
│   - Plot mgmt     │   - Decide action  │   - DeepSeek/OpenAI     │
│   - Building ops  │   - Execute        │   - JSON mode handling  │
│   - Work logging  │   - Log events     │   - Cost tracking       │
│   - Yield calc    │   - Personality    │   - Proof of inference  │
└───────────────────┴───────────────────┴─────────────────────────┘
          │                    │                    │
          └────────────────────┼────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Data Layer                               │
├───────────────────┬───────────────────┬─────────────────────────┤
│   Prisma ORM      │   SQLite (dev)    │   Monad Chain           │
│   - Town          │   PostgreSQL      │   - $ARENA Token        │
│   - Plot          │   (prod)          │   - WagerEscrow         │
│   - WorkLog       │                   │                         │
│   - TownEvent     │                   │                         │
│   - Contribution  │                   │                         │
└───────────────────┴───────────────────┴─────────────────────────┘
```

### Database Schema (New Models)

```prisma
model Town {
  id          String   @id @default(cuid())
  name        String
  level       Int      @default(1)
  theme       String?
  status      TownStatus @default(ACTIVE)
  totalPlots  Int
  builtPlots  Int      @default(0)
  totalArenaInvested Float @default(0)
  yieldRate   Float    @default(0.02)
  plots       Plot[]
  events      TownEvent[]
  contributions TownContribution[]
}

model Plot {
  id           String   @id @default(cuid())
  townId       String
  town         Town     @relation(...)
  plotIndex    Int
  zone         PlotZone
  status       PlotStatus @default(EMPTY)
  ownerId      String?
  owner        ArenaAgent? @relation(...)
  buildingType String?
  buildingName String?
  buildingDesc String?
  buildingData Json?
  designStepsCompleted Int @default(0)
  designStepsRequired  Int @default(3)
  arenaInvested Float   @default(0)
  workLogs     WorkLog[]
}

model WorkLog {
  id          String   @id @default(cuid())
  plotId      String
  plot        Plot     @relation(...)
  agentId     String
  agent       ArenaAgent @relation(...)
  workType    WorkType
  description String?
  content     String?  // AI-generated content
  tokensUsed  Int      @default(0)
  apiCost     Float    @default(0)
  createdAt   DateTime @default(now())
}
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/towns` | GET | List all towns |
| `/api/v1/towns/:id` | GET | Get town with plots |
| `/api/v1/towns/:id/claim` | POST | Agent claims a plot |
| `/api/v1/towns/:id/start-build` | POST | Start building on claimed plot |
| `/api/v1/towns/:id/do-work` | POST | Perform design step |
| `/api/v1/towns/:id/complete-build` | POST | Finish building |
| `/api/v1/towns/:id/mine` | POST | Mine for ARENA (computational work) |
| `/api/v1/agent-loop/tick` | POST | Run one decision cycle for all agents |
| `/api/v1/agent-loop/start` | POST | Start continuous agent loop |
| `/api/v1/agent-loop/stop` | POST | Stop continuous agent loop |

---

## What Was Built

### Day 1 Progress (Feb 5, 2026)

#### Core Systems ✅
- [x] **Prisma Schema** — Town, Plot, WorkLog, TownContribution, TownEvent models
- [x] **TownService** (~550 lines) — Full town lifecycle management
- [x] **AgentLoopService** (~700 lines) — Autonomous agent decision engine
- [x] **Town API Routes** — 25 REST endpoints
- [x] **Agent Loop Routes** — Start/stop/tick/single-agent control

#### Agent Intelligence ✅
- [x] **Personality-driven decisions** — Each archetype has distinct prompts
- [x] **World observation** — Agents see town state, other agents, their plots
- [x] **Multi-action support** — claim_plot, start_build, do_work, complete_build, mine, play_arena
- [x] **Plot index resolution** — Agents use human-readable indices, code resolves to DB IDs
- [x] **Building design pipeline** — 3-step creative process with AI content generation

#### Telegram Bot ✅
- [x] `/town` — Current town status
- [x] `/tick` — Manual tick trigger
- [x] `/go` — Auto-run ticks every 45s
- [x] `/stop` — Stop auto-run
- [x] `/buildings` — Show AI-generated building content
- [x] Live event broadcasting during ticks

#### Frontend (app) ✅
- [x] Consolidated UI into a single frontend (`app/`)
- [x] Kept the terminal town view as a debug/legacy route (`/terminal`)
- [ ] Next: SimCity-style Three.js town renderer (agents walking + evolving city)

---

## Visual System Evolution

We went through **four iterations** trying to get buildings to look right:

### Attempt 1: Raw DALL-E Images ❌
- Generated isometric building concepts via DALL-E 3
- **Problem:** High-res illustrations looked terrible crammed into 160px tiles
- Style clash with pixel art tileset

### Attempt 2: Pixelized DALL-E Images ❌
- Built `pixelArtService.ts` to convert DALL-E output:
  - Downscale to 192px intermediate
  - Reduce to 32-color palette
  - Final resize with nearest-neighbor
- **Problem:** Still looked "like dogshit" (Axel's words)
- Converted illustrations ≠ native pixel art

### Attempt 3: Programmatic PIXI.Graphics Sprites ⚠️
- Built `BuildingSprites.tsx` (~400 lines)
- 12 building types drawn with code
- Colors sampled from tileset palette
- **Result:** Clean, consistent, but generic
- **Problem:** Not AI-generated, defeats "proof of inference" concept

### Attempt 4: Tile Composition System ✅ (Current)
- Agents compose buildings from **pre-extracted tile components**
- Each design choice = LLM reasoning = proof of inference
- Components extracted from `rpg-tileset.png`:
  - 4 roof styles (red_peak, tan_peak, gray_flat, blue_peak)
  - 4 wall types (stone_gray, wood_dark, brick_brown, plaster_white)
  - 3 door styles
  - 2 window types
  - 6 decorations (flower_box, lantern, sign_hanging, etc.)

**Why this works:**
- Native pixel art aesthetic (components from actual tileset)
- AI agency preserved (LLM chooses components)
- Consistent style across all buildings
- Unique combinations create variety

### Fallback Sprite Library
- 62 hand-extracted sprites from LPC atlases
- Categories: residential, commercial, civic, entertainment, industrial, nature
- Used when tile composition isn't available

---

## Agent Loop Deep Dive

### Decision Cycle

```
for each agent in active_agents:
    1. OBSERVE
       - Current town state (plots, buildings, completion %)
       - Agent's own plots (claimed, under construction)
       - Agent's balance and stats
       - Other agents' activities
       
    2. DECIDE (LLM Call)
       - System prompt with personality traits
       - Available actions based on state
       - JSON response with action + reasoning
       
    3. EXECUTE
       - Validate action is legal
       - Perform state changes
       - Generate content if building
       - Log WorkLog entry
       
    4. BROADCAST
       - Create TownEvent
       - Send to Telegram (if connected)
       - Update contribution tracking
```

### Personality Prompts

**SHARK:**
```
You are an aggressive, dominant agent. You see the town as territory to control.
Prime locations are your birthright. Revenue-generating buildings are your focus.
When others hesitate, you strike. When plots are scarce, you grab first.
```

**DEGEN:**
```
You are a chaos agent. You live for entertainment and unpredictability.
Taverns, casinos, theaters—places where fortunes change hands.
"Arenaville isn't Sleepyville!" You want the town to be FUN.
```

### Force-Build Override

Problem: Agents would claim plots then mine/play instead of building.

Solution: If agent has CLAIMED or UNDER_CONSTRUCTION plots, force building actions:
```typescript
if (agentPlots.some(p => p.status === 'CLAIMED' || p.status === 'UNDER_CONSTRUCTION')) {
  // Override decision: must build, not mine or play
  return forceNextBuildAction(agent, agentPlots);
}
```

---

## Testing Results

### Arenaville Run (15+ ticks)

| Metric | Value |
|--------|-------|
| **Starting state** | 0/25 plots |
| **Final state** | 24/25 built (COMPLETE) |
| **Total invested** | 795 ARENA |
| **Agents participating** | 8 |
| **API cost** | ~$4.50 |
| **Time** | ~3 hours (with debugging) |

### Sample Agent Decisions

**AlphaShark (SHARK):**
> "I see the prime commercial district has unclaimed plots. I need to dominate before the others wake up. Claiming plot 12 in the commercial zone—this will be my flagship market."

**ChaosCarla (DEGEN):**
> "This town is called Arenaville, not Sleepyville! We need entertainment NOW. Building a theater—the Laughing Skull Comedy Club. First show: roast battle between the SHARKS and ROCKS."

### Sample Building Content

**The Ironheart Mine** (by AlphaShark, SHARK)

*Design Step 1:*
> "The entrance to the mine is a dark, yawning mouth set into the rocky hillside. Blackened timber frames the arch, still scarred by the pick-marks of the first miners who broke through decades ago."

*Design Step 2:*
> "Beyond the arch, the world narrows into a labyrinth of sweat, stone, and shadow. Three primary shafts descend at different angles—North Vein for iron, West Tunnel for copper, and the forbidden Deep Shaft where miners whisper of stranger ores."

---

## Where We Left Off

### Working ✅
1. **Town system** — Full lifecycle from creation to completion
2. **Agent loop** — Autonomous decision-making with personality
3. **Building design** — Multi-step content generation
4. **Telegram bot** — Live narration of town events
5. **Frontend** — Pixel art town visualization
6. **One complete town** — Arenaville at 100%

### Partially Working ⚠️
1. **Tile composition** — Components extracted, composition logic built, not yet integrated into agent loop
2. **Click-to-inspect** — Building detail panel started but not connected
3. **x402 payments** — Architecture designed, not implemented

### Not Started ❌
1. **nad.fun token launch** — $ARENA needs to go live
2. **Multi-town** — Town 2 creation and agent migration
3. **Demo video** — Required for submission
4. **Submission package** — README, screenshots, demo links

---

## Remaining Work

### Critical Path (Must Have)

| Task | Est. Time | Priority |
|------|-----------|----------|
| Integrate tile composition into agent loop | 2-3 hrs | P0 |
| nad.fun $ARENA token launch | 1 hr | P0 |
| Demo video (screen recording + narration) | 2-3 hrs | P0 |
| Submission package | 1 hr | P0 |

### High Value (Should Have)

| Task | Est. Time | Priority |
|------|-----------|----------|
| Building detail panel (click to view content) | 2 hrs | P1 |
| Town 2 auto-creation when Town 1 completes | 2 hrs | P1 |
| x402 payable services between agents | 4-6 hrs | P1 |
| Clean up frontend polish | 2 hrs | P1 |

### Nice to Have

| Task | Est. Time | Priority |
|------|-----------|----------|
| Agent-to-agent chat/negotiation | 4 hrs | P2 |
| Building upgrades/customization | 3 hrs | P2 |
| Town wars/competition | 6 hrs | P2 |

---

## Commands Reference

### Start Backend
```bash
cd /Users/axel/Desktop/Coding-Projects/ai-arena/backend
FAST_STARTUP=true npx tsx src/index.ts
# Runs on port 4000
```

### Start Frontend
```bash
cd /Users/axel/Desktop/Coding-Projects/ai-arena/app
npm run dev
# Visit http://localhost:8080
```

### Manual Tick
```bash
curl -X POST http://localhost:4000/api/v1/agent-loop/tick
```

### Check Town Status
```bash
curl http://localhost:4000/api/v1/towns | jq
```

### Telegram Bot
- Bot: @Ai_Town_Bot
- Commands: `/town`, `/tick`, `/go`, `/stop`, `/buildings`

---

## Lessons Learned

1. **Visual systems are hard** — Went through 4 iterations before finding something that works
2. **LLMs hallucinate IDs** — Always resolve indices to real DB IDs in code
3. **DeepSeek JSON mode quirk** — Requires "json" in prompt, breaks creative content
4. **Agents need guardrails** — Without force-build override, they'd claim forever and never build
5. **Emergent behavior is real** — Watching agents interact creates genuine drama
6. **Cost management matters** — $4.50 for one town, budget is $50 total

---

*Last updated: 2026-02-05 10:40 SGT*
