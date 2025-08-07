// Wallet addresses for HyperEVM deployment
// These should match the values in your .env files

export const WALLET_ADDRESSES = {
  // Bot deployment fees (0.01 HYPE per bot) go here
  DEPLOYMENT_WALLET: import.meta.env.VITE_DEPLOYMENT_WALLET_ADDRESS || '0x0000000000000000000000000000000000000000',
  
  // Platform treasury for tournament prizes and fees
  TREASURY_WALLET: import.meta.env.VITE_TREASURY_WALLET_ADDRESS || '0x0000000000000000000000000000000000000000',
  
  // HyperCore to HyperEVM bridge
  HYPEREVM_BRIDGE: import.meta.env.VITE_HYPEREVM_BRIDGE_ADDRESS || '0x2222222222222222222222222222222222222222',
} as const;

export const FEE_CONFIG = {
  // Flat bot deployment fee in HYPE (low barrier to entry)
  DEPLOYMENT_FEE: import.meta.env.VITE_DEPLOYMENT_FEE_HYPE || '0.1',
  
  // Energy pack pricing in HYPE
  ENERGY_PACKS: {
    small: { energy: 100, cost: 0.5 },    // 0.005 HYPE per energy
    medium: { energy: 500, cost: 2.0 },   // 0.004 HYPE per energy (20% discount)
    large: { energy: 1000, cost: 3.5 },   // 0.0035 HYPE per energy (30% discount)
    mega: { energy: 5000, cost: 15.0 }    // 0.003 HYPE per energy (40% discount)
  },
  
  // Tournament energy cost
  TOURNAMENT_ENERGY_COST: 10,
  
  // Platform takes this percentage of tournament entry fees
  TOURNAMENT_FEE_PERCENTAGE: parseInt(import.meta.env.VITE_TOURNAMENT_FEE_PERCENTAGE || '5'),
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

// Validate wallet addresses
export const isValidWalletAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// Check if using default addresses (for warnings)
export const isUsingDefaultAddresses = (): boolean => {
  return (
    WALLET_ADDRESSES.DEPLOYMENT_WALLET === '0x0000000000000000000000000000000000000000' ||
    WALLET_ADDRESSES.TREASURY_WALLET === '0x0000000000000000000000000000000000000000'
  );
};