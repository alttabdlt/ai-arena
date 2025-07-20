export const CONTRACT_ADDRESSES = {
  // HyperEVM Testnet
  998: {
    bondingCurveFactory: '0xb35B3D03385698eD0B02Ba26fEA8342f3B499A1A',
    graduationController: '0x578dA0744Df7FeFAf4806cCbD1017569B537C45d',
    treasury: '0x64c1b470c71749FcF9889717f2e762EB9f0F38d3',
  },
  // HyperEVM Mainnet (to be deployed)
  999: {
    bondingCurveFactory: '',
    graduationController: '',
    treasury: '',
  },
} as const;

export const getContractAddresses = (chainId: number) => {
  const addresses = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES];
  if (!addresses) {
    throw new Error(`No contract addresses for chain ${chainId}`);
  }
  return addresses;
};