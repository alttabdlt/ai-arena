# HyperEVM Integration Notes

## Key Differences from Standard EVM

1. **No Event Filters Support**
   - HyperEVM doesn't support `eth_newFilter` method
   - Cannot use standard event listeners with `.on()` 
   - Solution: Use polling or manual transaction monitoring

2. **RPC Endpoints**
   - Testnet: `https://rpc.hyperliquid-testnet.xyz/evm`
   - Mainnet: `https://rpc.hyperliquid.xyz/evm`
   - Note: Use `rpc.` not `api.` subdomain

3. **Native Token**
   - Uses HYPE for gas, not ETH
   - Get testnet HYPE from: https://app.hyperliquid-testnet.xyz/faucet

## Current Implementation

- Event listeners are disabled in `index.ts`
- Created `hyperEvmPoller.ts` as a template for polling-based monitoring
- All contract interactions (buy/sell) work normally
- GraphQL subscriptions work for UI updates

## Future Improvements

To enable event monitoring on HyperEVM:
1. Implement polling in `hyperEvmPoller.ts`
2. Parse transaction logs manually
3. Update database based on decoded events
4. Emit GraphQL subscriptions for real-time updates

For now, the platform works without automatic event indexing.