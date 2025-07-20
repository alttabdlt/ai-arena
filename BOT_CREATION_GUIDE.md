# Bot Creation Guide

## ✅ Current Status

The frontend and backend are now connected with basic bot creation functionality!

### What's Working:
1. **Smart Contract Hook** - `useBondingCurveFactory` connects to the deployed factory
2. **Quick Launch Component** - Modal for creating bots from the homepage
3. **Test Page** - Direct contract testing at http://localhost:8080/test

### What's NOT Fully Connected Yet:
- Backend resolver doesn't call the smart contract (frontend does it directly)
- Event listeners are disabled (HyperEVM doesn't support filters)
- Buy/sell functionality needs testing after bot creation

## 🚀 How to Create a Bot

### Method 1: Quick Launch (Homepage)
1. Open http://localhost:8080
2. Connect your wallet (MetaMask with HyperEVM Testnet)
3. Click "Quick Launch Bot" button
4. Fill in:
   - Bot Name (e.g., "AlphaBot")
   - Symbol (e.g., "ALPHA")
   - Description (optional)
5. Click "Launch Bot"
6. Approve transaction in MetaMask

### Method 2: Test Page (Direct Contract)
1. Open http://localhost:8080/test
2. Connect wallet
3. Use pre-filled test values or enter your own
4. Click "Create Bonding Curve"
5. Monitor transaction status on the page

## 🔧 Technical Flow

```
User clicks "Create Bot"
    ↓
Frontend generates random bot address
    ↓
Calls BondingCurveFactory.createBondingCurve()
    ↓
Smart contract creates curve on HyperEVM
    ↓
Frontend saves bot info to database via GraphQL
    ↓
Bot is now tradeable!
```

## ⚠️ Requirements

1. **Wallet with HYPE tokens** on HyperEVM testnet
   - Get from: https://app.hyperliquid-testnet.xyz/faucet

2. **MetaMask configured** for HyperEVM Testnet:
   - Network: HyperEVM Testnet
   - RPC: https://rpc.hyperliquid-testnet.xyz/evm
   - Chain ID: 998
   - Symbol: HYPE

## 🐛 Troubleshooting

### "Insufficient funds"
- You need HYPE tokens for gas fees
- Get from the testnet faucet

### Transaction fails
- Check you're on the correct network (Chain ID 998)
- Ensure you have enough HYPE for gas
- Try refreshing the page

### Can't see the bot after creation
- Check http://localhost:8080/discover
- The bot list might need manual refresh
- Database sync happens after blockchain confirmation

## 📝 Next Steps

After creating a bot:
1. Go to `/bot/:id/invest` to trade it
2. Check `/portfolio` to see your holdings
3. Monitor price changes in real-time

## 🔗 Deployed Contracts

- **BondingCurveFactory**: `0xb35B3D03385698eD0B02Ba26fEA8342f3B499A1A`
- **GraduationController**: `0x578dA0744Df7FeFAf4806cCbD1017569B537C45d`
- **Network**: HyperEVM Testnet (Chain ID: 998)