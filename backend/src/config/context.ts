import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Request } from 'express';
import { PubSub } from 'graphql-subscriptions';
import { extractUserFromRequest, AuthenticatedUser } from '../middleware/auth';

export interface Context {
  prisma: PrismaClient;
  redis: Redis;
  pubsub: PubSub;
  req?: Request;
  connection?: any;
  user?: AuthenticatedUser;
}

let pubsub: PubSub;

export function initializeServices(_prisma: PrismaClient, _redis: Redis) {
  pubsub = new PubSub();
}

export async function createContext({ req, prisma, redis, connection, pubsub: externalPubsub }: {
  req?: Request;
  prisma: PrismaClient;
  redis: Redis;
  connection?: any;
  pubsub?: PubSub;
}): Promise<Context> {
  if (!pubsub) {
    initializeServices(prisma, redis);
  }
  
  // Use external pubsub if provided, otherwise use the initialized one
  const pubsubInstance = externalPubsub || pubsub;
  
  // Extract user from JWT if present
  const user = await extractUserFromRequest(req, prisma, redis);
  
  return {
    prisma,
    redis,
    pubsub: pubsubInstance,
    req,
    connection,
    user: user || undefined,
  };
}