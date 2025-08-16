import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Network configuration - TESTNET/DEVNET MODE
export const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'devnet';
export const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet');

// Create connection
export const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// Platform wallets - Using user's Phantom devnet wallets
export const PLATFORM_WALLETS = {
  // Treasury wallet for platform fees and rewards
  treasury: new PublicKey(process.env.TREASURY_WALLET_PUBKEY || 'ALF5j6cGmUv18uUvoz4nEMEnyHAJmfKZSQfdKbUwi9vb'),
  
  // Bot deployment fee recipient (Custom wallet)
  deploymentFeeWallet: new PublicKey(process.env.DEPLOYMENT_FEE_WALLET || 'GTqrmffQ8zZv6CfDUGecYyNVgPAptru43dS13V3S5za6'),
  
  // Tournament prize pool escrow (using treasury for now)
  prizePoolEscrow: new PublicKey(process.env.PRIZE_POOL_ESCROW || 'ALF5j6cGmUv18uUvoz4nEMEnyHAJmfKZSQfdKbUwi9vb'),
};

// Fee configuration in SOL - TESTNET FEES
export const SOL_FEE_CONFIG = {
  // Bot deployment fee (in SOL)
  botDeploymentFee: 0.1, // 0.1 SOL for testing
  
  // Energy pack pricing (in SOL)
  energyPacks: {
    small: { energy: 100, cost: 0.01 },     // 0.01 SOL = 100 energy
    medium: { energy: 500, cost: 0.04 },    // 0.04 SOL = 500 energy
    large: { energy: 1000, cost: 0.08 },    // 0.08 SOL = 1000 energy
    mega: { energy: 5000, cost: 0.35 }      // 0.35 SOL = 5000 energy
  },
  
  // Tournament fees (in SOL)
  tournamentEntryFee: 0.05, // 0.05 SOL minimum
  platformFeePercentage: 2, // 2% platform fee on tournaments
  
  // Lootbox pricing (in SOL)
  lootboxPrices: {
    common: 0.05,
    rare: 0.15,
    epic: 0.5,
    legendary: 1.5
  }
};

// Helper functions
export async function getSolBalance(walletPubkey: PublicKey): Promise<number> {
  try {
    const balance = await connection.getBalance(walletPubkey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('Error fetching SOL balance:', error);
    return 0;
  }
}

export async function validateSolanaAddress(address: string): Promise<boolean> {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

// Transaction helper
export async function confirmTransaction(signature: string, maxRetries = 3): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      return !confirmation.value.err;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
}

// Format SOL amount for display
export function formatSolAmount(lamports: number): string {
  const sol = lamports / LAMPORTS_PER_SOL;
  if (sol === 0) return '0 SOL';
  if (sol < 0.001) return '<0.001 SOL';
  if (sol < 1) return `${sol.toFixed(3)} SOL`;
  if (sol < 1000) return `${sol.toFixed(2)} SOL`;
  return `${sol.toFixed(2)} SOL`;
}

// Convert SOL to lamports
export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}

// Get current SOL price from CoinGecko (for display purposes)
export async function getSolPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data = await response.json();
    return data.solana.usd || 0;
  } catch (error) {
    console.error('Error fetching SOL price:', error);
    return 0; // Return 0 if API fails
  }
}

// ========================================
// IDLE TOKEN CONFIGURATION (FOR FUTURE USE)
// ========================================
// The $IDLE token will be launched after the application is complete
// Configuration below is kept for reference but not used during testing

/*
export const IDLE_TOKEN_CONFIG = {
  mint: new PublicKey('IDLE_TOKEN_MINT_ADDRESS'), // Will be set after token launch
  decimals: 9,
  symbol: 'IDLE',
  name: 'IDLE - AI Arena Token',
  
  // Launch on pump.fun
  pumpfunUrl: 'https://pump.fun/IDLE', // Will be set after launch
};

// Fee configuration in $IDLE tokens (FOR MAINNET)
export const IDLE_FEE_CONFIG = {
  botDeploymentFee: 10000,        // 10,000 $IDLE
  tournamentEntryFee: 100,        // 100 $IDLE minimum
  platformFeePercentage: 5,       // 5% platform fee
  
  energyPacks: {
    small: { energy: 100, cost: 100 },
    medium: { energy: 500, cost: 400 },
    large: { energy: 1000, cost: 800 },
    mega: { energy: 5000, cost: 3500 }
  },
  
  lootboxPrices: {
    common: 500,
    rare: 1500,
    epic: 5000,
    legendary: 15000
  },
  
  idleRewardsPerHour: 100,
  maxIdleHours: 24,
  idleBonusMultiplier: {
    criminal: 1.2,
    gambler: 1.0,
    worker: 1.5
  }
};
*/