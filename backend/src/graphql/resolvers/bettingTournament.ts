import { PrismaClient, BettingTournamentStatus, BetStatus, StakingTier } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { pubsub, initializePubSub } from '../../config/context';
import { getTournamentScheduler } from '../../services/tournamentScheduler';

// Initialize pubsub if not already done
initializePubSub();

const prisma = new PrismaClient();

export const bettingTournamentResolvers = {
    Query: {
      // Tournament queries
      upcomingBettingTournaments: async (_: any, { limit = 5 }: { limit?: number }) => {
        const now = new Date();
        return await prisma.bettingTournament.findMany({
          where: {
            startTime: { gte: now },
            status: { in: [BettingTournamentStatus.SCHEDULED, BettingTournamentStatus.BETTING_OPEN] }
          },
          orderBy: { startTime: 'asc' },
          take: limit,
          include: {
            participants: true,
            bets: true
          }
        });
      },

      currentBettingTournament: async () => {
        return await prisma.bettingTournament.findFirst({
          where: {
            OR: [
              { status: BettingTournamentStatus.BETTING_OPEN },
              { status: BettingTournamentStatus.IN_PROGRESS }
            ]
          },
          include: {
            participants: true,
            bets: true
          }
        });
      },

      bettingTournament: async (_: any, { id }: { id: string }) => {
        return await prisma.bettingTournament.findUnique({
          where: { id },
          include: {
            participants: true,
            bets: {
              include: {
                participant: true
              }
            }
          }
        });
      },

      tournamentSchedule: async () => {
        const now = new Date();
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        const upcoming = await prisma.bettingTournament.findMany({
          where: {
            startTime: { gte: now, lte: endOfDay },
            status: { in: [BettingTournamentStatus.SCHEDULED, BettingTournamentStatus.BETTING_OPEN] }
          },
          orderBy: { startTime: 'asc' },
          take: 5,
          include: { participants: true, bets: true }
        });

        const current = await prisma.bettingTournament.findFirst({
          where: {
            OR: [
              { status: BettingTournamentStatus.BETTING_OPEN },
              { status: BettingTournamentStatus.IN_PROGRESS }
            ]
          },
          include: { participants: true, bets: true }
        });

        const recent = await prisma.bettingTournament.findMany({
          where: {
            status: BettingTournamentStatus.COMPLETED,
            updatedAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) } // Last hour
          },
          orderBy: { updatedAt: 'desc' },
          take: 3,
          include: { participants: true, bets: true }
        });

        // Calculate next tournament time
        const minutes = now.getMinutes();
        const nextSlot = Math.ceil(minutes / 15) * 15;
        const nextTime = new Date(now);
        if (nextSlot === 60) {
          nextTime.setHours(now.getHours() + 1, 0, 0, 0);
        } else {
          nextTime.setMinutes(nextSlot, 0, 0);
        }
        const nextTournamentIn = Math.floor((nextTime.getTime() - now.getTime()) / 1000);

        // Generate daily schedule
        const dailySchedule = [];
        for (let hour = 0; hour < 24; hour++) {
          for (let minute = 0; minute < 60; minute += 15) {
            const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            const slotIndex = (hour * 4 + minute / 15) % 4;
            const gameType = ['LIGHTNING_POKER', 'PROMPT_RACING', 'VIBE_CHECK', 'LIGHTNING_POKER'][slotIndex];
            dailySchedule.push({
              time,
              gameType,
              estimatedParticipants: 4 + Math.floor(Math.random() * 5) // 4-8 participants
            });
          }
        }

        return {
          upcoming,
          current,
          recent,
          nextTournamentIn,
          dailySchedule
        };
      },

      tournamentStats: async () => {
        const stats = await prisma.bettingTournament.aggregate({
          where: { status: BettingTournamentStatus.COMPLETED },
          _count: true,
          _sum: {
            totalBettingPool: true,
            housePoolContribution: true
          }
        });

        const betsStats = await prisma.bettingEntry.aggregate({
          where: { status: { in: [BetStatus.WON, BetStatus.LOST] } },
          _count: true,
          _sum: {
            amount: true,
            actualPayout: true
          },
          _max: {
            actualPayout: true
          }
        });

        // Find biggest upset (highest odds winner)
        const biggestUpset = await prisma.bettingEntry.findFirst({
          where: {
            status: BetStatus.WON,
            actualPayout: { gt: 0 }
          },
          orderBy: {
            potentialPayout: 'desc'
          },
          include: {
            participant: true,
            tournament: true
          }
        });

        // Calculate model win rates
        const modelWins = await prisma.bettingParticipant.groupBy({
          by: ['aiModel'],
          where: {
            placement: 1
          },
          _count: true
        });

        const modelTotals = await prisma.bettingParticipant.groupBy({
          by: ['aiModel'],
          _count: true,
          _avg: {
            currentOdds: true
          }
        });

        const modelWinRates = modelTotals.map(model => {
          const wins = modelWins.find(w => w.aiModel === model.aiModel)?._count || 0;
          const winRate = wins / model._count;
          const averageOdds = model._avg.currentOdds || 1;
          const profitability = (winRate * averageOdds) - 1; // Expected value

          return {
            model: model.aiModel,
            totalGames: model._count,
            wins,
            winRate,
            averageOdds,
            profitability
          };
        });

        return {
          totalTournaments: stats._count,
          totalBetsPlaced: betsStats._count,
          totalXPWagered: betsStats._sum.amount || 0,
          totalXPDistributed: betsStats._sum.actualPayout || 0,
          biggestWin: betsStats._max.actualPayout || 0,
          biggestUpset: biggestUpset ? {
            tournamentId: biggestUpset.tournamentId,
            winnerModel: biggestUpset.participant.aiModel,
            winnerOdds: biggestUpset.potentialPayout / biggestUpset.amount,
            payout: biggestUpset.actualPayout || 0,
            date: biggestUpset.tournament.createdAt
          } : null,
          modelWinRates
        };
      },

      // Betting queries
      myBets: async (_: any, { companionId, status, limit = 20 }: { companionId?: string, status?: BetStatus, limit?: number }, context: any) => {
        if (!context.user) throw new GraphQLError('Not authenticated');
        
        // If companionId provided, get bets for specific companion
        // Otherwise get all bets for user's companions
        let where: any = {};
        
        if (companionId) {
          // Verify companion belongs to user
          const companion = await prisma.bot.findUnique({
            where: { id: companionId }
          });
          if (!companion || companion.creatorId !== context.user.id) {
            throw new GraphQLError('Companion not found or does not belong to you');
          }
          where.botId = companionId;
        } else {
          // Get all companions for user
          const companions = await prisma.bot.findMany({
            where: { creatorId: context.user.id },
            select: { id: true }
          });
          where.botId = { in: companions.map(c => c.id) };
        }
        
        if (status) where.status = status;

        return await prisma.bettingEntry.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: limit,
          include: {
            bot: true,
            participant: true,
            tournament: {
              include: {
                participants: true
              }
            }
          }
        });
      },

      tournamentOdds: async (_: any, { tournamentId }: { tournamentId: string }) => {
        const tournament = await prisma.bettingTournament.findUnique({
          where: { id: tournamentId },
          include: {
            participants: true,
            bets: true
          }
        });

        if (!tournament) throw new GraphQLError('Tournament not found');

        // Calculate current odds based on parimutuel system
        const totalPool = tournament.totalBettingPool;
        const houseCut = Math.floor(totalPool * 0.05); // 5% house edge
        const payoutPool = totalPool - houseCut;

        const oddsBreakdown = tournament.participants.map(participant => {
          const participantBets = tournament.bets
            .filter(bet => bet.participantId === participant.id)
            .reduce((sum, bet) => sum + bet.amount, 0);
          
          const bettingPercentage = totalPool > 0 ? participantBets / totalPool : 0;
          const currentOdds = participantBets > 0 ? payoutPool / participantBets : 100; // Max 100x
          const impliedProbability = participantBets > 0 ? participantBets / totalPool : 0;

          return {
            participantId: participant.id,
            aiModel: participant.aiModel,
            name: participant.name,
            currentOdds: Math.min(currentOdds, 100), // Cap at 100x
            impliedProbability,
            totalBets: participantBets,
            bettingPercentage
          };
        });

        return {
          id: tournamentId,
          tournamentId,
          totalPool,
          houseCut,
          payoutPool,
          oddsBreakdown
        };
      },

      // Staking & XP queries
      myStakes: async (_: any, __: any, context: any) => {
        if (!context.user) throw new GraphQLError('Not authenticated');
        
        return await prisma.stakedIDLE.findMany({
          where: {
            userId: context.user.id,
            isActive: true
          },
          orderBy: { createdAt: 'desc' }
        });
      },

      myXPBalance: async (_: any, __: any, context: any) => {
        if (!context.user) throw new GraphQLError('Not authenticated');
        
        let xpBalance = await prisma.xPBalance.findUnique({
          where: { userId: context.user.id }
        });

        // Create XP balance if doesn't exist
        if (!xpBalance) {
          xpBalance = await prisma.xPBalance.create({
            data: {
              userId: context.user.id,
              currentXP: 0,
              totalEarnedXP: 0,
              totalSpentXP: 0,
              monthlyDecay: 0,
              lastDecayDate: new Date()
            }
          });
        }

        // Calculate additional fields
        const stakes = await prisma.stakedIDLE.findMany({
          where: {
            userId: context.user.id,
            isActive: true
          }
        });

        const totalStaked = stakes.reduce((sum, stake) => sum + stake.amount, 0);
        const maxAccumulation = totalStaked * 2; // 2x stake amount max
        const xpGenerationRate = stakes.reduce((sum, stake) => sum + stake.xpGenerationRate, 0);

        // Calculate next decay
        const nextDecayDate = new Date(xpBalance.lastDecayDate);
        nextDecayDate.setMonth(nextDecayDate.getMonth() + 1);
        const nextDecayAmount = Math.floor(xpBalance.currentXP * 0.1); // 10% decay

        return {
          ...xpBalance,
          maxAccumulation,
          xpGenerationRate,
          nextDecayAmount,
          nextDecayDate
        };
      },

      stakingRewards: async (_: any, { amount, tier }: { amount: number, tier: StakingTier }) => {
        const rates: Record<StakingTier, number> = {
          BRONZE: 10000,
          SILVER: 15000,
          GOLD: 20000,
          PLATINUM: 25000,
          DIAMOND: 30000
        };

        const hourlyXP = rates[tier];
        const dailyXP = hourlyXP * 24;
        const weeklyXP = dailyXP * 7;
        const maxAccumulation = amount * 2;

        return {
          hourlyXP,
          dailyXP,
          weeklyXP,
          maxAccumulation,
          currentAccumulated: 0 // Will be calculated based on actual stake
        };
      },

      myBettingStats: async (_: any, { companionId }: { companionId?: string }, context: any) => {
        if (!context.user) throw new GraphQLError('Not authenticated');
        
        // Get bets for specific companion or all user's companions
        let where: any = {};
        
        if (companionId) {
          // Verify companion belongs to user
          const companion = await prisma.bot.findUnique({
            where: { id: companionId }
          });
          if (!companion || companion.creatorId !== context.user.id) {
            throw new GraphQLError('Companion not found or does not belong to you');
          }
          where.botId = companionId;
        } else {
          // Get all companions for user
          const companions = await prisma.bot.findMany({
            where: { creatorId: context.user.id },
            select: { id: true }
          });
          where.botId = { in: companions.map(c => c.id) };
        }
        
        const bets = await prisma.bettingEntry.findMany({
          where,
          include: {
            bot: true,
            participant: true
          }
        });

        const totalBets = bets.length;
        const wins = bets.filter(b => b.status === BetStatus.WON);
        const losses = bets.filter(b => b.status === BetStatus.LOST);
        const totalXPWagered = bets.reduce((sum, bet) => sum + bet.amount, 0);
        const totalXPWon = wins.reduce((sum, bet) => sum + (bet.actualPayout || 0), 0);
        
        const winRate = totalBets > 0 ? wins.length / totalBets : 0;
        const roi = totalXPWagered > 0 ? (totalXPWon - totalXPWagered) / totalXPWagered : 0;
        
        const biggestWin = Math.max(...wins.map(w => w.actualPayout || 0), 0);
        
        // Find favorite model
        const modelBets = bets.reduce((acc, bet) => {
          acc[bet.participant.aiModel] = (acc[bet.participant.aiModel] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const favoriteModel = Object.entries(modelBets).sort((a, b) => b[1] - a[1])[0]?.[0];

        // Calculate streak
        const sortedBets = bets.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        let currentStreak = 0;
        let bestStreak = 0;
        let tempStreak = 0;
        
        for (const bet of sortedBets) {
          if (bet.status === BetStatus.WON) {
            tempStreak++;
            bestStreak = Math.max(bestStreak, tempStreak);
            if (sortedBets.indexOf(bet) === 0) currentStreak = tempStreak;
          } else if (bet.status === BetStatus.LOST) {
            tempStreak = 0;
            if (currentStreak > 0 && sortedBets.indexOf(bet) === 0) currentStreak = 0;
          }
        }

        return {
          totalBets,
          totalWins: wins.length,
          totalLosses: losses.length,
          totalXPWagered,
          totalXPWon,
          winRate,
          roi,
          biggestWin,
          favoriteModel,
          currentStreak,
          bestStreak
        };
      }
    },

    Mutation: {
      // Betting mutations
      placeBet: async (_: any, { input }: { input: any }, context: any) => {
        if (!context.user) throw new GraphQLError('Not authenticated');
        
        const { companionId, tournamentId, participantId, amount } = input;

        // Validate companion belongs to user
        const companion = await prisma.bot.findUnique({
          where: { id: companionId },
          include: { experience: true }
        });

        if (!companion) throw new GraphQLError('Companion not found');
        if (companion.creatorId !== context.user.id) {
          throw new GraphQLError('This companion does not belong to you');
        }
        if (!companion.isActive) {
          throw new GraphQLError('Companion is not active');
        }

        // Validate tournament is open for betting
        const tournament = await prisma.bettingTournament.findUnique({
          where: { id: tournamentId },
          include: { participants: true }
        });

        if (!tournament) throw new GraphQLError('Tournament not found');
        if (tournament.status !== BettingTournamentStatus.BETTING_OPEN) {
          throw new GraphQLError('Betting window is closed');
        }
        if (new Date() > tournament.bettingDeadline) {
          throw new GraphQLError('Betting deadline has passed');
        }

        // Check companion has enough XP
        if (!companion.experience || companion.experience.currentXP < amount) {
          throw new GraphQLError('Companion has insufficient XP balance');
        }

        // Find participant
        const participant = tournament.participants.find(p => p.id === participantId);
        if (!participant) throw new GraphQLError('Invalid participant');

        // Calculate potential payout based on current pool
        const updatedPool = tournament.totalBettingPool + amount;
        const houseCut = Math.floor(updatedPool * 0.05);
        const payoutPool = updatedPool - houseCut;
        
        // Get total bets on this participant
        const participantBets = await prisma.bettingEntry.aggregate({
          where: {
            tournamentId,
            participantId,
            status: BetStatus.PENDING
          },
          _sum: { amount: true }
        });

        const totalOnParticipant = (participantBets._sum.amount || 0) + amount;
        let potentialPayout = (payoutPool * amount) / totalOnParticipant;

        // Apply personality bonuses
        if (companion.personality === 'CRIMINAL') {
          // Criminal gets +20% bonus on underdog bets (odds > 3x)
          if (potentialPayout > amount * 3) {
            potentialPayout *= 1.2;
          }
        } else if (companion.personality === 'GAMBLER') {
          // Gambler gets +15% bonus on all bets (risk-taker)
          potentialPayout *= 1.15;
        } else if (companion.personality === 'WORKER') {
          // Worker gets +10% bonus on all bets (steady earner)
          potentialPayout *= 1.1;
        }

        // Create bet and update balances in transaction
        const result = await prisma.$transaction(async (tx) => {
          // Deduct XP from companion
          await tx.botExperience.update({
            where: { botId: companionId },
            data: {
              currentXP: { decrement: amount },
              totalBetXP: { increment: amount }
            }
          });

          // Update tournament pool
          await tx.bettingTournament.update({
            where: { id: tournamentId },
            data: {
              totalBettingPool: { increment: amount },
              housePoolContribution: { increment: Math.floor(amount * 0.05) }
            }
          });

          // Update participant total
          await tx.bettingParticipant.update({
            where: { id: participantId },
            data: {
              totalBetsPlaced: { increment: amount }
            }
          });

          // Create bet
          const bet = await tx.bettingEntry.create({
            data: {
              botId: companionId,
              tournamentId,
              participantId,
              amount,
              potentialPayout,
              status: BetStatus.PENDING
            },
            include: {
              bot: true,
              participant: true,
              tournament: true
            }
          });

          return bet;
        });

        // Publish updates
        pubsub.publish('ODDS_UPDATE', {
          oddsUpdate: { tournamentId }
        });

        pubsub.publish(`BET_UPDATE_${companionId}`, {
          myBetUpdate: result
        });

        return result;
      },

      claimWinnings: async (_: any, { betId }: { betId: string }, context: any) => {
        if (!context.user) throw new GraphQLError('Not authenticated');
        
        const bet = await prisma.bettingEntry.findUnique({
          where: { id: betId },
          include: {
            bot: true,
            tournament: true,
            participant: true
          }
        });

        if (!bet) throw new GraphQLError('Bet not found');
        if (!bet.bot) throw new GraphQLError('Companion not found');
        if (bet.bot.creatorId !== context.user.id) throw new GraphQLError('Not your companion\'s bet');
        if (bet.status !== BetStatus.WON) throw new GraphQLError('Bet did not win');
        if (bet.actualPayout === null) throw new GraphQLError('Payout not calculated yet');

        // Credit winnings to companion and update stats
        await prisma.botExperience.update({
          where: { botId: bet.botId },
          data: {
            currentXP: { increment: bet.actualPayout },
            totalXP: { increment: bet.actualPayout },
            totalWonXP: { increment: bet.actualPayout },
            bettingWins: { increment: 1 },
            winStreak: { increment: 1 }
          }
        });

        // Update best win streak if necessary
        const experience = await prisma.botExperience.findUnique({
          where: { botId: bet.botId }
        });
        
        if (experience && experience.winStreak > experience.bestWinStreak) {
          await prisma.botExperience.update({
            where: { botId: bet.botId },
            data: { bestWinStreak: experience.winStreak }
          });
        }

        pubsub.publish(`XP_UPDATE_${bet.botId}`, {
          companionXPUpdate: await prisma.botExperience.findUnique({
            where: { botId: bet.botId }
          })
        });

        return bet;
      },

      // Staking mutations
      stakeIDLE: async (_: any, { input }: { input: any }, context: any) => {
        if (!context.user) throw new GraphQLError('Not authenticated');
        
        const { amount, tier } = input;

        // TODO: Verify user has $IDLE tokens via Solana
        // For now, we'll assume they have the tokens

        const rates: Record<StakingTier, number> = {
          BRONZE: 10000,
          SILVER: 15000,
          GOLD: 20000,
          PLATINUM: 25000,
          DIAMOND: 30000
        };

        const xpGenerationRate = rates[tier as StakingTier];
        const lockedUntil = new Date();
        lockedUntil.setDate(lockedUntil.getDate() + 7); // 7-day lock

        const stake = await prisma.stakedIDLE.create({
          data: {
            userId: context.user.id,
            amount,
            xpGenerationRate,
            stakingTier: tier,
            lockedUntil,
            isActive: true
          }
        });

        return stake;
      },

      unstakeIDLE: async (_: any, { input }: { input: any }, context: any) => {
        if (!context.user) throw new GraphQLError('Not authenticated');
        
        const { stakeId, acceptPenalty } = input;

        const stake = await prisma.stakedIDLE.findUnique({
          where: { id: stakeId }
        });

        if (!stake) throw new GraphQLError('Stake not found');
        if (stake.userId !== context.user.id) throw new GraphQLError('Not your stake');
        if (!stake.isActive) throw new GraphQLError('Stake already withdrawn');

        const now = new Date();
        const isEarly = now < stake.lockedUntil;
        
        if (isEarly && !acceptPenalty) {
          throw new GraphQLError('Early unstaking requires accepting 50% penalty');
        }

        // Calculate final XP to claim
        const hoursSinceLastClaim = (now.getTime() - stake.lastClaimTime.getTime()) / (1000 * 60 * 60);
        const generatedXP = Math.floor(hoursSinceLastClaim * stake.xpGenerationRate);

        // Update stake and credit XP
        await prisma.$transaction(async (tx) => {
          // Mark stake as inactive
          await tx.stakedIDLE.update({
            where: { id: stakeId },
            data: {
              isActive: false,
              totalXPGenerated: { increment: generatedXP }
            }
          });

          // Credit remaining XP
          await tx.xPBalance.upsert({
            where: { userId: context.user.id },
            create: {
              userId: context.user.id,
              currentXP: generatedXP,
              totalEarnedXP: generatedXP,
              totalSpentXP: 0,
              monthlyDecay: 0
            },
            update: {
              currentXP: { increment: generatedXP },
              totalEarnedXP: { increment: generatedXP }
            }
          });

          // TODO: Return $IDLE tokens (with penalty if early)
          // For now, just mark as unstaked
        });

        return await prisma.stakedIDLE.findUnique({
          where: { id: stakeId }
        });
      },

      claimXP: async (_: any, { stakeId, companionId }: { stakeId: string, companionId?: string }, context: any) => {
        if (!context.user) throw new GraphQLError('Not authenticated');
        
        const stake = await prisma.stakedIDLE.findUnique({
          where: { id: stakeId }
        });

        if (!stake) throw new GraphQLError('Stake not found');
        if (stake.userId !== context.user.id) throw new GraphQLError('Not your stake');
        if (!stake.isActive) throw new GraphQLError('Stake is not active');

        const now = new Date();
        const hoursSinceLastClaim = (now.getTime() - stake.lastClaimTime.getTime()) / (1000 * 60 * 60);
        const generatedXP = Math.floor(hoursSinceLastClaim * stake.xpGenerationRate);

        if (generatedXP === 0) {
          throw new GraphQLError('No XP to claim yet');
        }

        // Get active companions to distribute XP to
        let companions;
        if (companionId) {
          // Claim to specific companion
          const companion = await prisma.bot.findUnique({
            where: { id: companionId },
            include: { experience: true }
          });
          if (!companion || companion.creatorId !== context.user.id) {
            throw new GraphQLError('Companion not found or does not belong to you');
          }
          if (!companion.isActive) {
            throw new GraphQLError('Companion is not active');
          }
          companions = [companion];
        } else {
          // Distribute to all active companions
          companions = await prisma.bot.findMany({
            where: {
              creatorId: context.user.id,
              isActive: true
            },
            include: { experience: true }
          });
          
          if (companions.length === 0) {
            throw new GraphQLError('No active companions to receive XP');
          }
        }

        // Distribute XP equally among companions
        const xpPerCompanion = Math.floor(generatedXP / companions.length);
        
        // Update stake and distribute XP
        const results = await prisma.$transaction(async (tx) => {
          // Update stake claim time
          await tx.stakedIDLE.update({
            where: { id: stakeId },
            data: {
              lastClaimTime: now,
              totalXPGenerated: { increment: generatedXP }
            }
          });

          // Distribute XP to companions
          const updatedCompanions = [];
          for (const companion of companions) {
            // Ensure experience record exists
            const experience = await tx.botExperience.upsert({
              where: { botId: companion.id },
              create: {
                botId: companion.id,
                level: 1,
                currentXP: xpPerCompanion,
                totalXP: xpPerCompanion,
                xpToNextLevel: 100
              },
              update: {
                currentXP: { increment: xpPerCompanion },
                totalXP: { increment: xpPerCompanion }
              }
            });
            updatedCompanions.push(experience);
            
            // Publish XP update for each companion
            pubsub.publish(`XP_UPDATE_${companion.id}`, {
              companionXPUpdate: experience
            });
          }
          
          return updatedCompanions;
        });

        return {
          xpClaimed: generatedXP,
          xpPerCompanion,
          companionsUpdated: results.length,
          companions: results
        };
      },

      // Admin mutations for testing
      simulateTournament: async (_: any, { tournamentId }: { tournamentId: string }) => {
        const tournamentScheduler = getTournamentScheduler();
        
        const tournament = await prisma.bettingTournament.findUnique({
          where: { id: tournamentId },
          include: {
            participants: true,
            bets: true
          }
        });

        if (!tournament) throw new GraphQLError('Tournament not found');
        
        // Simulate tournament completion
        await tournamentScheduler.forceCompleteTournament(tournamentId);
        
        return await prisma.bettingTournament.findUnique({
          where: { id: tournamentId },
          include: {
            participants: true,
            bets: true
          }
        });
      }
    },

    Subscription: {
      tournamentCreated: {
        subscribe: () => (pubsub as any).asyncIterator(['TOURNAMENT_CREATED'])
      },
      
      tournamentStatusUpdate: {
        subscribe: (_: any, { tournamentId }: { tournamentId: string }) => {
          return (pubsub as any).asyncIterator([`TOURNAMENT_STATUS_${tournamentId}`]);
        }
      },
      
      bettingWindowClosing: {
        subscribe: () => (pubsub as any).asyncIterator(['BETTING_CLOSING'])
      },
      
      tournamentCompleted: {
        subscribe: () => (pubsub as any).asyncIterator(['TOURNAMENT_COMPLETED'])
      },
      
      oddsUpdate: {
        subscribe: (_: any, { tournamentId }: { tournamentId: string }) => {
          return (pubsub as any).asyncIterator([`ODDS_UPDATE_${tournamentId}`]);
        }
      },
      
      myBetUpdate: {
        subscribe: (_: any, { userId }: { userId: string }) => {
          return (pubsub as any).asyncIterator([`BET_UPDATE_${userId}`]);
        }
      },
      
      myXPUpdate: {
        subscribe: (_: any, { userId }: { userId: string }) => {
          return (pubsub as any).asyncIterator([`XP_UPDATE_${userId}`]);
        }
      }
    },

    // Additional resolvers for nested types
    BettingTournament: {
      timeUntilStart: (tournament: any) => {
        const now = new Date();
        const startTime = new Date(tournament.startTime);
        const diff = startTime.getTime() - now.getTime();
        return Math.max(0, Math.floor(diff / 1000)); // Return seconds
      }
    },

    BettingParticipant: {
      bettingPercentage: async (participant: any) => {
        const tournament = await prisma.bettingTournament.findUnique({
          where: { id: participant.tournamentId }
        });
        if (!tournament || tournament.totalBettingPool === 0) return 0;
        return participant.totalBetsPlaced / tournament.totalBettingPool;
      },
      
      impliedProbability: async (participant: any) => {
        const tournament = await prisma.bettingTournament.findUnique({
          where: { id: participant.tournamentId }
        });
        if (!tournament || tournament.totalBettingPool === 0) return 0;
        return participant.totalBetsPlaced / tournament.totalBettingPool;
      }
    },

    StakedIDLE: {
      timeUntilUnlock: (stake: any) => {
        const now = new Date();
        const unlockTime = new Date(stake.lockedUntil);
        const diff = unlockTime.getTime() - now.getTime();
        return Math.max(0, Math.floor(diff / 1000)); // Return seconds
      },
      
      earlyUnstakePenalty: (stake: any) => {
        return Math.floor(stake.amount * 0.5); // 50% penalty
      }
    }
};