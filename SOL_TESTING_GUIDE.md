# 🚀 AI Arena - SOL Testing Guide (Updated)

## ✅ Configuration Complete

The platform has been updated to use **native SOL** instead of $IDLE tokens for all fees and transactions during the testing phase. The $IDLE token will be launched later when the application is complete.

## 📋 What Changed

### Fee Structure (Now in SOL)
| Feature | Old ($IDLE) | New (SOL) |
|---------|------------|-----------|
| Bot Deployment | 10 $IDLE | **0.1 SOL** |
| Tournament Entry | 5 $IDLE | **0.05 SOL** |
| Energy Pack (Small) | 1 $IDLE | **0.01 SOL** |
| Energy Pack (Medium) | 4 $IDLE | **0.04 SOL** |
| Energy Pack (Large) | 8 $IDLE | **0.08 SOL** |
| Energy Pack (Mega) | 35 $IDLE | **0.35 SOL** |
| Lootbox (Common) | 5 $IDLE | **0.05 SOL** |
| Lootbox (Rare) | 15 $IDLE | **0.15 SOL** |
| Lootbox (Epic) | 50 $IDLE | **0.5 SOL** |
| Lootbox (Legendary) | 150 $IDLE | **1.5 SOL** |

### Your Wallet Configuration
- **Custom Wallet**: `GTqrmffQ8zZv6CfDUGecYyNVgPAptru43dS13V3S5za6` (Receives bot deployment fees)
- **Treasury Wallet**: `ALF5j6cGmUv18uUvoz4nEMEnyHAJmfKZSQfdKbUwi9vb` (Platform treasury & prizes)

## 🧪 Testing Instructions

### Step 1: Get Devnet SOL

You need devnet SOL to test the platform:

```bash
# Option A: Use Solana Web Faucet (Recommended)
# Visit: https://faucet.solana.com
# Enter your wallet address: GTqrmffQ8zZv6CfDUGecYyNVgPAptru43dS13V3S5za6
# Request 2 SOL

# Option B: Use Solana CLI (if installed)
solana airdrop 2 GTqrmffQ8zZv6CfDUGecYyNVgPAptru43dS13V3S5za6 --url devnet
```

### Step 2: Configure Phantom Wallet

1. Open Phantom wallet extension
2. Click Settings (gear icon)
3. Go to "Developer Settings"
4. Enable "Testnet Mode"
5. Switch network to "Solana Devnet"
6. Your wallet should show the devnet SOL balance

### Step 3: Connect to the Platform

1. Visit the frontend: http://localhost:8080
2. Click "Connect Wallet"
3. Select Phantom
4. Approve the connection (make sure you're on Devnet)

### Step 4: Test Bot Deployment

1. Navigate to "Bot Management"
2. Click "Create Bot"
3. Configure your bot:
   - Name: Choose a unique name
   - Personality: Criminal/Gambler/Worker
   - Model: Select AI model
4. Click "Deploy" 
5. Phantom will prompt for 0.1 SOL payment
6. Approve the transaction
7. Your bot will be deployed!

### Step 5: Test Tournament Entry

1. Go to "Tournaments"
2. Select a game (Poker/Connect4/Reverse Hangman)
3. Click "Join Queue"
4. Phantom will prompt for 0.05 SOL entry fee
5. Approve the transaction
6. Wait for matchmaking

### Step 6: Test Energy Purchases

1. Go to your bot's profile
2. Click "Buy Energy"
3. Select a pack:
   - Small: 100 energy for 0.01 SOL
   - Medium: 500 energy for 0.04 SOL
   - Large: 1000 energy for 0.08 SOL
   - Mega: 5000 energy for 0.35 SOL
4. Approve the SOL transaction

## 🔍 Monitoring Transactions

### View on Solana Explorer
All transactions can be viewed on Solana Explorer (Devnet):
- Base URL: https://explorer.solana.com/?cluster=devnet
- Your wallet: https://explorer.solana.com/address/GTqrmffQ8zZv6CfDUGecYyNVgPAptru43dS13V3S5za6?cluster=devnet
- Treasury: https://explorer.solana.com/address/ALF5j6cGmUv18uUvoz4nEMEnyHAJmfKZSQfdKbUwi9vb?cluster=devnet

### Backend Monitoring
The backend monitors SOL transactions in real-time:
- Treasury balance changes are logged
- Incoming payments are detected and categorized
- Transaction types are determined by amount

## 🛠️ Troubleshooting

### Issue: "Insufficient SOL balance"
**Solution**: Get more devnet SOL from the faucet (free)

### Issue: Phantom shows mainnet
**Solution**: 
1. Go to Settings → Developer Settings
2. Enable Testnet Mode
3. Select "Devnet" network

### Issue: Transaction fails
**Possible causes**:
- Insufficient SOL for fees (need ~0.001 SOL extra for transaction fees)
- Wrong network (must be on devnet)
- Wallet not connected properly

### Issue: Can't see SOL balance
**Solution**: 
- Make sure Phantom is on Devnet
- Refresh the page
- Check wallet address matches the configured addresses

## 📝 Testing Checklist

- [ ] Got devnet SOL from faucet
- [ ] Phantom wallet configured for devnet
- [ ] Connected wallet to platform
- [ ] Deployed a bot (0.1 SOL)
- [ ] Entered a tournament (0.05 SOL)
- [ ] Purchased energy pack
- [ ] Won a tournament and received SOL prize
- [ ] Opened a lootbox (if available)
- [ ] Verified transactions on Solana Explorer

## 🚀 Benefits of SOL Testing

1. **Simpler**: No token creation or management needed
2. **Faster**: Direct SOL transfers, no token approvals
3. **Cleaner**: Native SOL is simpler than SPL tokens
4. **Realistic**: Tests the economic model with real value
5. **Free**: Devnet SOL is free from faucet

## 📊 Platform Wallet Balances

You can check platform wallet balances:
```graphql
# Query platform balances (when implemented)
query {
  platformBalances {
    treasury
    deploymentFees
    prizePool
    total
  }
}
```

## 🎮 Services Status

| Service | URL | Status |
|---------|-----|--------|
| Backend API | http://localhost:4000/graphql | ✅ Running |
| Frontend | http://localhost:8080 | ✅ Running |
| Metaverse Backend | http://localhost:5001 | ✅ Running |
| Metaverse Frontend | http://localhost:5175 | ✅ Running |

## 💡 Next Steps

After testing with SOL:
1. Complete application features
2. Launch $IDLE token on pump.fun
3. Update configuration to use $IDLE
4. Deploy to mainnet

---

**Ready to test!** The platform now uses SOL for all transactions. Get some devnet SOL and start testing! 🎉