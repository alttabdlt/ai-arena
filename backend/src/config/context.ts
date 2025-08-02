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
  user?: AuthenticatedUser | null;
}

export let pubsub: PubSub;

export function initializePubSub() {
  if (!pubsub) {
    pubsub = new PubSub();
    // Ensure asyncIterator is available
    if (typeof (pubsub as any).asyncIterator !== 'function') {
      console.error('⚠️ PubSub asyncIterator not found, attempting to patch...');
      // Patch asyncIterator if missing
      (pubsub as any).asyncIterator = function(triggers: string | string[]) {
        return this.asyncIterableIterator(triggers);
      };
    }
  }
}

export async function createContext({ req, prisma, redis, connection, pubsub: externalPubsub }: {
  req?: Request;
  prisma: PrismaClient;
  redis: Redis;
  connection?: any;
  pubsub?: PubSub;
}): Promise<Context> {
  if (!pubsub && !externalPubsub) {
    initializePubSub();
  }
  
  // Use external pubsub if provided, otherwise use the initialized one
  const pubsubInstance = externalPubsub || pubsub;
  
  // Debug logging for WebSocket contexts
  if (connection) {
    console.log('🔌 Creating WebSocket context:', {
      hasPubsub: !!pubsubInstance,
      hasAsyncIterator: typeof (pubsubInstance as any)?.asyncIterator === 'function',
      pubsubType: pubsubInstance?.constructor?.name,
      connectionParams: connection.connectionParams
    });
  }
  
  // Extract user from JWT if present
  let user = null;
  
  // For WebSocket connections, extract auth from connection params
  if (connection?.connectionParams?.authorization) {
    const authHeader = connection.connectionParams.authorization;
    console.log('🔑 WebSocket auth header found:', authHeader.substring(0, 20) + '...');
    
    // Create a fake request object with the auth header for extractUserFromRequest
    const fakeReq = {
      headers: {
        authorization: authHeader
      }
    } as any;
    
    user = await extractUserFromRequest(fakeReq, prisma, redis);
    console.log('👤 WebSocket user extracted:', user ? user.address : 'none');
  } else if (req) {
    // For HTTP requests, extract from request headers
    user = await extractUserFromRequest(req, prisma, redis);
  }
  
  return {
    prisma,
    redis,
    pubsub: pubsubInstance,
    req,
    connection,
    user,
  };
}