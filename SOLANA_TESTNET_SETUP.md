# 🚀 AI Arena - Solana Devnet Setup Guide

## ✅ Services Running

All services are now running with your Solana devnet configuration:

| Service | URL | Status |
|---------|-----|--------|
| Arena Backend | http://localhost:4000/graphql | ✅ Running |
| Arena Frontend | http://localhost:8080 | ✅ Running |
| Metaverse Backend | http://localhost:5001 | ✅ Running |
| Metaverse Frontend | http://localhost:5175 | ✅ Running |

## 📋 Your Wallet Configuration

Your Phantom devnet wallets are configured:
- **Custom Wallet**: `GTqrmffQ8zZv6CfDUGecYyNVgPAptru43dS13V3S5za6` (Bot deployment fees)
- **Treasury Wallet**: `ALF5j6cGmUv18uUvoz4nEMEnyHAJmfKZSQfdKbUwi9vb` (Platform treasury)

## 🪙 Creating Your $IDLE Token

### Step 1: Get Devnet SOL

First, you need devnet SOL to create the token:

```bash
# Option A: Use Solana CLI (if installed)
solana airdrop 2 GTqrmffQ8zZv6CfDUGecYyNVgPAptru43dS13V3S5za6 --url devnet

# Option B: Use the web faucet
# Visit: https://faucet.solana.com
# Enter: GTqrmffQ8zZv6CfDUGecYyNVgPAptru43dS13V3S5za6
# Request 2 SOL
```

### Step 2: Create the $IDLE Token

Run the token creation script:

```bash
cd /Users/axel/Desktop/Coding-Projects/ai-arena
npx ts-node scripts/create-idle-token.ts
```

**Note**: This script will:
1. Check for a wallet at `~/.config/solana/id.json`
2. If not found, create a new one (save the secret key!)
3. Create the $IDLE token with metadata
4. Mint 1 billion IDLE for testing
5. Save token info to `idle-token-devnet.json`

### Step 3: Update Token Address

After creating the token, update your `.env` files with the mint address:

```bash
# The script will output something like:
# Mint Address: ABC123xyz...

# Update backend/.env
IDLE_TOKEN_MINT=ABC123xyz...

# Update app/.env
VITE_IDLE_TOKEN_MINT=ABC123xyz...
```

Then restart the backend for changes to take effect.

## 🧪 Testing the Platform

### 1. Connect Your Phantom Wallet

1. Open Phantom wallet
2. Go to Settings → Developer Settings
3. Enable "Testnet Mode"
4. Switch network to "Solana Devnet"
5. Visit http://localhost:8080
6. Click "Connect Wallet" and select Phantom

### 2. Get Test $IDLE Tokens

Once you've created the token, you can:
- Use the initial 1B IDLE minted to the creator wallet
- Transfer some to your Phantom wallet for testing

### 3. Test Bot Deployment

With $IDLE tokens in your wallet:
1. Go to "Bot Management" 
2. Click "Create Bot"
3. Pay 10 $IDLE deployment fee (testnet rate)
4. Your bot will be deployed to the metaverse

### 4. Test Tournaments

1. Navigate to "Tournaments"
2. Join a queue (5 $IDLE entry fee on testnet)
3. Watch your bot compete
4. Win lootboxes and more $IDLE

## 🔍 Monitoring & Debugging

### View Transactions
- Solana Explorer: https://explorer.solana.com/?cluster=devnet
- Search for your wallet addresses or token mint

### Check Logs
```bash
# Backend logs
tail -f debug-logs/backend.log

# Check specific service
curl http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ bots { id name wallet } }"}'
```

### GraphQL Playground
Visit http://localhost:4000/graphql to test queries:

```graphql
# Get your bots
query {
  bots {
    id
    name
    personality
    wallet
  }
}

# Check your IDLE balance (once implemented)
query {
  wallet(address: "GTqrmffQ8zZv6CfDUGecYyNVgPAptru43dS13V3S5za6") {
    idleBalance
  }
}
```

## 🛠️ Troubleshooting

### Issue: "Invalid public key" error
**Solution**: Create the token first using the script above, then update .env files

### Issue: Can't connect Phantom
**Solution**: Ensure you're in Testnet Mode in Phantom settings

### Issue: No balance showing
**Solution**: Make sure you've:
1. Created the token
2. Updated .env files with the mint address
3. Restarted services

### Issue: Transaction failed
**Solution**: Check you have enough devnet SOL for fees (get more from faucet)

## 📝 Key Differences from Mainnet

| Feature | Testnet | Mainnet |
|---------|---------|---------|
| Bot Deployment | 10 $IDLE | 10,000 $IDLE |
| Tournament Entry | 5 $IDLE | 100 $IDLE |
| Network | Devnet | Mainnet-beta |
| Pump.fun | Simulated | Real trading |
| SOL Source | Faucet (free) | Purchase required |

## 🎮 Next Steps

1. **Create Token**: Run the script to create your $IDLE token
2. **Fund Wallets**: Get devnet SOL and distribute test IDLE
3. **Test Features**: Deploy bots, run tournaments, test the economy
4. **Iterate**: The platform is ready for testing and development

## 🔗 Useful Links

- [Solana Devnet Faucet](https://faucet.solana.com)
- [Solana Explorer (Devnet)](https://explorer.solana.com/?cluster=devnet)
- [Phantom Wallet](https://phantom.app)
- [Solana Token List](https://github.com/solana-labs/token-list)

## 💡 Tips

- Keep your test wallet secret key safe
- Document any issues for mainnet preparation
- Test all economic flows before mainnet
- Monitor gas costs on devnet to estimate mainnet costs

---

**Ready to test!** Your AI Arena platform is now running on Solana devnet with $IDLE token support. Create your token and start testing! 🚀