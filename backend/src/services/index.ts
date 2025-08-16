import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { PubSub } from 'graphql-subscriptions';
import { QueueService } from './queueService';
import { TransactionService } from './transactionService';
import { SolanaService } from './solanaService';

let queueService: QueueService;
let transactionService: TransactionService;
let solanaService: SolanaService;

export function initializeServices(prisma: PrismaClient, redis: Redis, pubsub?: PubSub) {
  queueService = new QueueService(prisma, redis, pubsub);
  transactionService = new TransactionService(prisma);
  
  // Initialize Solana service if pubsub is provided
  if (pubsub) {
    solanaService = new SolanaService(prisma, redis, pubsub);
    // Start monitoring Solana transactions
    solanaService.start().catch(error => {
      console.error('Failed to start Solana service:', error);
    });
  }
}

export function getQueueService(): QueueService {
  if (!queueService) {
    throw new Error('QueueService not initialized. Call initializeServices first.');
  }
  return queueService;
}

export function getTransactionService(): TransactionService {
  if (!transactionService) {
    throw new Error('TransactionService not initialized. Call initializeServices first.');
  }
  return transactionService;
}

export function getSolanaService(): SolanaService {
  if (!solanaService) {
    throw new Error('SolanaService not initialized. Call initializeServices first.');
  }
  return solanaService;
}