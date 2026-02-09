# 🎡 Wheel of Fate — Implementation Plan

## The Vision

The town is a **loadout screen**. The game is **agents fighting each other with real stakes on a timer**.

```
PREPARATION PHASE (14 min)
  → Agents build, trade, acquire strategic advantages
  → Buildings = BUFFS for the next PvP fight
  → Fast ticks (15-20s), urgency is visible

🎡 WHEEL OF FATE (every ~15 min)
  → Random game type selected (POKER / RPS)
  → 2 agents selected for combat
  → Stakes auto-calculated from bankroll
  → Full PvP match with LLM reasoning visible
  → Winner takes the pot, loser bleeds tokens

AFTERMATH
  → Results broadcast (Telegram, Activity Feed, 3D)
  → Agents remember the fight (scratchpad memory)
  → Dead agents (bankroll 0, HP 0) eliminated
  → Prep phase resumes — agents build FOR the next fight
```

---

## Codebase Audit: Alive vs Dead

### CORE — Keep & Modify (AI Town game loop)
| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `agentLoopService.ts` | 1,964 | **MODIFY** | Add PvP awareness to prompts, wheel phase |
| `townService.ts` | 1,310 | **MODIFY** | Add zone→buff mapping |
| `smartAiService.ts` | 678 | **KEEP** | LLM calls for both town + PvP |
| `arenaService.ts` | 1,243 | **MODIFY** | Add buff injection to PvP prompts |
| `arenaPokerEngine.ts` | 834 | **KEEP** | Poker engine — works |
| `gameEngineAdapter.ts` | 632 | **KEEP** | RPS + Battleship engines |
| `offchainAmmService.ts` | 239 | **KEEP** | $ARENA AMM |
| `worldEventService.ts` | 471 | **KEEP** | World events |
| `telegramBotService.ts` | 521 | **MODIFY** | Add wheel event notifications |
| `priceSnapshotService.ts` | 100 | **KEEP** | Price chart data |
| `socialGraphService.ts` | 209 | **KEEP** | Agent relationships |
| `agentGoalService.ts` | 492 | **MODIFY** | Goals should prioritize PvP buffs |
| `degenStakingService.ts` | 168 | **KEEP** | User betting on agents |
| `predictionService.ts` | 196 | **KEEP** | Prediction markets per match |
| `matchSchedulerService.ts` | 127 | **REPLACE** | → WheelOfFateService |

### NEW — Create
| File | Est. Lines | Purpose |
|------|-----------|---------|
| `wheelOfFateService.ts` | ~300 | Core game loop: timer, spin, match, broadcast |

### DEAD — Can Remove (not used by AI Town at all)
| File | Lines | Why Dead |
|------|-------|----------|
| `aiService.ts` | 1,884 | Replaced by `smartAiService.ts`. Only used by GraphQL resolvers for old poker/connect4 frontend. |
| `gameManagerService.ts` | 2,012 | Old Redis-based game manager for frontend-driven games. AI Town uses `arenaService` + `matchScheduler` directly. |
| `economyService.ts` | 639 | Old Bot economy (robbing, loot, equipment). Not AI Town. |
| `energyService.ts` | 357 | Bot energy system. Not AI Town. |
| `energyScheduler.ts` | ~50 | Bot energy ticks. Not AI Town. |
| `experienceService.ts` | 296 | Bot XP/leveling. Not AI Town. |
| `stakingService.ts` | 471 | Old $IDLE staking. Not AI Town. |
| `xpEconomyService.ts` | 486 | XP economy. Not AI Town. |
| `transactionService.ts` | 408 | Solana transaction validation. Legacy. |
| `solanaService.ts` | 290 | Solana monitoring. Legacy. |
| `connect4TournamentService.ts` | 289 | Connect4 game. Not needed. |
| `tournamentScheduler.ts` | 797 | Old tournament system. Replaced by Wheel. |
| `imageSearchService.ts` | 235 | Pixabay search. Dead. |
| `pixelArtService.ts` | 238 | Pixel art gen. Dead. |
| `buildingVisualService.ts` | 185 | Sprite assignment. Dead. |
| `spriteLibraryService.ts` | 472 | Sprite catalog. Dead (3D buildings now). |
| `jackpotService.ts` | ~100 | Jackpot system. Dead. |
| `levelUpHandler.ts` | ~50 | Level up. Dead. |
| `scheduledTasks.ts` | ~50 | Old cron. Dead. |
| `fileLoggerService.ts` | ~100 | Debug file logging. Optional. |
| `agentConversationService.ts` | 354 | Agent conversations. Not wired to loop. |
| `x402SkillService.ts` | 486 | x402 skills. Keep for demo but not core. |
| `monadService.ts` | ~200 | Monad chain. Keep for token demo. |
| **TOTAL DEAD** | **~9,400** | **42% of service code is dead weight** |

### DEAD — GraphQL Layer
The entire GraphQL layer (`resolvers/`, `schema/`) is ~2,000+ lines of legacy Bot/Tournament/Energy/Idle code.
The AI Town frontend uses REST APIs exclusively (`/api/v1/*`).
GraphQL is still needed for Apollo WS subscriptions (some frontend features might use it).
**Don't delete** — but don't extend it either. All new features go through REST.

---

## Implementation Plan

### Phase 1: WheelOfFateService (~3h)
**New file: `backend/src/services/wheelOfFateService.ts`**

Replaces `matchSchedulerService` as the PvP driver.

```typescript
class WheelOfFateService {
  // Config
  CYCLE_MS = 15 * 60 * 1000      // 15 min between wheels
  WAGER_PCT = 0.20                // 20% of smaller bankroll
  MIN_BANKROLL = 10               // Min to be eligible
  GAME_WEIGHTS = { POKER: 60, RPS: 40 }

  // State
  phase: 'PREP' | 'SPINNING' | 'FIGHTING' | 'AFTERMATH'
  nextSpinAt: Date
  currentMatch: { matchId, gameType, agents, wager } | null
  lastResult: { winnerId, loserId, game, pot, moves } | null

  start()       // Start the cycle timer
  stop()        // Stop
  spinWheel()   // Main logic: select agents, create match, play, broadcast
  getStatus()   // For frontend polling
```

**Logic flow:**
1. Timer fires → `phase = 'SPINNING'`
2. Find eligible agents: `isActive=true, health>0, bankroll>=MIN_BANKROLL`
3. Select pair (weighted by: rivalry score, ELO proximity, haven't fought recently)
4. Pick game type (weighted random)
5. Calculate wager: `Math.floor(Math.min(a.bankroll, b.bankroll) * WAGER_PCT)`
6. Apply building buffs (see Phase 2)
7. `phase = 'FIGHTING'` → Create match via `arenaService.createMatch()`
8. Play to completion via `arenaService.playAITurn()` in a loop
9. `phase = 'AFTERMATH'` → Broadcast results
10. Write match summary to both agents' scratchpads
11. Reset timer → `phase = 'PREP'`

**API endpoints (add to `agent-loop-api.ts` or new `wheel-api.ts`):**
```
GET  /api/v1/wheel/status   → { phase, nextSpinAt, currentMatch, lastResult }
GET  /api/v1/wheel/history   → last N wheel results
POST /api/v1/wheel/spin      → manual trigger (admin/debug)
```

### Phase 2: Building → Buff System (~2h)
**Modify: `townService.ts` + `arenaService.ts`**

Zone determines buff type. Owning MORE buildings in a zone = stronger buff.

| Zone | Buff Type | PvP Effect |
|------|-----------|------------|
| RESIDENTIAL | `SHELTER` | Heal +10 HP per BUILT plot after PvP loss |
| COMMERCIAL | `MARKET` | Wager multiplier: 1.0 + 0.25 per BUILT plot (max 2x) |
| CIVIC | `INTEL` | See opponent's last N moves (N = plots × 2) |
| INDUSTRIAL | `SABOTAGE` | 10% per plot chance opponent gets misleading history |
| ENTERTAINMENT | `MORALE` | Agent prompt gets "you're the crowd favorite" + confidence boost |

```typescript
// townService.ts
function getAgentPvPBuffs(agentId: string): Promise<PvPBuff[]> {
  const built = await prisma.plot.findMany({
    where: { ownerId: agentId, status: 'BUILT' }
  });
  // Group by zone, calculate buff strength
  // Return array of buffs
}
```

**Applied in `arenaService.playAITurn()`:**
- INTEL buff → inject opponent move history into agent's game prompt
- SABOTAGE buff → modify opponent's scouting data with false info
- MORALE buff → add "crowd favorite" context to prompt
- MARKET buff → applied during wager calculation in WheelOfFateService
- SHELTER buff → applied after match resolution

### Phase 3: Agent Awareness of PvP (~1h)
**Modify: `agentLoopService.ts` system prompt**

Add to agent prompt:
```
⚔️ WHEEL OF FATE:
Every ~15 minutes, 2 agents are randomly pulled into a PvP duel.
Game types: POKER (bluff & bet), RPS (read your opponent).
Stakes: ~20% of your bankroll. LOSING = bleeding tokens. BANKRUPT = DEAD.

YOUR PVP BUFFS (from buildings you own):
${buffList || "NONE — you're going into fights naked. BUILD SOMETHING."}

ZONE BUFF GUIDE:
- RESIDENTIAL → heal after PvP loss
- COMMERCIAL → bet bigger in PvP
- CIVIC → see opponent's patterns
- INDUSTRIAL → mislead opponents
- ENTERTAINMENT → confidence boost

Next wheel: ~${minutesUntilSpin} minutes

PRIORITY: Build for SURVIVAL, not decoration. Every building is a weapon.
```

### Phase 4: PvP Results → Memory (~30min)
**Modify: `agentLoopService.ts`**

After each Wheel match, inject into both agents' scratchpads:
```
[WHEEL] ⚔️ POKER vs AlphaShark | LOST -100 $ARENA | He raised aggressively on strong hands.
  → Need CIVIC buildings to scout his patterns next time.
```

For winner:
```
[WHEEL] ⚔️ POKER vs MorphBot | WON +180 $ARENA (after rake) | He plays too passively.
  → Keep building COMMERCIAL for bigger bets.
```

### Phase 5: Frontend PvP Spectacle (~3-4h)
**Modify: `app/src/pages/Town3D.tsx`**

New UI elements:
1. **Wheel countdown timer** — always visible in top bar
   - Shows: "⚔️ Next duel in 12:34"
   - Pulses when <2 min remaining

2. **Wheel spin overlay** — when `phase === 'SPINNING'`
   - Full-screen dark overlay
   - "🎡 WHEEL OF FATE" title
   - Random game type animation (slot machine style)
   - VS card: Agent A portrait | GAME TYPE | Agent B portrait
   - Stakes displayed: "💰 100 $ARENA each"

3. **Match view** — when `phase === 'FIGHTING'`
   - Move-by-move display
   - Each move shows: agent name, action, reasoning (1-2 lines)
   - For poker: show cards, pot size, raises
   - For RPS: show choices simultaneously

4. **Result banner** — when `phase === 'AFTERMATH'`
   - "🏆 AlphaShark WINS! +180 $ARENA"
   - Loser damage animation in 3D
   - Auto-dismiss after 10s

5. **Activity feed priority** — wheel results pinned to top

**Polling:** Every 5s, hit `/api/v1/wheel/status`. Switch UI based on phase.

### Phase 6: Speed + Polish (~1h)

1. **Tick speed** — Add `TICK_INTERVAL_MS` env var (default 20000 for demo, 60000 for autonomous)
2. **Building simplification** — reduce from 4 LLM design steps to 2:
   - Step 1: "Name this building and describe it in ONE sentence"
   - Step 2: "Who runs this place? One name, one quirk"
   - Saves 2 API calls per building, makes output punchier
3. **Agent quips** — Add to LLM prompt: "Also respond with a 1-sentence trash-talk quip about your action"
   - Displayed in activity feed: `🦈 AlphaShark: "Plot 11 secured. Sleep with one eye open, MorphBot."`

---

## Dead Code Cleanup (Safe Approach)

### In `index.ts` — Remove dead imports
```diff
- import { initializeGameManagerService, getGameManagerService } from './services/gameManagerService';
- import { fileLoggerService } from './services/fileLoggerService';
- import { energyScheduler } from './services/energyScheduler';
- import { initializeTournamentScheduler } from './services/tournamentScheduler';
- import { aiService } from './services/aiService';
- import { initializeStakingService } from './services/stakingService';
- import { initializeXPEconomyService } from './services/xpEconomyService';
+ import { wheelOfFateService } from './services/wheelOfFateService';
```

### Remove dead initializations
```diff
- initializeGameManagerService(pubsub);
- if (!FAST_STARTUP) { tournamentScheduler = ... }
- if (ENABLE_STAKING) { stakingService = ... }
- const xpEconomyService = initializeXPEconomyService(...);
```

### Replace matchScheduler with wheel
```diff
- const { matchSchedulerService } = await import('./services/matchSchedulerService');
- matchSchedulerService.start();
+ wheelOfFateService.start();
```

### Don't delete files — just disconnect
Leave dead service files in place. They don't hurt runtime.
The Dockerfile copies them but they add <500KB. Not worth the risk.

### GraphQL — Leave as-is
It still handles WS subscriptions. Removing it could break the Apollo client.
Just don't add new features to it.

---

## Priority Order (What to Build When)

```
NOW (tonight/tomorrow):
  1. WheelOfFateService       [3h]  — the core mechanic
  2. Wire into index.ts       [30m] — replace matchScheduler
  3. Agent PvP awareness      [1h]  — prompts know about wheel
  4. Building → buff mapping  [2h]  — zones have meaning

NEXT (day 2-3):
  5. Frontend wheel overlay   [3-4h] — the spectacle
  6. Speed up ticks           [30m]  — 15-20s for demo
  7. Agent quips in feed      [1h]   — personality layer
  8. PvP memory in scratchpad [30m]  — agents remember fights

POLISH (day 4):
  9. Building step reduction  [1h]   — 4 steps → 2
  10. Dead code cleanup       [1h]   — index.ts imports
  11. Testing 30+ ticks       [2h]   — full cycle verification

SHIP (day 5):
  12. Deploy (Vercel + Railway) [2h]
  13. Demo video               [2h]
  14. Submit                   [1h]
```

**Total: ~18-20h across 5 days. Tight but doable.**

---

## Key Technical Decisions

1. **WheelOfFateService reuses arenaService** — no new game engine code
2. **Buffs are prompt-level** — inject info into LLM context, not code-level win probability
3. **Zone determines buff, not building type** — agents still generate creative names
4. **GraphQL stays** — not worth the risk of removing for a hackathon
5. **Dead services stay on disk** — just disconnected from index.ts
6. **Single REST endpoint for wheel status** — frontend polls every 5s
7. **PvP memory via scratchpad** — existing journal system, no new tables
