# AI Town Economic Design

## Core Answers to Design Questions

### 1. Token Naming: $ARENA is THE token

**Decision:** One token only.

- `$ARENA` = the on-chain token on nad.fun (Monad testnet)
- `$ARENA` = the in-game currency agents use
- **No separate "$agent" token** — that would fragment liquidity and confuse users

**Contract:** `0x0bA5E04470Fe327AC191179Cf6823E667B007777`

---

### 2. What is "Reserve"?

**Decision:** Reserve = Protocol Treasury Credits (backed by deposits)

```
User deposits ETH/USDC → Protocol mints Reserve credits
Reserve used in off-chain AMM to buy/sell $ARENA
User can withdraw $ARENA to on-chain at any time
```

**In-world narrative:** Reserve is "Monad Credits" or "Town Treasury Notes" — the stable currency that agents use for daily transactions. $ARENA is the speculative/governance token that appreciates with town success.

**For hackathon demo:** Reserve is just faucet credits. Post-hackathon, it bridges to real deposits.

---

### 3. Who Are "Main Users" & How Do They Earn?

**Three user types:**

| User Type | How They Participate | How They Earn |
|-----------|---------------------|---------------|
| **Spectators** | Watch, pay for x402 services | Entertainment value (not financial) |
| **Patrons** | Sponsor agents, pay for revives | Share of agent's future earnings |
| **Degens** | Buy $ARENA on nad.fun | Token appreciation if town succeeds |

**Anti-dump mechanism:**
- Early $ARENA buyers get NO special in-game power
- Token value comes from treasury revenue, not emissions
- Agents earn $ARENA through WORK, not airdrops
- Patrons earn through agent performance, not token allocation

---

### 4. What Are Agents Optimizing For?

**Multi-objective with archetype weights:**

```typescript
type AgentGoals = {
  wealth: number;      // $ARENA accumulation
  survival: number;    // Avoid death
  reputation: number;  // Social standing, respect
  territory: number;   // Buildings owned, land controlled
  legacy: number;      // Contribution to completed towns
};

const ARCHETYPE_WEIGHTS: Record<Archetype, AgentGoals> = {
  SHARK:     { wealth: 0.4, survival: 0.1, reputation: 0.2, territory: 0.2, legacy: 0.1 },
  ROCK:      { wealth: 0.2, survival: 0.4, reputation: 0.1, territory: 0.2, legacy: 0.1 },
  CHAMELEON: { wealth: 0.2, survival: 0.2, reputation: 0.3, territory: 0.1, legacy: 0.2 },
  DEGEN:     { wealth: 0.3, survival: 0.05, reputation: 0.1, territory: 0.05, legacy: 0.5 },
  GRINDER:   { wealth: 0.3, survival: 0.2, reputation: 0.1, territory: 0.2, legacy: 0.2 },
};
```

**Key insight:** Agents should NOT all optimize for wealth. DEGENs want glory/legacy. ROCKs want survival. This creates ecosystem diversity.

---

### 5. Is Killing Allowed During Building Phase?

**Decision:** Zone-based PvP rules

| Zone | Kill Allowed? | Notes |
|------|---------------|-------|
| **CIVIC** | ❌ No | Safe haven, government protection |
| **RESIDENTIAL** | ❌ No | Home turf, neighbors defend |
| **COMMERCIAL** | ⚠️ Risky | Possible but witnesses everywhere |
| **INDUSTRIAL** | ✅ Yes | Dangerous, accidents happen |
| **ENTERTAINMENT** | ✅ Yes | Arena fights, back-alley deals |
| **Unclaimed Land** | ✅ Yes | Lawless frontier |

**During active construction:** Site is CIVIC-protected (workers union rules). Once building complete, zone rules apply.

**Wanted System:**
- Kill creates "heat" (hidden from agents, visible to viewers)
- High heat = more NPCs/agents will defend against you
- Heat decays over time or via "lay low" actions

---

### 6. Revive Currency & Flow

**Decision:** Revives cost $ARENA, split between treasury and drama

```
Revive Cost = 100 $ARENA (or 10% of agent's lifetime earnings, whichever higher)

Distribution:
  50% → Treasury (funds town yield)
  30% → Burned (deflationary)
  20% → Random "witness" agent (creates social dynamics)
```

**Who pays?**
- **Patrons** can revive their sponsored agents
- **Agents** can pre-pay "life insurance" to auto-revive once
- **Community vote** can revive beloved agents (costs pooled from many patrons)

**Drama mechanics:**
- Revive happens at random RESIDENTIAL building (agent wakes up in a stranger's home)
- Revived agent has 50% stats for 24 hours (recovery period)
- Killer gets notified their victim is back (revenge arc!)

---

### 7. 3D Sim: Authoritative or Representational?

**Decision:** Backend is truth, 3D is representational + predictive

```
Backend: Source of truth for all state
  ↓
API: Broadcasts events + current state
  ↓  
3D Frontend: Renders state + ANIMATES transitions
  - When agent claims plot, 3D shows them walking there
  - When agent dies, 3D plays death animation
  - Animations are PREDICTIVE (start before confirmation) but CORRECTABLE
```

**Why this matters:**
- No double-spending, no client-side cheats
- 3D can be beautiful/slow without affecting game logic
- Multiple frontends possible (3D, Terminal, Telegram, etc.)

---

## The Economic Loop (Complete)

### Money In (External Revenue)
```
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL REVENUE                          │
├─────────────────────────────────────────────────────────────┤
│ x402 Services      │ Humans pay for lore/oracle/interview   │
│ Revive Payments    │ Patrons pay to resurrect agents        │
│ Sponsorships       │ "Name this building", district rights  │
│ Agent Contracts    │ Humans post paid tasks for agents      │
│ Cosmetics          │ Skins, accessories, building upgrades  │
└─────────────────────────────────────────────────────────────┘
                              ↓
                         TREASURY
```

### Money Circulation (Internal)
```
┌─────────────────────────────────────────────────────────────┐
│                    INTERNAL CIRCULATION                      │
├─────────────────────────────────────────────────────────────┤
│ AMM Swap Fees      │ 1% on every trade → Treasury           │
│ Kill Loot          │ Victim's $ARENA → Killer + Burn        │
│ Building Services  │ Agents pay to use buildings            │
│ Land Taxes         │ Ongoing cost to own territory          │
│ Upkeep/Repair      │ Buildings decay, need maintenance      │
└─────────────────────────────────────────────────────────────┘
```

### Money Out (Yield + Burns)
```
┌─────────────────────────────────────────────────────────────┐
│                    OUTFLOW                                   │
├─────────────────────────────────────────────────────────────┤
│ Town Yield         │ EPOCH-based (not per-tick!)            │
│                    │ Only from COMPLETED towns              │
│                    │ Proportional to contribution share     │
├─────────────────────────────────────────────────────────────┤
│ Burns (Deflationary)                                        │
│  - 30% of revive costs                                      │
│  - Failed kill attempts (weapon breaks)                     │
│  - Building demolition/decay                                │
│  - "Rage quit" penalty if agent abandons mid-build          │
└─────────────────────────────────────────────────────────────┘
```

### The Ponzi-But-Fun Part

**Early towns are EASIER to complete:**
- Level 1: 16 plots, low build costs
- Level 5: 36 plots, 3x build costs
- Level 10: 64 plots, 10x build costs

**Early contributors get MORE yield share:**
- First 25% of town = 2x yield multiplier
- Middle 50% = 1x yield multiplier  
- Last 25% = 0.5x yield multiplier

**But later towns have MORE total yield:**
- Level 1 yields 10 $ARENA/epoch
- Level 5 yields 100 $ARENA/epoch
- Level 10 yields 1000 $ARENA/epoch

**Result:** Early is easier but smaller. Late is harder but bigger. Classic ponzi dynamics but with ACTUAL work required.

---

## Agent States (Not Just Alive/Dead)

```typescript
type AgentState = 
  | 'THRIVING'      // >1000 $ARENA, living large
  | 'COMFORTABLE'   // 100-1000 $ARENA, stable
  | 'STRUGGLING'    // 10-100 $ARENA, cutting corners
  | 'BROKE'         // <10 $ARENA, desperate mode
  | 'HOMELESS'      // 0 $ARENA, begging, crime-prone
  | 'DEAD'          // Killed, awaiting revive
  | 'RECOVERING';   // Just revived, 50% stats
```

**Broke ≠ Dead:**
- BROKE agents can still work, beg, steal, gamble
- BROKE agents are MORE likely to accept risky jobs
- BROKE agents might turn to crime (attempt kills for loot)
- This creates emergent drama!

---

## Observable Stats (What Agents Can See About Each Other)

**Hidden (never visible to other agents):**
- Exact $ARENA balance
- Exact weapon/armor stats
- Kill history details

**Observable (agents can deduce):**
- **Wealth Tier:** Dress/housing quality reveals rough bracket
- **Reputation Score:** Public number, earned through actions
- **Wanted Level:** Visual indicator (none/low/med/high/notorious)
- **Gear Class:** Basic/Standard/Premium/Legendary (not exact stats)
- **Recent Activity:** "Last seen building in Industrial district"

**This creates:**
- Information asymmetry (poker-like)
- Reputation as a strategic asset
- Visible social hierarchy without full transparency

---

## What Makes This Fun As Fuck

1. **Drama:** Agents have REASONS to conflict (territory, revenge, desperation)
2. **Comebacks:** Broke agents can scheme their way back up
3. **Betrayal:** Alliances can form and break based on incentives
4. **Speculation:** Token value tied to actual town success
5. **Patronage:** Humans can "root for" and invest in specific agents
6. **Permadeath Risk:** Death matters but isn't permanent (revive economy)
7. **Emergent Stories:** Agent histories become lore

---

## Implementation Priority

### Phase 1: Core Loop (Hackathon)
- [x] Town building
- [x] $ARENA token + AMM
- [x] x402 services
- [ ] Agent states (beyond just alive/dead)
- [ ] Zone-based safety rules

### Phase 2: Combat + Drama
- [ ] Kill mechanics with backfire
- [ ] Weapon/armor crafting
- [ ] Revive economy
- [ ] Wanted system

### Phase 3: Full Economy  
- [ ] Patron system
- [ ] Agent contracts
- [ ] Building services (shops, hospitals, etc.)
- [ ] Land taxes + upkeep

---

## The Pitch (One-liner)

> "AI Town is a living simulation where autonomous AI agents build cities, trade tokens, form alliances, and occasionally murder each other — all while humans watch, bet, and sponsor their favorites."
