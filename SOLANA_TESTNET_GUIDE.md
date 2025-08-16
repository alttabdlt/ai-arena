# 🧪 Solana Devnet Testing Guide

## Overview
This guide helps you set up and test AI Arena with $IDLE token on Solana devnet - no real money required!

## 🚀 Quick Start

### 1. Install Prerequisites

#### Solana CLI Tools
```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install SPL Token CLI
cargo install spl-token-cli

# Verify installation
solana --version
spl-token --version
```

### 2. Configure for Devnet
```bash
# Set Solana CLI to use devnet
solana config set --url devnet

# Generate a new wallet (or use existing)
solana-keygen new --outfile ~/.config/solana/devnet.json

# Set as default keypair
solana config set --keypair ~/.config/solana/devnet.json

# Check your address
solana address
```

### 3. Get Free Test SOL
```bash
# Request 2 SOL airdrop (max per request)
solana airdrop 2

# Check balance
solana balance

# Need more? Wait a few seconds and request again
solana airdrop 2
```

### 4. Create $IDLE Test Token
```bash
# Run our helper script
./scripts/create-idle-token-devnet.sh

# Or manually:
# Create token with 6 decimals
spl-token create-token --decimals 6

# Save the token mint address!
# Example: idLe7xX2LqWYcMQ9gWgYY8hbBc8J8VmPk3rBmkDvYkE
```

### 5. Configure Environment Variables

Create `.env` in both backend and app directories:

#### Backend `.env`:
```env
# Solana Configuration
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com

# $IDLE Token (use your created token mint)
IDLE_TOKEN_MINT=YOUR_TOKEN_MINT_ADDRESS_HERE

# Platform Wallets (use your wallet address)
TREASURY_WALLET_PUBKEY=YOUR_WALLET_ADDRESS_HERE
DEPLOYMENT_FEE_WALLET=YOUR_WALLET_ADDRESS_HERE
PRIZE_POOL_ESCROW=YOUR_WALLET_ADDRESS_HERE

# Existing configs (keep these)
DATABASE_URL=postgresql://user:password@localhost:5432/ai_arena
REDIS_URL=redis://localhost:6379
PORT=4000
WS_PORT=4001
```

#### Frontend `.env`:
```env
# Solana Configuration
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com

# $IDLE Token
VITE_IDLE_TOKEN_MINT=YOUR_TOKEN_MINT_ADDRESS_HERE

# Platform Wallets
VITE_TREASURY_WALLET_ADDRESS=YOUR_WALLET_ADDRESS_HERE
VITE_DEPLOYMENT_WALLET_ADDRESS=YOUR_WALLET_ADDRESS_HERE

# Existing configs (keep these)
VITE_GRAPHQL_URL=http://localhost:4000/graphql
VITE_WS_URL=ws://localhost:4000/graphql
VITE_GAME_WS_URL=ws://localhost:4001
```

## 💸 Testnet Fee Structure

All fees are drastically reduced for testing:

| Action | Mainnet Fee | Testnet Fee |
|--------|------------|-------------|
| Bot Deployment | 10,000 $IDLE | 10 $IDLE |
| Tournament Entry | 1,000 $IDLE | 5 $IDLE |
| Energy Pack (Small) | 100 $IDLE | 1 $IDLE |
| Energy Pack (Mega) | 3,500 $IDLE | 35 $IDLE |
| Common Lootbox | 500 $IDLE | 5 $IDLE |
| Legendary Lootbox | 15,000 $IDLE | 150 $IDLE |

## 🔧 Testing Workflow

### 1. Start the Application
```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd app
npm run dev

# Terminal 3: Start metaverse
cd metaverse-game
npm run dev
```

### 2. Connect Wallet
1. Install [Phantom Wallet](https://phantom.app)
2. Switch to Devnet:
   - Settings → Developer Settings → Network → Devnet
3. Import your test wallet:
   - Use the seed phrase from your devnet wallet
   - Or create a new wallet and airdrop SOL

### 3. Get Test $IDLE Tokens
```bash
# Send test tokens to your Phantom wallet
spl-token transfer YOUR_TOKEN_MINT 10000 YOUR_PHANTOM_ADDRESS

# Check balance
spl-token balance YOUR_TOKEN_MINT --owner YOUR_PHANTOM_ADDRESS
```

### 4. Test Features
- **Deploy a Bot**: Costs only 10 $IDLE on testnet
- **Enter Tournament**: Just 5 $IDLE entry fee
- **Buy Energy**: 1 $IDLE for 100 energy
- **Open Lootboxes**: Starting at 5 $IDLE

## 🛠️ Useful Commands

### Check Token Info
```bash
# Display token details
spl-token display YOUR_TOKEN_MINT

# Check your token balance
spl-token balance YOUR_TOKEN_MINT

# List all token accounts
spl-token accounts
```

### Send Test Tokens
```bash
# Transfer tokens to another wallet
spl-token transfer YOUR_TOKEN_MINT AMOUNT RECIPIENT_ADDRESS

# Example: Send 1000 $IDLE
spl-token transfer idLe7xX2LqW... 1000 7nYzB4sD9xK...
```

### Monitor Transactions
```bash
# View recent transactions
solana transaction-history

# Check specific transaction
solana confirm TRANSACTION_SIGNATURE
```

## 🌐 Devnet Resources

### Block Explorers
- **Solscan**: https://solscan.io/?cluster=devnet
- **Solana Explorer**: https://explorer.solana.com/?cluster=devnet
- **SolanaFM**: https://solana.fm/?cluster=devnet-solana

### View Your Token
```
https://solscan.io/token/YOUR_TOKEN_MINT?cluster=devnet
```

### Faucets
- **Official**: `solana airdrop 2`
- **Web Faucet**: https://faucet.solana.com (if available)

## 🐛 Troubleshooting

### "Insufficient SOL for transaction"
```bash
# Get more test SOL
solana airdrop 2
```

### "Token account does not exist"
```bash
# Create associated token account
spl-token create-account YOUR_TOKEN_MINT
```

### "Transaction simulation failed"
- Check you're on devnet: `solana config get`
- Verify RPC is devnet: `https://api.devnet.solana.com`
- Ensure sufficient SOL balance

### Wallet Not Connecting
1. Ensure Phantom is set to Devnet
2. Clear browser cache
3. Restart the application

## 📊 Monitoring Your Test Deployment

### View Transactions
All transactions are visible on Solscan:
```
https://solscan.io/account/YOUR_WALLET?cluster=devnet
```

### Check Token Distribution
```bash
# See all holders of your token
spl-token accounts --mint YOUR_TOKEN_MINT
```

### Monitor $IDLE Transfers
The backend logs all $IDLE transfers:
```
tail -f backend/logs/idle-transfers.log
```

## 🎮 Test Scenarios

### Scenario 1: Full Game Flow
1. Deploy a bot (10 $IDLE)
2. Enter tournament (5 $IDLE)
3. Win tournament (receive $IDLE rewards)
4. Buy lootbox with winnings
5. Equip items from lootbox

### Scenario 2: Idle Rewards Testing
1. Deploy multiple bots
2. Let them idle in metaverse
3. Check idle rewards accumulation (10 $IDLE/hour)
4. Claim rewards after 24 hours max

### Scenario 3: Economy Testing
1. Create multiple test wallets
2. Distribute $IDLE between them
3. Test trading, tournament entry, energy purchases
4. Verify all transactions on explorer

## 🚀 Ready for Mainnet?

When you're ready to go live:

1. **Update Network Config**:
   - Change `devnet` to `mainnet-beta` in configs
   - Update RPC URLs to mainnet endpoints

2. **Launch Real Token**:
   - Create token on pump.fun
   - Update mint addresses in configs

3. **Adjust Fees**:
   - Restore production fee amounts
   - Remove testnet fee reductions

4. **Security Audit**:
   - Review all wallet permissions
   - Audit smart contract interactions
   - Test with small amounts first

## 📝 Notes

- **Devnet resets** occasionally, tokens may disappear
- **Rate limits** apply to airdrops (max 2 SOL per request)
- **Test freely** - it's all fake money!
- **Keep devnet wallet separate** from mainnet wallet

---

## Need Help?

- **Solana Docs**: https://docs.solana.com
- **SPL Token Guide**: https://spl.solana.com/token
- **Discord Support**: Join AI Arena Discord
- **GitHub Issues**: Report bugs on our repo

Happy Testing! 🎉