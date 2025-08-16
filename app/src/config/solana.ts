import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { clusterApiUrl } from '@solana/web3.js';

// Network configuration - DEVNET/TESTNET MODE
export const network = WalletAdapterNetwork.Devnet;
export const endpoint = import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl(network);

// Platform wallets - Must match backend configuration
export const PLATFORM_WALLETS = {
  treasury: new PublicKey(import.meta.env.VITE_TREASURY_WALLET_ADDRESS || 'ALF5j6cGmUv18uUvoz4nEMEnyHAJmfKZSQfdKbUwi9vb'),
  deploymentFees: new PublicKey(import.meta.env.VITE_DEPLOYMENT_WALLET_ADDRESS || 'GTqrmffQ8zZv6CfDUGecYyNVgPAptru43dS13V3S5za6'),
  prizePool: new PublicKey(import.meta.env.VITE_PRIZE_POOL_WALLET || 'ALF5j6cGmUv18uUvoz4nEMEnyHAJmfKZSQfdKbUwi9vb'),
};

// Fee configuration in SOL - TESTNET FEES (matching backend)
export const FEES = {
  botDeployment: 0.1,      // 0.1 SOL for testing
  tournamentEntry: 0.05,   // 0.05 SOL minimum
  platformFeePercent: 2,   // 2% of tournament prizes
  
  energyPacks: {
    small: { energy: 100, cost: 0.01, savings: 0 },
    medium: { energy: 500, cost: 0.04, savings: 20 },
    large: { energy: 1000, cost: 0.08, savings: 20 },
    mega: { energy: 5000, cost: 0.35, savings: 30 }
  },
  
  lootboxes: {
    common: { cost: 0.05, color: 'text-gray-500' },
    rare: { cost: 0.15, color: 'text-blue-500' },
    epic: { cost: 0.5, color: 'text-purple-500' },
    legendary: { cost: 1.5, color: 'text-orange-500' }
  }
};

// Format SOL amounts for display
export function formatSolAmount(lamports: number): string {
  const sol = lamports / LAMPORTS_PER_SOL;
  
  if (sol === 0) return '0 SOL';
  if (sol < 0.001) return '<0.001 SOL';
  if (sol < 1) return `${sol.toFixed(4)} SOL`;
  if (sol < 1000) return `${sol.toFixed(2)} SOL`;
  if (sol < 1000000) return `${(sol / 1000).toFixed(1)}K SOL`;
  return `${(sol / 1000000).toFixed(2)}M SOL`;
}

// Format USD value (using live SOL price)
export function formatUsdValue(lamports: number, solPrice: number): string {
  const sol = lamports / LAMPORTS_PER_SOL;
  const value = sol * solPrice;
  
  if (value < 0.01) return '<$0.01';
  if (value < 1) return `$${value.toFixed(3)}`;
  if (value < 1000) return `$${value.toFixed(2)}`;
  if (value < 1000000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${(value / 1000000).toFixed(2)}M`;
}

// Convert SOL to lamports
export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}

// Validate Solana address
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

// Get explorer link - DEVNET VERSION
export function getExplorerLink(
  type: 'address' | 'tx' | 'token',
  id: string,
  cluster: 'mainnet-beta' | 'devnet' = 'devnet' // Default to devnet for testing
): string {
  const baseUrl = 'https://explorer.solana.com';
  const clusterParam = `?cluster=${cluster}`;
  
  switch (type) {
    case 'address':
      return `${baseUrl}/address/${id}${clusterParam}`;
    case 'tx':
      return `${baseUrl}/tx/${id}${clusterParam}`;
    case 'token':
      return `${baseUrl}/address/${id}${clusterParam}`;
    default:
      return baseUrl;
  }
}

// Fetch SOL price from CoinGecko
export async function fetchSolPriceData(): Promise<{
  price: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
} | null> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=solana');
    const data = await response.json();
    
    if (data && data.length > 0) {
      const solData = data[0];
      return {
        price: solData.current_price || 0,
        marketCap: solData.market_cap || 0,
        volume24h: solData.total_volume || 0,
        priceChange24h: solData.price_change_percentage_24h || 0
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching SOL price data:', error);
    return null;
  }
}

// ========================================
// IDLE TOKEN CONFIGURATION (FOR FUTURE USE)
// ========================================
// The $IDLE token will be launched after the application is complete
// Configuration below is kept for reference but not used during testing

/*
export const IDLE_TOKEN = {
  mint: new PublicKey('IDLE_TOKEN_MINT_ADDRESS'), // Will be set after token launch
  decimals: 9,
  symbol: 'IDLE',
  name: 'IDLE - AI Arena Token',
  pumpfunUrl: 'https://pump.fun/IDLE' // Will be set after launch
};

// Idle rewards configuration (FOR MAINNET)
export const IDLE_REWARDS = {
  baseRate: 100, // 100 $IDLE per hour
  maxHours: 24,
  
  personalityMultipliers: {
    CRIMINAL: 1.2,
    GAMBLER: 1.0,
    WORKER: 1.5
  }
};
*/