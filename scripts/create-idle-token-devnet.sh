#!/bin/bash

# Create $IDLE Test Token on Solana Devnet
# This script helps you create and configure the test token

echo "🚀 AI Arena - $IDLE Test Token Setup for Devnet"
echo "================================================"
echo ""

# Check if Solana CLI is installed
if ! command -v solana &> /dev/null; then
    echo "❌ Solana CLI not found. Please install it first:"
    echo "   sh -c \"\$(curl -sSfL https://release.solana.com/stable/install)\""
    exit 1
fi

# Check if SPL Token CLI is installed
if ! command -v spl-token &> /dev/null; then
    echo "❌ SPL Token CLI not found. Installing..."
    cargo install spl-token-cli
fi

echo "📍 Setting up Solana CLI for devnet..."
solana config set --url devnet

echo ""
echo "💰 Checking wallet balance..."
BALANCE=$(solana balance)
echo "   Current balance: $BALANCE"

# Check if balance is sufficient
if [[ $(echo "$BALANCE" | awk '{print $1}' | awk -F. '{print $1}') -lt 1 ]]; then
    echo ""
    echo "⚠️  Low balance detected. Requesting airdrop..."
    solana airdrop 2
    sleep 5
    echo "   New balance: $(solana balance)"
fi

echo ""
echo "🪙 Creating $IDLE token..."
echo "   Token will have 6 decimals (standard for SPL tokens)"

# Create the token
TOKEN_OUTPUT=$(spl-token create-token --decimals 6 2>&1)
TOKEN_MINT=$(echo "$TOKEN_OUTPUT" | grep "Creating token" | awk '{print $3}')

if [ -z "$TOKEN_MINT" ]; then
    echo "❌ Failed to create token. Output:"
    echo "$TOKEN_OUTPUT"
    exit 1
fi

echo "   ✅ Token created: $TOKEN_MINT"

echo ""
echo "📦 Creating token account..."
TOKEN_ACCOUNT=$(spl-token create-account $TOKEN_MINT | grep "Creating account" | awk '{print $3}')
echo "   ✅ Token account: $TOKEN_ACCOUNT"

echo ""
echo "🏭 Minting initial supply..."
echo "   Minting 1,000,000,000 $IDLE tokens..."
spl-token mint $TOKEN_MINT 1000000000

echo ""
echo "📊 Token Summary:"
echo "   =================="
spl-token display $TOKEN_MINT

echo ""
echo "🎯 Next Steps:"
echo "   1. Update your .env files with the token mint address:"
echo "      IDLE_TOKEN_MINT=$TOKEN_MINT"
echo "      VITE_IDLE_TOKEN_MINT=$TOKEN_MINT"
echo ""
echo "   2. Update your wallet addresses in .env:"
echo "      TREASURY_WALLET_PUBKEY=$(solana address)"
echo "      DEPLOYMENT_FEE_WALLET=$(solana address)"
echo ""
echo "   3. To send test tokens to another wallet:"
echo "      spl-token transfer $TOKEN_MINT <AMOUNT> <RECIPIENT_ADDRESS>"
echo ""
echo "   4. View on Solscan:"
echo "      https://solscan.io/token/$TOKEN_MINT?cluster=devnet"
echo ""
echo "✅ $IDLE test token setup complete!"