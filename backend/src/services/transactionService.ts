import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';

export class TransactionService {
  private provider: ethers.JsonRpcProvider;
  private prisma: PrismaClient;
  private DEPLOYMENT_FEE = ethers.parseEther('0.01'); // 0.01 HYPE
  private DEPLOYMENT_WALLET: string;
  private TREASURY_WALLET: string;
  private TOURNAMENT_FEE_PERCENTAGE: number;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    
    const rpcUrl = process.env.RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    this.DEPLOYMENT_WALLET = process.env.DEPLOYMENT_WALLET_ADDRESS || '0x0000000000000000000000000000000000000000';
    this.TREASURY_WALLET = process.env.TREASURY_WALLET_ADDRESS || '0x0000000000000000000000000000000000000000';
    this.TOURNAMENT_FEE_PERCENTAGE = parseInt(process.env.TOURNAMENT_FEE_PERCENTAGE || '5');
  }

  async validateDeploymentTransaction(txHash: string, senderAddress: string): Promise<{
    isValid: boolean;
    error?: string;
  }> {
    try {
      // Check if this is a testnet mock transaction (starts with timestamp pattern)
      const isTestnetMock = /^0x[0-9a-f]{12}/.test(txHash) && txHash.endsWith('00000000');
      
      if (isTestnetMock) {
        console.log('Testnet mock transaction detected - skipping on-chain validation');
        // For testnet, just check if the transaction hasn't been used before
        const existingTx = await this.prisma.deploymentTransaction.findUnique({
          where: { txHash },
        });
        
        if (existingTx) {
          return { isValid: false, error: 'Transaction already used' };
        }
        
        // Accept testnet mock transactions
        return { isValid: true };
      }
      
      const existingTx = await this.prisma.deploymentTransaction.findUnique({
        where: { txHash },
      });
      
      if (existingTx) {
        return { isValid: false, error: 'Transaction already used' };
      }

      // Retry logic for fetching transaction
      let tx = null;
      let attempts = 0;
      const maxAttempts = 5;
      const baseDelay = 1000; // 1 second

      while (!tx && attempts < maxAttempts) {
        try {
          tx = await this.provider.getTransaction(txHash);
          if (tx) break;
        } catch (err) {
          console.log(`Attempt ${attempts + 1}/${maxAttempts} to fetch transaction failed`);
        }

        attempts++;
        if (attempts < maxAttempts) {
          // Exponential backoff: 1s, 2s, 4s, 8s
          const delay = baseDelay * Math.pow(2, attempts - 1);
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      if (!tx) {
        return { isValid: false, error: 'Transaction not found after multiple attempts' };
      }

      // Wait a bit for receipt if transaction was just found
      let receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        // Try once more after a delay
        await new Promise(resolve => setTimeout(resolve, 3000));
        receipt = await this.provider.getTransactionReceipt(txHash);
      }
      
      if (!receipt || receipt.status !== 1) {
        return { isValid: false, error: 'Transaction failed or not confirmed' };
      }

      if (tx.from.toLowerCase() !== senderAddress.toLowerCase()) {
        return { isValid: false, error: 'Transaction sender mismatch' };
      }

      if (tx.to?.toLowerCase() !== this.DEPLOYMENT_WALLET.toLowerCase()) {
        return { isValid: false, error: 'Invalid recipient address' };
      }

      if (tx.value < this.DEPLOYMENT_FEE) {
        return { isValid: false, error: 'Insufficient deployment fee (0.01 HYPE required)' };
      }

      const blockNumber = await this.provider.getBlockNumber();
      const confirmations = blockNumber - receipt.blockNumber;
      
      if (confirmations < 3) {
        return { isValid: false, error: 'Insufficient confirmations (need 3+)' };
      }

      return { isValid: true };
    } catch (error) {
      console.error('Error validating transaction:', error);
      return { isValid: false, error: 'Failed to validate transaction' };
    }
  }

  async getTransactionDetails(txHash: string) {
    try {
      const [tx, receipt] = await Promise.all([
        this.provider.getTransaction(txHash),
        this.provider.getTransactionReceipt(txHash),
      ]);

      if (!tx || !receipt) {
        return null;
      }

      const block = await this.provider.getBlock(receipt.blockNumber);

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: ethers.formatEther(tx.value) + ' HYPE',
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status === 1 ? 'success' : 'failed',
        blockNumber: receipt.blockNumber,
        timestamp: block ? block.timestamp : 0,
      };
    } catch (error) {
      console.error('Error getting transaction details:', error);
      return null;
    }
  }

  async updateTransactionStatus(txHash: string, status: 'CONFIRMED' | 'FAILED' | 'REFUNDED') {
    return this.prisma.deploymentTransaction.update({
      where: { txHash },
      data: { status },
    });
  }

  async monitorPendingTransactions() {
    const pendingTxs = await this.prisma.deploymentTransaction.findMany({
      where: { status: 'PENDING' },
      include: { bot: true },
    });

    for (const tx of pendingTxs) {
      try {
        const receipt = await this.provider.getTransactionReceipt(tx.txHash);
        
        if (receipt) {
          if (receipt.status === 1) {
            await this.updateTransactionStatus(tx.txHash, 'CONFIRMED');
          } else {
            await this.updateTransactionStatus(tx.txHash, 'FAILED');
            
            await this.prisma.bot.update({
              where: { id: tx.botId },
              data: { isActive: false },
            });
          }
        } else {
          const timeSinceCreation = Date.now() - tx.createdAt.getTime();
          if (timeSinceCreation > 30 * 60 * 1000) {
            await this.updateTransactionStatus(tx.txHash, 'FAILED');
            
            await this.prisma.bot.update({
              where: { id: tx.botId },
              data: { isActive: false },
            });
          }
        }
      } catch (error) {
        console.error(`Error monitoring transaction ${tx.txHash}:`, error);
      }
    }
  }

  async validateTournamentFeeTransaction(txHash: string, senderAddress: string, expectedAmount: string): Promise<{
    isValid: boolean;
    error?: string;
  }> {
    try {
      // Retry logic for fetching transaction
      let tx = null;
      let attempts = 0;
      const maxAttempts = 5;
      const baseDelay = 1000; // 1 second

      while (!tx && attempts < maxAttempts) {
        try {
          tx = await this.provider.getTransaction(txHash);
          if (tx) break;
        } catch (err) {
          console.log(`Attempt ${attempts + 1}/${maxAttempts} to fetch tournament transaction failed`);
        }

        attempts++;
        if (attempts < maxAttempts) {
          // Exponential backoff: 1s, 2s, 4s, 8s
          const delay = baseDelay * Math.pow(2, attempts - 1);
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      if (!tx) {
        return { isValid: false, error: 'Transaction not found after multiple attempts' };
      }

      // Wait a bit for receipt if transaction was just found
      let receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        // Try once more after a delay
        await new Promise(resolve => setTimeout(resolve, 3000));
        receipt = await this.provider.getTransactionReceipt(txHash);
      }
      
      if (!receipt || receipt.status !== 1) {
        return { isValid: false, error: 'Transaction failed or not confirmed' };
      }

      if (tx.from.toLowerCase() !== senderAddress.toLowerCase()) {
        return { isValid: false, error: 'Transaction sender mismatch' };
      }

      if (tx.to?.toLowerCase() !== this.TREASURY_WALLET.toLowerCase()) {
        return { isValid: false, error: 'Invalid recipient address (must be treasury)' };
      }

      const expectedAmountWei = ethers.parseEther(expectedAmount);
      if (tx.value < expectedAmountWei) {
        return { isValid: false, error: `Insufficient tournament fee (expected ${expectedAmount} HYPE)` };
      }

      return { isValid: true };
    } catch (error) {
      console.error('Error validating tournament fee transaction:', error);
      return { isValid: false, error: 'Failed to validate transaction' };
    }
  }

  calculatePlatformFee(entryFee: string): string {
    const feeWei = ethers.parseEther(entryFee);
    const platformFeeWei = (feeWei * BigInt(this.TOURNAMENT_FEE_PERCENTAGE)) / BigInt(100);
    return ethers.formatEther(platformFeeWei);
  }

  calculatePrizePool(entryFee: string, participants: number): string {
    const totalFeesWei = ethers.parseEther(entryFee) * BigInt(participants);
    const platformFeeWei = (totalFeesWei * BigInt(this.TOURNAMENT_FEE_PERCENTAGE)) / BigInt(100);
    const prizePoolWei = totalFeesWei - platformFeeWei;
    return ethers.formatEther(prizePoolWei);
  }

  async startMonitoring() {
    setInterval(() => {
      this.monitorPendingTransactions().catch(console.error);
    }, 60000);
  }
}