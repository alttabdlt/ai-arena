import { PrismaClient, StakingTier, StakedIDLE, XPBalance } from '@prisma/client';
import { PubSub } from 'graphql-subscriptions';
import * as cron from 'node-cron';

export interface StakingConfig {
  bronzeRate: number;
  silverRate: number;
  goldRate: number;
  platinumRate: number;
  diamondRate: number;
  lockDays: number;
  earlyUnstakePenalty: number;
  maxAccumulationMultiplier: number;
  monthlyDecayRate: number;
}

export class StakingService {
  private static instance: StakingService;
  private prisma: PrismaClient;
  private pubsub: PubSub;
  private xpGenerationJob: any = null;
  private decayJob: any = null;
  
  // Configuration
  private config: StakingConfig = {
    bronzeRate: 10000,    // XP per hour
    silverRate: 15000,
    goldRate: 20000,
    platinumRate: 25000,
    diamondRate: 30000,
    lockDays: 7,
    earlyUnstakePenalty: 0.5, // 50%
    maxAccumulationMultiplier: 2, // 2x stake amount
    monthlyDecayRate: 0.1 // 10%
  };

  private constructor(prisma: PrismaClient, pubsub: PubSub) {
    this.prisma = prisma;
    this.pubsub = pubsub;
  }

  public static getInstance(prisma: PrismaClient, pubsub: PubSub): StakingService {
    if (!StakingService.instance) {
      StakingService.instance = new StakingService(prisma, pubsub);
    }
    return StakingService.instance;
  }

  public initialize(): void {
    console.log('💎 Staking Service initializing...');
    
    // Generate XP every hour for all active stakes
    this.xpGenerationJob = cron.schedule('0 * * * *', () => {
      this.processXPGeneration();
    });
    
    // Apply monthly decay on the 1st of each month at midnight
    this.decayJob = cron.schedule('0 0 1 * *', () => {
      this.processMonthlyDecay();
    });
    
    console.log('💎 Staking Service initialized - XP generation every hour');
  }

  public stop(): void {
    if (this.xpGenerationJob) {
      this.xpGenerationJob.stop();
      this.xpGenerationJob = null;
    }
    if (this.decayJob) {
      this.decayJob.stop();
      this.decayJob = null;
    }
    console.log('🛑 Staking Service stopped');
  }

  // Stake $IDLE tokens to generate XP
  public async stake(
    userId: string, 
    amount: number, 
    tier: StakingTier
  ): Promise<StakedIDLE> {
    // TODO: Verify user has $IDLE tokens via Solana
    // For now, we'll assume they have the tokens
    
    const xpGenerationRate = this.getTierRate(tier);
    const lockedUntil = new Date();
    lockedUntil.setDate(lockedUntil.getDate() + this.config.lockDays);
    
    const stake = await this.prisma.stakedIDLE.create({
      data: {
        userId,
        amount,
        xpGenerationRate,
        stakingTier: tier,
        lockedUntil,
        isActive: true
      }
    });
    
    // Ensure user has XP balance
    await this.ensureXPBalance(userId);
    
    // Publish staking event
    this.pubsub.publish('STAKE_CREATED', {
      stakeCreated: stake
    });
    
    console.log(`💎 User ${userId} staked ${amount} $IDLE at ${tier} tier`);
    
    return stake;
  }

  // Unstake $IDLE tokens
  public async unstake(
    stakeId: string, 
    userId: string, 
    acceptPenalty: boolean = false
  ): Promise<StakedIDLE> {
    const stake = await this.prisma.stakedIDLE.findUnique({
      where: { id: stakeId }
    });
    
    if (!stake) {
      throw new Error('Stake not found');
    }
    
    if (stake.userId !== userId) {
      throw new Error('Not your stake');
    }
    
    if (!stake.isActive) {
      throw new Error('Stake already withdrawn');
    }
    
    const now = new Date();
    const isEarly = now < stake.lockedUntil;
    
    if (isEarly && !acceptPenalty) {
      throw new Error(`Early unstaking requires accepting ${this.config.earlyUnstakePenalty * 100}% penalty`);
    }
    
    // Calculate and claim any unclaimed XP
    const unclaimedXP = await this.calculateUnclaimedXP(stake);
    
    // Update stake and credit XP in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Mark stake as inactive
      const updatedStake = await tx.stakedIDLE.update({
        where: { id: stakeId },
        data: {
          isActive: false,
          totalXPGenerated: { increment: unclaimedXP }
        }
      });
      
      // Credit unclaimed XP
      if (unclaimedXP > 0) {
        await tx.xPBalance.update({
          where: { userId },
          data: {
            currentXP: { increment: unclaimedXP },
            totalEarnedXP: { increment: unclaimedXP }
          }
        });
      }
      
      // TODO: Return $IDLE tokens (with penalty if early)
      // const returnAmount = isEarly 
      //   ? stake.amount * (1 - this.config.earlyUnstakePenalty)
      //   : stake.amount;
      
      return updatedStake;
    });
    
    // Publish unstaking event
    this.pubsub.publish('STAKE_WITHDRAWN', {
      stakeWithdrawn: result
    });
    
    console.log(`💎 User ${userId} unstaked ${stake.amount} $IDLE${isEarly ? ' (with penalty)' : ''}`);
    
    return result;
  }

  // Claim accumulated XP from staking
  public async claimXP(stakeId: string, userId: string): Promise<XPBalance> {
    const stake = await this.prisma.stakedIDLE.findUnique({
      where: { id: stakeId }
    });
    
    if (!stake) {
      throw new Error('Stake not found');
    }
    
    if (stake.userId !== userId) {
      throw new Error('Not your stake');
    }
    
    if (!stake.isActive) {
      throw new Error('Stake is not active');
    }
    
    const generatedXP = await this.calculateUnclaimedXP(stake);
    
    if (generatedXP === 0) {
      throw new Error('No XP to claim yet');
    }
    
    // Check max accumulation
    const xpBalance = await this.prisma.xPBalance.findUnique({
      where: { userId }
    });
    
    const currentTotal = xpBalance?.currentXP || 0;
    const maxAccumulation = stake.amount * this.config.maxAccumulationMultiplier;
    const finalXP = Math.min(generatedXP, maxAccumulation - currentTotal);
    
    if (finalXP <= 0) {
      throw new Error('Maximum XP accumulation reached');
    }
    
    // Update stake and balance
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.stakedIDLE.update({
        where: { id: stakeId },
        data: {
          lastClaimTime: new Date(),
          totalXPGenerated: { increment: finalXP }
        }
      });
      
      return await tx.xPBalance.upsert({
        where: { userId },
        create: {
          userId,
          currentXP: finalXP,
          totalEarnedXP: finalXP,
          totalSpentXP: 0,
          monthlyDecay: 0
        },
        update: {
          currentXP: { increment: finalXP },
          totalEarnedXP: { increment: finalXP }
        }
      });
    });
    
    // Publish XP update
    this.pubsub.publish(`XP_UPDATE_${userId}`, {
      myXPUpdate: result
    });
    
    console.log(`💰 User ${userId} claimed ${finalXP} XP from staking`);
    
    return result;
  }

  // Process hourly XP generation for all active stakes
  private async processXPGeneration(): Promise<void> {
    console.log('⏰ Processing hourly XP generation...');
    
    const activeStakes = await this.prisma.stakedIDLE.findMany({
      where: { isActive: true }
    });
    
    for (const stake of activeStakes) {
      try {
        // Auto-claim XP for each active stake
        await this.autoClaimXP(stake);
      } catch (error) {
        console.error(`Error processing XP for stake ${stake.id}:`, error);
      }
    }
    
    console.log(`✅ Processed XP generation for ${activeStakes.length} active stakes`);
  }

  // Auto-claim XP (called by cron job)
  private async autoClaimXP(stake: StakedIDLE): Promise<void> {
    const generatedXP = await this.calculateUnclaimedXP(stake);
    
    if (generatedXP === 0) return;
    
    // Check max accumulation
    const xpBalance = await this.prisma.xPBalance.findUnique({
      where: { userId: stake.userId }
    });
    
    const currentTotal = xpBalance?.currentXP || 0;
    const maxAccumulation = stake.amount * this.config.maxAccumulationMultiplier;
    const finalXP = Math.min(generatedXP, maxAccumulation - currentTotal);
    
    if (finalXP <= 0) return; // Max accumulation reached
    
    // Update stake and balance
    await this.prisma.$transaction(async (tx) => {
      await tx.stakedIDLE.update({
        where: { id: stake.id },
        data: {
          lastClaimTime: new Date(),
          totalXPGenerated: { increment: finalXP }
        }
      });
      
      await tx.xPBalance.upsert({
        where: { userId: stake.userId },
        create: {
          userId: stake.userId,
          currentXP: finalXP,
          totalEarnedXP: finalXP,
          totalSpentXP: 0,
          monthlyDecay: 0
        },
        update: {
          currentXP: { increment: finalXP },
          totalEarnedXP: { increment: finalXP }
        }
      });
    });
    
    // Publish XP update
    this.pubsub.publish(`XP_UPDATE_${stake.userId}`, {
      myXPUpdate: await this.prisma.xPBalance.findUnique({
        where: { userId: stake.userId }
      })
    });
  }

  // Process monthly XP decay
  private async processMonthlyDecay(): Promise<void> {
    console.log('📉 Processing monthly XP decay...');
    
    const allBalances = await this.prisma.xPBalance.findMany({
      where: { currentXP: { gt: 0 } }
    });
    
    for (const balance of allBalances) {
      const decayAmount = Math.floor(balance.currentXP * this.config.monthlyDecayRate);
      
      if (decayAmount > 0) {
        await this.prisma.xPBalance.update({
          where: { id: balance.id },
          data: {
            currentXP: { decrement: decayAmount },
            monthlyDecay: { increment: decayAmount },
            lastDecayDate: new Date()
          }
        });
        
        // Publish decay event
        this.pubsub.publish(`XP_UPDATE_${balance.userId}`, {
          myXPUpdate: await this.prisma.xPBalance.findUnique({
            where: { userId: balance.userId }
          })
        });
        
        console.log(`📉 Applied ${decayAmount} XP decay to user ${balance.userId}`);
      }
    }
    
    console.log(`✅ Processed monthly decay for ${allBalances.length} users`);
  }

  // Calculate unclaimed XP for a stake
  private async calculateUnclaimedXP(stake: StakedIDLE): Promise<number> {
    const now = new Date();
    const hoursSinceLastClaim = (now.getTime() - stake.lastClaimTime.getTime()) / (1000 * 60 * 60);
    return Math.floor(hoursSinceLastClaim * stake.xpGenerationRate);
  }

  // Get XP generation rate for tier
  private getTierRate(tier: StakingTier): number {
    const rates: Record<StakingTier, number> = {
      BRONZE: this.config.bronzeRate,
      SILVER: this.config.silverRate,
      GOLD: this.config.goldRate,
      PLATINUM: this.config.platinumRate,
      DIAMOND: this.config.diamondRate
    };
    return rates[tier];
  }

  // Ensure user has XP balance entry
  private async ensureXPBalance(userId: string): Promise<XPBalance> {
    return await this.prisma.xPBalance.upsert({
      where: { userId },
      create: {
        userId,
        currentXP: 0,
        totalEarnedXP: 0,
        totalSpentXP: 0,
        monthlyDecay: 0
      },
      update: {} // No update needed, just ensure it exists
    });
  }

  // Get user's active stakes
  public async getUserStakes(userId: string): Promise<StakedIDLE[]> {
    return await this.prisma.stakedIDLE.findMany({
      where: {
        userId,
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Get user's XP balance with calculations
  public async getUserXPBalance(userId: string): Promise<any> {
    const xpBalance = await this.ensureXPBalance(userId);
    
    const stakes = await this.getUserStakes(userId);
    const totalStaked = stakes.reduce((sum, stake) => sum + stake.amount, 0);
    const xpGenerationRate = stakes.reduce((sum, stake) => sum + stake.xpGenerationRate, 0);
    const maxAccumulation = totalStaked * this.config.maxAccumulationMultiplier;
    
    // Calculate next decay
    const nextDecayDate = new Date(xpBalance.lastDecayDate);
    nextDecayDate.setMonth(nextDecayDate.getMonth() + 1);
    const nextDecayAmount = Math.floor(xpBalance.currentXP * this.config.monthlyDecayRate);
    
    return {
      ...xpBalance,
      totalStaked,
      activeStakes: stakes.length,
      maxAccumulation,
      xpGenerationRate,
      nextDecayAmount,
      nextDecayDate
    };
  }

  // Calculate staking rewards preview
  public calculateRewards(amount: number, tier: StakingTier): any {
    const hourlyXP = this.getTierRate(tier);
    const dailyXP = hourlyXP * 24;
    const weeklyXP = dailyXP * 7;
    const maxAccumulation = amount * this.config.maxAccumulationMultiplier;
    
    return {
      hourlyXP,
      dailyXP,
      weeklyXP,
      maxAccumulation,
      timeToMax: Math.ceil(maxAccumulation / hourlyXP), // Hours to reach max
      lockPeriod: this.config.lockDays,
      earlyUnstakePenalty: this.config.earlyUnstakePenalty
    };
  }
}

// Helper function to get the singleton instance
let stakingServiceInstance: StakingService | null = null;

export function initializeStakingService(
  prisma: PrismaClient,
  pubsub: PubSub
): StakingService {
  if (!stakingServiceInstance) {
    stakingServiceInstance = StakingService.getInstance(prisma, pubsub);
  }
  return stakingServiceInstance;
}

export function getStakingService(): StakingService {
  if (!stakingServiceInstance) {
    throw new Error('Staking service not initialized. Call initializeStakingService first.');
  }
  return stakingServiceInstance;
}