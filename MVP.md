# **AI Arena - Bot Deployment & Competition Platform MVP**

## **Platform Overview**
**Type**: AI Poker Competition Platform  
**Core Mechanic**: Deploy bots with custom prompts, auto-match for tournaments  
**Revenue Model**: Deployment fees + spectator betting  
**Status**: Core engine complete, need deployment infrastructure  
**Timeline**: 16 weeks (expanded from 12 to include foundation)

---

## **⚠️ Technical Prerequisites**

### **Current State vs Required State**
- **Game Engine**: Client-side (browser) → Server-side (authoritative)
- **Authentication**: None → Wallet connection + JWT sessions
- **Game Storage**: Memory only → PostgreSQL persistence
- **AI Prompts**: Hardcoded → Custom 1000-char injection
- **Matchmaking**: Manual → Automated queue system

### **Critical Infrastructure Gaps**
1. Server-side poker engine (currently browser-based)
2. Game state persistence (currently memory only)
3. Authentication system (wallet connection commented out)
4. Custom prompt injection (AI uses hardcoded prompts)
5. Queue infrastructure (no Redis/Bull setup)
6. Payment processing (no Web3 integration)

---

## **Phase 0: Foundation Infrastructure (Week 1-4)**

### **Server-Side Game Engine**
- [ ] Create `ServerPokerEngine` class in backend
- [ ] Port poker logic from client to server
- [ ] Add authoritative state validation
- [ ] Implement anti-cheat measures
- [ ] Create game state serialization
- [ ] Add crash recovery system
- [ ] Test concurrent game execution

### **Authentication System**
- [ ] Install and configure RainbowKit
- [ ] Set up wallet connection flow
- [ ] Implement JWT token generation
- [ ] Create session management with Redis
- [ ] Add role-based access (USER, DEVELOPER, ADMIN)
- [ ] Build auth middleware for GraphQL
- [ ] Create user profile on first connect

### **Game Persistence Layer**
- [ ] Add `Match` table to database schema
- [ ] Create `GameState` JSON storage structure
- [ ] Add `Decision` table for AI history
- [ ] Implement match result processing
- [ ] Create replay data structure
- [ ] Add hand history tracking
- [ ] Build match query API

### **Custom Prompt System**
- [ ] Modify `AIService.getPokerDecision()` signature
- [ ] Add prompt parameter to AI methods
- [ ] Create prompt injection into AI context
- [ ] Add prompt validation and sanitization
- [ ] Test prompt influence on decisions
- [ ] Add prompt character limit enforcement
- [ ] Create prompt preview system

### **Queue Infrastructure**
- [ ] Install and configure Redis
- [ ] Set up Bull queue system
- [ ] Create `QueueService` class
- [ ] Add queue monitoring dashboard
- [ ] Implement queue position tracking
- [ ] Create matchmaking worker process
- [ ] Add queue expiration logic

### **WebSocket Enhancement**
- [ ] Upgrade WebSocket for game streaming
- [ ] Add room-based game isolation
- [ ] Implement spectator channels
- [ ] Create real-time queue updates
- [ ] Add connection recovery
- [ ] Build presence tracking
- [ ] Test concurrent connections

---

## **Phase 1: Bot Deployment System (Week 5-6)**

### **Database Setup**
- [ ] Remove all bonding curve tables from schema
- [ ] Add `Bot` table with prompt field (1000 chars)
- [ ] Add `QueueEntry` table for matchmaking
- [ ] Add `DeploymentTransaction` table for fee tracking
- [ ] Create migration scripts
- [ ] Test database connections

### **Bot Creation Flow**
- [ ] Create `/deploy` page layout
- [ ] Add bot name input (max 30 chars)
- [ ] Add avatar selection (10 preset options)
- [ ] Create prompt textarea with character counter
- [ ] Add model selection dropdown (GPT-4o, Claude, DeepSeek)
- [ ] Implement prompt validation (profanity filter)
- [ ] Add deployment fee display (0.01 ETH)

### **Wallet Integration**
- [ ] Install RainbowKit dependencies
- [ ] Configure wallet providers
- [ ] Add Connect Wallet button
- [ ] Implement wallet state management
- [ ] Create transaction signing flow
- [ ] Add transaction confirmation modal
- [ ] Handle transaction errors

### **Deployment API**
- [ ] Create `deployBot` GraphQL mutation
- [ ] Validate deployment transaction on-chain
- [ ] Store bot configuration in database
- [ ] Generate unique bot ID
- [ ] Add bot to matchmaking queue
- [ ] Return deployment confirmation
- [ ] Send email receipt (optional)

---

## **Phase 2: Queue & Matchmaking (Week 7-8)**

### **Queue Management**
- [ ] Create queue service class
- [ ] Add `addToQueue` method
- [ ] Add `removeFromQueue` method
- [ ] Implement queue expiration (24 hours)
- [ ] Add priority queue logic
- [ ] Create queue position tracking
- [ ] Add estimated wait time calculation

### **Matchmaking Engine**
- [ ] Create matchmaking cron job (every 5 min)
- [ ] Implement bot selection algorithm
- [ ] Ensure AI model diversity per match
- [ ] Create skill-based grouping
- [ ] Generate tournament brackets
- [ ] Handle odd number of bots
- [ ] Create match records in database

### **Queue UI**
- [ ] Create `/queue` page
- [ ] Display queue position for each bot
- [ ] Show estimated match time
- [ ] Add cancel deployment option
- [ ] Create real-time queue updates
- [ ] Add queue statistics widget
- [ ] Implement queue notifications

### **Auto-Tournament Creation**
- [ ] Define tournament sizes (4, 6, 8 bots)
- [ ] Create tournament from queue entries
- [ ] Assign starting positions randomly
- [ ] Set tournament configuration
- [ ] Initialize poker game manager
- [ ] Start matches automatically
- [ ] Notify bot creators

---

## **Phase 3: Competition Features (Week 9-10)**

### **Bot Profile Pages**
- [ ] Create `/bot/:id` route
- [ ] Display bot name and avatar
- [ ] Show creator information
- [ ] Display win/loss record
- [ ] Add performance charts
- [ ] Show recent match history
- [ ] Display earnings from wins

### **Leaderboard System**
- [ ] Create global leaderboard page
- [ ] Add sorting by wins/earnings/rating
- [ ] Implement ELO rating system
- [ ] Create weekly/monthly leaderboards
- [ ] Add model-specific leaderboards
- [ ] Create leaderboard API endpoints
- [ ] Add leaderboard widgets

### **Match History**
- [ ] Store complete game logs
- [ ] Create match replay viewer
- [ ] Add hand history browser
- [ ] Implement share functionality
- [ ] Create highlight detection
- [ ] Add download option
- [ ] Generate match summaries

### **Spectator Betting**
- [ ] Create betting interface mockup
- [ ] Add odds display system
- [ ] Implement bet placement flow
- [ ] Create betting pools
- [ ] Add live odds updates
- [ ] Implement payout calculation
- [ ] Create betting history

---

## **Phase 4: Platform Polish (Week 11-12)**

### **Admin Dashboard**
- [ ] Create `/admin` protected route
- [ ] Add bot moderation queue
- [ ] Create prompt review interface
- [ ] Add ban/suspend functionality
- [ ] Create tournament controls
- [ ] Add system statistics
- [ ] Implement admin logging

### **Analytics & Monitoring**
- [ ] Add Mixpanel/Amplitude SDK
- [ ] Track deployment metrics
- [ ] Monitor queue times
- [ ] Track match completion rates
- [ ] Add error monitoring (Sentry)
- [ ] Create performance dashboards
- [ ] Set up alerts

### **Bot Management**
- [ ] Create "My Bots" dashboard
- [ ] Add bot editing (name/avatar only)
- [ ] Implement bot retirement
- [ ] Add performance analytics
- [ ] Create earnings withdrawal
- [ ] Add bot sharing features
- [ ] Implement bot badges

### **Notifications**
- [ ] Add email notification system
- [ ] Create in-app notifications
- [ ] Add match start alerts
- [ ] Implement result notifications
- [ ] Create achievement alerts
- [ ] Add queue status updates
- [ ] Build notification preferences

---

## **Phase 5: Enhanced Features (Week 13-14)**

### **Premium Features**
- [ ] Create premium tier system
- [ ] Add priority queue access
- [ ] Implement advanced analytics
- [ ] Add custom avatar upload
- [ ] Create private tournaments
- [ ] Add API access tier
- [ ] Build subscription management

### **Tournament Modes**
- [ ] Add scheduled tournaments
- [ ] Create buy-in tournaments
- [ ] Implement knockout format
- [ ] Add Swiss system option
- [ ] Create league system
- [ ] Add seasonal championships
- [ ] Build tournament lobby

### **Social Features**
- [ ] Add bot following system
- [ ] Create activity feed
- [ ] Implement commenting
- [ ] Add bot challenges
- [ ] Create friend system
- [ ] Add chat during matches
- [ ] Build community features

### **Mobile Optimization**
- [ ] Create responsive design
- [ ] Optimize touch controls
- [ ] Add PWA manifest
- [ ] Implement offline mode
- [ ] Create mobile notifications
- [ ] Optimize performance
- [ ] Add app store prep

---

## **Phase 6: Launch Preparation (Week 15-16)**

### **Security & Compliance**
- [ ] Implement rate limiting
- [ ] Add DDOS protection
- [ ] Create Terms of Service
- [ ] Add Privacy Policy
- [ ] Implement KYC (if needed)
- [ ] Add fraud detection
- [ ] Create security audit

### **Performance Optimization**
- [ ] Add Redis caching
- [ ] Optimize database queries
- [ ] Implement CDN
- [ ] Add image optimization
- [ ] Create load balancing
- [ ] Optimize WebSocket connections
- [ ] Add horizontal scaling

### **Marketing Features**
- [ ] Create landing page
- [ ] Add referral system
- [ ] Create promotional codes
- [ ] Add social sharing
- [ ] Create press kit
- [ ] Add testimonials section
- [ ] Build email campaigns

### **Final Testing**
- [ ] Complete E2E test suite
- [ ] Perform load testing
- [ ] Test payment flows
- [ ] Verify mobile experience
- [ ] Test cross-browser compatibility
- [ ] Perform security testing
- [ ] Create bug bounty program

---

## **Technical Specifications**

### **Deployment Fee Structure**
```
Standard Deployment: 0.01 ETH
Priority Queue: 0.02 ETH
Premium Bot Slot: 0.05 ETH
Tournament Entry: Variable
```

### **Queue Algorithm**
```typescript
// Priority Score = Base Priority + (Time Waiting * 0.1) + Premium Bonus
// Match when 4-8 bots available with similar ratings
// Ensure model diversity (max 2 same model per match)
```

### **Prompt System**
```typescript
interface BotPrompt {
  strategy: string;      // 1000 chars max
  validatedAt: Date;     // Admin approval timestamp
  flags: string[];       // profanity, aggressive, etc.
}

// AI Service Modification
async getPokerDecision(botId: string, gameState: PokerGameState) {
  const bot = await prisma.bot.findUnique({ where: { id: botId }});
  const enhancedPrompt = {
    gameState: gameState,
    botStrategy: bot.prompt, // Custom 1000-char strategy
    instructions: "You are playing poker. " + bot.prompt
  };
  // Send to AI with custom personality
}
```

### **Revenue Projections**
- **Month 1**: 100 bots × 0.01 ETH = 1 ETH
- **Month 3**: 500 bots × 0.01 ETH = 5 ETH
- **Month 6**: 2000 bots + betting fees = 25 ETH
- **Year 1**: Premium subs + tournaments = 200 ETH

---

## **Infrastructure Architecture**

### **Server-Side Game Engine**
```typescript
// Move from client to server
class ServerPokerEngine {
  private gameState: AuthoritativeGameState;
  private stateValidator: StateValidator;
  private persistenceLayer: GamePersistence;
  
  async processAction(action: PlayerAction): Promise<GameUpdate> {
    // Validate action legality
    // Update authoritative state
    // Persist to database
    // Broadcast via WebSocket
  }
}
```

### **Authentication Flow**
```
User → Connect Wallet → Sign Message → Generate JWT → 
Create Session → Store in Redis → Attach to Requests
```

### **Game Persistence Schema**
```typescript
model Match {
  id            String   @id
  status        MatchStatus
  participants  Json     // Bot IDs and positions
  gameHistory   Json     // Complete state history
  decisions     Json     // All AI decisions
  result        Json     // Final rankings
  replayUrl     String?  // S3 presigned URL
  createdAt     DateTime
  completedAt   DateTime?
}

model AIDecision {
  id          String   @id
  matchId     String
  botId       String
  handNumber  Int
  decision    Json     // Action, reasoning, timing
  gameState   Json     // State at decision time
  timestamp   DateTime
}
```

### **Queue Architecture**
```
Bot Deployment → Redis Queue → Bull Processor → 
Matchmaking Algorithm → Create Match → Start Game
```

### **Deployment Stack**
- **Frontend**: Vercel (Next.js)
- **Backend**: Railway/Fly.io (Node.js)
- **Database**: Supabase (PostgreSQL)
- **Cache**: Upstash (Redis)
- **Queue**: Railway (Bull)
- **Storage**: Cloudflare R2 (Replays)
- **WebSocket**: Railway (Socket.io)

### **Security Considerations**
```typescript
// Current Issues
- Client-side game state (manipulatable)
- No API rate limiting (expensive AI calls)
- No prompt validation (malicious content)
- No anti-Sybil measures (spam bots)

// Required Security
- Server authoritative state
- API rate limits per wallet
- Prompt content filtering
- Bot deployment limits
- Transaction verification
- Admin approval for prompts
```

---

*Last Updated: December 2024  
Version: 3.1 - Foundation Infrastructure Added*