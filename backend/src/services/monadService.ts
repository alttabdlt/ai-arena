/**
 * MonadService — On-chain integration with Monad testnet.
 * 
 * Handles:
 * - Reading contract state (ArenaToken balance, WagerEscrow matches)
 * - Submitting match results on-chain (optional, for demo)
 * - Token transfers for wager settlements
 * 
 * Uses ethers.js v6 for Monad (EVM-compatible).
 */

import { ethers } from 'ethers';

// ============================================
// Contract ABIs (minimal — only what we need)
// ============================================

const ARENA_TOKEN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 value) returns (bool)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

const WAGER_ESCROW_ABI = [
  'function owner() view returns (address)',
  'function treasury() view returns (address)',
  'function rakePercent() view returns (uint256)',
  'function paused() view returns (bool)',
  'function getMatch(bytes32 matchId) view returns (tuple(address player1, address player2, address token, uint256 wagerAmount, uint8 status, uint256 createdAt))',
  'function createMatch(bytes32 matchId, address token, uint256 wagerAmount)',
  'function joinMatch(bytes32 matchId)',
  'function resolveMatch(bytes32 matchId, address winner)',
  'function cancelMatch(bytes32 matchId)',
  'event MatchCreated(bytes32 indexed matchId, address indexed player1, address token, uint256 wagerAmount)',
  'event MatchJoined(bytes32 indexed matchId, address indexed player2)',
  'event MatchResolved(bytes32 indexed matchId, address indexed winner, uint256 payout, uint256 rake)',
  'event MatchCancelled(bytes32 indexed matchId)',
];

// ============================================
// Types
// ============================================

interface MonadConfig {
  rpcUrl: string;
  chainId: number;
  deployerKey: string;
  arenaTokenAddress: string;
  wagerEscrowAddress: string;
  treasuryAddress: string;
}

interface OnChainStatus {
  connected: boolean;
  chainId: number;
  blockNumber: number;
  deployerBalance: string;
  arenaTokenBalance: string;
  escrowPaused: boolean;
  escrowRakePercent: number;
}

// ============================================
// Service
// ============================================

class MonadService {
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;
  private arenaToken: ethers.Contract | null = null;
  private wagerEscrow: ethers.Contract | null = null;
  private config: MonadConfig | null = null;
  private initialized = false;

  constructor() {
    this.tryInit();
  }

  private tryInit() {
    const rpcUrl = process.env.MONAD_RPC_URL;
    const deployerKey = process.env.MONAD_DEPLOYER_KEY;
    const arenaTokenAddress = process.env.ARENA_TOKEN_ADDRESS;
    const wagerEscrowAddress = process.env.WAGER_ESCROW_ADDRESS;
    const treasuryAddress = process.env.TREASURY_ADDRESS;

    if (!rpcUrl || !deployerKey || !arenaTokenAddress || !wagerEscrowAddress) {
      console.log('[Monad] Not configured — on-chain features disabled');
      return;
    }

    try {
      this.config = {
        rpcUrl,
        chainId: parseInt(process.env.MONAD_CHAIN_ID || '10143'),
        deployerKey,
        arenaTokenAddress,
        wagerEscrowAddress,
        treasuryAddress: treasuryAddress || arenaTokenAddress,
      };

      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(deployerKey, this.provider);
      this.arenaToken = new ethers.Contract(arenaTokenAddress, ARENA_TOKEN_ABI, this.wallet);
      this.wagerEscrow = new ethers.Contract(wagerEscrowAddress, WAGER_ESCROW_ABI, this.wallet);
      this.initialized = true;
      console.log(`[Monad] Connected to ${rpcUrl} (chain ${this.config.chainId})`);
      console.log(`[Monad] ArenaToken: ${arenaTokenAddress}`);
      console.log(`[Monad] WagerEscrow: ${wagerEscrowAddress}`);
    } catch (err: any) {
      console.error(`[Monad] Init failed: ${err.message}`);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // ============================================
  // Read Operations
  // ============================================

  async getStatus(): Promise<OnChainStatus> {
    if (!this.initialized || !this.provider || !this.wallet) {
      return {
        connected: false,
        chainId: 0,
        blockNumber: 0,
        deployerBalance: '0',
        arenaTokenBalance: '0',
        escrowPaused: false,
        escrowRakePercent: 0,
      };
    }

    try {
      const [blockNumber, balance, tokenBalance, paused, rake] = await Promise.all([
        this.provider.getBlockNumber(),
        this.provider.getBalance(this.wallet.address),
        this.arenaToken!.balanceOf(this.wallet.address),
        this.wagerEscrow!.paused(),
        this.wagerEscrow!.rakePercent(),
      ]);

      return {
        connected: true,
        chainId: this.config!.chainId,
        blockNumber,
        deployerBalance: ethers.formatEther(balance),
        arenaTokenBalance: ethers.formatUnits(tokenBalance, 18),
        escrowPaused: paused,
        escrowRakePercent: Number(rake),
      };
    } catch (err: any) {
      console.error(`[Monad] getStatus failed: ${err.message}`);
      return {
        connected: false,
        chainId: this.config?.chainId || 0,
        blockNumber: 0,
        deployerBalance: '0',
        arenaTokenBalance: '0',
        escrowPaused: false,
        escrowRakePercent: 0,
      };
    }
  }

  // ============================================
  // Write Operations (for demo)
  // ============================================

  /**
   * Record a match result on-chain by calling WagerEscrow.
   * For the demo, the deployer acts as the oracle/admin.
   *
   * In production, each agent would have its own wallet and deposit tokens.
   * For demo purposes, we just log the result on-chain.
   */
  async recordMatchOnChain(matchId: string, winnerId: string | null): Promise<string | null> {
    if (!this.initialized || !this.wagerEscrow || !this.wallet) {
      return null;
    }

    try {
      // Convert matchId to bytes32 hash
      const matchHash = ethers.id(matchId);

      // For demo: just emit a log transaction (cheaper than full escrow flow)
      // The full flow would be: createMatch → joinMatch → resolveMatch
      // But that requires funding agent wallets with tokens
      
      // Instead, we'll use a simple transfer as a receipt
      // This proves the integration works without complex token funding
      console.log(`[Monad] Recording match ${matchId.slice(0, 12)}... on-chain (hash: ${matchHash.slice(0, 12)}...)`);
      
      // Send a tiny amount of MON as a receipt transaction
      const tx = await this.wallet.sendTransaction({
        to: this.config!.treasuryAddress,
        value: ethers.parseEther('0.000001'), // Dust amount as receipt
        data: ethers.AbiCoder.defaultAbiCoder().encode(
          ['bytes32', 'string'],
          [matchHash, winnerId || 'draw']
        ),
      });
      
      console.log(`[Monad] Tx submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`[Monad] Tx confirmed in block ${receipt?.blockNumber}`);
      
      return tx.hash;
    } catch (err: any) {
      console.error(`[Monad] recordMatchOnChain failed: ${err.message}`);
      return null;
    }
  }

  // ============================================
  // Getters
  // ============================================

  getConfig() {
    return this.config;
  }

  getDeployerAddress(): string | null {
    return this.wallet?.address || null;
  }
}

// Singleton
export const monadService = new MonadService();
