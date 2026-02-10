/**
 * AuthService — Stub for legacy wallet authentication.
 * The actual auth service was removed during dead code cleanup.
 * This stub prevents GraphQL resolver import errors.
 * Wallet auth now handled by Privy (frontend-only).
 */

export class AuthService {
  constructor(_prisma: any, _redis: any) {}

  async generateNonce(_address: string): Promise<string> {
    return Math.random().toString(36).substring(2);
  }

  generateSignMessage(nonce: string): string {
    return `Sign this message to verify your wallet: ${nonce}`;
  }

  async verifyWalletSignature(_address: string, _message: string, _signature: string): Promise<boolean> {
    return false; // Disabled — use Privy
  }

  async authenticateWallet(_address: string, _signature: string, _nonce: string) {
    throw new Error('Legacy wallet auth disabled. Use Privy for wallet onboarding.');
  }

  async refreshTokens(_refreshToken: string) {
    throw new Error('Legacy wallet auth disabled. Use Privy for wallet onboarding.');
  }

  async logout(_userId: string): Promise<void> {}
}
