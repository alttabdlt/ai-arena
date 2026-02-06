declare module '@x402/express' {
  export const paymentMiddleware: any;
}

declare module '@x402/core/server' {
  export const x402ResourceServer: any;
  export const HTTPFacilitatorClient: any;
}

declare module '@x402/evm/exact/server' {
  export const registerExactEvmScheme: any;
}

