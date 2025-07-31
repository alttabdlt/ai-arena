import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

interface TournamentMatch {
  id: string;
  tournamentId: string;
  round: 'semifinal' | 'final';
  matchIndex?: number; // 0 or 1 for semifinals
  player1Id: string;
  player2Id: string;
  winnerId?: string;
  gameState: any;
}

interface TournamentBracket {
  tournamentId: string;
  semifinalMatches: [TournamentMatch, TournamentMatch];
  finalMatch?: TournamentMatch;
  championId?: string;
}

export class Connect4TournamentService {
  private tournaments = new Map<string, TournamentBracket>();
  private matchToTournament = new Map<string, string>();
  private prisma: PrismaClient;
  private pubsub: any;

  constructor(prisma: PrismaClient, pubsub: any) {
    this.prisma = prisma;
    this.pubsub = pubsub;
  }

  async createTournament(tournamentId: string, botIds: string[]): Promise<TournamentBracket> {
    if (botIds.length !== 4) {
      throw new Error('Connect4 tournament requires exactly 4 players');
    }

    // Create semifinal matches
    const semifinal1 = await this.createMatch(tournamentId, 'semifinal', 0, botIds[0], botIds[1]);
    const semifinal2 = await this.createMatch(tournamentId, 'semifinal', 1, botIds[2], botIds[3]);

    const bracket: TournamentBracket = {
      tournamentId,
      semifinalMatches: [semifinal1, semifinal2],
    };

    this.tournaments.set(tournamentId, bracket);
    this.matchToTournament.set(semifinal1.id, tournamentId);
    this.matchToTournament.set(semifinal2.id, tournamentId);

    console.log(`Created Connect4 tournament ${tournamentId} with semifinals:`, {
      match1: `${semifinal1.player1Id} vs ${semifinal1.player2Id}`,
      match2: `${semifinal2.player1Id} vs ${semifinal2.player2Id}`,
    });

    return bracket;
  }

  private async createMatch(
    tournamentId: string,
    round: 'semifinal' | 'final',
    matchIndex: number | undefined,
    player1Id: string,
    player2Id: string
  ): Promise<TournamentMatch> {
    // Get player details
    const [player1, player2] = await Promise.all([
      this.prisma.bot.findUnique({ where: { id: player1Id }, include: { creator: true } }),
      this.prisma.bot.findUnique({ where: { id: player2Id }, include: { creator: true } }),
    ]);

    if (!player1 || !player2) {
      throw new Error('One or both players not found');
    }

    const matchId = uuidv4();

    // Create match record in database
    const dbMatch = await this.prisma.match.create({
      data: {
        id: matchId,
        tournamentId,
        type: 'TOURNAMENT',
        status: 'SCHEDULED',
        gameHistory: { 
          gameType: 'connect4',
          round,
          matchIndex
        },
        decisions: {},
      },
    });

    // Create match participants
    await this.prisma.matchParticipant.createMany({
      data: [
        {
          matchId: dbMatch.id,
          botId: player1.id,
          position: 1,
          points: 0,
        },
        {
          matchId: dbMatch.id,
          botId: player2.id,
          position: 2,
          points: 0,
        },
      ],
    });

    // Create game state for 2-player Connect4
    const gameState = {
      id: matchId,
      tournamentId,
      gameType: 'connect4',
      players: [
        {
          id: player1.id,
          name: player1.name,
          avatar: player1.avatar,
          isAI: true,
          aiModel: player1.modelType,
          aiStrategy: player1.prompt,
          creatorAddress: player1.creator.address,
        },
        {
          id: player2.id,
          name: player2.name,
          avatar: player2.avatar,
          isAI: true,
          aiModel: player2.modelType,
          aiStrategy: player2.prompt,
          creatorAddress: player2.creator.address,
        },
      ],
      currentTurn: player1.id,
      currentPlayerIndex: 0,
      phase: 'playing',
      gamePhase: 'playing',
      board: Array(8).fill(null).map(() => Array(8).fill(0)), // 8x8 Connect4 board
      winner: null,
      moveCount: 0,
      winningLine: null,
    };

    const match: TournamentMatch = {
      id: matchId,
      tournamentId,
      round,
      matchIndex,
      player1Id,
      player2Id,
      gameState,
    };

    return match;
  }

  async handleMatchComplete(matchId: string, winnerId: string): Promise<TournamentMatch | null> {
    const tournamentId = this.matchToTournament.get(matchId);
    if (!tournamentId) {
      console.error(`No tournament found for match ${matchId}`);
      return null;
    }

    const bracket = this.tournaments.get(tournamentId);
    if (!bracket) {
      console.error(`Tournament bracket not found: ${tournamentId}`);
      return null;
    }

    // Find which match completed
    const semifinalIndex = bracket.semifinalMatches.findIndex(m => m.id === matchId);
    
    if (semifinalIndex !== -1) {
      // Semifinal completed
      bracket.semifinalMatches[semifinalIndex].winnerId = winnerId;
      console.log(`Semifinal ${semifinalIndex + 1} winner: ${winnerId}`);

      // Check if both semifinals are complete
      if (bracket.semifinalMatches.every(m => m.winnerId)) {
        // Create finals match
        const finalist1 = bracket.semifinalMatches[0].winnerId!;
        const finalist2 = bracket.semifinalMatches[1].winnerId!;
        
        const finalMatch = await this.createMatch(
          tournamentId,
          'final',
          undefined,
          finalist1,
          finalist2
        );

        bracket.finalMatch = finalMatch;
        this.matchToTournament.set(finalMatch.id, tournamentId);

        console.log(`Created finals match: ${finalist1} vs ${finalist2}`);

        // Publish tournament update
        this.publishTournamentUpdate(bracket);

        // Return the finals match for the game manager to start
        return finalMatch;
      }
    } else if (bracket.finalMatch && bracket.finalMatch.id === matchId) {
      // Finals completed
      bracket.finalMatch.winnerId = winnerId;
      bracket.championId = winnerId;
      
      console.log(`Tournament ${tournamentId} champion: ${winnerId}`);
      
      // Publish tournament complete event
      this.publishTournamentComplete(bracket);
    }
    
    return null;
  }

  getMatchInfo(matchId: string): { tournament: TournamentBracket; match: TournamentMatch } | null {
    const tournamentId = this.matchToTournament.get(matchId);
    if (!tournamentId) return null;

    const bracket = this.tournaments.get(tournamentId);
    if (!bracket) return null;

    // Find the specific match
    let match: TournamentMatch | undefined;
    const semifinalMatch = bracket.semifinalMatches.find(m => m.id === matchId);
    if (semifinalMatch) {
      match = semifinalMatch;
    } else if (bracket.finalMatch && bracket.finalMatch.id === matchId) {
      match = bracket.finalMatch;
    }

    if (!match) return null;

    return { tournament: bracket, match };
  }

  getTournamentBracket(tournamentId: string): TournamentBracket | null {
    return this.tournaments.get(tournamentId) || null;
  }

  private publishTournamentUpdate(bracket: TournamentBracket): void {
    this.pubsub.publish('TOURNAMENT_UPDATE', {
      tournamentUpdate: {
        tournamentId: bracket.tournamentId,
        type: 'bracket_update',
        data: {
          semifinals: bracket.semifinalMatches.map(m => ({
            matchId: m.id,
            player1: m.player1Id,
            player2: m.player2Id,
            winner: m.winnerId,
          })),
          finals: bracket.finalMatch ? {
            matchId: bracket.finalMatch.id,
            player1: bracket.finalMatch.player1Id,
            player2: bracket.finalMatch.player2Id,
            winner: bracket.finalMatch.winnerId,
          } : null,
        },
      },
    });
  }

  private publishTournamentComplete(bracket: TournamentBracket): void {
    this.pubsub.publish('TOURNAMENT_UPDATE', {
      tournamentUpdate: {
        tournamentId: bracket.tournamentId,
        type: 'tournament_complete',
        data: {
          championId: bracket.championId,
        },
      },
    });
  }
}

// Singleton instance
let connect4TournamentService: Connect4TournamentService | null = null;

export function getConnect4TournamentService(prisma: PrismaClient, pubsub: any): Connect4TournamentService {
  if (!connect4TournamentService) {
    connect4TournamentService = new Connect4TournamentService(prisma, pubsub);
  }
  return connect4TournamentService;
}