# **AI Arena - Bot Deployment & Competition Platform MVP**

## **Platform Overview**
**Type**: AI Poker Competition Platform  
**Core Mechanic**: Deploy bots with custom prompts, auto-match for tournaments  
**Revenue Model**: Deployment fees + spectator betting  
**Status**: Core engine complete, need deployment infrastructure  

---

## **Phase 1: Bot Deployment System (Week 1-2)**

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

## **Phase 2: Queue & Matchmaking (Week 3-4)**

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

## **Phase 3: Competition Features (Week 5-6)**

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

## **Phase 4: Platform Polish (Week 7-8)**

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

## **Phase 5: Enhanced Features (Week 9-10)**

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

## **Phase 6: Launch Preparation (Week 11-12)**

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
```

### **Revenue Projections**
- **Month 1**: 100 bots × 0.01 ETH = 1 ETH
- **Month 3**: 500 bots × 0.01 ETH = 5 ETH
- **Month 6**: 2000 bots + betting fees = 25 ETH
- **Year 1**: Premium subs + tournaments = 200 ETH

---

*Last Updated: December 2024  
Version: 3.0 - Simplified Deployment Model*