/**
 * AgentFundingService — verifies on-chain $ARENA transfers to player wallet
 * and converts them into in-game bankroll top-ups.
 *
 * Funding proof model:
 * - Player pastes a Monad tx hash.
 * - We verify successful tx receipt.
 * - We parse ArenaToken Transfer events in that tx.
 * - We sum transfers where `to == playerWallet`.
 * - Credited bankroll = floor(rawAmount / 10^decimals).
 */

import { ethers } from 'ethers';

const ERC20_TRANSFER_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function decimals() view returns (uint8)',
] as const;

const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

function safeTrim(value: unknown, maxLen: number): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function normalizeWallet(value: unknown): string {
  return safeTrim(value, 140).toLowerCase();
}

export interface FundingVerification {
  txHash: string;
  creditedArena: number;
  rawAmount: string;
  blockNumber: number | null;
}

class AgentFundingService {
  private provider: ethers.JsonRpcProvider | null = null;
  private tokenAddress: string | null = null;
  private tokenAddressNormalized: string | null = null;
  private tokenContract: ethers.Contract | null = null;
  private decimals: number | null = null;

  constructor() {
    this.tryInit();
  }

  private tryInit(): void {
    const rpcUrl = safeTrim(process.env.MONAD_RPC_URL, 300);
    const tokenAddress = safeTrim(process.env.ARENA_TOKEN_ADDRESS || '0xC9795A42b7f31D2c1a0B67E7E1b8ea6729957777', 120);
    if (!rpcUrl || !tokenAddress) {
      console.log('[Funding] MONAD_RPC_URL / ARENA_TOKEN_ADDRESS missing. Funding verification disabled.');
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.tokenAddress = tokenAddress;
      this.tokenAddressNormalized = tokenAddress.toLowerCase();
      this.tokenContract = new ethers.Contract(tokenAddress, ERC20_TRANSFER_ABI, this.provider);
      console.log(`[Funding] Enabled tx verification for token ${tokenAddress}`);
    } catch (error: any) {
      console.error(`[Funding] Init failed: ${error?.message || error}`);
      this.provider = null;
      this.tokenAddress = null;
      this.tokenAddressNormalized = null;
      this.tokenContract = null;
    }
  }

  isReady(): boolean {
    return Boolean(this.provider && this.tokenContract && this.tokenAddressNormalized);
  }

  getTokenAddress(): string {
    return this.tokenAddress || '0xC9795A42b7f31D2c1a0B67E7E1b8ea6729957777';
  }

  private async getDecimals(): Promise<number> {
    if (this.decimals != null) return this.decimals;
    if (!this.tokenContract) return 18;
    try {
      const decimals = Number(await this.tokenContract.decimals());
      this.decimals = Number.isFinite(decimals) && decimals > 0 && decimals < 40 ? decimals : 18;
      return this.decimals;
    } catch {
      this.decimals = 18;
      return 18;
    }
  }

  async verifyFundingTx(params: { txHash: string; walletAddress: string }): Promise<FundingVerification> {
    if (!this.provider || !this.tokenAddressNormalized) {
      throw new Error('Funding verifier unavailable. Backend missing Monad RPC config.');
    }

    const txHash = safeTrim(params.txHash, 100);
    if (!TX_HASH_REGEX.test(txHash)) {
      throw new Error('Invalid tx hash format.');
    }

    const wallet = normalizeWallet(params.walletAddress);
    if (!wallet || !wallet.startsWith('0x')) {
      throw new Error('Valid player wallet is required.');
    }

    const receipt = await this.provider.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error('Transaction not found yet. Wait for confirmation.');
    }
    if (receipt.status !== 1) {
      throw new Error('Transaction failed on-chain.');
    }

    const iface = new ethers.Interface(ERC20_TRANSFER_ABI);
    let totalRaw = 0n;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== this.tokenAddressNormalized) continue;
      try {
        const parsed = iface.parseLog(log);
        if (!parsed || parsed.name !== 'Transfer') continue;
        const to = normalizeWallet(parsed.args.to);
        if (to !== wallet) continue;
        const amount = BigInt(parsed.args.value.toString());
        if (amount > 0n) totalRaw += amount;
      } catch {
        // Non-transfer token log or decode failure. Ignore.
      }
    }

    if (totalRaw <= 0n) {
      throw new Error('No $ARENA transfer to your wallet found in this tx.');
    }

    const decimals = await this.getDecimals();
    const divisor = 10n ** BigInt(decimals);
    const creditedArenaBig = totalRaw / divisor;
    if (creditedArenaBig <= 0n) {
      throw new Error('Transfer amount is too small to credit (must be at least 1 $ARENA).');
    }
    if (creditedArenaBig > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('Transfer amount too large.');
    }

    return {
      txHash: txHash.toLowerCase(),
      creditedArena: Number(creditedArenaBig),
      rawAmount: totalRaw.toString(),
      blockNumber: Number.isFinite(Number(receipt.blockNumber)) ? Number(receipt.blockNumber) : null,
    };
  }
}

export const agentFundingService = new AgentFundingService();
