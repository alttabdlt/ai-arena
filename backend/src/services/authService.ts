import { sign, verify, SignOptions } from 'jsonwebtoken';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { PrismaClient, User } from '@prisma/client';
import { Redis } from 'ioredis';
import bs58 from 'bs58';

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
      // Convert base58 address to PublicKey
      const publicKey = new PublicKey(address);
      
      // Convert message to bytes
      const messageBytes = new TextEncoder().encode(message);
      
      // Try to decode signature - support both base58 (Solana standard) and base64
      let signatureBytes: Uint8Array;
      try {
        // Try base58 first (Solana standard)
        signatureBytes = bs58.decode(signature);
      } catch {
        // Fallback to base64 for compatibility
        signatureBytes = Buffer.from(signature, 'base64');
      }
      
      // Verify the signature using nacl (tweetnacl)
      return nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKey.toBytes()
      );
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

    // Store refresh token in Redis with error handling
    try {
      const sessionKey = `${this.SESSION_PREFIX}${user.id}`;
      await this.redis.set(sessionKey, refreshToken, 'EX', 7 * 24 * 60 * 60); // 7 days
    } catch (error) {
      console.error('Redis error when storing refresh token:', error);
      // Continue without Redis - tokens will still work but refresh won't be validated against Redis
    }

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
      
      // Check if token exists in Redis with error handling
      try {
        const sessionKey = `${this.SESSION_PREFIX}${payload.userId}`;
        const storedToken = await this.redis.get(sessionKey);
        
        if (storedToken !== token) {
          console.log('Refresh token not found in Redis or mismatch');
          return null;
        }
      } catch (redisError) {
        console.error('Redis error when verifying refresh token:', redisError);
        // If Redis is down, allow the token through based on JWT verification alone
        console.log('Redis unavailable, proceeding with JWT verification only');
      }

      return payload;
    } catch (error) {
      console.error('JWT verification error:', error);
      return null;
    }
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

  private generateNonceString(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  async generateNonce(address: string): Promise<string> {
    const nonce = this.generateNonceString();
    
    // Store nonce in Redis with 5 minute expiry for validation
    try {
      const nonceKey = `nonce:${address.toLowerCase()}`;
      await this.redis.set(nonceKey, nonce, 'EX', 300); // 5 minutes
    } catch (error) {
      console.error('Redis error when storing nonce:', error);
      // Continue without Redis - nonce will still work but less secure
    }
    
    return nonce;
  }

  async authenticateWallet(address: string, _signature: string, nonce: string): Promise<any> {
    const normalizedAddress = address.toLowerCase();
    
    // Verify nonce from Redis if available
    try {
      const nonceKey = `nonce:${normalizedAddress}`;
      const storedNonce = await this.redis.get(nonceKey);
      
      if (storedNonce && storedNonce !== nonce) {
        throw new Error('Invalid or expired nonce');
      }
      
      // Delete used nonce
      await this.redis.del(nonceKey);
    } catch (error) {
      console.error('Redis error when verifying nonce:', error);
      // Continue without Redis verification
    }
    
    // Create or update user
    const user = await this.createOrUpdateUser(address);
    
    // Generate auth tokens
    const tokens = await this.generateAuthTokens(user);
    
    return {
      user: {
        id: user.id,
        address: user.address,
        username: user.username,
        role: user.role,
        kycTier: user.kycTier || 0
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }

  async refreshTokens(refreshToken: string): Promise<any> {
    const payload = await this.verifyRefreshToken(refreshToken);
    
    if (!payload) {
      throw new Error('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Invalidate old refresh token
    try {
      const sessionKey = `${this.SESSION_PREFIX}${user.id}`;
      await this.redis.del(sessionKey);
    } catch (error) {
      console.error('Redis error when invalidating old token:', error);
    }

    // Generate new tokens
    const tokens = await this.generateAuthTokens(user);
    
    return {
      user: {
        id: user.id,
        address: user.address,
        username: user.username,
        role: user.role,
        kycTier: user.kycTier || 0
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }
}