export const CONTRACT_ADDRESSES = {
  // HyperEVM Testnet
  998: {
    bondingCurveFactory: '0xb35B3D03385698eD0B02Ba26fEA8342f3B499A1A',
    graduationController: '0x578dA0744Df7FeFAf4806cCbD1017569B537C45d',
  },
  // HyperEVM Mainnet
  999: {
    bondingCurveFactory: '0x...', // To be deployed
    graduationController: '0x...', // To be deployed
  },
} as const;

export function getContractAddresses(chainId: number) {
  const addresses = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES];
  if (!addresses) {
    throw new Error(`No contract addresses for chain ${chainId}`);
  }
  return addresses;
}