import { Request } from 'express';
import { AuthService } from '../services/authService';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

export interface AuthenticatedUser {
  id: string;
  address: string;
  originalAddress?: string; // Original case-sensitive address
  role: string;
}

export async function extractUserFromRequest(
  req: Request | undefined,
  prisma: PrismaClient,
  redis: Redis
): Promise<AuthenticatedUser | null> {
  if (!req || !req.headers.authorization) {
    return null;
  }

  const authHeader = req.headers.authorization;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!token) {
    return null;
  }

  try {
    const authService = new AuthService(prisma, redis);
    const payload = await authService.verifyAccessToken(token);

    if (!payload) {
      return null;
    }

    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return null;
    }

    // Get the original case-sensitive address from headers if available
    const originalAddress = req.headers['x-wallet-address'] as string | undefined;

    return {
      id: user.id,
      address: user.address,
      originalAddress: originalAddress || user.address, // Use header address if available
      role: user.role,
    };
  } catch (error) {
    console.error('Error during auth extraction:', error);
    return null;
  }
}