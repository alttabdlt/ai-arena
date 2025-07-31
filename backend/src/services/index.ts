import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { PubSub } from 'graphql-subscriptions';
import { QueueService } from './queueService';
import { TransactionService } from './transactionService';

let queueService: QueueService;
let transactionService: TransactionService;

export function initializeServices(prisma: PrismaClient, redis: Redis, pubsub?: PubSub) {
  queueService = new QueueService(prisma, redis, pubsub);
  transactionService = new TransactionService(prisma);
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