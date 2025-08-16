# 🚀 Solana & $IDLE Token Migration Guide

## ✅ Completed Migration Steps

### 1. **Dependencies Updated**
- ✅ Removed EVM dependencies (ethers, viem, wagmi)
- ✅ Installed Solana Web3.js and wallet adapters
- ✅ Added SPL token support for $IDLE

### 2. **Configuration Files Created**
- ✅ `/backend/src/config/solana.ts` - Backend Solana configuration
- ✅ `/app/src/config/solana.ts` - Frontend Solana configuration
- ✅ Configured $IDLE token with pump.fun integration

### 3. **Wallet Infrastructure**
- ✅ Replaced MetaMask/WalletConnect with Phantom/Solflare
- ✅ Created `SolanaWalletButton.tsx` component
- ✅ Updated wallet provider for Solana

### 4. **Backend Services**
- ✅ Created `SolanaService` to replace HyperEvmPoller
- ✅ Implemented $IDLE transaction monitoring
- ✅ Added idle reward distribution system

### 5. **Fee Structure**
- ✅ Updated all fees from HYPE to $IDLE
- ✅ Bot deployment: 10,000 $IDLE
- ✅ Tournament entry: 1,000 $IDLE minimum
- ✅ Energy packs priced in $IDLE

## 📋 Next Steps Required

### 1. **Launch $IDLE on Pump.fun**
```bash
# 1. Visit pump.fun
# 2. Create new token with:
   - Name: IDLE - AI Arena Token
   - Symbol: IDLE
   - Supply: 1,000,000,000
   - Description: "Get paid to be lazy. The official token of AI Arena's crime metaverse."
   - Image: Create a lazy criminal bot mascot
# 3. Add initial liquidity (recommended: 5-10 SOL)
# 4. Update token mint address in config files
```

### 2. **Update Environment Variables**
```env
# Backend (.env)
SOLANA_NETWORK=mainnet-beta
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
IDLE_TOKEN_MINT=[YOUR_PUMP_FUN_MINT_ADDRESS]
TREASURY_WALLET_PUBKEY=[YOUR_TREASURY_SOLANA_ADDRESS]
DEPLOYMENT_FEE_WALLET=[YOUR_FEE_COLLECTION_ADDRESS]

# Frontend (.env)
VITE_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
VITE_IDLE_TOKEN_MINT=[YOUR_PUMP_FUN_MINT_ADDRESS]
VITE_TREASURY_WALLET_ADDRESS=[YOUR_TREASURY_SOLANA_ADDRESS]
```

### 3. **Update GraphQL Resolvers**
```typescript
// In backend/src/graphql/resolvers/economy.ts
// Replace ETH/HYPE references with $IDLE
// Update transaction handling to use SolanaService
```

### 4. **Frontend Components to Update**
- [ ] Update `useHypeBalance` hook → `useIdleBalance`
- [ ] Replace wallet buttons with `SolanaWalletButton`
- [ ] Update energy purchase modals to use $IDLE
- [ ] Add pump.fun price chart widget

### 5. **Remove Old Contracts**
```bash
# Delete EVM contract files
rm -rf contracts/src/*.sol
rm -rf contracts/script/*.sol
rm -rf contracts/test/*.sol

# Keep contracts folder for future Solana programs
```

### 6. **Test the Integration**
```bash
# Start backend
cd backend && npm run dev

# Start frontend
cd app && npm run dev

# Test wallet connection with Phantom
# Test $IDLE balance display
# Test bot deployment flow
```

## 🎮 $IDLE Tokenomics Implementation

### Idle Reward System
```typescript
// Already implemented in SolanaService:
- Base rate: 10 $IDLE/hour
- Criminal bots: 1.2x multiplier
- Worker bots: 1.5x multiplier (they're best at being idle!)
- Max accumulation: 24 hours
```

### Marketing Integration
1. **Pump.fun Profile**
   - Bio: "The laziest way to earn in crypto 😴"
   - Twitter: Link to @AIArenaGame
   - Telegram: Create $IDLE community

2. **Launch Campaign**
   - "Get paid to do nothing"
   - "Your bots work while you don't"
   - "Idle gameplay, active rewards"

3. **Community Incentives**
   - Airdrop to existing players
   - Bonus $IDLE for early adopters
   - Referral rewards in $IDLE

## 🐛 Troubleshooting

### Common Issues

#### Wallet Not Connecting
```typescript
// Check browser has Phantom/Solflare installed
// Ensure on Solana mainnet
// Clear browser cache if needed
```

#### $IDLE Balance Not Showing
```typescript
// Token account might not exist yet
// Need to receive first $IDLE to create account
// Check correct mint address in config
```

#### Transaction Failures
```typescript
// Insufficient SOL for gas
// Token account needs initialization
// Check Solana network status
```

## 🚨 Important Notes

1. **DO NOT** deploy to mainnet until:
   - $IDLE token is launched on pump.fun
   - All wallet addresses are configured
   - Testing on devnet is complete

2. **Security Considerations**:
   - Never commit private keys
   - Use environment variables for sensitive data
   - Implement rate limiting for idle rewards

3. **Migration Timeline**:
   - Week 1: Launch $IDLE on pump.fun
   - Week 2: Test on devnet
   - Week 3: Migrate existing users
   - Week 4: Full mainnet launch

## 📊 Monitoring & Analytics

### Track Performance
```typescript
// Add to SolanaService
- Transaction volume tracking
- $IDLE circulation metrics
- Idle reward distribution stats
- Pump.fun price integration
```

### Success Metrics
- Daily active wallets
- $IDLE trading volume
- Bot deployment rate
- Tournament participation

## 🎯 Launch Checklist

- [ ] $IDLE token created on pump.fun
- [ ] Initial liquidity added
- [ ] Environment variables updated
- [ ] Treasury wallets configured
- [ ] Frontend wallet integration tested
- [ ] Bot deployment flow working
- [ ] Tournament entry with $IDLE tested
- [ ] Idle rewards distributing correctly
- [ ] Marketing materials ready
- [ ] Community channels created

## 💰 Revenue Projections

### Based on $IDLE at $0.000069
- Bot deployment: ~$0.69 per bot
- Tournament entry: ~$0.069 per entry
- Energy packs: ~$0.007-$0.24 range
- Platform fees: 2% of all transactions

### Growth Targets
- Month 1: 1,000 holders, $69k market cap
- Month 3: 5,000 holders, $420k market cap
- Month 6: 10,000 holders, $1M+ market cap

## 🔗 Resources

- [Pump.fun](https://pump.fun) - Token launch platform
- [Solscan](https://solscan.io) - Block explorer
- [Phantom](https://phantom.app) - Primary wallet
- [Jup.ag](https://jup.ag) - DEX aggregator

---

**Ready to make AI Arena the laziest, most profitable game on Solana! 🦥💰**

*Remember: This migration makes your platform a meme-friendly, Solana-native gaming experience with built-in viral potential through the $IDLE token.*