import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  gameRegistry, 
  gameLoader,
  ContextFactory
} from '@/game-engine';
import { 
  PokerGameManager,
  PokerGameState,
  PokerGameConfig,
  PokerGameEvent,
  PokerPhase as GamePhase, 
  PokerPlayer as Player, 
  Card,
  PokerStyleBonus as StyleBonus
} from '@/game-engine/games/poker';
import { 
  IGameDecision as AIDecision,
  IScoreBreakdown as PointEvent,
  IGameEvent as AchievementEvent
} from '@/game-engine/core/interfaces';
import { registerGames } from '@/game-engine/games';

// Re-export types for backward compatibility
export type { PokerGameConfig as GameConfig, PokerGameState as GameState } from '@/game-engine/games/poker/PokerTypes';

export interface UsePokerGameState {
  players: (Player & { avatar: string; isAI: boolean })[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  phase: GamePhase;
  currentPlayer: Player | null;
  winners: { playerId: string; amount: number; hand?: string }[];
  isHandComplete: boolean;
  currentAIThinking: string | null;
  currentAIReasoning: string | null;
  recentActions: {
    playerId: string;
    action: string;
    amount?: number;
    timestamp: number;
  }[];
  aiDecisionHistory?: Map<string, AIDecision>;
  recentStyleBonuses: StyleBonus[];
  recentMisreads: {
    handNumber: number;
    actual: string;
    aiThought: string;
    holeCards: string[];
    boardCards: string[];
    phase: string;
    severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
    modelName: string;
    timestamp: number;
  }[];
  recentPointEvents: PointEvent[];
  recentAchievementEvents: AchievementEvent[];
}

// Adapter to convert new framework types to legacy types
class PokerGameAdapter {
  private manager: PokerGameManager;
  private context: any;
  private tournament?: any;

  constructor(config: any, tournament?: any) {
    // Register games if not already done
    if (gameRegistry.getAll().length === 0) {
      registerGames();
    }

    // Create game instance
    const descriptor = gameRegistry.get('poker');
    if (!descriptor) {
      throw new Error('Poker game not registered');
    }

    this.context = ContextFactory.create({ gameId: 'poker-game-' + Date.now() });
    const factory = descriptor.factory;
    this.tournament = tournament;
    
    // Use tournament data if available
    let playerConfigs = config.playerConfigs;
    if (tournament?.players) {
      playerConfigs = tournament.players.map((player: any) => ({
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        aiModel: player.aiModel
      }));
    }
    
    // Convert legacy config to new format
    const pokerConfig: PokerGameConfig = {
      thinkingTime: config.speed === 'thinking' ? 120000 : config.speed === 'fast' ? 5000 : 10000, // Increased timeouts for AI API calls
      playerConfigs: playerConfigs || this.generateDefaultPlayers(config.playerCount || 3, config.startingChips),
      startingChips: config.startingChips || 10000,
      smallBlind: 50,
      bigBlind: 100,
      maxHands: config.maxHands === -1 ? undefined : config.maxHands,
      speed: config.speed || 'normal',
      showAIThinking: config.showAIThinking !== false,
      showDecisionHistory: config.showDecisionHistory !== false
    };

    this.manager = factory.createManager(pokerConfig, this.context) as unknown as PokerGameManager;
  }

  private generateDefaultPlayers(count: number, startingChips: number) {
    const botProfiles = [
      { id: 'gambler', name: 'The Gambler', avatar: '/assets/bot-gambler.png' },
      { id: 'terminator', name: 'Terminator', avatar: '/assets/bot-terminator.png' },
      { id: 'zenmaster', name: 'Zen Master', avatar: '/assets/bot-zen-master.png' }
    ];

    const additionalNames = ['Shark', 'Bluffer', 'Calculator', 'Rock', 'Maniac', 'Trickster'];
    const players = [];

    for (let i = 0; i < count; i++) {
      let profile;
      if (i < botProfiles.length) {
        profile = botProfiles[i];
      } else {
        const avatarIndex = i % botProfiles.length;
        const nameIndex = (i - botProfiles.length) % additionalNames.length;
        profile = {
          id: `bot-${i}`,
          name: additionalNames[nameIndex],
          avatar: botProfiles[avatarIndex].avatar
        };
      }

      players.push({
        id: profile.id,
        name: profile.name,
        avatar: profile.avatar,
        aiModel: 'gpt-4o'
      });
    }

    return players;
  }

  async initialize() {
    // Manager should be created but not started yet
    // The actual game initialization happens in startGame
    return Promise.resolve();
  }

  async startGame() {
    await this.manager.startGame();
  }

  async startNewHand() {
    await this.manager.startNewHand();
  }

  getEnhancedState() {
    try {
      const state = this.manager.getState() as PokerGameState;
      const currentPlayer = state.currentTurn ? 
        state.players.find(p => p.id === state.currentTurn) : null;

      return {
        players: state.players.map(p => ({
          ...p,
          avatar: '/assets/bot-gambler.png', // Default avatar
          isAI: true
        })),
        communityCards: state.communityCards,
        pot: state.pot,
        currentBet: state.currentBet,
        phase: state.phase as GamePhase,
        currentPlayer: currentPlayer as any,
        winners: state.winners,
        isHandComplete: state.isHandComplete,
        aiDecisionHistory: new Map()
      };
    } catch (error) {
      // Return default state if manager not initialized
      return {
        players: [],
        communityCards: [],
        pot: 0,
        currentBet: 0,
        phase: 'waiting' as GamePhase,
        currentPlayer: null,
        winners: [],
        isHandComplete: false,
        aiDecisionHistory: new Map()
      };
    }
  }

  getCurrentPlayer() {
    try {
      const state = this.manager.getState() as PokerGameState;
      return state.currentTurn ? 
        state.players.find(p => p.id === state.currentTurn) : null;
    } catch (error) {
      return null;
    }
  }

  getSpeed() {
    return this.manager.getConfig().speed;
  }

  setSpeed(speed: string) {
    // Speed is immutable in new framework, would need to recreate manager
    console.warn('Speed changes not supported in new framework');
  }

  pause() {
    this.manager.pauseGame();
  }

  resume() {
    this.manager.resumeGame();
  }

  isPaused() {
    return false; // TODO: Implement pause state tracking
  }

  getGameState() {
    return 'playing'; // Simplified for now
  }

  getCurrentHandNumber() {
    return this.manager.getCurrentHandNumber();
  }

  getDecisionHistory() {
    return this.manager.getDecisionHistory();
  }

  addEventListener(handler: (event: any) => void) {
    // Convert new event format to legacy format
    this.manager.on('thinking', (data) => {
      handler({
        type: 'thinking',
        playerId: data.playerId,
        timestamp: data.timestamp
      });
    });

    this.manager.on('decision-made', (data) => {
      handler({
        type: 'action',
        playerId: data.playerId,
        action: data.decision.action,
        reasoning: data.decision.reasoning,
        timestamp: data.timestamp
      });
    });

    this.manager.on('phase-changed', (data) => {
      handler({
        type: 'phase-change',
        phase: data.phase,
        timestamp: data.timestamp
      });
    });

    this.manager.on('hand-completed', (data) => {
      handler({
        type: 'hand-complete',
        winners: data.winners,
        timestamp: data.timestamp
      });
    });
  }

  removeEventListener(handler: (event: any) => void) {
    // Not implemented in adapter
  }

  getConfig() {
    return this.manager.getConfig();
  }

  getTournamentId() {
    return this.context.gameId;
  }

  getPlayerCount() {
    return this.manager.getState().players.length;
  }

  getPointScoringLeaderboard() {
    return [];
  }

  getPlayerPoints(playerId: string) {
    return { base: 0, style: 0, penalty: 0, total: 0 };
  }

  getStyleStats(playerId: string) {
    return null;
  }

  getAchievements(playerId: string) {
    return [];
  }
}

export function usePokerGame(tournament?: any) {
  const gameManagerRef = useRef<PokerGameAdapter | null>(null);
  const [gameState, setGameState] = useState<UsePokerGameState>({
    players: [],
    communityCards: [],
    pot: 0,
    currentBet: 0,
    phase: 'waiting',
    currentPlayer: null,
    winners: [],
    isHandComplete: false,
    currentAIThinking: null,
    currentAIReasoning: null,
    recentActions: [],
    recentStyleBonuses: [],
    recentMisreads: [],
    recentPointEvents: [],
    recentAchievementEvents: []
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameSpeed, setGameSpeed] = useState('thinking');
  const [config, setConfig] = useState<any | null>(null);
  const [currentGameState, setCurrentGameState] = useState<any>('setup');

  const updateGameState = useCallback(() => {
    if (!gameManagerRef.current) return;
    
    const state = gameManagerRef.current.getEnhancedState();
    const currentPlayer = gameManagerRef.current.getCurrentPlayer();
    
    setGameState(prev => ({
      ...prev,
      players: state.players,
      communityCards: state.communityCards,
      pot: state.pot,
      currentBet: state.currentBet,
      phase: state.phase,
      currentPlayer,
      winners: state.winners,
      isHandComplete: state.isHandComplete,
      aiDecisionHistory: state.aiDecisionHistory
    }));
  }, []);

  const handleGameEvent = useCallback((event: any) => {
    switch (event.type) {
      case 'thinking':
        setGameState(prev => ({
          ...prev,
          currentAIThinking: event.playerId || null,
          currentAIReasoning: null
        }));
        break;
        
      case 'action':
        if (event.playerId && event.action) {
          const actionText = event.action.type === 'raise' || event.action.type === 'bet'
            ? `${event.action.type} $${event.action.amount}`
            : event.action.type === 'call' && event.action.amount
            ? `${event.action.type} $${event.action.amount}`
            : event.action.type;
            
          setGameState(prev => ({
            ...prev,
            currentAIThinking: null,
            currentAIReasoning: event.reasoning || null,
            recentActions: [
              {
                playerId: event.playerId!,
                action: actionText,
                amount: event.action!.amount,
                timestamp: event.timestamp
              },
              ...prev.recentActions.slice(0, 9)
            ]
          }));
          
          updateGameState();
          setTimeout(() => updateGameState(), 50);
        }
        break;
        
      case 'phase-change':
        updateGameState();
        setTimeout(() => {
          setGameState(prev => ({
            ...prev,
            currentAIReasoning: null
          }));
        }, 2000);
        break;
        
      case 'hand-complete':
        updateGameState();
        break;
    }
  }, [updateGameState]);

  const initializeGame = useCallback(async (gameConfig: any) => {
    if (gameManagerRef.current) {
      gameManagerRef.current.removeEventListener(handleGameEvent);
    }

    const manager = new PokerGameAdapter(gameConfig, tournament);
    gameManagerRef.current = manager;
    
    setConfig(gameConfig);
    setGameSpeed(gameConfig.speed || 'thinking');
    
    manager.addEventListener(handleGameEvent);
    
    try {
      // Don't start the game immediately - just initialize
      // The game will start when user clicks "Start Game"
      setIsInitialized(true);
      setCurrentGameState('setup');
      // Don't call updateGameState here - manager isn't initialized yet
    } catch (error) {
      console.error('Failed to initialize poker game:', error);
      setIsInitialized(false);
    }
  }, [handleGameEvent, updateGameState, tournament]);

  const pauseGame = useCallback(() => {
    if (gameManagerRef.current) {
      gameManagerRef.current.pause();
      setIsPaused(true);
    }
  }, []);

  const resumeGame = useCallback(() => {
    if (gameManagerRef.current) {
      gameManagerRef.current.resume();
      setIsPaused(false);
    }
  }, []);

  const changeSpeed = useCallback((newSpeed: string) => {
    if (gameManagerRef.current) {
      gameManagerRef.current.setSpeed(newSpeed);
      setGameSpeed(newSpeed);
    }
  }, []);

  const getCurrentHandNumber = useCallback(() => {
    return gameManagerRef.current?.getCurrentHandNumber() || 0;
  }, []);

  const getDecisionHistory = useCallback((): any[] => {
    return gameManagerRef.current?.getDecisionHistory() || [];
  }, []);

  const getTournamentId = useCallback(() => {
    return gameManagerRef.current?.getTournamentId() || '';
  }, []);

  const getPlayerCount = useCallback(() => {
    return gameManagerRef.current?.getPlayerCount() || 0;
  }, []);

  // Initialize with tournament data if provided
  useEffect(() => {
    if (tournament && !isInitialized) {
      const gameConfig = {
        speed: tournament.config?.speed || 'normal',
        playerCount: tournament.players?.length || 3,
        startingChips: tournament.config?.startingChips || 10000,
        maxHands: tournament.config?.maxHands || -1,
        showAIThinking: tournament.config?.showAIThinking !== false,
        showDecisionHistory: tournament.config?.showDecisionHistory !== false,
        playerConfigs: tournament.players
      };
      
      initializeGame(gameConfig);
    }
  }, [tournament, isInitialized, initializeGame]);

  useEffect(() => {
    return () => {
      if (gameManagerRef.current) {
        gameManagerRef.current.removeEventListener(handleGameEvent);
      }
    };
  }, [handleGameEvent]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (gameManagerRef.current && !isPaused) {
        updateGameState();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, updateGameState]);

  return {
    gameState,
    isInitialized,
    isPaused,
    gameSpeed,
    config,
    currentGameState,
    initializeGame,
    pauseGame,
    resumeGame,
    changeSpeed,
    getCurrentHandNumber,
    getDecisionHistory,
    getTournamentId,
    getPlayerCount,
    getGameConfig: () => config,
    getPointScoringLeaderboard: () => gameManagerRef.current?.getPointScoringLeaderboard() || [],
    getPlayerPoints: (playerId: string) => gameManagerRef.current?.getPlayerPoints(playerId) || { base: 0, style: 0, penalty: 0, total: 0 },
    getStyleStats: (playerId: string) => gameManagerRef.current?.getStyleStats(playerId) || null,
    getAchievements: (playerId: string) => gameManagerRef.current?.getAchievements(playerId) || [],
    // Additional methods needed by TournamentView
    startNewHand: useCallback(async () => {
      if (gameManagerRef.current) {
        await gameManagerRef.current.startNewHand();
        updateGameState();
      }
    }, [updateGameState]),
    getCurrentHandDecisions: useCallback(() => {
      return getDecisionHistory().filter(d => d.handNumber === getCurrentHandNumber());
    }, [getDecisionHistory, getCurrentHandNumber]),
    updateConfig: useCallback((newConfig: Partial<any>) => {
      setConfig(prev => ({ ...prev, ...newConfig }));
    }, []),
    startGame: useCallback(async () => {
      if (gameManagerRef.current) {
        try {
          await gameManagerRef.current.initialize();
          await gameManagerRef.current.startGame();
          setCurrentGameState('playing');
          updateGameState();
          await gameManagerRef.current.startNewHand();
        } catch (error) {
          console.error('Failed to start poker game:', error);
          setCurrentGameState('setup');
        }
      }
    }, [updateGameState]),
    stopGame: useCallback(() => {
      setCurrentGameState('stopped');
    }, []),
    clearGame: useCallback(() => {
      setCurrentGameState('setup');
      setGameState({
        players: [],
        communityCards: [],
        pot: 0,
        currentBet: 0,
        phase: 'waiting',
        currentPlayer: null,
        winners: [],
        isHandComplete: false,
        currentAIThinking: null,
        currentAIReasoning: null,
        recentActions: [],
        recentStyleBonuses: [],
        recentMisreads: [],
        recentPointEvents: [],
        recentAchievementEvents: []
      });
    }, []),
    getStyleLeaderboard: () => [],
    getPlayerStyleStats: (playerId: string) => null,
    getAllStyleStats: () => [],
    getPointLeaderboard: () => [],
    setTournamentMode: (mode: 'STYLE_MASTER' | 'BALANCED' | 'CLASSIC') => {
      console.log('Tournament mode:', mode);
    },
    getPlayerAchievements: (playerId: string) => [],
    getAchievementProgress: (playerId: string) => new Map(),
    getAllAchievements: () => [],
    getTotalAchievementPoints: (playerId: string) => 0
  };
}