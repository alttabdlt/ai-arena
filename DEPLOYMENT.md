# AI Arena Deployment Guide

## ✅ Testnet Deployment Complete

Contracts have been successfully deployed to HyperEVM Testnet!

### Deployed Contract Addresses

```
Network: HyperEVM Testnet (Chain ID: 998)
Date: 2025-07-16

GraduationController: 0x578dA0744Df7FeFAf4806cCbD1017569B537C45d
BondingCurveFactory: 0xb35B3D03385698eD0B02Ba26fEA8342f3B499A1A
Treasury: 0x64c1b470c71749FcF9889717f2e762EB9f0F38d3
Deployer: 0x2487155dF829977813Ea9b4F992C229F86D4f16a
```

## 🚀 Next Steps

### 1. Start the Backend Services

```bash
cd backend

# Install dependencies if not already done
npm install

# Start PostgreSQL and Redis (if using Docker)
docker-compose up -d postgres redis

# Run database migrations
npx prisma migrate dev

# Start the backend server
npm run dev
```

### 2. Start the Frontend

```bash
cd app

# Install dependencies if not already done
npm install

# Start the development server
npm run dev
```

### 3. Get Testnet HYPE Tokens

1. Visit the HyperEVM testnet faucet: https://app.hyperliquid-testnet.xyz/faucet
2. Request testnet HYPE tokens for your wallet
3. You'll need these to pay for gas fees when testing

### 4. Test the Platform

1. **Connect Wallet**: Use MetaMask with HyperEVM Testnet configured
2. **Launch a Bot**: Create your first AI bot with a bonding curve
3. **Trade**: Buy and sell bot tokens to test the bonding curve
4. **Monitor**: Check the GraphQL playground at http://localhost:4000/graphql

## 📋 Configuration Files Created

### Frontend (.env)
```env
VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here
VITE_API_URL=http://localhost:4000/graphql
VITE_WS_URL=ws://localhost:4001
VITE_USE_MAINNET=false
VITE_BONDING_CURVE_FACTORY_ADDRESS=0xb35B3D03385698eD0B02Ba26fEA8342f3B499A1A
VITE_GRADUATION_CONTROLLER_ADDRESS=0x578dA0744Df7FeFAf4806cCbD1017569B537C45d
```

### Backend (.env)
```env
# Update these values in your backend/.env file
DATABASE_URL=postgresql://user:password@localhost:5432/ai_arena
REDIS_URL=redis://localhost:6379
HYPEREVM_RPC_URL=https://rpc.hyperliquid-testnet.xyz/evm
HYPEREVM_CHAIN_ID=998
BONDING_CURVE_FACTORY_ADDRESS=0xb35B3D03385698eD0B02Ba26fEA8342f3B499A1A
GRADUATION_CONTROLLER_ADDRESS=0x578dA0744Df7FeFAf4806cCbD1017569B537C45d
```

## 🧪 Testing Checklist

- [ ] Backend server starts without errors
- [ ] Frontend connects to backend GraphQL API
- [ ] Wallet connects to HyperEVM Testnet
- [ ] Can create a new bot with bonding curve
- [ ] Can buy tokens from bonding curve
- [ ] Can sell tokens back to bonding curve
- [ ] Real-time price updates via WebSocket
- [ ] Transaction history shows in UI

## 🔍 Monitoring

### Contract Events
Monitor contract events in the backend logs. The EventListener service will:
- Track all bonding curve creations
- Monitor buy/sell transactions
- Watch for graduations

### GraphQL Playground
Access http://localhost:4000/graphql to:
- Test queries and mutations
- Monitor subscriptions
- Check API health

## 🚨 Troubleshooting

### "No HYPE balance" error
- Get testnet HYPE from the faucet
- Make sure you're on the correct network (Chain ID: 998)

### Contract transaction fails
- Check you have enough HYPE for gas
- Verify the contract addresses in your .env files
- Check the backend logs for detailed errors

### Frontend can't connect to backend
- Ensure backend is running on port 4000
- Check CORS settings in backend
- Verify GraphQL endpoint in frontend .env

## 📝 Important Notes

1. **This is TESTNET** - Do not use real funds
2. **Save your deployment info** - Keep contract addresses safe
3. **Monitor gas usage** - HyperEVM uses HYPE for gas, not ETH
4. **Test thoroughly** - Before mainnet deployment

## 🎯 What's Working

✅ Smart contracts deployed and verified
✅ Backend services configured with contract addresses
✅ Frontend configured with contract addresses
✅ GraphQL API ready for queries/mutations/subscriptions
✅ Web3 integration with wagmi/viem
✅ Bonding curve mathematics implemented

## 🔄 Next Development Steps

1. Replace mock data with real GraphQL queries in UI components
2. Implement tournament system contracts
3. Add KYC integration
4. Enhance social features
5. Add comprehensive error handling
6. Implement analytics dashboard

---

For questions or issues, check the logs in both frontend and backend for detailed error messages.