import { useState, useEffect, useCallback, useRef } from 'react';
import { useSubscription, gql, useMutation } from '@apollo/client';
import { UsePokerGameState } from './usePokerGameAdapter';
import { Card, PokerPhase as GamePhase, PokerPlayer as Player } from '@/game-engine/games/poker/PokerTypes';
import { IGameDecision as AIDecision, IPlayerConfig } from '@/game-engine/core/interfaces';
import { PokerStyleBonus as StyleBonus } from '@/game-engine/games/poker/scoring/PokerScoringSystem';
import { SIGNAL_FRONTEND_READY } from '@/graphql/mutations/queue';

// GraphQL subscription for game state updates
const GAME_STATE_UPDATE = gql`
  subscription GameStateUpdate($gameId: String!) {
    gameStateUpdate(gameId: $gameId) {
      gameId
      type
      timestamp
      data
    }
  }
`;

const GAME_EVENT = gql`
  subscription GameEvent($gameId: String!) {
    gameEvent(gameId: $gameId) {
      gameId
      event
      playerId
      data
      timestamp
    }
  }
`;

interface UseServerSidePokerOptions {
  gameId: string;
  tournament?: any;
}

export function useServerSidePoker({ gameId, tournament }: UseServerSidePokerOptions) {
  const [signalFrontendReady] = useMutation(SIGNAL_FRONTEND_READY);
  const hasSignaledReady = useRef(false);
  
  // Game state that matches TournamentView expectations
  const [gameState, setGameState] = useState<UsePokerGameState>({
    players: [],
    communityCards: [],
    pot: 0,
    currentBet: 0,
    phase: 'setup' as GamePhase,
    currentPlayer: null,
    winners: [],
    isHandComplete: false,
    currentAIThinking: null,
    currentAIReasoning: null,
    recentActions: [],
    aiDecisionHistory: new Map(),
    recentStyleBonuses: [],
    recentMisreads: [],
    recentPointEvents: [],
    recentAchievementEvents: []
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [currentGameState, setCurrentGameState] = useState<'setup' | 'playing' | 'paused' | 'finished'>('setup');
  const [config, setConfig] = useState<any>({
    startingChips: 100000,
    blindStructure: 'normal',
    maxHands: 20,
    speed: 'normal',
    mode: 'balanced',
    showAIThinking: true,
    showDecisionHistory: true
  });

  const handHistoryRef = useRef<Map<number, Map<string, AIDecision>>>(new Map());
  const currentHandNumber = useRef(1);

  // Subscribe to game state updates
  const { data: stateData, error: stateError } = useSubscription(GAME_STATE_UPDATE, {
    variables: { gameId },
    skip: !gameId || !tournament,
    onSubscriptionData: ({ subscriptionData }) => {
      console.log('🎲 [Poker] Game state subscription data received:', {
        hasData: !!subscriptionData.data,
        gameId,
        timestamp: new Date().toISOString()
      });
      
      if (subscriptionData.data?.gameStateUpdate) {
        const update = subscriptionData.data.gameStateUpdate;
        console.log('🎲 [Poker] Game state update:', {
          type: update.type,
          gameId: update.gameId,
          dataLength: update.data?.length
        });
        
        try {
          const parsedData = JSON.parse(update.data);
          console.log('🎲 [Poker] Parsed game state:', {
            hasState: !!parsedData.state,
            phase: parsedData.state?.phase,
            playerCount: parsedData.state?.players?.length,
            currentTurn: parsedData.state?.currentTurn,
            pot: parsedData.state?.pot
          });
          
          if (parsedData.state) {
            updateGameStateFromBackend(parsedData.state);
            
            // Mark as initialized and playing when we get first state
            if (!isInitialized) {
              console.log('🎲 [Poker] Initializing game for the first time');
              setIsInitialized(true);
              setCurrentGameState('playing');
              setIsActive(true);
              
              // Signal to backend that frontend is ready
              if (!hasSignaledReady.current && gameId) {
                hasSignaledReady.current = true;
                console.log('🎲 [Poker] Signaling frontend ready...');
                signalFrontendReady({
                  variables: { matchId: gameId }
                }).then(() => {
                  console.log('✅ [Poker] Signaled frontend ready for game:', gameId);
                }).catch((error) => {
                  console.error('❌ [Poker] Failed to signal frontend ready:', error);
                });
              }
            }
          }
        } catch (err) {
          console.error('❌ [Poker] Failed to parse game state:', err);
        }
      }
    },
    onError: (error) => {
      console.error('❌ [Poker] Game state subscription error:', error);
    }
  });

  // Subscribe to game events
  const { data: eventData, error: eventError } = useSubscription(GAME_EVENT, {
    variables: { gameId },
    skip: !gameId || !tournament,
    onSubscriptionData: ({ subscriptionData }) => {
      console.log('🎯 [Poker] Game event subscription data received:', {
        hasData: !!subscriptionData.data,
        hasGameEvent: !!subscriptionData.data?.gameEvent,
        gameId,
        timestamp: new Date().toISOString()
      });
      
      if (subscriptionData.data?.gameEvent) {
        const event = subscriptionData.data.gameEvent;
        console.log('🎯 [Poker] Game event:', {
          event: event.event,
          playerId: event.playerId,
          gameId: event.gameId,
          hasData: !!event.data
        });
        handleGameEvent(event);
      }
    },
    onError: (error) => {
      console.error('❌ [Poker] Game event subscription error:', error);
    }
  });

  // Transform backend state to match frontend expectations
  const updateGameStateFromBackend = useCallback((backendState: any) => {
    try {
      console.log('🔄 [Poker] Transforming backend state:', {
        playerCount: backendState.players?.length,
        firstPlayer: backendState.players?.[0] ? {
          id: backendState.players[0].id,
          hasHoleCards: !!backendState.players[0].holeCards,
          holeCardsLength: backendState.players[0].holeCards?.length,
          holeCards: backendState.players[0].holeCards,
          hasCards: !!backendState.players[0].cards,
          cardsLength: backendState.players[0].cards?.length
        } : null
      });
      
      // Transform players
      const players = backendState.players.map((p: any) => {
        const playerData = {
          id: p.id,
          name: p.name,
          chips: p.chips || p.resources?.chips || 0,
          cards: p.holeCards || p.cards || [],
          folded: p.folded || p.resources?.folded || false,
          allIn: p.isAllIn || p.allIn || p.resources?.allIn || false,
          bet: p.bet || p.resources?.bet || 0,
          avatar: getPlayerAvatar(p.id, tournament),
          isAI: true, // All players are AI in this system
          hasActed: p.hasActed || p.resources?.hasActed || false
        };
        
        console.log('🃏 [Poker] Player transformed:', {
          id: playerData.id,
          name: playerData.name,
          cardCount: playerData.cards.length,
          cards: playerData.cards,
          chips: playerData.chips
        });
        
        return playerData;
      });

      // Get current player
      const currentPlayer = backendState.currentTurn ? 
        players.find((p: Player) => p.id === backendState.currentTurn) : null;

      // Update hand number if new hand started
      if (backendState.gameSpecific?.handNumber && 
          backendState.gameSpecific.handNumber !== currentHandNumber.current) {
        currentHandNumber.current = backendState.gameSpecific.handNumber;
        handHistoryRef.current.set(currentHandNumber.current, new Map());
      }

      setGameState(prev => ({
        ...prev,
        players,
        communityCards: backendState.gameSpecific?.communityCards || [],
        pot: backendState.gameSpecific?.pot || 0,
        currentBet: backendState.gameSpecific?.currentBet || 0,
        phase: (backendState.gameSpecific?.bettingRound || 'preflop') as GamePhase,
        currentPlayer,
        isHandComplete: backendState.gameSpecific?.handComplete || false,
        winners: backendState.gameSpecific?.winners || []
      }));

      // Check if game is complete
      if (backendState.status === 'completed') {
        setCurrentGameState('finished');
        setIsActive(false);
      }
    } catch (error) {
      console.error('Error transforming backend state:', error);
    }
  }, [tournament]);

  // Handle game events
  const handleGameEvent = useCallback((event: any) => {
    try {
      console.log('🎮 [Poker] handleGameEvent processing:', {
        eventType: event.event,
        playerId: event.playerId,
        dataLength: event.data?.length
      });
      
      const eventData = event.data ? JSON.parse(event.data) : {};
      
      switch (event.event) {
        case 'player_decision':
          console.log('🎮 [Poker] Processing player_decision event');
          handlePlayerDecision(event.playerId, eventData);
          break;
        case 'thinking_start':
          console.log('🎮 [Poker] Processing thinking_start event');
          setGameState(prev => ({
            ...prev,
            currentAIThinking: event.playerId,
            currentAIReasoning: null
          }));
          break;
        case 'thinking_complete':
          console.log('🎮 [Poker] Processing thinking_complete event');
          setGameState(prev => ({
            ...prev,
            currentAIThinking: null
          }));
          break;
        case 'hand_complete':
          console.log('🎮 [Poker] Processing hand_complete event');
          handleHandComplete(eventData);
          break;
        case 'style_bonus':
          console.log('🎮 [Poker] Processing style_bonus event');
          handleStyleBonus(eventData);
          break;
        case 'achievement_unlocked':
          console.log('🎮 [Poker] Processing achievement_unlocked event');
          handleAchievement(eventData);
          break;
        case 'misread_detected':
          console.log('🎮 [Poker] Processing misread_detected event');
          handleMisread(eventData);
          break;
        default:
          console.log('🎮 [Poker] Unknown event type:', event.event);
      }
    } catch (error) {
      console.error('❌ [Poker] Error handling game event:', error);
    }
  }, []);

  const handlePlayerDecision = useCallback((playerId: string, data: any) => {
    console.log('💭 [Poker] handlePlayerDecision called:', {
      playerId,
      hasDecision: !!data.decision,
      decisionData: data.decision,
      fullData: data
    });
    
    if (!data.decision) {
      console.warn('⚠️ [Poker] No decision data in player_decision event');
      return;
    }

    // Get current game state to capture additional info
    const currentState = gameState;
    const player = currentState.players.find(p => p.id === playerId);

    const decision: AIDecision = {
      action: { 
        type: data.decision.action,
        playerId: playerId,
        timestamp: new Date(),
        data: { amount: data.decision.amount }
      },
      confidence: data.decision.confidence || 0.7,
      reasoning: data.decision.reasoning || '',
      metadata: {
        gamePhase: currentState.phase,
        communityCards: [...currentState.communityCards],
        timestamp: new Date()
      }
    };
    
    console.log('💭 [Poker] AI Decision created:', {
      playerId,
      playerName: player?.name,
      action: decision.action.type,
      amount: (decision.action as any).amount,
      confidence: decision.confidence,
      hasReasoning: !!decision.reasoning,
      phase: currentState.phase,
      currentHandNumber: currentHandNumber.current
    });

    // Update AI decision history
    setGameState(prev => {
      const newHistory = new Map(prev.aiDecisionHistory);
      newHistory.set(playerId, decision);
      
      // Store in hand history with enhanced data
      const currentHandHistory = handHistoryRef.current.get(currentHandNumber.current) || new Map();
      currentHandHistory.set(playerId, decision);
      handHistoryRef.current.set(currentHandNumber.current, currentHandHistory);
      
      console.log('📚 [Poker] Decision history updated:', {
        handNumber: currentHandNumber.current,
        totalDecisionsInHand: currentHandHistory.size,
        totalHands: handHistoryRef.current.size,
        playersInHistory: Array.from(currentHandHistory.keys())
      });

      return {
        ...prev,
        aiDecisionHistory: newHistory,
        currentAIReasoning: decision.reasoning,
        recentActions: [
          ...prev.recentActions.slice(-9),
          {
            playerId,
            action: decision.action.type,
            amount: (decision.action as any).amount,
            timestamp: Date.now()
          }
        ]
      };
    });
  }, [gameState]);

  const handleHandComplete = useCallback((data: any) => {
    setGameState(prev => ({
      ...prev,
      isHandComplete: true,
      winners: data.winners || []
    }));
  }, []);

  const handleStyleBonus = useCallback((data: any) => {
    const bonus: StyleBonus = {
      type: data.category || data.type,
      points: data.points,
      description: data.description
    };

    setGameState(prev => ({
      ...prev,
      recentStyleBonuses: [...prev.recentStyleBonuses, bonus]
    }));

    // Clear after 5 seconds
    setTimeout(() => {
      setGameState(prev => ({
        ...prev,
        recentStyleBonuses: prev.recentStyleBonuses.filter(b => b !== bonus)
      }));
    }, 5000);
  }, []);

  const handleAchievement = useCallback((data: any) => {
    const event = {
      playerId: data.playerId,
      achievement: data.achievement,
      unlockedAt: new Date()
    };

    setGameState(prev => ({
      ...prev,
      recentAchievementEvents: [...prev.recentAchievementEvents, event]
    }));

    // Clear after 5 seconds
    setTimeout(() => {
      setGameState(prev => ({
        ...prev,
        recentAchievementEvents: prev.recentAchievementEvents.filter(e => e !== event)
      }));
    }, 5000);
  }, []);

  const handleMisread = useCallback((data: any) => {
    const misread = {
      ...data,
      handNumber: currentHandNumber.current,
      timestamp: Date.now()
    };

    setGameState(prev => ({
      ...prev,
      recentMisreads: [...prev.recentMisreads, misread]
    }));

    // Clear after 5 seconds
    setTimeout(() => {
      setGameState(prev => ({
        ...prev,
        recentMisreads: prev.recentMisreads.filter(m => m !== misread)
      }));
    }, 5000);
  }, []);

  // Helper to get player avatar
  const getPlayerAvatar = (playerId: string, tournament: any) => {
    const participant = tournament?.participants?.find((p: any) => 
      p.bot.id === playerId
    );
    return participant?.bot?.avatar || `/api/placeholder/40/40`;
  };

  // Mock functions to match the interface expected by TournamentView
  const pauseGame = useCallback(() => {
    setCurrentGameState('paused');
  }, []);

  const resumeGame = useCallback(() => {
    setCurrentGameState('playing');
  }, []);

  const startGame = useCallback(() => {
    // Game is already started on backend, just update state
    setCurrentGameState('playing');
  }, []);

  const stopGame = useCallback(() => {
    setCurrentGameState('finished');
  }, []);

  const clearGame = useCallback(() => {
    // Reset to initial state
    setGameState({
      players: [],
      communityCards: [],
      pot: 0,
      currentBet: 0,
      phase: 'setup' as GamePhase,
      currentPlayer: null,
      winners: [],
      isHandComplete: false,
      currentAIThinking: null,
      currentAIReasoning: null,
      recentActions: [],
      aiDecisionHistory: new Map(),
      recentStyleBonuses: [],
      recentMisreads: [],
      recentPointEvents: [],
      recentAchievementEvents: []
    });
    setCurrentGameState('setup');
  }, []);

  const changeSpeed = useCallback((speed: string) => {
    setConfig(prev => ({ ...prev, speed }));
  }, []);

  const updateConfig = useCallback((newConfig: any) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  const getDecisionHistory = useCallback(() => {
    console.log('📜 [Poker] getDecisionHistory called:', {
      totalHands: handHistoryRef.current.size,
      currentHandNumber: currentHandNumber.current,
      handHistoryKeys: Array.from(handHistoryRef.current.keys())
    });
    
    const history: any[] = [];
    
    // Iterate through all hands
    handHistoryRef.current.forEach((decisions, handNumber) => {
      console.log(`  Hand ${handNumber}: ${decisions.size} decisions`);
      
      // Iterate through all decisions in this hand
      decisions.forEach((decision, playerId) => {
        const player = gameState.players.find(p => p.id === playerId);
        if (!player) {
          console.warn(`  Player ${playerId} not found in gameState`);
          return;
        }
        
        // Create entry in the format expected by DecisionHistory component
        const entry = {
          handNumber,
          playerId,
          playerName: player.name,
          playerCards: player.cards || [],
          decision: decision,
          gamePhase: decision.metadata?.gamePhase || 'preflop',
          communityCards: decision.metadata?.communityCards || [],
          timestamp: decision.metadata?.timestamp || Date.now()
        };
        
        history.push(entry);
        console.log(`  Added decision for ${player.name}: ${decision.action.type}`);
      });
    });
    
    // Sort by hand number (descending) and timestamp (ascending)
    const sorted = history.sort((a, b) => {
      if (a.handNumber !== b.handNumber) {
        return b.handNumber - a.handNumber; // Newer hands first
      }
      return a.timestamp - b.timestamp; // Earlier decisions first within same hand
    });
    
    console.log('📜 [Poker] Decision history compiled:', {
      totalEntries: sorted.length,
      hands: [...new Set(sorted.map(e => e.handNumber))],
      firstEntry: sorted[0]
    });
    
    return sorted;
  }, [gameState.players]);

  const getCurrentHandDecisions = useCallback(() => {
    return handHistoryRef.current.get(currentHandNumber.current) || new Map();
  }, []);

  const getCurrentHandNumber = useCallback(() => {
    return currentHandNumber.current;
  }, []);

  // Mock leaderboard functions
  const getStyleLeaderboard = useCallback(() => [], []);
  const getPlayerStyleStats = useCallback(() => null, []);
  const getAllStyleStats = useCallback(() => new Map(), []);
  const getPointLeaderboard = useCallback(() => [], []);
  const getPlayerPoints = useCallback(() => ({ base: 0, style: 0, penalty: 0, total: 0 }), []);

  // Initialize from tournament data
  useEffect(() => {
    if (tournament && !isInitialized) {
      const playerConfigs = tournament.participants?.map((p: any) => ({
        id: p.bot.id,
        name: p.bot.name,
        avatar: p.bot.avatar,
        aiModel: p.bot.modelType
      })) || [];
      
      updateConfig({ playerConfigs });
    }
  }, [tournament, isInitialized, updateConfig]);

  // Signal frontend ready immediately when tournament and gameId are available
  useEffect(() => {
    if (tournament && gameId && !hasSignaledReady.current) {
      hasSignaledReady.current = true;
      console.log('🎲 [Poker] Signaling frontend ready immediately on mount...');
      signalFrontendReady({
        variables: { matchId: gameId }
      }).then(() => {
        console.log('✅ [Poker] Signaled frontend ready for game:', gameId);
      }).catch((error) => {
        console.error('❌ [Poker] Failed to signal frontend ready:', error);
        // Reset flag on error so it can be retried
        hasSignaledReady.current = false;
      });
    }
  }, [tournament, gameId, signalFrontendReady]);

  return {
    // State
    gameState,
    isInitialized,
    isPaused: currentGameState === 'paused',
    gameSpeed: config.speed,
    config,
    currentGameState,
    isActive,
    
    // Methods
    initializeGame: startGame,
    pauseGame,
    resumeGame,
    changeSpeed,
    getCurrentHandNumber,
    getDecisionHistory,
    getCurrentHandDecisions,
    updateConfig,
    startGame,
    stopGame,
    clearGame,
    getStyleLeaderboard,
    getPlayerStyleStats,
    getAllStyleStats,
    getPointLeaderboard,
    getPlayerPoints,
    
    // Not used but needed for interface
    startNewHand: () => Promise.resolve(),
    getGameConfig: () => config,
    getStyleStats: () => null,
    getAchievements: () => [],
    getPointScoringLeaderboard: () => [],
    evaluations: { recentEvaluations: [], averageScores: new Map() }
  };
}