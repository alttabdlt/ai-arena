import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { PrismaClient } from '@prisma/client';
import { 
  connection, 
  PLATFORM_WALLETS,
  SOL_FEE_CONFIG,
  solToLamports
} from '../config/solana';

export class TransactionService {
  private connection: Connection;
  private DEPLOYMENT_FEE = SOL_FEE_CONFIG.botDeploymentFee; // 0.1 SOL
  private DEPLOYMENT_WALLET: PublicKey;
  private TREASURY_WALLET: PublicKey;
  private TOURNAMENT_FEE_PERCENTAGE: number;

  constructor(_prisma: PrismaClient) {
    this.connection = connection;
    
    this.DEPLOYMENT_WALLET = PLATFORM_WALLETS.deploymentFeeWallet;
    this.TREASURY_WALLET = PLATFORM_WALLETS.treasury;
    this.TOURNAMENT_FEE_PERCENTAGE = SOL_FEE_CONFIG.platformFeePercentage;
  }

  /**
   * Validate SOL payment for bot deployment
   */
  async validateDeploymentTransaction(txSignature: string, senderAddress: string): Promise<{
    isValid: boolean;
    error?: string;
  }> {
    // Use default deployment fee
    return this.validateDeploymentTransactionWithAmount(txSignature, senderAddress, this.DEPLOYMENT_FEE * LAMPORTS_PER_SOL);
  }
  
  /**
   * Validate payment with specific amount (for progressive pricing)
   * @param txSignature - Solana transaction signature
   * @param senderAddress - Sender wallet address
   * @param requiredAmount - Required amount in $IDLE tokens (or lamports for SOL)
   */
  async validateDeploymentTransactionWithAmount(txSignature: string, senderAddress: string, requiredAmount: number): Promise<{
    isValid: boolean;
    error?: string;
  }> {
    try {
      // Check if this is a testnet mock transaction
      const isTestnetMock = txSignature.startsWith('test_') || txSignature.startsWith('mock_');
      
      if (isTestnetMock) {
        console.log(`Testnet mock transaction detected: ${txSignature}`);
        return { isValid: true };
      }

      // Fetch transaction from Solana
      const tx = await this.connection.getParsedTransaction(txSignature, {
        maxSupportedTransactionVersion: 0
      });

      if (!tx) {
        return { 
          isValid: false, 
          error: 'Transaction not found on Solana blockchain' 
        };
      }

      // Validate sender address format
      if (!senderAddress || typeof senderAddress !== 'string') {
        return {
          isValid: false,
          error: 'Invalid sender address provided'
        };
      }
      
      // Verify sender
      let senderPubkey: PublicKey;
      try {
        senderPubkey = new PublicKey(senderAddress);
      } catch (error) {
        console.error('Invalid public key format:', senderAddress);
        return {
          isValid: false,
          error: 'Invalid wallet address format'
        };
      }
      
      const accountKeys = tx.transaction.message.accountKeys;
      const senderFound = accountKeys.some(key => 
        key.pubkey.equals(senderPubkey)
      );

      if (!senderFound) {
        return { 
          isValid: false, 
          error: 'Sender address not found in transaction' 
        };
      }

      // Check SOL transfer amount (native SOL, not SPL token)
      // TODO: In production, this should validate $IDLE SPL token transfers
      // For now, we're using SOL as a placeholder
      // Convert IDLE amount to SOL equivalent (1000 IDLE = 0.01 SOL for testing)
      const solEquivalent = requiredAmount / 100000; // 1 SOL = 100k IDLE for testing
      const requiredLamports = solToLamports(solEquivalent);
      let validTransfer = false;

      // Look for SOL transfers in the transaction
      if (tx.meta && tx.meta.postBalances && tx.meta.preBalances) {
        console.log('🔍 Validating transaction:', txSignature);
        console.log('Expected deployment wallet:', this.DEPLOYMENT_WALLET.toString());
        console.log('Account keys in transaction:', accountKeys.map(k => k.pubkey.toString()));
        
        // Check deployment wallet first
        const deploymentWalletIndex = accountKeys.findIndex(
          key => key.pubkey.equals(this.DEPLOYMENT_WALLET)
        );

        // Also check treasury wallet as fallback
        const treasuryWalletIndex = accountKeys.findIndex(
          key => key.pubkey.equals(this.TREASURY_WALLET)
        );

        if (deploymentWalletIndex !== -1) {
          const preBalance = tx.meta.preBalances[deploymentWalletIndex];
          const postBalance = tx.meta.postBalances[deploymentWalletIndex];
          const received = postBalance - preBalance;

          console.log(`✅ Deployment wallet found at index ${deploymentWalletIndex}`);
          console.log(`   Balance change: ${received / LAMPORTS_PER_SOL} SOL`);
          console.log(`   Required: ${this.DEPLOYMENT_FEE} SOL (${requiredLamports} lamports)`);

          if (received >= requiredLamports) {
            validTransfer = true;
          } else {
            console.error(`❌ Insufficient amount received: ${received / LAMPORTS_PER_SOL} SOL < ${this.DEPLOYMENT_FEE} SOL`);
          }
        } else if (treasuryWalletIndex !== -1) {
          // Fallback: check if payment went to treasury wallet
          const preBalance = tx.meta.preBalances[treasuryWalletIndex];
          const postBalance = tx.meta.postBalances[treasuryWalletIndex];
          const received = postBalance - preBalance;

          console.log(`⚠️ Payment went to treasury wallet instead of deployment wallet`);
          console.log(`   Treasury balance change: ${received / LAMPORTS_PER_SOL} SOL`);
          console.log(`   Required: ${this.DEPLOYMENT_FEE} SOL`);

          if (received >= requiredLamports) {
            validTransfer = true;
            console.log('✅ Accepting payment to treasury wallet');
          }
        } else {
          console.error('❌ Neither deployment wallet nor treasury wallet found in transaction');
          console.error('   Expected deployment wallet:', this.DEPLOYMENT_WALLET.toString());
          console.error('   Expected treasury wallet:', this.TREASURY_WALLET.toString());
        }
      }

      if (!validTransfer) {
        return { 
          isValid: false, 
          error: `Insufficient payment. Required: ${this.DEPLOYMENT_FEE} SOL. Check server logs for details.` 
        };
      }

      // Check if transaction is confirmed
      const confirmation = await this.connection.getSignatureStatus(txSignature);
      if (!confirmation.value?.confirmationStatus || 
          confirmation.value.confirmationStatus !== 'confirmed' && 
          confirmation.value.confirmationStatus !== 'finalized') {
        return { 
          isValid: false, 
          error: 'Transaction not yet confirmed' 
        };
      }

      console.log(`✅ Valid deployment transaction: ${txSignature}`);
      console.log(`   From: ${senderAddress}`);
      console.log(`   Amount: ${this.DEPLOYMENT_FEE} SOL`);
      console.log(`   To: ${this.DEPLOYMENT_WALLET.toString()}`);

      return { isValid: true };

    } catch (error) {
      console.error('Error validating deployment transaction:', error);
      return { 
        isValid: false, 
        error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Validate SOL payment for tournament entry
   */
  async validateTournamentEntryTransaction(
    txSignature: string, 
    _senderAddress: string,
    entryFee: number // in SOL
  ): Promise<{
    isValid: boolean;
    error?: string;
  }> {
    try {
      // Check if this is a testnet mock transaction
      const isTestnetMock = txSignature.startsWith('test_') || txSignature.startsWith('mock_');
      
      if (isTestnetMock) {
        console.log(`Testnet mock tournament entry: ${txSignature}`);
        return { isValid: true };
      }

      // Fetch transaction
      const tx = await this.connection.getParsedTransaction(txSignature, {
        maxSupportedTransactionVersion: 0
      });

      if (!tx) {
        return { 
          isValid: false, 
          error: 'Transaction not found' 
        };
      }

      // Verify payment amount to prize pool escrow
      const requiredLamports = solToLamports(entryFee);
      const prizePoolWallet = PLATFORM_WALLETS.prizePoolEscrow;
      const accountKeys = tx.transaction.message.accountKeys;
      
      const prizePoolIndex = accountKeys.findIndex(
        key => key.pubkey.equals(prizePoolWallet)
      );

      if (prizePoolIndex === -1) {
        return { 
          isValid: false, 
          error: 'Prize pool wallet not found in transaction' 
        };
      }

      if (tx.meta) {
        const preBalance = tx.meta.preBalances[prizePoolIndex];
        const postBalance = tx.meta.postBalances[prizePoolIndex];
        const received = postBalance - preBalance;

        if (received < requiredLamports) {
          return { 
            isValid: false, 
            error: `Insufficient entry fee. Required: ${entryFee} SOL` 
          };
        }
      }

      return { isValid: true };

    } catch (error) {
      console.error('Error validating tournament entry:', error);
      return { 
        isValid: false, 
        error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Validate SOL payment for energy pack purchase
   */
  async validateEnergyPurchaseTransaction(
    txSignature: string,
    _senderAddress: string,
    packType: keyof typeof SOL_FEE_CONFIG.energyPacks
  ): Promise<{
    isValid: boolean;
    error?: string;
  }> {
    try {
      const pack = SOL_FEE_CONFIG.energyPacks[packType];
      if (!pack) {
        return { 
          isValid: false, 
          error: 'Invalid energy pack type' 
        };
      }

      // Check if this is a testnet mock transaction
      const isTestnetMock = txSignature.startsWith('test_') || txSignature.startsWith('mock_');
      
      if (isTestnetMock) {
        console.log(`Testnet mock energy purchase: ${txSignature}`);
        return { isValid: true };
      }

      // Validate SOL payment to treasury
      const tx = await this.connection.getParsedTransaction(txSignature, {
        maxSupportedTransactionVersion: 0
      });

      if (!tx) {
        return { 
          isValid: false, 
          error: 'Transaction not found' 
        };
      }

      const requiredLamports = solToLamports(pack.cost);
      const accountKeys = tx.transaction.message.accountKeys;
      const treasuryIndex = accountKeys.findIndex(
        key => key.pubkey.equals(this.TREASURY_WALLET)
      );

      if (treasuryIndex === -1 || !tx.meta) {
        return { 
          isValid: false, 
          error: 'Treasury wallet not found in transaction' 
        };
      }

      const received = tx.meta.postBalances[treasuryIndex] - tx.meta.preBalances[treasuryIndex];
      
      if (received < requiredLamports) {
        return { 
          isValid: false, 
          error: `Insufficient payment. Required: ${pack.cost} SOL` 
        };
      }

      return { isValid: true };

    } catch (error) {
      console.error('Error validating energy purchase:', error);
      return { 
        isValid: false, 
        error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(txSignature: string): Promise<{
    confirmed: boolean;
    finalised: boolean;
    error?: string;
  }> {
    try {
      const status = await this.connection.getSignatureStatus(txSignature);
      
      if (!status.value) {
        return { 
          confirmed: false, 
          finalised: false, 
          error: 'Transaction not found' 
        };
      }

      return {
        confirmed: status.value.confirmationStatus === 'confirmed' || 
                  status.value.confirmationStatus === 'finalized',
        finalised: status.value.confirmationStatus === 'finalized',
        error: status.value.err ? JSON.stringify(status.value.err) : undefined
      };

    } catch (error) {
      console.error('Error getting transaction status:', error);
      return { 
        confirmed: false, 
        finalised: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Calculate tournament prize distribution
   */
  calculatePrizeDistribution(totalPot: number, winners: number): {
    platformFee: number;
    perWinnerPrize: number;
    totalDistributed: number;
  } {
    const platformFee = totalPot * (this.TOURNAMENT_FEE_PERCENTAGE / 100);
    const prizePool = totalPot - platformFee;
    const perWinnerPrize = prizePool / winners;

    return {
      platformFee,
      perWinnerPrize,
      totalDistributed: prizePool
    };
  }

  /**
   * Log transaction for audit
   */
  async logTransaction(data: {
    signature: string;
    type: 'deployment' | 'tournament' | 'energy' | 'lootbox';
    amount: number; // in SOL
    from: string;
    to: string;
    metadata?: any;
  }): Promise<void> {
    console.log('💰 Transaction logged:', {
      ...data,
      timestamp: new Date().toISOString()
    });
    // In production, save to database
  }
}