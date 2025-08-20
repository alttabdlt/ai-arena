import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { PubSub } from 'graphql-subscriptions';
import { TransactionService } from './transactionService';
import { SolanaService } from './solanaService';

let transactionService: TransactionService;
let solanaService: SolanaService | null = null;

interface ServiceOptions {
  enableSolana?: boolean;
}

export function initializeServices(
  prisma: PrismaClient, 
  redis: Redis, 
  pubsub?: PubSub,
  options: ServiceOptions = {}
) {
  const { enableSolana = true } = options;
  
  transactionService = new TransactionService(prisma);
  
  // Initialize Solana service if enabled and pubsub is provided
  if (pubsub && enableSolana) {
    solanaService = new SolanaService(prisma, redis, pubsub);
    // Start monitoring Solana transactions
    solanaService.start().catch(error => {
      console.error('Failed to start Solana service:', error);
    });
    console.log('💰 Solana service initialized for blockchain monitoring');
  } else if (!enableSolana) {
    console.log('⏭️  Solana service disabled for faster startup');
  }
}

export function getTransactionService(): TransactionService {
  if (!transactionService) {
    throw new Error('TransactionService not initialized. Call initializeServices first.');
  }
  return transactionService;
}

export function getSolanaService(): SolanaService | null {
  if (!solanaService) {
    // Return null instead of throwing - service might be disabled
    return null;
  }
  return solanaService;
}