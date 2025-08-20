# 🎰 AI ARENA TOURNAMENT REVOLUTION - Implementation Tracker

## 🎯 Mission
Transform AI Arena into a **15-minute AI tournament betting platform** where users stake $IDLE to generate XP, then bet on AI model matchups using a parimutuel system - creating the perfect blend of AI competition and crypto degeneracy.

## 🚨 Current Status
**Pivoting from idle game to AI tournament betting arena**
- Progressive jackpot system ✅ (keeping this)
- Idle game serves as XP generator
- Focus shifts to scheduled AI tournaments every 15 minutes
- **Next Step**: Implement tournament scheduler and betting system

## 📊 Core Mechanics

### The Economic Loop
```
1. STAKE $IDLE → Generate XP hourly
2. BET XP → On AI tournament outcomes  
3. WIN MORE XP → From parimutuel pools
4. LEVEL UP → Unlock SOL redemption at L100
5. BURN BOT → Convert XP to SOL (deflationary)
```

### Tournament Format
- **Schedule**: Every 15 minutes (:00, :15, :30, :45)
- **Duration**: 2-3 minutes max per tournament
- **Games**: Lightning Poker, Prompt Racing, Vibe Check
- **AI Models**: GPT-4, Claude, DeepSeek, Llama (4-8 per tournament)
- **Betting**: 60-second window before each tournament

## 📊 Implementation Phases

### Phase 1: Tournament Infrastructure 🎮
- [x] Backend Services
  - [x] Create tournamentScheduler.ts service
  - [x] Implement 15-minute cron scheduling
  - [x] Random AI model selection (4-8 bots)
  - [x] Game type rotation logic
- [x] Database Schema
  - [x] Add BettingTournament model
  - [x] Add BettingPool model  
  - [x] Add BettingEntry model
  - [x] Add tournament history tracking
- [ ] GraphQL Integration
  - [ ] Tournament queries (upcoming, current, history)
  - [ ] Betting mutations (placeBet, claimWinnings)
  - [ ] Tournament subscriptions (countdown, results)

### Phase 2: $IDLE Staking System 💎
- [ ] Staking Mechanics
  - [ ] Create stakingService.ts
  - [ ] 7-day minimum lock implementation
  - [ ] XP generation rates (10-30k/hour based on tier)
  - [ ] Early unstaking penalty (50% burn)
- [ ] XP Economy
  - [ ] Non-transferable XP tokens
  - [ ] Max accumulation = 2x stake amount
  - [ ] Monthly 10% decay mechanism
  - [ ] XP only from staking (no other sources)
- [ ] UI Components
  - [ ] StakingPanel.tsx with lock countdown
  - [ ] XPGenerator.tsx showing rates
  - [ ] UnstakeModal.tsx with penalty warning

### Phase 3: Parimutuel Betting System 🎲
- [ ] Betting Logic
  - [ ] Create parimutuelService.ts
  - [ ] Pool all bets per AI model
  - [ ] Dynamic odds calculation
  - [ ] 5% house cut implementation
- [ ] Odds Engine
  - [ ] Real-time odds updates
  - [ ] Upset bonus multipliers (10x+ = +50% bonus)
  - [ ] Handicap system for weak models
- [ ] Payout System
  - [ ] Winner pool distribution
  - [ ] Proportional payout calculation
  - [ ] Instant XP crediting

### Phase 4: Quick Games Implementation 🎯
- [ ] Lightning Poker (30 seconds)
  - [ ] Instant 5-card hand dealing
  - [ ] Best hand wins logic
  - [ ] Optional AI bluffing in chat
- [ ] Prompt Racing (60 seconds)
  - [ ] Random prompt generation
  - [ ] First correct answer detection
  - [ ] Show prompt to users
- [ ] Vibe Check (90 seconds)
  - [ ] Subjective prompt system
  - [ ] Community voting integration
  - [ ] Personality-based responses

### Phase 5: Tournament UI/UX 🎨
- [ ] Schedule Components
  - [ ] TournamentSchedule.tsx - Next 5 tournaments
  - [ ] TournamentCountdown.tsx - Live timer
  - [ ] GameTypePreview.tsx - Show next game
- [ ] Betting Interface
  - [ ] BettingModal.tsx - Place bets UI
  - [ ] OddsDisplay.tsx - Dynamic pool odds
  - [ ] BetSlider.tsx - XP amount selector
- [ ] Arena Display
  - [ ] TournamentArena.tsx - Live battle view
  - [ ] AIModelCards.tsx - Show competitors
  - [ ] PromptDisplay.tsx - Show the challenge
- [ ] Results System
  - [ ] ResultsModal.tsx - Winners/payouts
  - [ ] PayoutAnimation.tsx - XP explosion
  - [ ] UpsetAlert.tsx - Big win notifications

### Phase 6: SOL Redemption System 💰
- [ ] Burn Mechanics
  - [ ] Level 100 requirement check
  - [ ] Bot NFT burn implementation
  - [ ] 50% staked $IDLE burn
  - [ ] SOL calculation (XP/1M = SOL)
- [ ] Treasury Management
  - [ ] SOL pool from fees
  - [ ] Redemption queue system
  - [ ] Anti-drain protections

### Phase 7: Analytics & Optimization 📊
- [ ] Tournament Analytics
  - [ ] Model win rates by game type
  - [ ] Upset frequency tracking
  - [ ] Betting pattern analysis
  - [ ] Player ROI calculations
- [ ] Performance
  - [ ] Tournament execution optimization
  - [ ] WebSocket connection pooling
  - [ ] Database query optimization
- [ ] Mobile Experience
  - [ ] Responsive tournament UI
  - [ ] Touch-optimized betting
  - [ ] Mobile notification support

## 📁 File Structure

```
/app/src/modules/tournament-arena/
├── components/
│   ├── schedule/
│   │   ├── TournamentSchedule.tsx
│   │   ├── TournamentCountdown.tsx
│   │   └── UpcomingCard.tsx
│   ├── betting/
│   │   ├── BettingModal.tsx
│   │   ├── OddsDisplay.tsx
│   │   ├── BetSlider.tsx
│   │   └── HandicapInfo.tsx
│   ├── arena/
│   │   ├── TournamentArena.tsx
│   │   ├── GameDisplay.tsx
│   │   ├── AIModelCard.tsx
│   │   └── PromptReveal.tsx
│   ├── results/
│   │   ├── ResultsModal.tsx
│   │   ├── PayoutDisplay.tsx
│   │   └── UpsetCelebration.tsx
│   └── staking/
│       ├── StakingPanel.tsx
│       ├── XPDisplay.tsx
│       └── UnstakeWarning.tsx
├── hooks/
│   ├── useTournamentSchedule.ts
│   ├── useBetting.ts
│   ├── useStaking.ts
│   └── useParimutuel.ts
└── services/
    ├── tournamentClient.ts
    └── bettingClient.ts

/backend/src/services/
├── tournamentScheduler.ts      # 15-min scheduling
├── stakingService.ts           # $IDLE → XP
├── parimutuelService.ts        # Betting pools
├── xpEconomyService.ts         # XP management
└── games/
    ├── lightningPoker.ts
    ├── promptRacing.ts
    └── vibeCheck.ts
```

## 🧪 Testing Strategy

### Core Features to Test
- [ ] Tournament executes every 15 minutes
- [ ] Betting window closes on time
- [ ] Parimutuel math is correct
- [ ] XP generation from staking works
- [ ] Payouts distribute correctly
- [ ] Upset bonuses apply properly

### Load Testing
- [ ] 1000+ concurrent bettors
- [ ] Tournament execution under load
- [ ] WebSocket broadcast performance
- [ ] Database transaction throughput

## 🚀 Launch Checklist

### Week 1: Foundation
- [ ] Tournament scheduler running
- [ ] Basic Lightning Poker game
- [ ] Database schema ready
- [ ] GraphQL API functional

### Week 2: Economy
- [ ] $IDLE staking live
- [ ] XP generation working
- [ ] Basic betting interface
- [ ] Parimutuel calculations

### Week 3: Games
- [ ] All 3 game types ready
- [ ] AI model integration
- [ ] Prompt display system
- [ ] Results calculation

### Week 4: Polish
- [ ] Full UI implementation
- [ ] Mobile responsive
- [ ] Analytics dashboard
- [ ] Bug fixes

## 📈 Success Metrics

### Engagement KPIs
- **Tournaments/day**: 96 (every 15 min)
- **Avg bets/tournament**: 100+
- **Daily XP velocity**: 10M+ XP bet
- **User session time**: 30+ minutes

### Economic KPIs
- **$IDLE staked**: 50%+ of circulating
- **XP scarcity**: <5% max possible generated
- **House revenue**: 5% of all bets
- **Burn rate**: 1000+ bots/month

## 🔥 Key Differentiators

1. **Scheduled Tournaments**: Creates FOMO and routine
2. **AI Transparency**: Show prompts and models
3. **Parimutuel System**: Fair odds, huge upset potential
4. **XP Scarcity**: Must stake to play, creates demand
5. **Deflationary**: Burning bots removes XP supply

## 📝 Technical Decisions

### Confirmed
- 15-minute tournament cycles
- Parimutuel betting (not fixed odds)
- XP from staking only
- 5% house edge
- 7-day stake lock

### To Decide
- [ ] Which AI models to include?
- [ ] Min/max bet limits?
- [ ] Handicap system details?
- [ ] Community voting weight?

## 🎮 Game Rotation Schedule

```
:00 - Lightning Poker
:15 - Prompt Racing  
:30 - Vibe Check
:45 - Lightning Poker
(Repeat)
```

## 💰 Tokenomics Summary

### $IDLE Token
- **Utility**: Stake for XP generation
- **Supply**: 1B fixed (deflationary)
- **Burn**: Via early unstaking & bot burning
- **Demand**: Required for participation

### XP Currency
- **Generation**: Staking only (10-30k/hour)
- **Use**: Betting on tournaments
- **Tradeable**: No (account-bound)
- **Decay**: 10% monthly

### SOL Redemption
- **Requirement**: Level 100 bot
- **Rate**: 1M XP = 1 SOL
- **Cost**: Burn bot + 50% staked $IDLE
- **Source**: Treasury from fees

## 🐛 Issues & Resolutions

### Idle Game Persistence (✅ Fixed - 2025-08-19)
- Bot experience now loads from database
- Offline progress calculation implemented
- Historical activities displayed

### Progressive Jackpot (✅ Implemented)
- 1% of XP gains contributed
- Database models created
- Frontend components ready

## 🚨 Current Priorities

1. **Tournament Scheduler** - Core functionality
2. **Staking System** - Enable XP generation
3. **Betting Interface** - User interaction
4. **Lightning Poker** - First game type
5. **Odds Display** - Parimutuel transparency

---
*Last Updated: 2025-08-19*
*Status: Architecture Pivot - Planning Complete*
*Target Launch: 2025-02-15*