// Wallet addresses for HyperEVM deployment
// These should match the values in your .env files

export const WALLET_ADDRESSES = {
  // Bot deployment fees (0.01 HYPE per bot) go here
  DEPLOYMENT_WALLET: process.env.DEPLOYMENT_WALLET_ADDRESS || '0x0000000000000000000000000000000000000000',
  
  // Platform treasury for tournament prizes and fees
  TREASURY_WALLET: process.env.TREASURY_WALLET_ADDRESS || '0x0000000000000000000000000000000000000000',
  
  // HyperCore to HyperEVM bridge
  HYPEREVM_BRIDGE: process.env.HYPEREVM_BRIDGE_ADDRESS || '0x2222222222222222222222222222222222222222',
} as const;

export const FEE_CONFIG = {
  // Bot deployment fee in HYPE
  DEPLOYMENT_FEE: process.env.DEPLOYMENT_FEE_HYPE || '0.01',
  
  // Platform takes this percentage of tournament entry fees
  TOURNAMENT_FEE_PERCENTAGE: parseInt(process.env.TOURNAMENT_FEE_PERCENTAGE || '5'),
} as const;

// Helper functions for fee calculations
export const calculatePlatformFee = (entryFee: string): string => {
  const fee = parseFloat(entryFee);
  const platformFee = (fee * FEE_CONFIG.TOURNAMENT_FEE_PERCENTAGE) / 100;
  return platformFee.toFixed(6);
};

export const calculatePrizePool = (entryFee: string, participants: number): string => {
  const fee = parseFloat(entryFee);
  const totalFees = fee * participants;
  const platformFee = (totalFees * FEE_CONFIG.TOURNAMENT_FEE_PERCENTAGE) / 100;
  const prizePool = totalFees - platformFee;
  return prizePool.toFixed(6);
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

// Log wallet configuration on startup
export const logWalletConfig = (): void => {
  console.log('💰 Wallet Configuration:');
  console.log(`   Deployment Wallet: ${WALLET_ADDRESSES.DEPLOYMENT_WALLET}`);
  console.log(`   Treasury Wallet: ${WALLET_ADDRESSES.TREASURY_WALLET}`);
  console.log(`   HyperEVM Bridge: ${WALLET_ADDRESSES.HYPEREVM_BRIDGE}`);
  console.log(`   Deployment Fee: ${FEE_CONFIG.DEPLOYMENT_FEE} HYPE`);
  console.log(`   Tournament Fee: ${FEE_CONFIG.TOURNAMENT_FEE_PERCENTAGE}%`);
  
  if (isUsingDefaultAddresses()) {
    console.warn('⚠️  WARNING: Using default wallet addresses. Update .env before production!');
  }
};