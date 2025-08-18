import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { PubSub } from 'graphql-subscriptions';
import { 
  connection, 
  PLATFORM_WALLETS,
  SOL_FEE_CONFIG,
  getSolBalance
} from '../config/solana';

interface TransactionLog {
  signature: string;
  type: 'deployment' | 'energy' | 'tournament' | 'lootbox';
  amount: number; // in SOL
  from: string;
  to: string;
  timestamp: Date;
  metadata?: any;
}

export class SolanaService {
  // private prisma: PrismaClient; // Unused
  private redis: Redis;
  private pubsub: PubSub;
  private subscriptionId: number | null = null;
  // private lastSignature: string | null = null; // Unused
  private isMonitoring: boolean = false;

  constructor(_prisma: PrismaClient, redis: Redis, pubsub: PubSub) {
    // this.prisma = prisma; // Unused
    this.redis = redis;
    this.pubsub = pubsub;
  }

  /**
   * Start monitoring Solana transactions for SOL payments
   */
  async start() {
    try {
      console.log('Starting Solana service for SOL transaction monitoring...');
      
      // Start monitoring native SOL transactions
      await this.monitorSolTransactions();
      
      console.log('Solana service started successfully');
    } catch (error) {
      console.error('Failed to start Solana service:', error);
    }
  }

  /**
   * Stop monitoring
   */
  async stop() {
    this.isMonitoring = false;
    if (this.subscriptionId !== null) {
      await connection.removeAccountChangeListener(this.subscriptionId);
      this.subscriptionId = null;
    }
    console.log('Solana service stopped');
  }

  /**
   * Monitor SOL transactions to platform wallets
   */
  private async monitorSolTransactions() {
    this.isMonitoring = true;
    
    // Subscribe to treasury wallet SOL balance changes
    this.subscriptionId = connection.onAccountChange(
      PLATFORM_WALLETS.treasury,
      async (accountInfo, context) => {
        if (!this.isMonitoring) return;
        
        const newBalance = accountInfo.lamports / LAMPORTS_PER_SOL;
        console.log('💰 Treasury balance changed:', {
          slot: context.slot,
          balance: `${newBalance.toFixed(4)} SOL`
        });
        
        // Emit balance update event
        await this.pubsub.publish('TREASURY_BALANCE_UPDATE', {
          treasuryBalanceUpdate: {
            balance: newBalance,
            timestamp: new Date()
          }
        });
      },
      'confirmed'
    );

    // Also monitor deployment fee wallet
    connection.onAccountChange(
      PLATFORM_WALLETS.deploymentFeeWallet,
      async (accountInfo, context) => {
        if (!this.isMonitoring) return;
        
        const newBalance = accountInfo.lamports / LAMPORTS_PER_SOL;
        console.log('🤖 Deployment wallet balance changed:', {
          slot: context.slot,
          balance: `${newBalance.toFixed(4)} SOL`
        });
      },
      'confirmed'
    );

    // Poll for recent transactions periodically
    setInterval(() => this.pollRecentTransactions(), 10000); // Every 10 seconds
  }

  /**
   * Poll for recent transactions to platform wallets
   */
  private async pollRecentTransactions() {
    if (!this.isMonitoring) return;

    try {
      // Get recent signatures for treasury wallet
      const signatures = await connection.getSignaturesForAddress(
        PLATFORM_WALLETS.treasury,
        { limit: 10 }
      );

      for (const sig of signatures) {
        // Skip if we've already processed this transaction
        const cacheKey = `tx:processed:${sig.signature}`;
        const processed = await this.redis.get(cacheKey);
        if (processed) continue;

        // Get full transaction details
        const tx = await connection.getParsedTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0
        });

        if (!tx || !tx.meta) continue;

        // Determine transaction type and amount
        const accountKeys = tx.transaction.message.accountKeys;
        const treasuryIndex = accountKeys.findIndex(
          key => key.pubkey.equals(PLATFORM_WALLETS.treasury)
        );

        if (treasuryIndex !== -1) {
          const preBalance = tx.meta.preBalances[treasuryIndex];
          const postBalance = tx.meta.postBalances[treasuryIndex];
          const received = (postBalance - preBalance) / LAMPORTS_PER_SOL;

          if (received > 0) {
            console.log(`📥 Incoming SOL transaction detected:`);
            console.log(`   Amount: ${received.toFixed(4)} SOL`);
            console.log(`   Signature: ${sig.signature}`);
            
            // Emit transaction event
            await this.pubsub.publish('SOL_TRANSACTION', {
              solTransaction: {
                signature: sig.signature,
                amount: received,
                timestamp: new Date(sig.blockTime! * 1000),
                type: this.determineTransactionType(received)
              }
            });

            // Mark as processed (cache for 1 hour)
            await this.redis.set(cacheKey, '1', 'EX', 3600);
          }
        }
      }
    } catch (error) {
      console.error('Error polling transactions:', error);
    }
  }

  /**
   * Determine transaction type based on amount
   */
  private determineTransactionType(amount: number): string {
    // Match against known fee amounts
    if (Math.abs(amount - SOL_FEE_CONFIG.botDeploymentFee) < 0.0001) {
      return 'deployment';
    }
    if (Math.abs(amount - SOL_FEE_CONFIG.tournamentEntryFee) < 0.0001) {
      return 'tournament';
    }
    
    // Check energy pack prices
    for (const [packType, pack] of Object.entries(SOL_FEE_CONFIG.energyPacks)) {
      if (Math.abs(amount - pack.cost) < 0.0001) {
        return `energy_${packType}`;
      }
    }
    
    // Check lootbox prices
    for (const [boxType, price] of Object.entries(SOL_FEE_CONFIG.lootboxPrices)) {
      if (Math.abs(amount - price) < 0.0001) {
        return `lootbox_${boxType}`;
      }
    }
    
    return 'unknown';
  }

  /**
   * Get wallet SOL balance
   */
  async getWalletBalance(walletAddress: string): Promise<number> {
    try {
      const pubkey = new PublicKey(walletAddress);
      return await getSolBalance(pubkey);
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      return 0;
    }
  }

  /**
   * Get platform wallet balances
   */
  async getPlatformBalances(): Promise<{
    treasury: number;
    deploymentFees: number;
    prizePool: number;
    total: number;
  }> {
    const [treasury, deploymentFees, prizePool] = await Promise.all([
      getSolBalance(PLATFORM_WALLETS.treasury),
      getSolBalance(PLATFORM_WALLETS.deploymentFeeWallet),
      getSolBalance(PLATFORM_WALLETS.prizePoolEscrow)
    ]);

    return {
      treasury,
      deploymentFees,
      prizePool,
      total: treasury + deploymentFees + prizePool
    };
  }

  /**
   * Verify a user has sufficient SOL balance for an action
   */
  async verifyBalance(walletAddress: string, requiredAmount: number): Promise<{
    hasBalance: boolean;
    currentBalance: number;
    required: number;
    shortfall?: number;
  }> {
    const balance = await this.getWalletBalance(walletAddress);
    const hasBalance = balance >= requiredAmount;
    
    return {
      hasBalance,
      currentBalance: balance,
      required: requiredAmount,
      shortfall: hasBalance ? undefined : requiredAmount - balance
    };
  }

  /**
   * Log transaction for tracking
   */
  async logTransaction(log: TransactionLog): Promise<void> {
    const key = `tx:log:${log.signature}`;
    await this.redis.set(key, JSON.stringify(log), 'EX', 86400 * 7); // Keep for 7 days
    
    console.log(`📝 Transaction logged:`, {
      type: log.type,
      amount: `${log.amount} SOL`,
      signature: log.signature.substring(0, 20) + '...'
    });
  }

  /**
   * Get recent transactions
   */
  async getRecentTransactions(limit: number = 10): Promise<TransactionLog[]> {
    const keys = await this.redis.keys('tx:log:*');
    const transactions: TransactionLog[] = [];
    
    for (const key of keys.slice(0, limit)) {
      const data = await this.redis.get(key);
      if (data) {
        transactions.push(JSON.parse(data));
      }
    }
    
    return transactions.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }
}