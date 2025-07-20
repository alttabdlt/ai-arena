import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Request } from 'express';
import { PubSub } from 'graphql-subscriptions';
import { ContractService } from '../services/contractService';
import { PriceService } from '../services/priceService';

export interface Context {
  prisma: PrismaClient;
  redis: Redis;
  pubsub: PubSub;
  contractService: ContractService;
  priceService: PriceService;
  req?: Request;
  connection?: any;
  user?: {
    address: string;
    tier: number;
  };
}

let pubsub: PubSub;
let contractService: ContractService;
let priceService: PriceService;

export function initializeServices(prisma: PrismaClient, redis: Redis) {
  pubsub = new PubSub();
  contractService = new ContractService(prisma, redis);
  priceService = new PriceService();
}

export function createContext({ req, prisma, redis, connection }: {
  req?: Request;
  prisma: PrismaClient;
  redis: Redis;
  connection?: any;
}): Context {
  if (!pubsub || !contractService || !priceService) {
    initializeServices(prisma, redis);
  }
  
  return {
    prisma,
    redis,
    pubsub,
    contractService,
    priceService,
    req,
    connection,
  };
}