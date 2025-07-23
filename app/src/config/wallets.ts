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
  // Bot deployment fee in HYPE
  DEPLOYMENT_FEE: import.meta.env.VITE_DEPLOYMENT_FEE_HYPE || '0.01',
  
  // Platform takes this percentage of tournament entry fees
  TOURNAMENT_FEE_PERCENTAGE: parseInt(import.meta.env.VITE_TOURNAMENT_FEE_PERCENTAGE || '5'),
} as const;

// Helper functions for fee calculations
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