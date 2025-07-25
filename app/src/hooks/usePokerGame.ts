// React hooks imports for legacy code
import { useState, useEffect, useCallback, useRef } from 'react';

// Re-export everything from the adapter to maintain backward compatibility
export * from './usePokerGameAdapter';

// Legacy support - redirect to adapter
import { usePokerGame as usePokerGameAdapter } from './usePokerGameAdapter';
export const usePokerGame = (tournament?: any) => usePokerGameAdapter(tournament);

// Keep type exports for backward compatibility - aliased from new locations
export type { PokerGameConfig as GameConfig, PokerGameState as GameState } from '@/game-engine/games/poker/PokerTypes';
export type { PokerPhase as GamePhase, PokerPlayer as Player, Card } from '@/game-engine/games/poker/PokerTypes';
export type { IGameDecision as AIDecision } from '@/game-engine/core/interfaces';
export type { PokerStyleBonus as StyleBonus } from '@/game-engine/games/poker/scoring/PokerScoringSystem';
export type { IScoreBreakdown as PointEvent } from '@/game-engine/core/interfaces';
export type { IGameEvent as AchievementEvent } from '@/game-engine/core/interfaces';

// PlayerStats is no longer a separate export - it's internal to the scoring system

// Legacy type imports for the unused legacy code below
import { PokerGameManager } from '@/game-engine/games/poker';
import type { PokerGameEvent as GameEvent, DecisionHistoryEntry } from '@/game-engine/games/poker/PokerGameManager';

// PlayerStats type for legacy code
interface PlayerStats {
  totalStylePoints: number;
  handsPlayed: number;
  bluffs: { successful: number; failed: number };
  trashWins: number;
  comeback: boolean;
  davidVsGoliath: number;
  unconventionalWins: number;
}

/* LEGACY CODE PRESERVED BELOW - DO NOT USE */

// Import missing types for legacy code
import type { 
  PokerPhase as GamePhase, 
  PokerPlayer as Player, 
  Card,
  PokerGameConfig as GameConfig,
  PokerGameState as GameState
} from '@/game-engine/games/poker';
import type { 
  IGameDecision as AIDecision
} from '@/game-engine/core/interfaces';

// Define types inline to match notification components
interface PointEvent {
  playerId: string;
  type: 'base' | 'style' | 'penalty';
  category: string;
  points: number;
  description: string;
  details?: any;
}

interface AchievementEvent {
  playerId: string;
  achievement: {
    id: string;
    name: string;
    description: string;
    category: string;
    rarity: string;
    points: number;
    icon?: string;
  };
  unlockedAt: Date;
}
import type { PokerStyleBonus as StyleBonus } from '@/game-engine/games/poker';

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

// Legacy function commented out - not used, redirects to adapter
/*
function usePokerGameLegacy() {
  const gameManagerRef = useRef<PokerGameManager | null>(null);
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
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [currentGameState, setCurrentGameState] = useState<GameState>('setup');

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

  const handleGameEvent = useCallback((event: GameEvent) => {
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
              ...prev.recentActions.slice(0, 9) // Keep last 10 actions
            ]
          }));
          
          // Update game state to reflect all changes including decision history
          updateGameState();
          
          // Force update to ensure decision history is current
          setTimeout(() => {
            updateGameState();
          }, 50);
        }
        break;
        
      case 'phase-change':
        updateGameState();
        // Clear reasoning when phase changes
        setTimeout(() => {
          setGameState(prev => ({
            ...prev,
            currentAIReasoning: null
          }));
        }, 2000);
        break;
        
      case 'hand-complete':
        // Handle style bonuses if present
        if (event.styleBonuses && event.styleBonuses.length > 0) {
          setGameState(prev => ({
            ...prev,
            recentStyleBonuses: event.styleBonuses || []
          }));
          
          // Clear style bonuses after 5 seconds
          setTimeout(() => {
            setGameState(prev => ({
              ...prev,
              recentStyleBonuses: []
            }));
          }, 5000);
        }
        
        // Force update to reflect chip changes
        updateGameState();
        // Update chip amounts in players state
        setTimeout(() => {
          updateGameState();
        }, 100);
        break;
        
      case 'hand-misread':
        if (event.misread) {
          setGameState(prev => ({
            ...prev,
            recentMisreads: [
              ...prev.recentMisreads,
              {
                ...event.misread!,
                timestamp: event.timestamp
              }
            ].slice(-10) // Keep only last 10 misreads
          }));
          
          // Clear old misreads after 30 seconds
          setTimeout(() => {
            setGameState(prev => ({
              ...prev,
              recentMisreads: prev.recentMisreads.filter(
                m => Date.now() - m.timestamp < 30000
              )
            }));
          }, 30000);
        }
        break;
        
      case 'points':
        if (event.pointEvents) {
          setGameState(prev => ({
            ...prev,
            recentPointEvents: [
              ...prev.recentPointEvents,
              ...event.pointEvents!
            ].slice(-20) // Keep only last 20 point events
          }));
          
          // Clear old point events after 5 seconds
          setTimeout(() => {
            setGameState(prev => ({
              ...prev,
              recentPointEvents: prev.recentPointEvents.filter(
                e => Date.now() - e.timestamp < 5000
              )
            }));
          }, 5000);
        }
        break;
        
      case 'achievement':
        if (event.achievementEvents) {
          setGameState(prev => ({
            ...prev,
            recentAchievementEvents: [
              ...prev.recentAchievementEvents,
              ...event.achievementEvents!
            ].slice(-10) // Keep only last 10 achievement events
          }));
          
          // Clear old achievement events after 10 seconds
          setTimeout(() => {
            setGameState(prev => ({
              ...prev,
              recentAchievementEvents: prev.recentAchievementEvents.filter(
                e => Date.now() - e.timestamp < 10000
              )
            }));
          }, 10000);
        }
        break;
    }
  }, [updateGameState]);

  // Initialize game manager
  useEffect(() => {
    if (!gameManagerRef.current) {
      const manager = new PokerGameManager();
      // Don't initialize automatically - wait for explicit game start
      
      // Subscribe to game events
      manager.onGameEvent((event: GameEvent) => {
        handleGameEvent(event);
      });
      
      gameManagerRef.current = manager;
      updateGameState();
      setConfig(manager.getConfig());
      setCurrentGameState(manager.getGameState());
      setIsInitialized(true);
    }
    
    // Cleanup function to stop any running games
    return () => {
      if (gameManagerRef.current && gameManagerRef.current.getGameState() === 'playing') {
        gameManagerRef.current.stopGame();
      }
    };
  }, [handleGameEvent, updateGameState]);

  const startNewHand = useCallback(() => {
    if (!gameManagerRef.current) return;
    
    // Clear previous hand data
    setGameState(prev => ({
      ...prev,
      winners: [],
      isHandComplete: false,
      currentAIThinking: null,
      currentAIReasoning: null,
      recentActions: []
    }));
    
    gameManagerRef.current.startNewHand();
  }, []);

  const pauseGame = useCallback(() => {
    if (!gameManagerRef.current) return;
    gameManagerRef.current.pause();
    setIsPaused(true);
  }, []);

  const resumeGame = useCallback(() => {
    if (!gameManagerRef.current) return;
    gameManagerRef.current.resume();
    setIsPaused(false);
  }, []);

  const changeSpeed = useCallback((speed: string) => {
    if (!gameManagerRef.current) return;
    gameManagerRef.current.setSpeed(speed);
    setGameSpeed(speed);
  }, []);

  const getDecisionHistory = useCallback((): DecisionHistoryEntry[] => {
    if (!gameManagerRef.current) return [];
    return gameManagerRef.current.getFullDecisionHistory();
  }, []);

  const getCurrentHandDecisions = useCallback((): DecisionHistoryEntry[] => {
    if (!gameManagerRef.current) return [];
    return gameManagerRef.current.getCurrentHandDecisions();
  }, []);

  const getCurrentHandNumber = useCallback((): number => {
    if (!gameManagerRef.current) return 0;
    return gameManagerRef.current.getCurrentHandNumber();
  }, []);

  const updateConfig = useCallback((newConfig: Partial<GameConfig>) => {
    if (!gameManagerRef.current) return;
    gameManagerRef.current.setConfig(newConfig);
    setConfig(gameManagerRef.current.getConfig());
  }, []);

  const startGame = useCallback(() => {
    if (!gameManagerRef.current) return;
    gameManagerRef.current.startGame();
    setCurrentGameState('playing');
  }, []);

  const stopGame = useCallback(() => {
    if (!gameManagerRef.current) return;
    gameManagerRef.current.stopGame();
    setCurrentGameState('setup');
    updateGameState();
  }, [updateGameState]);

  const clearGame = useCallback(() => {
    if (!gameManagerRef.current) return;
    gameManagerRef.current.clearGame();
    setCurrentGameState('setup');
    updateGameState();
  }, [updateGameState]);

  const getStyleLeaderboard = useCallback(() => {
    if (!gameManagerRef.current) return [];
    return gameManagerRef.current.getStyleLeaderboard();
  }, []);

  const getPlayerStyleStats = useCallback((playerId: string): PlayerStats | undefined => {
    if (!gameManagerRef.current) return undefined;
    return gameManagerRef.current.getPlayerStyleStats(playerId);
  }, []);

  const getAllStyleStats = useCallback((): PlayerStats[] => {
    if (!gameManagerRef.current) return [];
    return gameManagerRef.current.getAllStyleStats();
  }, []);
  
  const getPointLeaderboard = useCallback(() => {
    if (!gameManagerRef.current) return [];
    return gameManagerRef.current.getPointLeaderboard();
  }, []);
  
  const getPlayerPoints = useCallback((playerId: string) => {
    if (!gameManagerRef.current) return undefined;
    return gameManagerRef.current.getPlayerPoints(playerId);
  }, []);
  
  const setTournamentMode = useCallback((mode: 'STYLE_MASTER' | 'BALANCED' | 'CLASSIC') => {
    if (!gameManagerRef.current) return;
    gameManagerRef.current.setTournamentMode(mode);
  }, []);
  
  const getPlayerAchievements = useCallback((playerId: string) => {
    if (!gameManagerRef.current) return [];
    return gameManagerRef.current.getPlayerAchievements(playerId);
  }, []);
  
  const getAchievementProgress = useCallback((playerId: string) => {
    if (!gameManagerRef.current) return new Map();
    return gameManagerRef.current.getAchievementProgress(playerId);
  }, []);
  
  const getAllAchievements = useCallback(() => {
    if (!gameManagerRef.current) return [];
    return gameManagerRef.current.getAllAchievements();
  }, []);
  
  const getTotalAchievementPoints = useCallback((playerId: string) => {
    if (!gameManagerRef.current) return 0;
    return gameManagerRef.current.getTotalAchievementPoints(playerId);
  }, []);

  return {
    gameState,
    isInitialized,
    isPaused,
    gameSpeed,
    config,
    currentGameState,
    startNewHand,
    pauseGame,
    resumeGame,
    changeSpeed,
    getDecisionHistory,
    getCurrentHandDecisions,
    getCurrentHandNumber,
    updateConfig,
    startGame,
    stopGame,
    clearGame,
    getStyleLeaderboard,
    getPlayerStyleStats,
    getAllStyleStats,
    getPointLeaderboard,
    getPlayerPoints,
    setTournamentMode,
    getPlayerAchievements,
    getAchievementProgress,
    getAllAchievements,
    getTotalAchievementPoints
  };
}
*/