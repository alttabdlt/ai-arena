import { sign, verify, SignOptions } from 'jsonwebtoken';
import { ethers } from 'ethers';
import { PrismaClient, User } from '@prisma/client';
import { Redis } from 'ioredis';

interface AuthTokenPayload {
  userId: string;
  address: string;
  role: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private prisma: PrismaClient;
  private redis: Redis;
  private JWT_SECRET: string;
  private JWT_REFRESH_SECRET: string;
  private ACCESS_TOKEN_EXPIRY = '15m';
  private REFRESH_TOKEN_EXPIRY = '7d';
  private SESSION_PREFIX = 'session:';

  constructor(prisma: PrismaClient, redis: Redis) {
    this.prisma = prisma;
    this.redis = redis;
    this.JWT_SECRET = process.env.JWT_SECRET || 'development-secret';
    this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'development-refresh-secret';
  }

  async verifyWalletSignature(address: string, message: string, signature: string): Promise<boolean> {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  async generateAuthTokens(user: User): Promise<AuthTokens> {
    const payload: AuthTokenPayload = {
      userId: user.id,
      address: user.address,
      role: user.role,
    };

    const accessToken = sign(payload, this.JWT_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    } as SignOptions);

    const refreshToken = sign(payload, this.JWT_REFRESH_SECRET, {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
    } as SignOptions);

    // Store refresh token in Redis
    const sessionKey = `${this.SESSION_PREFIX}${user.id}`;
    await this.redis.set(sessionKey, refreshToken, 'EX', 7 * 24 * 60 * 60); // 7 days

    return { accessToken, refreshToken };
  }

  async verifyAccessToken(token: string): Promise<AuthTokenPayload | null> {
    try {
      const payload = verify(token, this.JWT_SECRET) as AuthTokenPayload;
      return payload;
    } catch (error) {
      return null;
    }
  }

  async verifyRefreshToken(token: string): Promise<AuthTokenPayload | null> {
    try {
      const payload = verify(token, this.JWT_REFRESH_SECRET) as AuthTokenPayload;
      
      // Check if token exists in Redis
      const sessionKey = `${this.SESSION_PREFIX}${payload.userId}`;
      const storedToken = await this.redis.get(sessionKey);
      
      if (storedToken !== token) {
        return null;
      }

      return payload;
    } catch (error) {
      return null;
    }
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens | null> {
    const payload = await this.verifyRefreshToken(refreshToken);
    
    if (!payload) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return null;
    }

    // Invalidate old refresh token
    const sessionKey = `${this.SESSION_PREFIX}${user.id}`;
    await this.redis.del(sessionKey);

    // Generate new tokens
    return this.generateAuthTokens(user);
  }

  async logout(userId: string): Promise<void> {
    const sessionKey = `${this.SESSION_PREFIX}${userId}`;
    await this.redis.del(sessionKey);
  }

  async createOrUpdateUser(address: string): Promise<User> {
    const normalizedAddress = address.toLowerCase();
    
    const user = await this.prisma.user.upsert({
      where: { address: normalizedAddress },
      update: { updatedAt: new Date() },
      create: {
        address: normalizedAddress,
        role: 'USER',
      },
    });

    return user;
  }

  generateSignMessage(nonce: string): string {
    return `Welcome to AI Arena!\n\nClick to sign in and accept the Terms of Service.\n\nThis request will not trigger a blockchain transaction or cost any gas fees.\n\nNonce: ${nonce}`;
  }

  generateNonce(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}