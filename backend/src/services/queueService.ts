import { PrismaClient, QueueType, Prisma } from '@prisma/client';
import { Redis } from 'ioredis';
import { PubSub } from 'graphql-subscriptions';
import { getGameManagerService } from './gameManagerService';
import { randomInt } from 'crypto';
import { getConnect4TournamentService } from './connect4TournamentService';

export interface QueueServiceConfig {
  minPlayersForMatch: number;
  maxPlayersForMatch: number;
  queueExpirationHours: number;
  matchmakingIntervalMs: number;
}

export class QueueService {
  private prisma: PrismaClient;
  private redis: Redis | null;
  private pubsub: PubSub;
  private config: QueueServiceConfig;
  private matchmakingInterval: NodeJS.Timeout | null = null;
  private nextMatchmakingRun: Date = new Date(Date.now() + 30000);
  private testGameTypeOverride: string | null = null;

  constructor(prisma: PrismaClient, redis?: Redis, pubsub?: PubSub) {
    this.prisma = prisma;
    this.redis = redis || null;
    this.pubsub = pubsub || new PubSub();
    
    this.config = {
      minPlayersForMatch: 4,
      maxPlayersForMatch: 4,
      queueExpirationHours: 24,
      matchmakingIntervalMs: 30000, // 30 seconds
    };
  }

  getNextMatchTime(): Date {
    return this.nextMatchmakingRun;
  }

  setTestGameTypeOverride(gameType: string | null): void {
    this.testGameTypeOverride = gameType;
    console.log(`🎯 Test game type override ${gameType ? `set to: ${gameType}` : 'cleared'}`);
  }

  getTestGameTypeOverride(): string | null {
    return this.testGameTypeOverride;
  }

  async ensureDemoBots(): Promise<void> {
    try {
      console.log('Ensuring demo bots are in queue...');
      
      // Find all demo bots
      const demoBots = await this.prisma.bot.findMany({
        where: {
          isDemo: true,
          isActive: true,
        },
      });

      if (demoBots.length === 0) {
        console.log('No demo bots found in database');
        return;
      }

      console.log(`Found ${demoBots.length} demo bots`);

      // Check each demo bot and add to queue if not already there
      for (const bot of demoBots) {
        // Check if bot is already in queue
        const existingEntry = await this.prisma.queueEntry.findFirst({
          where: {
            botId: bot.id,
            status: 'WAITING',
          },
        });

        if (!existingEntry) {
          // Add to queue with 1 year expiry
          await this.prisma.queueEntry.create({
            data: {
              botId: bot.id,
              queueType: 'STANDARD',
              priority: 0,
              status: 'WAITING',
              enteredAt: new Date(),
              expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
            },
          });
          console.log(`Added demo bot "${bot.name}" to queue`);
        } else {
          console.log(`Demo bot "${bot.name}" already in queue`);
        }
      }

      // Notify queue update
      await this.notifyQueueUpdate();
      
      console.log('Demo bots queue check complete');
    } catch (error) {
      console.error('Error ensuring demo bots in queue:', error);
    }
  }

  async addToQueue(botId: string, queueType: QueueType = 'STANDARD'): Promise<any> {
    const existingEntry = await this.prisma.queueEntry.findFirst({
      where: {
        botId,
        status: 'WAITING',
      },
    });

    if (existingEntry) {
      throw new Error('Bot is already in queue');
    }

    const bot = await this.prisma.bot.findUnique({
      where: { id: botId },
    });

    if (!bot || !bot.isActive) {
      throw new Error('Bot not found or inactive');
    }

    const priority = this.calculatePriority(queueType, bot);
    const expiresAt = new Date(Date.now() + this.config.queueExpirationHours * 60 * 60 * 1000);

    const entry = await this.prisma.queueEntry.create({
      data: {
        botId,
        queueType,
        priority,
        status: 'WAITING',
        enteredAt: new Date(),
        expiresAt,
      },
      include: {
        bot: {
          include: {
            creator: true,
          },
        },
      },
    });

    await this.notifyQueueUpdate();

    return entry;
  }

  async removeFromQueue(botId: string): Promise<boolean> {
    const result = await this.prisma.queueEntry.updateMany({
      where: {
        botId,
        status: 'WAITING',
      },
      data: {
        status: 'CANCELLED',
      },
    });

    if (result.count > 0) {
      await this.notifyQueueUpdate();
    }

    return result.count > 0;
  }

  async findMatches(): Promise<{ botIds: string[], entryIds: string[] }[]> {
    const matches: { botIds: string[], entryIds: string[] }[] = [];

    for (const queueType of ['PREMIUM', 'PRIORITY', 'STANDARD'] as QueueType[]) {
      const waitingEntries = await this.prisma.queueEntry.findMany({
        where: {
          queueType,
          status: 'WAITING',
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          bot: {
            include: {
              creator: true,
            },
          },
        },
        orderBy: [
          { priority: 'desc' },
          { enteredAt: 'asc' },
        ],
      });

      // Track selected bot IDs to prevent duplicates within this matching session
      const selectedBotIds = new Set<string>();
      
      // Filter out any duplicate bot entries
      const uniqueEntries: typeof waitingEntries = [];
      for (const entry of waitingEntries) {
        if (!selectedBotIds.has(entry.botId)) {
          uniqueEntries.push(entry);
          selectedBotIds.add(entry.botId);
        } else {
          console.log(`⚠️ Skipping duplicate bot ${entry.bot.name} (${entry.botId}) in ${queueType} queue`);
        }
      }

      // Now create matches from unique entries
      let index = 0;
      while (index + this.config.minPlayersForMatch <= uniqueEntries.length) {
        // Always create exactly 4-player matches
        const matchSize = 4;
        
        const selectedEntries = uniqueEntries.slice(index, index + matchSize);
        index += matchSize;
        
        const botIds = selectedEntries.map(entry => entry.botId);
        const entryIds = selectedEntries.map(entry => entry.id);
        
        // Verify no duplicates (extra safety check)
        const uniqueBotIds = new Set(botIds);
        if (uniqueBotIds.size !== botIds.length) {
          console.error(`❌ CRITICAL: Duplicate bot IDs detected in match! Bot IDs: ${botIds.join(', ')}`);
          continue; // Skip this match
        }
        
        // Debug logging
        console.log(`Matching ${matchSize} unique bots from ${queueType} queue:`);
        selectedEntries.forEach((entry, i) => {
          console.log(`  ${i + 1}. Bot: ${entry.bot.name} (ID: ${entry.botId}, Creator: ${entry.bot.creator?.address || 'N/A'}, Demo: ${entry.bot.isDemo})`);
        });
        
        // Don't mark as MATCHED yet - wait until tournament is created successfully
        matches.push({ botIds, entryIds });
      }
    }

    return matches;
  }

  async expireOldEntries(): Promise<number> {
    const result = await this.prisma.queueEntry.updateMany({
      where: {
        status: 'WAITING',
        expiresAt: {
          lte: new Date(),
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    if (result.count > 0) {
      await this.notifyQueueUpdate();
    }

    return result.count;
  }

  async getQueueStatus(): Promise<any> {
    const queueCounts = await this.prisma.queueEntry.groupBy({
      by: ['queueType'],
      where: {
        status: 'WAITING',
      },
      _count: true,
    });

    const totalInQueue = queueCounts.reduce((sum, entry) => sum + entry._count, 0);

    // Future enhancement: track recent matches
    // await this.prisma.queueEntry.findMany({
    //   where: { status: 'MATCHED' },
    //   orderBy: { matchedAt: 'desc' },
    //   take: 10,
    // });

    const avgWaitTime = await this.calculateAverageWaitTime();

    return {
      totalInQueue,
      averageWaitTime: avgWaitTime,
      nextMatchTime: this.calculateNextMatchTime(),
      queueTypes: queueCounts.map(entry => ({
        type: entry.queueType,
        count: entry._count,
        estimatedWaitTime: this.estimateWaitTime(entry.queueType, entry._count),
      })),
    };
  }

  async getQueuePosition(botId: string): Promise<number | null> {
    const entry = await this.prisma.queueEntry.findFirst({
      where: {
        botId,
        status: 'WAITING',
      },
    });

    if (!entry) {
      return null;
    }

    const position = await this.prisma.queueEntry.count({
      where: {
        status: 'WAITING',
        queueType: entry.queueType,
        OR: [
          { priority: { gt: entry.priority } },
          {
            priority: entry.priority,
            enteredAt: { lt: entry.enteredAt },
          },
        ],
      },
    });

    return position + 1;
  }

  private calculatePriority(queueType: QueueType, bot: any): number {
    let priority = 0;

    switch (queueType) {
      case 'PREMIUM':
        priority = 100;
        break;
      case 'PRIORITY':
        priority = 50;
        break;
      case 'STANDARD':
        priority = 0;
        break;
    }

    const stats = typeof bot.stats === 'string' ? JSON.parse(bot.stats) : bot.stats;
    if (stats.wins > 10) {
      priority += 5;
    }

    return priority;
  }

  private async calculateAverageWaitTime(): Promise<number> {
    const recentMatches = await this.prisma.queueEntry.findMany({
      where: {
        status: 'MATCHED',
        matchedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    if (recentMatches.length === 0) {
      return 120;
    }

    const totalWaitTime = recentMatches.reduce((sum, entry) => {
      const waitTime = entry.matchedAt!.getTime() - entry.enteredAt.getTime();
      return sum + waitTime;
    }, 0);

    return Math.round(totalWaitTime / recentMatches.length / 1000);
  }

  private calculateNextMatchTime(): Date {
    return new Date(Date.now() + this.config.matchmakingIntervalMs);
  }

  private estimateWaitTime(queueType: QueueType, count: number): number {
    const baseTime = 120;
    const multiplier = count / this.config.minPlayersForMatch;
    
    switch (queueType) {
      case 'PREMIUM':
        return Math.round(baseTime * 0.5 * multiplier);
      case 'PRIORITY':
        return Math.round(baseTime * 0.75 * multiplier);
      case 'STANDARD':
        return Math.round(baseTime * multiplier);
      default:
        return baseTime;
    }
  }

  private async notifyQueueUpdate() {
    if (this.redis) {
      try {
        await this.redis.publish('QUEUE_UPDATE', JSON.stringify({
          timestamp: new Date().toISOString(),
          type: 'queue_update',
        }));
      } catch (error) {
        console.error('Failed to publish queue update:', error);
      }
    }
  }

  async cleanupStuckMatches(): Promise<void> {
    try {
      // Find MATCHED entries older than 5 minutes (they should have tournaments by now)
      const stuckTimeout = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes
      
      const stuckEntries = await this.prisma.queueEntry.findMany({
        where: {
          status: 'MATCHED',
          matchedAt: {
            lt: stuckTimeout,
          },
        },
        include: {
          bot: true,
        },
      });
      
      if (stuckEntries.length > 0) {
        console.log(`Found ${stuckEntries.length} stuck MATCHED entries, resetting to WAITING...`);
        
        // Reset them back to WAITING
        await this.prisma.queueEntry.updateMany({
          where: {
            id: {
              in: stuckEntries.map(e => e.id),
            },
          },
          data: {
            status: 'WAITING',
            matchedAt: null,
          },
        });
        
        console.log(`Reset ${stuckEntries.length} stuck entries back to WAITING`);
        
        // Notify queue update
        await this.notifyQueueUpdate();
      }
    } catch (error) {
      console.error('Failed to cleanup stuck matches:', error);
    }
  }

  async cleanupDuplicateEntries(): Promise<void> {
    try {
      // Find all WAITING entries
      const waitingEntries = await this.prisma.queueEntry.findMany({
        where: {
          status: 'WAITING',
        },
        orderBy: {
          enteredAt: 'asc', // Keep oldest entry
        },
        include: {
          bot: true,
        },
      });

      // Group by botId
      const entriesByBot = new Map<string, typeof waitingEntries>();
      for (const entry of waitingEntries) {
        const botEntries = entriesByBot.get(entry.botId) || [];
        botEntries.push(entry);
        entriesByBot.set(entry.botId, botEntries);
      }

      // Remove duplicates (keep only the first/oldest)
      let totalCancelled = 0;
      for (const [botId, entries] of entriesByBot) {
        if (entries.length > 1) {
          console.log(`Found ${entries.length} duplicate WAITING entries for bot ${entries[0].bot.name} (${botId}), removing extras...`);
          
          // Keep the first, cancel the rest
          const toCancel = entries.slice(1).map(e => e.id);
          
          await this.prisma.queueEntry.updateMany({
            where: {
              id: {
                in: toCancel,
              },
            },
            data: {
              status: 'CANCELLED',
            },
          });
          
          totalCancelled += toCancel.length;
          console.log(`Cancelled ${toCancel.length} duplicate entries for bot ${entries[0].bot.name}`);
        }
      }

      if (totalCancelled > 0) {
        console.log(`Total duplicate entries cleaned up: ${totalCancelled}`);
        // Notify queue update
        await this.notifyQueueUpdate();
      }
    } catch (error) {
      console.error('Failed to cleanup duplicate entries:', error);
    }
  }

  startMatchmaking() {
    if (this.matchmakingInterval) {
      return;
    }

    const runMatchmaking = async () => {
      try {
        console.log('Running matchmaking...');
        
        // Update timing
        this.nextMatchmakingRun = new Date(Date.now() + this.config.matchmakingIntervalMs);
        
        await this.expireOldEntries();
        await this.cleanupStuckMatches(); // Clean up stuck MATCHED entries
        await this.cleanupDuplicateEntries(); // Clean up duplicate WAITING entries
        
        const matches = await this.findMatches();
        
        if (matches.length > 0) {
          console.log(`Found ${matches.length} potential matches`);
          
          for (const match of matches) {
            try {
              // Mark entries as MATCHED before creating tournament
              await this.prisma.queueEntry.updateMany({
                where: {
                  id: {
                    in: match.entryIds,
                  },
                },
                data: {
                  status: 'MATCHED',
                },
              });
              
              // Create the tournament
              await this.createTournament(match.botIds);
              console.log(`Successfully created tournament for ${match.botIds.length} bots`);
              
              // Notify queue update after successful creation
              await this.notifyQueueUpdate();
            } catch (error) {
              console.error(`Failed to create tournament for bots ${match.botIds.join(', ')}:`, error);
              
              // Rollback: Mark entries back to WAITING if tournament creation failed
              try {
                await this.prisma.queueEntry.updateMany({
                  where: {
                    id: {
                      in: match.entryIds,
                    },
                  },
                  data: {
                    status: 'WAITING',
                  },
                });
                console.log(`Rolled back queue entries to WAITING status`);
              } catch (rollbackError) {
                console.error('Failed to rollback queue entries:', rollbackError);
              }
            }
          }
        }
      } catch (error) {
        console.error('Matchmaking error:', error);
      }
    };

    // Run immediately
    runMatchmaking();

    // Then run on interval
    this.matchmakingInterval = setInterval(runMatchmaking, this.config.matchmakingIntervalMs);
  }

  stopMatchmaking() {
    if (this.matchmakingInterval) {
      clearInterval(this.matchmakingInterval);
      this.matchmakingInterval = null;
    }
  }

  private async createTournament(botIds: string[]) {
    console.log(`Creating tournament for bots: ${botIds.join(', ')}`);
    
    // Available game types for random selection
    const gameTypes = ['poker', 'reverse-hangman', 'connect4'];
    
    let selectedGameType: string;
    
    // Check for test override first
    if (this.testGameTypeOverride && gameTypes.includes(this.testGameTypeOverride)) {
      selectedGameType = this.testGameTypeOverride;
      console.log(`🧪 Using test game type override: ${selectedGameType}`);
      
      // Clear the test override after using it (one-time use)
      this.testGameTypeOverride = null;
      console.log('🧹 Cleared test game type override');
    } else {
      // Use crypto.randomInt for better randomness
      const cryptoIndex = randomInt(0, gameTypes.length);
      
      selectedGameType = gameTypes[cryptoIndex];
    }
    
    console.log(`🎮 Game selection:`, {
      timestamp: new Date().toISOString(),
      selectedGameType: selectedGameType,  // ← THIS IS THE ACTUAL GAME SELECTED
      gameTypes: gameTypes,
    });
    
    console.log(`✅ Selected game type: ${selectedGameType.toUpperCase()} (using crypto.randomInt for true randomness)`);
    
    try {
      // First, clean up any old matches for these bots that are still in SCHEDULED/IN_PROGRESS state
      for (const botId of botIds) {
        const oldMatches = await this.prisma.match.findMany({
          where: {
            status: {
              in: ['SCHEDULED', 'IN_PROGRESS'],
            },
            participants: {
              some: {
                botId,
              },
            },
          },
        });
        
        if (oldMatches.length > 0) {
          console.log(`Cleaning up ${oldMatches.length} old matches for bot ${botId}`);
          await this.prisma.match.updateMany({
            where: {
              id: {
                in: oldMatches.map(m => m.id),
              },
            },
            data: {
              status: 'ABANDONED',
              completedAt: new Date(),
            },
          });
        }
      }
      // Create tournament record
      const tournament = await this.prisma.tournament.create({
        data: {
          name: `Match ${new Date().toISOString()}`,
          type: 'ROOKIE', // Valid enum value
          status: 'UPCOMING', // Valid enum value
          entryFee: new Prisma.Decimal(0),
          prizePool: new Prisma.Decimal(0),
          startTime: new Date(),
          endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours later
        },
      });

      // For Connect4, we handle everything differently
      if (selectedGameType === 'connect4') {
        // Create Connect4 tournament bracket
        const connect4TournamentService = getConnect4TournamentService(this.prisma, this.pubsub);
        const tournamentBracket = await connect4TournamentService.createTournament(tournament.id, botIds);
        
        // Update queue entries to matched
        await this.prisma.queueEntry.updateMany({
          where: {
            botId: { in: botIds },
            status: 'WAITING',
          },
          data: {
            status: 'MATCHED',
            matchedAt: new Date(),
          },
        });

        // For Connect4, we need to publish queue updates with the first semifinal match ID
        const primaryMatchId = tournamentBracket.semifinalMatches[0].id;
        
        // Publish queue updates with match ID for each bot
        for (const botId of botIds) {
          const queueEntry = await this.prisma.queueEntry.findFirst({
            where: {
              botId,
              status: 'MATCHED',
            },
            include: {
              bot: {
                include: {
                  creator: true,
                },
              },
            },
          });

          if (queueEntry) {
            console.log(`📡 Publishing QUEUE_UPDATE for bot ${queueEntry.bot.name} (${botId})`);
            console.log(`   - Bot creator: ${queueEntry.bot.creator?.address || 'N/A'}`);
            console.log(`   - Match ID: ${primaryMatchId}`);
            console.log(`   - Queue status: ${queueEntry.status}`);
            console.log(`   - Game type: ${selectedGameType}`);
            
            // Publish to GraphQL subscription with match ID and game type
            this.pubsub.publish('QUEUE_UPDATE', {
              queueUpdate: {
                ...queueEntry,
                matchId: primaryMatchId,
                gameType: selectedGameType,
              },
            });
          }
        }
        
        // Start the first two semifinal matches
        for (const semifinalMatch of tournamentBracket.semifinalMatches) {
          await getGameManagerService().createGame(
            semifinalMatch.id, 
            'connect4', 
            [semifinalMatch.player1Id, semifinalMatch.player2Id], 
            semifinalMatch.gameState
          );
          await getGameManagerService().startGame(semifinalMatch.id);
          
          console.log(`Started Connect4 semifinal match ${semifinalMatch.id}`);
        }
        
        console.log(`Tournament ${tournament.id} created with Connect4 bracket`);
        return; // Exit early for Connect4
      }

      // Create match record with game type (for non-Connect4 games)
      const match = await this.prisma.match.create({
        data: {
          tournamentId: tournament.id,
          type: 'TOURNAMENT',
          status: 'SCHEDULED',
          gameHistory: { gameType: selectedGameType }, // Store game type
          decisions: {}, // Will store AI decisions
        },
      });

      // Create match participants
      const players = [];
      for (let i = 0; i < botIds.length; i++) {
        const bot = await this.prisma.bot.findUnique({
          where: { id: botIds[i] },
          include: { creator: true },
        });

        if (!bot) continue;

        await this.prisma.matchParticipant.create({
          data: {
            matchId: match.id,
            botId: bot.id,
            position: i + 1, // seat position
            points: 0, // starting points
          },
        });

        players.push({
          id: bot.id,
          name: bot.name,
          avatar: bot.avatar,
          chips: 10000,
          seat: i + 1,
          isAI: true,
          aiModel: bot.modelType,
          aiStrategy: bot.prompt,
          creatorAddress: bot.creator.address,
        });
      }

      // Update queue entries to matched
      await this.prisma.queueEntry.updateMany({
        where: {
          botId: { in: botIds },
          status: 'WAITING',
        },
        data: {
          status: 'MATCHED',
          matchedAt: new Date(),
        },
      });

      // Publish queue updates with match ID for each bot
      for (const botId of botIds) {
        const queueEntry = await this.prisma.queueEntry.findFirst({
          where: {
            botId,
            status: 'MATCHED',
          },
          include: {
            bot: {
              include: {
                creator: true,
              },
            },
          },
        });

        if (queueEntry) {
          console.log(`📡 Publishing QUEUE_UPDATE for bot ${queueEntry.bot.name} (${botId})`);
          console.log(`   - Bot creator: ${queueEntry.bot.creator?.address || 'N/A'}`);
          console.log(`   - Match ID: ${match.id}`);
          console.log(`   - Queue status: ${queueEntry.status}`);
          console.log(`   - Is demo bot: ${queueEntry.bot.isDemo}`);
          
          // Validate creator is loaded for non-demo bots
          if (!queueEntry.bot.isDemo && !queueEntry.bot.creator) {
            console.error(`❌ CRITICAL: Bot ${queueEntry.bot.name} has no creator loaded! This will break subscriptions.`);
          }
          
          // Publish to GraphQL subscription with match ID and game type
          this.pubsub.publish('QUEUE_UPDATE', {
            queueUpdate: {
              ...queueEntry,
              matchId: match.id,
              gameType: selectedGameType,
            },
          });
        } else {
          console.log(`⚠️ No queue entry found for bot ${botId} with MATCHED status`);
        }
      }

      // Initialize game state based on game type
      let initialState: any;
      
      switch (selectedGameType) {
        case 'poker':
          // Create and shuffle deck
          const suits = ['♠', '♥', '♦', '♣'];
          const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
          const deck: string[] = [];
          for (const suit of suits) {
            for (const rank of ranks) {
              deck.push(rank + suit);
            }
          }
          // Shuffle deck
          for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
          }
          
          // Deal hole cards to each player
          const dealtCards: string[] = [];
          const playersWithCards = players.map((player: any) => {
            const holeCards = [deck.pop()!, deck.pop()!];
            dealtCards.push(...holeCards);
            return {
              ...player,
              holeCards,
              bet: 0,
              totalBet: 0,
              folded: false,
              isAllIn: false,
              hasActed: false,
            };
          });
          
          // Post blinds
          const smallBlindAmount = 50;
          const bigBlindAmount = 100;
          playersWithCards[1].bet = smallBlindAmount;
          playersWithCards[1].totalBet = smallBlindAmount;
          playersWithCards[1].chips -= smallBlindAmount;
          playersWithCards[2].bet = bigBlindAmount;
          playersWithCards[2].totalBet = bigBlindAmount;
          playersWithCards[2].chips -= bigBlindAmount;
          
          const pot = smallBlindAmount + bigBlindAmount;
          
          initialState = {
            id: match.id,
            tournamentId: tournament.id,
            gameType: 'poker',
            players: playersWithCards,
            dealerPosition: 0,
            smallBlindPosition: 1,
            bigBlindPosition: 2,
            currentTurn: playersWithCards[3 % playersWithCards.length].id, // First to act after big blind
            communityCards: [],
            pot,
            currentBet: bigBlindAmount,
            minRaise: bigBlindAmount * 2,
            phase: 'preflop',
            handNumber: 1,
            blindLevel: 1,
            smallBlind: smallBlindAmount,
            bigBlind: bigBlindAmount,
            ante: 0,
            deck,
            burnt: [],
            actionHistory: { preflop: [], flop: [], turn: [], river: [] },
            lastAction: null,
            speed: 'normal', // Add speed setting for visualization timing
          };
          break;
          
        case 'reverse-hangman':
          initialState = {
            id: match.id,
            tournamentId: tournament.id,
            gameType: 'reverse-hangman',
            players: players.map((player: any) => ({
              ...player,
              isAI: true,
              guessHistory: [],
              roundsWon: 0,
              totalScore: 0
            })),
            currentTurn: players[0].id,
            phase: 'waiting',
            roundNumber: 0,
            maxRounds: 3,
            attempts: [],
            maxAttempts: 6,
            targetPrompt: '',
            generatedOutput: '',
            difficulty: 'medium',
            scores: {},
            currentPromptPair: null,
          };
          break;
          
        case 'connect4':
          // Connect4 is handled earlier, this should never be reached
          throw new Error('Connect4 should have been handled earlier in the flow');
          break;
          
        default:
          throw new Error(`Unknown game type: ${selectedGameType}`);
      }

      // Create game instance with selected game type (non-Connect4 games)
      if ((selectedGameType as string) !== 'connect4') {
        await getGameManagerService().createGame(match.id, selectedGameType, botIds, initialState);

        // Start the game
        await getGameManagerService().startGame(match.id);

        console.log(`Tournament ${tournament.id} created and started with match ${match.id}`);
      }
    } catch (error) {
      console.error('Error creating tournament:', error);
      throw error;
    }
  }
}