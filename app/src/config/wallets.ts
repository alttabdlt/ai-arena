// Wallet addresses for Solana deployment
// These should match the values in your .env files

export const WALLET_ADDRESSES = {
  // Bot deployment fees (10,000 $IDLE per bot) go here
  DEPLOYMENT_WALLET: import.meta.env.VITE_DEPLOYMENT_WALLET_ADDRESS || '11111111111111111111111111111111',
  
  // Platform treasury for tournament prizes and fees
  TREASURY_WALLET: import.meta.env.VITE_TREASURY_WALLET_ADDRESS || '11111111111111111111111111111111',
  
  // $IDLE token mint address (update after pump.fun launch)
  IDLE_TOKEN_MINT: import.meta.env.VITE_IDLE_TOKEN_MINT || '11111111111111111111111111111111',
} as const;

export const FEE_CONFIG = {
  // Flat bot deployment fee in $IDLE tokens
  DEPLOYMENT_FEE: import.meta.env.VITE_DEPLOYMENT_FEE_IDLE || '10000',
  
  // Energy pack pricing in $IDLE
  ENERGY_PACKS: {
    small: { energy: 100, cost: 100 },    // 1 $IDLE per energy
    medium: { energy: 500, cost: 450 },   // 0.9 $IDLE per energy (10% discount)
    large: { energy: 1000, cost: 800 },   // 0.8 $IDLE per energy (20% discount)
    mega: { energy: 5000, cost: 3500 }    // 0.7 $IDLE per energy (30% discount)
  },
  
  // Tournament entry fee in $IDLE
  TOURNAMENT_ENTRY_FEE: parseInt(import.meta.env.VITE_TOURNAMENT_ENTRY_FEE || '1000'),
  
  // Platform takes this percentage of tournament entry fees
  TOURNAMENT_FEE_PERCENTAGE: parseInt(import.meta.env.VITE_TOURNAMENT_FEE_PERCENTAGE || '2'),
} as const;

// Helper functions for fee calculations
export const getEnergyPackCost = (packType: 'small' | 'medium' | 'large' | 'mega'): number => {
  return FEE_CONFIG.ENERGY_PACKS[packType].cost;
};

export const getEnergyPackAmount = (packType: 'small' | 'medium' | 'large' | 'mega'): number => {
  return FEE_CONFIG.ENERGY_PACKS[packType].energy;
};

export const calculatePlatformFee = (entryFee: number): number => {
  return (entryFee * FEE_CONFIG.TOURNAMENT_FEE_PERCENTAGE) / 100;
};

export const calculatePrizePool = (entryFee: number, participants: number): number => {
  const totalFees = entryFee * participants;
  const platformFee = calculatePlatformFee(totalFees);
  return totalFees - platformFee;
};

// Validate wallet addresses (Solana base58 format)
export const isValidWalletAddress = (address: string): boolean => {
  // Solana addresses are base58 encoded and typically 32-44 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
};

// Check if using default addresses (for warnings)
export const isUsingDefaultAddresses = (): boolean => {
  return (
    WALLET_ADDRESSES.DEPLOYMENT_WALLET === '11111111111111111111111111111111' ||
    WALLET_ADDRESSES.TREASURY_WALLET === '11111111111111111111111111111111'
  );
};