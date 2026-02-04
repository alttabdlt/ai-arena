import { getGameManagerService } from '../../services/gameManagerService';
import type { Context } from '../../config/context';
import { withFilter } from 'graphql-subscriptions';
import { PubSub } from 'graphql-subscriptions';

// Type the PubSub asyncIterator properly
interface PubSubAsyncIterator<T> extends AsyncIterator<T> {
  return(): Promise<IteratorResult<T>>;
  throw(error?: any): Promise<IteratorResult<T>>;
}

interface TypedPubSub extends PubSub {
  asyncIterator<T = any>(triggers: string | string[]): PubSubAsyncIterator<T>;
}

// Get gameManagerService instance
const gameManagerService = () => getGameManagerService();

export const gameManagerResolvers = {
  Query: {
    activeGames: async () => {
      return gameManagerService().getActiveGames().map(transformGameInstance);
    },
    
    gameById: async (_: any, { gameId }: { gameId: string }) => {
      const game = gameManagerService().getGameById(gameId);
      return game ? transformGameInstance(game) : null;
    },
    
    gameStats: async () => {
      const stats = gameManagerService().getGameStats();
      return {
        totalGames: stats.total,
        activeGames: stats.active,
        pausedGames: stats.paused,
        completedGames: stats.completed,
        totalSpectators: stats.totalSpectators,
        gamesByType: [
          { type: 'POKER', count: stats.poker || 0, active: stats.activePoker || 0 },
          { type: 'REVERSE_HANGMAN', count: stats.reverseHangman || 0, active: stats.activeReverseHangman || 0 },
          { type: 'CHESS', count: stats.chess || 0, active: stats.activeChess || 0 },
          { type: 'GO', count: stats.go || 0, active: stats.activeGo || 0 },
        ]
      };
    },
  },

  Mutation: {
    createGame: async (_: any, args: any, ctx: Context) => {
      const { gameId, type, players } = args;
      
      // Convert enum to lowercase for internal use
      const gameType = type.toLowerCase().replace('_', '-') as any;
      
      // Build a sensible initial state per game type
      let initialState: any;
      
      if (gameType === 'poker') {
        // Load bots to map model/name when available
        let botMap: Record<string, any> = {};
        try {
          const bots = await ctx.prisma.bot.findMany({ where: { id: { in: players } } });
          botMap = Object.fromEntries(bots.map(b => [b.id, b]));
        } catch (e) {
          // continue with defaults
        }
        // Initialize poker with handComplete=true to trigger first hand start
        const startingChips = 10000;
        const smallBlind = 50;
        const bigBlind = 100;
        
        initialState = {
          phase: 'handComplete',
          handComplete: true,
          players: players.map((id: string, idx: number) => {
            const bot = botMap[id];
            const aiModel = bot?.modelType || (idx % 2 === 0 ? 'DEEPSEEK_CHAT' : 'GPT_4O');
            return {
              id,
              name: bot?.name || id,
              isAI: true,
              aiModel, // normalize later in game manager
              aiStrategy: 'Play optimal poker strategy',
              chips: startingChips,
              bet: 0,
              totalBet: 0,
              folded: false,
              isActive: true,
              isAllIn: false,
              hasActed: false,
              position: idx,
            };
          }),
          communityCards: [],
          pot: 0,
          currentBet: 0,
          currentTurn: players[0],
          deck: null, // Created on first hand
          burnt: [],
          handNumber: 1,
          maxHands: 5,
          bigBlind,
          smallBlind,
          dealerIndex: 0,
          minRaise: bigBlind * 2,
          sidePots: [],
          winners: [],
          speed: 'thinking',
          timeoutMs: 10000,
        };
      } else if (gameType === 'reverse-hangman') {
        initialState = {
          phase: 'playing',
          players: players.map((id: string) => ({ id, roundsWon: 0, totalScore: 0 })),
          attempts: [],
          maxAttempts: 5,
          currentTurn: players[0],
          turnCount: 0,
          timeoutMs: 10000,
        };
      } else if (gameType === 'connect4') {
        initialState = {
          phase: 'waiting',
          players: players.map((id: string) => ({ id })),
          board: Array.from({ length: 8 }, () => Array(8).fill(0)),
          currentTurn: players[0],
          currentPlayerIndex: 0,
          moveCount: 0,
          gamePhase: 'playing',
        };
      } else {
        // Fallback minimal state
        initialState = {
          gameId,
          phase: 'waiting',
          players: players.map((id: string) => ({ id, isAI: true })),
          turnCount: 0,
        };
      }
      
      const game = await gameManagerService().createGame(gameId, gameType, players, initialState);
      return transformGameInstance(game);
    },
    
    startGame: async (_: any, { gameId }: { gameId: string }) => {
      await gameManagerService().startGame(gameId);
      const game = gameManagerService().getGameById(gameId);
      return transformGameInstance(game!);
    },
    
    pauseGame: async (_: any, { gameId }: { gameId: string }) => {
      await gameManagerService().pauseGame(gameId);
      const game = gameManagerService().getGameById(gameId);
      return transformGameInstance(game!);
    },
    
    resumeGame: async (_: any, { gameId }: { gameId: string }) => {
      await gameManagerService().resumeGame(gameId);
      const game = gameManagerService().getGameById(gameId);
      return transformGameInstance(game!);
    },
    
    addSpectator: async (_: any, { gameId, userId }: { gameId: string; userId: string }) => {
      await gameManagerService().addSpectator(gameId, userId);
      return true;
    },
    
    removeSpectator: async (_: any, { gameId, userId }: { gameId: string; userId: string }) => {
      await gameManagerService().removeSpectator(gameId, userId);
      return true;
    },
  },

  Subscription: {
    gameStateUpdate: {
      subscribe: withFilter(
        (_: any, __: any, ctx: any) => (ctx.pubsub as TypedPubSub).asyncIterator(['GAME_UPDATE']),
        (payload, variables) => {
          return payload.gameId === variables.gameId && payload.type === 'state';
        }
      ),
      resolve: (payload: any) => ({
        gameId: payload.gameId,
        type: 'STATE_CHANGE',
        timestamp: payload.timestamp,
        data: JSON.stringify(payload.data)
      })
    },
    
    gameEvent: {
      subscribe: withFilter(
        (_: any, __: any, ctx: any) => (ctx.pubsub as TypedPubSub).asyncIterator(['GAME_UPDATE']),
        (payload, variables) => {
          return payload.gameId === variables.gameId && (payload.type === 'event' || payload.type === 'decision');
        }
      ),
      resolve: (payload: any) => ({
        gameId: payload.gameId,
        event: payload.type === 'decision' ? 'player_decision' : (payload.data?.event || 'unknown'),
        playerId: payload.data?.playerId || payload.data?.decision?.playerId || null,
        data: JSON.stringify(payload.data || {}),
        timestamp: payload.timestamp || new Date().toISOString()
      })
    },
    
    allGameUpdates: {
      subscribe: (_: any, __: any, ctx: any) => (ctx.pubsub as TypedPubSub).asyncIterator(['GAME_UPDATE']),
      resolve: (payload: any) => ({
        gameId: payload.gameId,
        type: mapUpdateType(payload.type),
        timestamp: payload.timestamp,
        data: JSON.stringify(payload.data)
      })
    },
  },
};

// Helper functions
function transformGameInstance(game: any) {
  // Ensure we don't include non-serializable properties
  const cleanState = {
    ...game.state,
    // Remove any potential non-serializable properties from state
  };
  
  return {
    id: game.id,
    type: game.type.toUpperCase().replace('-', '_'),
    status: game.status.toUpperCase(),
    players: game.state.players?.map((p: any) => ({
      id: p.id,
      name: p.name || p.id,
      isAI: p.isAI || false,
      model: p.aiModel || null,
      status: getPlayerStatus(p)
    })) || [],
    spectatorCount: game.spectators?.size || 0,
    createdAt: game.createdAt || new Date(),
    lastActivity: game.lastActivity,
    gameState: JSON.stringify(cleanState)
  };
}

function getPlayerStatus(player: any): string {
  if (player.isEliminated) return 'ELIMINATED';
  if (player.isWinner) return 'WINNER';
  if (player.folded || !player.isActive) return 'FOLDED';
  return 'ACTIVE';
}

function mapUpdateType(type: string): string {
  switch (type) {
    case 'state': return 'STATE_CHANGE';
    case 'decision': return 'PLAYER_ACTION';
    case 'event': return 'GAME_EVENT';
    default: return 'STATE_CHANGE';
  }
}
