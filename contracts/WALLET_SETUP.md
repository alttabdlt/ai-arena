# HyperEVM Wallet Setup Guide

## Quick Setup

1. **Create a new wallet for deployment** (MetaMask recommended)
   - Install MetaMask if you don't have it
   - Create a new account specifically for testnet deployment
   - **NEVER use your main wallet for testnet**

2. **Add HyperEVM Testnet to MetaMask**
   ```
   Network Name: HyperEVM Testnet
   RPC URL: https://rpc.hyperliquid-testnet.xyz/evm
   Chain ID: 998
   Currency Symbol: HYPE
   ```

3. **Get your wallet addresses**
   - **Deployment Wallet**: Copy the address and private key
   - **Treasury Wallet**: Create another account in MetaMask for treasury

4. **Get testnet HYPE tokens**
   - Visit: https://app.hyperliquid-testnet.xyz/faucet
   - Request testnet HYPE tokens
   - You'll need these for gas fees

## Update your .env file

```bash
# Your deployment wallet's private key (keep this secret!)
PRIVATE_KEY=0x... # The private key from MetaMask (Settings > Account Details > Export Private Key)

# Your treasury wallet address (where fees go)
TREASURY_ADDRESS=0x... # The public address of your treasury wallet
```

## Security Notes

- **NEVER share your private key**
- **NEVER commit .env to git** (it's already in .gitignore)
- **Use separate wallets for testnet and mainnet**
- **For mainnet, use a hardware wallet**

## Example addresses (DO NOT USE THESE):
```
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
TREASURY_ADDRESS=0x742d35Cc6634C0532925a3b844Bc9e7595f7842a
```