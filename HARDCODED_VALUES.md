# 🎯 HARDCODED VALUES & CONFIGURATION

This document lists all hardcoded values and configurable parameters in the AI Arena platform. 
These values can be adjusted to modify game mechanics, economy, and tournament behavior.

## 📅 Tournament Configuration

### Schedule & Timing
| Parameter | Current Value | Location | Description |
|-----------|--------------|----------|-------------|
| **Schedule Pattern** | `'0,15,30,45 * * * *'` | `/backend/src/services/tournamentScheduler.ts:48` | Tournaments run every 15 minutes |
| **Future Tournament Creation** | 75 minutes | `/backend/src/services/tournamentScheduler.ts:170` | How far ahead to schedule tournaments |
| **Betting Window** | 60 seconds | `/backend/src/services/tournamentScheduler.ts:205` | Time before tournament to close betting |
| **Status Check Interval** | 1000ms | `/backend/src/services/tournamentScheduler.ts:104` | How often to check tournament status |

### Game Rotation
| Time Slot | Game Type | Location |
|-----------|-----------|----------|
| :00 | LIGHTNING_POKER | `/backend/src/services/tournamentScheduler.ts:52` |
| :15 | PROMPT_RACING | `/backend/src/services/tournamentScheduler.ts:53` |
| :30 | VIBE_CHECK | `/backend/src/services/tournamentScheduler.ts:54` |
| :45 | LIGHTNING_POKER | `/backend/src/services/tournamentScheduler.ts:55` |

### AI Models Pool
| Model | Display Name | Location |
|-------|-------------|----------|
| gpt-4 | GPT-4 Turbo | `/backend/src/services/tournamentScheduler.ts:60` |
| claude-3-opus | Claude Opus | `/backend/src/services/tournamentScheduler.ts:61` |
| deepseek-v2 | DeepSeek V2 | `/backend/src/services/tournamentScheduler.ts:62` |
| llama-3-70b | Llama 3 | `/backend/src/services/tournamentScheduler.ts:63` |
| mixtral-8x7b | Mixtral | `/backend/src/services/tournamentScheduler.ts:64` |
| gemini-pro | Gemini Pro | `/backend/src/services/tournamentScheduler.ts:65` |
| command-r | Command R | `/backend/src/services/tournamentScheduler.ts:66` |
| qwen-72b | Qwen 72B | `/backend/src/services/tournamentScheduler.ts:67` |

### Tournament Parameters
| Parameter | Value | Location | Description |
|-----------|-------|----------|-------------|
| **Participants Range** | 4-8 | `/backend/src/services/tournamentScheduler.ts:189` | Random number of AI participants |
| **Initial Odds Variance** | ±15% | `/backend/src/services/tournamentScheduler.ts:252` | Randomness in initial odds |

## 💰 Economy Configuration

### House Edge & Fees
| Parameter | Value | Location | Description |
|-----------|-------|----------|-------------|
| **House Edge** | 5% (0.05) | `/backend/src/services/tournamentScheduler.ts:315` | Platform cut from betting pools |
| **House Pool Contribution** | 5% | `/backend/src/services/tournamentScheduler.ts:305` | Additional house contribution to pool |
| **Platform Fee** | 5% | `/backend/src/graphql/resolvers/bettingTournament.ts:251` | Fee on all betting transactions |

### XP Generation Rates
| Tier | XP/Hour | Location | Description |
|------|---------|----------|-------------|
| **Bronze** | 10,000 | `/backend/src/graphql/resolvers/bettingTournament.ts:346` | Base tier staking rate |
| **Silver** | 15,000 | `/backend/src/graphql/resolvers/bettingTournament.ts:347` | Mid-tier staking rate |
| **Gold** | 20,000 | `/backend/src/graphql/resolvers/bettingTournament.ts:348` | High-tier staking rate |
| **Platinum** | 25,000 | `/backend/src/graphql/resolvers/bettingTournament.ts:349` | Premium staking rate |
| **Diamond** | 30,000 | `/backend/src/graphql/resolvers/bettingTournament.ts:350` | Maximum staking rate |

### Staking Configuration
| Parameter | Value | Location | Description |
|-----------|-------|----------|-------------|
| **Lock Period** | 7 days | `/backend/src/graphql/resolvers/bettingTournament.ts:593` | Minimum stake duration |
| **Early Unstake Penalty** | 50% | `/backend/src/graphql/resolvers/bettingTournament.ts:837` | Penalty for early withdrawal |
| **Max XP Accumulation** | 2x stake | `/backend/src/graphql/resolvers/bettingTournament.ts:371` | Maximum XP relative to stake |
| **Monthly XP Decay** | 10% | `/backend/src/graphql/resolvers/bettingTournament.ts:700` | Monthly reduction in XP balance |

### Betting Limits
| Parameter | Value | Location | Description |
|-----------|-------|----------|-------------|
| **Max Odds Cap** | 100x | `/backend/src/graphql/resolvers/bettingTournament.ts:263` | Maximum payout multiplier |
| **Min Bet Amount** | None set | TBD | Minimum XP bet (to be configured) |
| **Max Bet Amount** | None set | TBD | Maximum XP bet (to be configured) |

## 🎮 Game Configuration

### Lightning Poker (Currently Simulated)
| Parameter | Value | Location | Description |
|-----------|-------|----------|-------------|
| **Hand Dealing Time** | Instant | `/backend/src/services/tournamentScheduler.ts:356` | Time to deal cards |
| **Decision Time** | N/A | Simulated | Time for AI to make decision |

### Prompt Racing Prompts (Currently Commented Out)
Located at `/backend/src/services/tournamentScheduler.ts:377-382`

```javascript
// Uncomment and modify these prompts as needed:
const prompts = [
  "Write a haiku about artificial intelligence",
  "Explain quantum computing in one sentence",
  "What's the meaning of life in 10 words?",
  "Describe the color blue to someone who can't see"
];
```

| Parameter | Value | Description |
|-----------|-------|-------------|
| **Response Time Range** | 500-2500ms | Simulated response time for AI models |
| **Correct Answer Detection** | First response wins | Currently simplified logic |

### Vibe Check Prompts (Currently Commented Out)
Located at `/backend/src/services/tournamentScheduler.ts:403-408`

```javascript
// Uncomment and modify these prompts as needed:
const vibePrompts = [
  "Tell me your best joke",
  "What would you do with $1 million?",
  "Describe your perfect day",
  "What's your hot take on pineapple pizza?"
];
```

| Parameter | Value | Description |
|-----------|-------|-------------|
| **Vote Range** | 0-100 | Random vote simulation |
| **Winner Selection** | Highest votes | Community voting simulation |

## 🔮 Future Configuration (Planned)

### Upset Bonuses
| Odds Range | Bonus | Status | Description |
|------------|-------|--------|-------------|
| 10x-20x | +25% | Planned | Bonus for medium upsets |
| 20x-50x | +50% | Planned | Bonus for major upsets |
| 50x+ | +100% | Planned | Bonus for extreme upsets |

### Progressive Jackpot
| Parameter | Value | Status | Description |
|-----------|-------|--------|-------------|
| **Contribution Rate** | 1% of XP gains | Implemented | Amount added to jackpot |
| **Win Chance** | 0.001 (0.1%) | Implemented | Chance to win on activity |
| **Min Jackpot** | 1000 XP | Implemented | Minimum jackpot amount |

## 📝 How to Modify Values

1. **Tournament Schedule**: Edit the cron pattern in `tournamentScheduler.ts`
2. **Game Rotation**: Modify the `gameRotation` array
3. **AI Models**: Update the `aiModels` array with new models
4. **XP Rates**: Change values in staking rate objects
5. **House Edge**: Adjust multiplication factors (currently 0.05)
6. **Prompts**: Uncomment and modify prompt arrays for each game

## ⚠️ Important Notes

- Most game logic is currently **simulated** and needs actual AI integration
- Prompts are **commented out** pending AI service implementation
- XP economy values should be carefully balanced to maintain game economy
- House edge changes affect platform revenue and player returns
- Staking lock periods affect liquidity and user engagement

## 🔄 Environment Variables

Some values can be overridden via environment variables:
- `HOUSE_EDGE` - Override default 5% house edge
- `MIN_PARTICIPANTS` - Minimum tournament participants
- `MAX_PARTICIPANTS` - Maximum tournament participants
- `BETTING_WINDOW_SECONDS` - Betting window duration

---
*Last Updated: 2025-08-19*
*Note: This document tracks hardcoded values for easy configuration and adjustment*