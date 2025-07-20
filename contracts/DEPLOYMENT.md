# AI Arena Smart Contracts Deployment Guide

## Overview

This guide covers deploying the AI Arena smart contracts to HyperEVM testnet and mainnet.

## Network Information

### HyperEVM Testnet
- **Chain ID**: 998
- **RPC URL**: https://api.hyperliquid-testnet.xyz/evm
- **Native Token**: HYPE (testnet)
- **Explorer**: https://explorer.hyperliquid-testnet.xyz

### HyperEVM Mainnet
- **Chain ID**: 999
- **RPC URL**: https://rpc.hyperliquid.xyz/evm
- **Native Token**: HYPE
- **Explorer**: https://hyperscan.xyz

## Prerequisites

1. **Install Foundry**:
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **Get HYPE tokens**:
   - For testnet: Use faucet or bridge testnet tokens
   - For mainnet: Bridge from Arbitrum via [official bridge](https://app.hyperliquid.xyz/bridge)

3. **Set up environment**:
   ```bash
   cd contracts
   cp .env.example .env
   # Edit .env with your private key and treasury address
   ```

## Deployment Steps

### 1. Deploy to Testnet First

```bash
# Load environment variables
source .env

# Deploy to HyperEVM testnet
forge script script/Deploy.s.sol \
  --rpc-url $HYPEREVM_TESTNET_RPC_URL \
  --broadcast \
  --verify \
  -vvvv

# The script will:
# 1. Deploy GraduationController
# 2. Deploy BondingCurveFactory
# 3. Link them together
# 4. Save addresses to deployment-addresses.txt
```

### 2. Test on Testnet

```bash
# Run local tests
forge test -vvv

# Test on testnet
forge script script/TestDeploy.s.sol \
  --rpc-url $HYPEREVM_TESTNET_RPC_URL \
  --broadcast
```

### 3. Deploy to Mainnet

⚠️ **WARNING**: This uses real HYPE tokens!

```bash
# Set confirmation flag
export CONFIRM_MAINNET_DEPLOYMENT=true

# Deploy to mainnet
forge script script/DeployMainnet.s.sol \
  --rpc-url $HYPEREVM_MAINNET_RPC_URL \
  --broadcast \
  --verify \
  -vvvv
```

## Post-Deployment Configuration

### 1. Update Backend Configuration

Edit `backend/.env`:
```env
# Contract addresses from deployment
BONDING_CURVE_FACTORY_ADDRESS=0x...
GRADUATION_CONTROLLER_ADDRESS=0x...
HYPEREVM_RPC_URL=https://api.hyperliquid-testnet.xyz/evm
HYPEREVM_CHAIN_ID=998
```

### 2. Update Frontend Configuration

Edit `app/.env`:
```env
# Contract addresses
VITE_BONDING_CURVE_FACTORY_ADDRESS=0x...
VITE_GRADUATION_CONTROLLER_ADDRESS=0x...
VITE_USE_MAINNET=false
```

### 3. Generate TypeScript Types

```bash
# Generate contract ABIs
cd contracts
forge build

# Copy ABIs to frontend
cp out/BondingCurveFactory.sol/BondingCurveFactory.json ../app/src/abi/
cp out/BondingCurve.sol/BondingCurve.json ../app/src/abi/
cp out/GraduationController.sol/GraduationController.json ../app/src/abi/
```

## Verify Deployment

### 1. Check Contract Creation
- Visit the explorer with your factory address
- Verify the contracts are deployed correctly

### 2. Test Basic Functions
```bash
# Create a test bonding curve
cast send $BONDING_CURVE_FACTORY_ADDRESS \
  "createBondingCurve(string,string,address)" \
  "Test Bot" "TBOT" 0x0000000000000000000000000000000000000001 \
  --rpc-url $HYPEREVM_TESTNET_RPC_URL \
  --private-key $PRIVATE_KEY
```

### 3. Monitor Events
```bash
# Watch for CurveCreated events
cast logs \
  --address $BONDING_CURVE_FACTORY_ADDRESS \
  --rpc-url $HYPEREVM_TESTNET_RPC_URL
```

## Gas Costs

Estimated gas usage:
- **Factory Deployment**: ~2.5M gas
- **Graduation Controller**: ~1.5M gas
- **Create Bonding Curve**: ~3M gas
- **Buy Tokens**: ~150k gas
- **Sell Tokens**: ~120k gas

## Troubleshooting

### "Insufficient HYPE"
- Ensure your deployer wallet has enough HYPE
- For testnet: Use faucet
- For mainnet: Bridge from Arbitrum

### "Gas estimation failed"
- HyperEVM may require switching to "slow block" mode for deployment
- Try increasing gas limit manually

### "Contract verification failed"
- HyperEVM explorer may not support verification yet
- Keep source code for manual verification

## Security Checklist

- [ ] Treasury address is correct multisig
- [ ] Private key is secured
- [ ] Contracts tested on testnet
- [ ] Anti-bot measures verified
- [ ] Graduation threshold confirmed ($69k)
- [ ] Fee percentages correct (1% platform, 2% creator)

## Next Steps

After successful deployment:
1. Update backend contract service with addresses
2. Configure frontend to use deployed contracts
3. Set up event listeners for real-time updates
4. Test full buy/sell flow through UI
5. Monitor for graduation events