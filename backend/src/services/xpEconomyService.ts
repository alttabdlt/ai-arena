import { PrismaClient, XPBalance, BetStatus } from '@prisma/client';
import { PubSub } from 'graphql-subscriptions';
import { GraphQLError } from 'graphql';

export interface XPTransaction {
  userId: string;
  amount: number;
  type: 'EARN' | 'SPEND' | 'DECAY' | 'BONUS';
  description: string;
  metadata?: any;
}

export class XPEconomyService {
  private static instance: XPEconomyService;
  private prisma: PrismaClient;
  private pubsub: PubSub;
  
  // XP economy configuration
  private readonly config = {
    monthlyDecayRate: 0.1, // 10% monthly decay
    maxAccumulationMultiplier: 2, // 2x stake amount max
    minBetAmount: 100, // Minimum XP bet
    maxBetMultiplier: 0.2, // Max 20% of balance per bet
    upsetBonuses: {
      low: { threshold: 10, bonus: 0.25 },    // 10x-20x odds: +25%
      medium: { threshold: 20, bonus: 0.5 },   // 20x-50x odds: +50%
      high: { threshold: 50, bonus: 1.0 }      // 50x+ odds: +100%
    },
    streakBonuses: {
      3: 0.1,  // 3 wins: +10%
      5: 0.2,  // 5 wins: +20%
      10: 0.5  // 10 wins: +50%
    }
  };

  private constructor(prisma: PrismaClient, pubsub: PubSub) {
    this.prisma = prisma;
    this.pubsub = pubsub;
  }

  public static getInstance(prisma: PrismaClient, pubsub: PubSub): XPEconomyService {
    if (!XPEconomyService.instance) {
      XPEconomyService.instance = new XPEconomyService(prisma, pubsub);
    }
    return XPEconomyService.instance;
  }

  // Get or create XP balance for user
  public async getOrCreateBalance(userId: string): Promise<XPBalance> {
    return await this.prisma.xPBalance.upsert({
      where: { userId },
      create: {
        userId,
        currentXP: 0,
        totalEarnedXP: 0,
        totalSpentXP: 0,
        monthlyDecay: 0
      },
      update: {} // Just return existing if found
    });
  }

  // Add XP to user balance
  public async addXP(transaction: XPTransaction): Promise<XPBalance> {
    const { userId, amount, type, description } = transaction;
    
    if (amount <= 0) {
      throw new GraphQLError('Amount must be positive');
    }
    
    await this.getOrCreateBalance(userId);
    
    // Update balance based on transaction type
    const updatedBalance = await this.prisma.xPBalance.update({
      where: { userId },
      data: {
        currentXP: { increment: amount },
        totalEarnedXP: type === 'EARN' || type === 'BONUS' 
          ? { increment: amount } 
          : undefined
      }
    });
    
    // Log transaction (could be stored in separate table)
    console.log(`💰 XP Transaction: ${userId} ${type} ${amount} XP - ${description}`);
    
    // Publish XP update event
    this.pubsub.publish(`XP_UPDATE_${userId}`, {
      myXPUpdate: updatedBalance
    });
    
    return updatedBalance;
  }

  // Deduct XP from user balance
  public async deductXP(
    userId: string, 
    amount: number, 
    description: string = 'XP spent'
  ): Promise<XPBalance> {
    if (amount <= 0) {
      throw new GraphQLError('Amount must be positive');
    }
    
    const balance = await this.getOrCreateBalance(userId);
    
    if (balance.currentXP < amount) {
      throw new GraphQLError('Insufficient XP balance');
    }
    
    const updatedBalance = await this.prisma.xPBalance.update({
      where: { userId },
      data: {
        currentXP: { decrement: amount },
        totalSpentXP: { increment: amount }
      }
    });
    
    console.log(`💸 XP Deduction: ${userId} spent ${amount} XP - ${description}`);
    
    // Publish XP update event
    this.pubsub.publish(`XP_UPDATE_${userId}`, {
      myXPUpdate: updatedBalance
    });
    
    return updatedBalance;
  }

  // Process bet placement
  public async placeBet(
    userId: string,
    amount: number,
    tournamentId: string,
    _participantId: string
  ): Promise<{ balance: XPBalance, betId: string }> {
    // Validate bet amount
    if (amount < this.config.minBetAmount) {
      throw new GraphQLError(`Minimum bet is ${this.config.minBetAmount} XP`);
    }
    
    const balance = await this.getOrCreateBalance(userId);
    
    // Check max bet limit (20% of balance)
    const maxBet = Math.floor(balance.currentXP * this.config.maxBetMultiplier);
    if (amount > maxBet) {
      throw new GraphQLError(`Maximum bet is ${maxBet} XP (20% of balance)`);
    }
    
    // Deduct XP for bet
    const updatedBalance = await this.deductXP(
      userId, 
      amount, 
      `Bet on tournament ${tournamentId}`
    );
    
    // Note: Actual bet creation handled by betting resolver
    const betId = `bet-${Date.now()}-${Math.random()}`;
    
    return { balance: updatedBalance, betId };
  }

  // Process bet payout
  public async processPayout(
    userId: string,
    betAmount: number,
    odds: number,
    isUpset: boolean = false
  ): Promise<XPBalance> {
    let payout = Math.floor(betAmount * odds);
    
    // Apply upset bonus if applicable
    if (isUpset) {
      const upsetBonus = this.calculateUpsetBonus(odds);
      payout = Math.floor(payout * (1 + upsetBonus));
      console.log(`🎉 Upset bonus applied: +${upsetBonus * 100}%`);
    }
    
    // Check for win streak bonus
    const streakBonus = await this.calculateStreakBonus(userId);
    if (streakBonus > 0) {
      payout = Math.floor(payout * (1 + streakBonus));
      console.log(`🔥 Streak bonus applied: +${streakBonus * 100}%`);
    }
    
    return await this.addXP({
      userId,
      amount: payout,
      type: 'EARN',
      description: `Tournament bet payout (${odds}x odds)`,
      metadata: { betAmount, odds, isUpset }
    });
  }

  // Calculate upset bonus based on odds
  private calculateUpsetBonus(odds: number): number {
    const { upsetBonuses } = this.config;
    
    if (odds >= upsetBonuses.high.threshold) {
      return upsetBonuses.high.bonus;
    } else if (odds >= upsetBonuses.medium.threshold) {
      return upsetBonuses.medium.bonus;
    } else if (odds >= upsetBonuses.low.threshold) {
      return upsetBonuses.low.bonus;
    }
    
    return 0;
  }

  // Calculate win streak bonus
  private async calculateStreakBonus(userId: string): Promise<number> {
    // Get user's companions
    const companions = await this.prisma.bot.findMany({
      where: { creatorId: userId },
      select: { id: true }
    });
    
    // Get recent bets from all companions
    const recentBets = await this.prisma.bettingEntry.findMany({
      where: { 
        botId: { in: companions.map(c => c.id) },
        status: { in: [BetStatus.WON, BetStatus.LOST] }
      },
      orderBy: { timestamp: 'desc' },
      take: 20
    });
    
    // Count consecutive wins
    let streak = 0;
    for (const bet of recentBets) {
      if (bet.status === BetStatus.WON) {
        streak++;
      } else {
        break;
      }
    }
    
    // Apply streak bonus
    const { streakBonuses } = this.config;
    if (streak >= 10) return streakBonuses[10];
    if (streak >= 5) return streakBonuses[5];
    if (streak >= 3) return streakBonuses[3];
    
    return 0;
  }

  // Apply monthly decay to all balances
  public async applyMonthlyDecay(): Promise<void> {
    console.log('📉 Applying monthly XP decay...');
    
    const balances = await this.prisma.xPBalance.findMany({
      where: { currentXP: { gt: 0 } }
    });
    
    for (const balance of balances) {
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
    
    console.log(`✅ Monthly decay applied to ${balances.length} users`);
  }

  // Get user's XP statistics
  public async getUserStats(userId: string): Promise<any> {
    const balance = await this.getOrCreateBalance(userId);
    
    // Get user's companions
    const companions = await this.prisma.bot.findMany({
      where: { creatorId: userId },
      select: { id: true }
    });
    
    // Get betting stats from all companions
    const bets = await this.prisma.bettingEntry.findMany({
      where: { botId: { in: companions.map(c => c.id) } },
      include: { participant: true }
    });
    
    const totalBets = bets.length;
    const wins = bets.filter(b => b.status === BetStatus.WON);
    const losses = bets.filter(b => b.status === BetStatus.LOST);
    
    const totalWagered = bets.reduce((sum, bet) => sum + bet.amount, 0);
    const totalWon = wins.reduce((sum, bet) => sum + (bet.actualPayout || 0), 0);
    
    // Calculate ROI
    const roi = totalWagered > 0 ? (totalWon - totalWagered) / totalWagered : 0;
    
    // Get current streak
    const sortedBets = bets
      .filter(b => b.status === BetStatus.WON || b.status === BetStatus.LOST)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    let currentStreak = 0;
    for (const bet of sortedBets) {
      if (bet.status === BetStatus.WON) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    // Get active stakes for XP generation rate
    const stakes = await this.prisma.stakedIDLE.findMany({
      where: { userId, isActive: true }
    });
    
    const xpGenerationRate = stakes.reduce((sum, stake) => sum + stake.xpGenerationRate, 0);
    
    return {
      balance: {
        current: balance.currentXP,
        totalEarned: balance.totalEarnedXP,
        totalSpent: balance.totalSpentXP,
        monthlyDecay: balance.monthlyDecay,
        xpGenerationRate
      },
      betting: {
        totalBets,
        wins: wins.length,
        losses: losses.length,
        winRate: totalBets > 0 ? wins.length / totalBets : 0,
        totalWagered,
        totalWon,
        roi,
        currentStreak,
        biggestWin: Math.max(...wins.map(w => w.actualPayout || 0), 0)
      },
      staking: {
        activeStakes: stakes.length,
        totalStaked: stakes.reduce((sum, stake) => sum + stake.amount, 0),
        xpPerHour: xpGenerationRate
      }
    };
  }

  // Transfer XP between users (for future features)
  public async transferXP(
    fromUserId: string,
    toUserId: string,
    amount: number,
    reason: string = 'XP transfer'
  ): Promise<{ from: XPBalance, to: XPBalance }> {
    if (amount <= 0) {
      throw new GraphQLError('Amount must be positive');
    }
    
    // Use transaction to ensure atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      // Check sender balance
      const fromBalance = await tx.xPBalance.findUnique({
        where: { userId: fromUserId }
      });
      
      if (!fromBalance || fromBalance.currentXP < amount) {
        throw new GraphQLError('Insufficient XP balance');
      }
      
      // Deduct from sender
      const updatedFrom = await tx.xPBalance.update({
        where: { userId: fromUserId },
        data: {
          currentXP: { decrement: amount },
          totalSpentXP: { increment: amount }
        }
      });
      
      // Add to receiver
      const updatedTo = await tx.xPBalance.upsert({
        where: { userId: toUserId },
        create: {
          userId: toUserId,
          currentXP: amount,
          totalEarnedXP: amount,
          totalSpentXP: 0,
          monthlyDecay: 0
        },
        update: {
          currentXP: { increment: amount },
          totalEarnedXP: { increment: amount }
        }
      });
      
      return { from: updatedFrom, to: updatedTo };
    });
    
    // Publish updates for both users
    this.pubsub.publish(`XP_UPDATE_${fromUserId}`, {
      myXPUpdate: result.from
    });
    
    this.pubsub.publish(`XP_UPDATE_${toUserId}`, {
      myXPUpdate: result.to
    });
    
    console.log(`💸 XP Transfer: ${fromUserId} → ${toUserId}: ${amount} XP - ${reason}`);
    
    return result;
  }

  // Get leaderboard
  public async getLeaderboard(limit: number = 10): Promise<any[]> {
    const balances = await this.prisma.xPBalance.findMany({
      orderBy: { currentXP: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            address: true
          }
        }
      }
    });
    
    // Get additional stats for each user
    const leaderboard = await Promise.all(
      balances.map(async (balance, index) => {
        // Get user's companions
        const companions = await this.prisma.bot.findMany({
          where: { creatorId: balance.userId },
          select: { id: true }
        });
        
        const bets = await this.prisma.bettingEntry.findMany({
          where: { botId: { in: companions.map(c => c.id) } },
          select: { status: true }
        });
        
        const wins = bets.filter(b => b.status === BetStatus.WON).length;
        const winRate = bets.length > 0 ? wins / bets.length : 0;
        
        return {
          rank: index + 1,
          userId: balance.userId,
          username: balance.user?.username || 'Anonymous',
          address: balance.user?.address,
          currentXP: balance.currentXP,
          totalEarnedXP: balance.totalEarnedXP,
          winRate,
          totalBets: bets.length
        };
      })
    );
    
    return leaderboard;
  }
}

// Helper function to get the singleton instance
let xpEconomyServiceInstance: XPEconomyService | null = null;

export function initializeXPEconomyService(
  prisma: PrismaClient,
  pubsub: PubSub
): XPEconomyService {
  if (!xpEconomyServiceInstance) {
    xpEconomyServiceInstance = XPEconomyService.getInstance(prisma, pubsub);
  }
  return xpEconomyServiceInstance;
}

export function getXPEconomyService(): XPEconomyService {
  if (!xpEconomyServiceInstance) {
    throw new Error('XP Economy service not initialized. Call initializeXPEconomyService first.');
  }
  return xpEconomyServiceInstance;
}