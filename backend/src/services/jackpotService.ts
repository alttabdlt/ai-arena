/**
 * JackpotService — Stub for legacy idle game jackpot.
 * Removed during dead code cleanup. Stub prevents GraphQL resolver crashes.
 */

export class JackpotService {
  private static instance: JackpotService | null = null;

  static getInstance(_prisma: any, _pubsub: any): JackpotService {
    if (!JackpotService.instance) {
      JackpotService.instance = new JackpotService();
    }
    return JackpotService.instance;
  }

  async contributeToJackpot(_amount: number): Promise<void> {}

  async checkForJackpotWinWithBonus(_botId: string, _personality: string) {
    return { won: false, amount: 0 };
  }
}
