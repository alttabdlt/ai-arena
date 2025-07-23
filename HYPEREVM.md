# HyperEVM Integration Guide

## Overview
AI Arena is deployed on HyperEVM, part of the Hyperliquid ecosystem. HyperEVM provides EVM compatibility with enhanced performance and native integration with Hyperliquid's trading infrastructure.

## Network Configuration

### Mainnet
- **Chain ID**: 999
- **RPC URL**: `https://rpc.hyperliquid.xyz/evm`
- **Native Token**: HYPE (18 decimals)
- **Block Explorer**: `https://explorer.hyperliquid.xyz` (if available)

### Testnet
- **Chain ID**: 998
- **RPC URL**: `https://rpc.hyperliquid-testnet.xyz/evm`
- **Native Token**: HYPE (18 decimals)
- **Block Explorer**: `https://explorer.hyperliquid-testnet.xyz` (if available)

## Key Differences from Ethereum

### 1. Native Token
- Uses **HYPE** instead of ETH as gas token
- 18 decimals (same as ETH)
- All deployment fees paid in HYPE

### 2. Consensus & Fees
- Secured by HyperBFT consensus
- Cancun hardfork enabled (without blobs)
- EIP-1559 active (base fees burned)
- **Priority fees also burned** (sent to zero address)

### 3. Bridge Address
- Transfer HYPE between HyperCore and HyperEVM
- Bridge Address: `0x2222222222222222222222222222222222222222`
- Send HYPE to this address from HyperCore to bridge to HyperEVM

### 4. Current Limitations
- No websocket JSON-RPC support at `rpc.hyperliquid.xyz/evm`
- No official frontend components
- Alpha stage - features being gradually rolled out

## Wallet Configuration

### Adding HyperEVM to MetaMask

1. Open MetaMask
2. Click "Add Network" 
3. Enter the following:

**Mainnet:**
```
Network Name: HyperEVM
RPC URL: https://rpc.hyperliquid.xyz/evm
Chain ID: 999
Currency Symbol: HYPE
```

**Testnet:**
```
Network Name: HyperEVM Testnet
RPC URL: https://rpc.hyperliquid-testnet.xyz/evm
Chain ID: 998
Currency Symbol: HYPE
```

### Supported Wallets
- MetaMask
- WalletConnect compatible wallets
- Any wallet supporting custom EVM chains

## Development Setup

### Environment Variables
```bash
# Backend (.env)
RPC_URL=https://rpc.hyperliquid.xyz/evm
CHAIN_ID=999
DEPLOYMENT_WALLET_ADDRESS=your_deployment_wallet_address
DEPLOYMENT_FEE_HYPE=0.01

# Frontend (.env)
REACT_APP_CHAIN_ID=999
REACT_APP_RPC_URL=https://rpc.hyperliquid.xyz/evm
REACT_APP_DEPLOYMENT_WALLET=your_deployment_wallet_address
```

### Chain Configuration (wagmi/viem)
```typescript
import { defineChain } from 'viem';

export const hyperevmMainnet = defineChain({
  id: 999,
  name: 'HyperEVM',
  network: 'hyperevm',
  nativeCurrency: {
    decimals: 18,
    name: 'HYPE',
    symbol: 'HYPE',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.hyperliquid.xyz/evm'],
    },
  },
});
```

## Deployment Costs

### Bot Deployment Fees
- Standard Bot: 0.01 HYPE
- Priority Queue: 0.02 HYPE (future)
- Premium Slot: 0.05 HYPE (future)

### Gas Costs
- Similar to Ethereum mainnet
- Gas prices in HYPE
- Both base and priority fees are burned

## Smart Contract Deployment

### Using Hardhat
```javascript
module.exports = {
  networks: {
    hyperevm: {
      url: "https://rpc.hyperliquid.xyz/evm",
      chainId: 999,
      accounts: [process.env.PRIVATE_KEY]
    },
    hyperevmTestnet: {
      url: "https://rpc.hyperliquid-testnet.xyz/evm",
      chainId: 998,
      accounts: [process.env.PRIVATE_KEY]
    }
  }
};
```

### Using Foundry
```toml
[profile.default]
src = 'src'
out = 'out'
libs = ['lib']

[rpc_endpoints]
hyperevm = "https://rpc.hyperliquid.xyz/evm"
hyperevm_testnet = "https://rpc.hyperliquid-testnet.xyz/evm"
```

## Transaction Handling

### Send HYPE Transaction
```typescript
import { parseEther } from 'viem';
import { useSendTransaction } from 'wagmi';

const { sendTransaction } = useSendTransaction();

// Send 0.01 HYPE
sendTransaction({
  to: recipientAddress,
  value: parseEther('0.01'),
});
```

### Check HYPE Balance
```typescript
import { useBalance } from 'wagmi';

const { data: balance } = useBalance({
  address: userAddress,
});

console.log(`Balance: ${balance?.formatted} HYPE`);
```

## Common Issues & Solutions

### Issue: Transaction Failing
- Ensure sufficient HYPE balance for gas
- Check if wallet is connected to correct network
- Verify RPC endpoint is accessible

### Issue: Cannot Connect Wallet
- Manually add HyperEVM network to wallet
- Clear wallet cache and reconnect
- Try different RPC endpoint if available

### Issue: Bridge Not Working
- Ensure sending to correct bridge address
- Allow time for bridge processing
- Check both HyperCore and HyperEVM balances

## Resources

### Official Documentation
- [HyperEVM Docs](https://hyperliquid.gitbook.io/hyperliquid-docs/hyperevm)
- [Developer Guide](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm)

### Community Resources
- Discord: [Join Hyperliquid Discord]
- Twitter: [@HyperliquidX](https://twitter.com/HyperliquidX)

### Block Explorers
- Mainnet: TBD
- Testnet: TBD

## Migration Checklist

When migrating from Ethereum to HyperEVM:

- [x] Update chain configuration in wallet providers
- [x] Replace ETH with HYPE in UI and documentation
- [x] Update RPC endpoints in backend services
- [x] Modify transaction validation for HyperEVM
- [x] Update deployment scripts for new chain
- [x] Test on HyperEVM testnet first
- [ ] Verify smart contracts on HyperEVM explorer
- [ ] Update monitoring for HyperEVM metrics

## Security Considerations

1. **Alpha Stage**: HyperEVM is in alpha - expect changes
2. **No Websockets**: Plan for HTTP polling instead
3. **Bridge Security**: Always verify bridge transactions
4. **Fee Burning**: Both base and priority fees are burned

---

*Last Updated: December 2024  
Version: 1.0 - Initial HyperEVM Integration*