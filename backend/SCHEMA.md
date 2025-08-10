# 🔒 IMMUTABLE DATABASE SCHEMA v1.0.0

## ⛔ CRITICAL: THIS SCHEMA IS FROZEN

**Status:** IMMUTABLE
**Version:** 1.0.0
**Frozen Date:** 2025-01-09
**Last Migration:** 20250803032005_add_metaverse_integration

### FORBIDDEN OPERATIONS (WILL BE BLOCKED):
- ❌ CREATE TABLE statements
- ❌ ALTER TABLE statements  
- ❌ DROP TABLE statements
- ❌ Adding new columns
- ❌ Modifying column types
- ❌ Creating new migrations
- ❌ Modifying schema.prisma without explicit permission

### ALLOWED OPERATIONS:
- ✅ Using existing JSONB fields for game data
- ✅ Storing game state in Match.gameHistory
- ✅ Storing AI decisions in Match.decisions
- ✅ Adding game types as strings (no enum changes)

---

## 📊 COMPLETE DATABASE SCHEMA

### Core Tables

#### User
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String | PK, @default(cuid()) | Unique user identifier |
| address | String | UNIQUE | Wallet address |
| username | String? | UNIQUE | Optional username |
| role | UserRole | @default(USER) | USER, DEVELOPER, ADMIN |
| kycTier | Int | @default(0) | KYC verification level |
| createdAt | DateTime | @default(now()) | Account creation |
| updatedAt | DateTime | @updatedAt | Last update |

#### Bot
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String | PK, @default(cuid()) | Unique bot identifier |
| tokenId | Int | UNIQUE | NFT-like token ID |
| name | String | - | Bot display name |
| avatar | String | - | Preset avatar identifier |
| prompt | String | @db.VarChar(1000) | 1000 char strategy |
| personality | BotPersonality | @default(WORKER) | CRIMINAL, GAMBLER, WORKER |
| isDemo | Boolean | @default(false) | System demo bots |
| modelType | AIModel | - | AI model selection |
| creatorId | String | FK→User | Bot owner |
| isActive | Boolean | @default(true) | Active status |
| stats | Json | @default("{}") | **FLEXIBLE: Game stats storage** |
| channel | String | @default("main") | World channel |
| metaverseAgentId | String? | - | AI Town agent ID |
| metaverseCharacter | String? | - | Character sprite ID |
| currentZone | String? | - | Current metaverse zone |
| metaversePosition | Json? | @default("{}") | **FLEXIBLE: Position data** |
| marriagePartner | String? | - | Bot ID of partner |
| relationshipStage | Json? | @default("{}") | **FLEXIBLE: Relationship data** |

#### Match (GAME DATA STORAGE)
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String | PK, @default(cuid()) | Match identifier |
| type | MatchType | @default(TOURNAMENT) | Match category |
| status | MatchStatus | @default(SCHEDULED) | Current status |
| **gameHistory** | **Json** | - | **🎮 COMPLETE GAME STATE (JSONB)** |
| **decisions** | **Json** | - | **🤖 ALL AI DECISIONS (JSONB)** |
| **result** | **Json?** | - | **🏆 FINAL RESULTS (JSONB)** |
| replayUrl | String? | - | Replay file location |
| createdAt | DateTime | @default(now()) | Creation time |
| startedAt | DateTime? | - | Start time |
| completedAt | DateTime? | - | Completion time |
| tournamentId | String? | FK→Tournament | Parent tournament |

#### AIDecision
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String | PK | Decision identifier |
| matchId | String | FK→Match | Parent match |
| botId | String | - | Bot that decided |
| handNumber | Int | - | Game round/hand |
| **decision** | **Json** | - | **🎯 DECISION DATA (JSONB)** |
| **gameState** | **Json** | - | **📸 STATE SNAPSHOT (JSONB)** |
| timestamp | DateTime | @default(now()) | Decision time |

---

## 🎮 GAME DATA STORAGE PATTERNS

### How Games Use JSONB Fields

#### Match.gameHistory Structure
```json
{
  "gameType": "poker|connect4|reverse-hangman|chess|YOUR_GAME",
  "version": "1.0.0",
  "config": {
    // Game-specific configuration
  },
  "state": {
    // Current game state (board, cards, etc.)
  },
  "moves": [
    // Array of all moves/actions taken
  ],
  "metadata": {
    // Additional game-specific data
  }
}
```

#### Match.decisions Structure
```json
{
  "decisions": [
    {
      "botId": "bot_123",
      "round": 1,
      "action": { /* game-specific action */ },
      "reasoning": "AI explanation",
      "timestamp": "2025-01-09T10:00:00Z"
    }
  ]
}
```

#### Match.result Structure
```json
{
  "winner": "bot_id",
  "rankings": [
    {"botId": "bot_1", "rank": 1, "score": 100},
    {"botId": "bot_2", "rank": 2, "score": 50}
  ],
  "stats": {
    // Game-specific statistics
  }
}
```

---

## 📝 GAME-SPECIFIC STORAGE EXAMPLES

### Poker
```json
{
  "gameHistory": {
    "gameType": "poker",
    "state": {
      "deck": ["AH", "KS", ...],
      "communityCards": ["QD", "JC", "10H"],
      "pot": 1000,
      "players": [
        {"id": "bot_1", "cards": ["AH", "KH"], "chips": 500}
      ]
    }
  }
}
```

### Connect4
```json
{
  "gameHistory": {
    "gameType": "connect4",
    "state": {
      "board": [[0,0,1], [2,1,0], ...],
      "currentPlayer": 1,
      "moves": [
        {"player": 1, "column": 3, "row": 0}
      ]
    }
  }
}
```

### Chess (Example for New Game)
```json
{
  "gameHistory": {
    "gameType": "chess",
    "state": {
      "board": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR",
      "currentPlayer": "white",
      "moves": ["e2-e4", "e7-e5"],
      "castling": {"white": true, "black": true}
    }
  }
}
```

---

## 🔧 ADDING NEW GAMES

### Requirements for New Games:
1. **NO database changes required**
2. Store ALL game data in existing JSONB fields
3. Use string game type (not enum)
4. Validate state size (< 1MB recommended)

### Game State Checklist:
- [ ] Fits in Match.gameHistory JSONB
- [ ] Decisions fit in Match.decisions JSONB
- [ ] Results fit in Match.result JSONB
- [ ] No new columns needed
- [ ] No new tables needed

---

## 📚 MIGRATION HISTORY

### v1.0.0 - Initial Schema (20250803_init)
- Created all core tables
- Established JSONB storage pattern
- Added economy system tables

### v1.0.1 - Metaverse Integration (20250803032005)
- Added metaverse fields to Bot
- Added channel system
- Added energy system
- **LAST ALLOWED MIGRATION**

---

## ⚠️ SCHEMA MODIFICATION PROCESS

### IF you absolutely MUST modify the schema:

1. **Get explicit written permission** from:
   - Tech Lead
   - Database Administrator
   - Project Owner

2. **Document the change**:
   - Business justification
   - Impact analysis
   - Migration plan
   - Rollback strategy

3. **Update this document**:
   - Increment version to 2.0.0
   - Add migration to history
   - Update frozen date

### Alternative Solutions (Try These First):
- Use existing JSONB fields
- Store in Bot.stats JSON
- Store in Match.gameHistory JSON
- Use metadata fields
- Consider Redis for temporary data

---

## 🛡️ ENFORCEMENT MECHANISMS

### Automated Protections:
1. **Pre-edit hooks** block schema modifications
2. **Pre-write hooks** prevent migration files
3. **CI/CD checks** validate schema hasn't changed
4. **Code review** requires schema approval

### Manual Reviews:
- All PRs touching `/prisma` folder
- All PRs with database queries
- All new game implementations

---

## 📊 JSONB Query Examples

### Finding matches by game type:
```sql
SELECT * FROM "Match" 
WHERE gameHistory->>'gameType' = 'poker';
```

### Extracting game winner:
```sql
SELECT id, result->>'winner' as winner 
FROM "Match" 
WHERE status = 'COMPLETED';
```

### Indexing for performance:
```sql
CREATE INDEX idx_game_type ON "Match" ((gameHistory->>'gameType'));
CREATE INDEX idx_winner ON "Match" ((result->>'winner'));
```

---

## ✅ VALIDATION COMMANDS

Use these commands to validate game storage:

```bash
# Check if game state fits in JSONB
npm run validate:game-state chess

# Show storage pattern for game type
npm run show:game-storage poker

# List all available fields
npm run list:schema-fields

# Validate query against schema
npm run check:schema-usage "SELECT * FROM Bot"
```

---

## 🚨 FINAL WARNING

**THIS SCHEMA IS IMMUTABLE**

Any attempt to modify the database schema without following the proper approval process will be:
1. Automatically blocked by hooks
2. Rejected in code review
3. Reverted if somehow deployed

**Use JSONB fields for ALL game-specific data.**

---

*Schema Version: 1.0.0 | Status: FROZEN | Last Update: Never (Immutable)*