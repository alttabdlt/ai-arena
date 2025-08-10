import { JOIN_GAME, LEAVE_GAME, UPDATE_GAME_SPEED } from '@/graphql/mutations/game';
import { SIGNAL_FRONTEND_READY } from '@/graphql/mutations/queue';
import { gql, useMutation, useSubscription } from '@apollo/client';
import { IGameDecision as AIDecision, Card, PokerPhase as GamePhase, PokerPlayer as Player, PokerStyleBonus as StyleBonus } from '@game/shared/types';
import { useCallback, useEffect, useRef, useState } from 'react';

// Define the game state interface for the hook
interface UsePokerGameState {
  players: Player[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  phase: GamePhase;
  currentPlayer: Player | null;
  winners: any[];
  isHandComplete: boolean;
  currentAIThinking: string | null;
  currentAIReasoning: string | null;
  recentActions: any[];
  aiDecisionHistory: Map<string, AIDecision>;
  recentStyleBonuses: StyleBonus[];
  recentMisreads: any[];
  recentPointEvents: any[];
  recentAchievementEvents: any[];
}

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
  const [joinGame] = useMutation(JOIN_GAME);
  const [leaveGame] = useMutation(LEAVE_GAME);
  const [updateGameSpeed] = useMutation(UPDATE_GAME_SPEED);
  const hasSignaledReady = useRef(false);
  const hasJoinedGame = useRef(false);
  const hasInitializedFromMatch = useRef(false);
  const isCatchingUp = useRef(false);
  const lastUpdateTime = useRef(Date.now());
  const eventBuffer = useRef<any[]>([]);
  const isProcessingBuffer = useRef(false);
  
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
  
  // Clear any stale sessionStorage on mount to force server sync
  useEffect(() => {
    if (gameId) {
      const timestamp = sessionStorage.getItem(`poker-timestamp-${gameId}`);
      if (timestamp) {
        const age = Date.now() - parseInt(timestamp);
        // Clear if older than 30 seconds
        if (age > 30000) {
          console.log('🔄 Clearing stale Poker state, will sync from server');
          sessionStorage.removeItem(`poker-gamestate-${gameId}`);
          sessionStorage.removeItem(`poker-handhistory-${gameId}`);
          sessionStorage.removeItem(`poker-timestamp-${gameId}`);
        }
      }
    }
  }, [gameId]);

  // Buffer processing function for smooth experience
  const processEventBuffer = useCallback(() => {
    if (isProcessingBuffer.current || eventBuffer.current.length === 0) return;
    
    isProcessingBuffer.current = true;
    const events = [...eventBuffer.current];
    eventBuffer.current = [];

    // Process events more smoothly - don't skip decision history
    if (events.length > 5) {
      // console.log(`🎮 [Poker] Processing ${events.length} buffered events smoothly`);
      isCatchingUp.current = true;
      
      // Process state updates first
      const stateUpdates = events.filter(e => e.type === 'state');
      if (stateUpdates.length > 0) {
        // Process all states to ensure smooth transition
        stateUpdates.forEach((stateEvent, index) => {
          const isLatest = index === stateUpdates.length - 1;
          updateGameStateFromBackend(stateEvent.data, !isLatest);
        });
      }
      
      // Process decisions with a slight delay for visualization
      const decisions = events.filter(e => e.type === 'decision');
      // console.log(`🃏 [Poker] Processing ${decisions.length} decisions for history`);
      
      // Process all decisions to maintain history
      decisions.forEach(event => {
        handlePlayerDecision(event.playerId, event.data, true);
      });
      
      isCatchingUp.current = false;
    } else {
      // Normal processing for small number of events
      events.forEach(event => {
        if (event.type === 'state') {
          updateGameStateFromBackend(event.data, false);
        } else if (event.type === 'decision') {
          handlePlayerDecision(event.playerId, event.data, false);
        }
      });
    }
    
    isProcessingBuffer.current = false;
    lastUpdateTime.current = Date.now();
  }, []);

  // Balanced buffer processing for smooth experience
  useEffect(() => {
    const timer = setTimeout(() => {
      if (eventBuffer.current.length > 0) {
        processEventBuffer();
      }
    }, 100); // 100ms provides smooth updates without overwhelming the UI

    return () => clearTimeout(timer);
  }, [eventBuffer.current.length, processEventBuffer]);

  // Join game when component mounts and leave when unmounts
  useEffect(() => {
    if (gameId && !hasJoinedGame.current) {
      hasJoinedGame.current = true;
      
      joinGame({
        variables: { gameId }
      }).then(result => {
        console.log('✅ Joined Poker game:', gameId, 'Active viewers:', result.data?.joinGame?.activeViewers);
      }).catch(error => {
        console.error('❌ Failed to join Poker game:', error);
      });
    }
    
    // Cleanup function - leave game when component unmounts
    return () => {
      if (gameId && hasJoinedGame.current) {
        console.log('👋 Leaving Poker game:', gameId);
        leaveGame({
          variables: { gameId }
        }).catch(error => {
          console.error('❌ Failed to leave Poker game:', error);
        });
      }
      
      // Don't clear sessionStorage on unmount - preserve for navigation
    };
  }, [gameId, joinGame, leaveGame]);
  
  // Clear persisted state when game completes (after delay)
  useEffect(() => {
    if (gameId && currentGameState === 'finished') {
      // Keep data for a while after game ends (5 minutes)
      setTimeout(() => {
        sessionStorage.removeItem(`poker-gamestate-${gameId}`);
        sessionStorage.removeItem(`poker-handhistory-${gameId}`);
        sessionStorage.removeItem(`poker-timestamp-${gameId}`);
      }, 5 * 60 * 1000);
    }
  }, [gameId, currentGameState]);

  // Subscribe to game state updates
  const { data: stateData, error: stateError } = useSubscription(GAME_STATE_UPDATE, {
    variables: { gameId },
    skip: !gameId,
    onSubscriptionData: ({ subscriptionData }) => {
      if (subscriptionData.data?.gameStateUpdate) {
        const update = subscriptionData.data.gameStateUpdate;
        
        try {
          const parsedData = JSON.parse(update.data);
          
          if (parsedData.state) {
            // Add to buffer instead of processing immediately
            eventBuffer.current.push({
              type: 'state',
              data: parsedData.state,
              timestamp: Date.now()
            });
            
            // Mark as initialized on first state AND signal ready here
            if (!isInitialized) {
              console.log('🎲 [Poker] First state received, initializing...');
              setIsInitialized(true);
              setCurrentGameState('playing');
              setIsActive(true);
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
    skip: !gameId,
    onSubscriptionData: ({ subscriptionData }) => {
      if (subscriptionData.data?.gameEvent) {
        const event = subscriptionData.data.gameEvent;
        
        try {
          const eventData = event.data ? JSON.parse(event.data) : {};
          
          // Add to buffer instead of processing immediately
          if (event.event === 'player_decision') {
            eventBuffer.current.push({
              type: 'decision',
              playerId: event.playerId,
              data: eventData,
              timestamp: Date.now()
            });
          } else {
            // Handle other events immediately (they're less frequent)
            handleGameEvent(event);
          }
        } catch (err) {
          console.error('❌ [Poker] Failed to parse game event:', err);
        }
      }
    },
    onError: (error) => {
      console.error('❌ [Poker] Game event subscription error:', error);
    }
  });

  // Transform backend state to match frontend expectations
  const updateGameStateFromBackend = useCallback((backendState: any, isCatchUp = false) => {
    try {
      // Reduce logging during catch-up mode
      if (!isCatchUp) {
        // console.log('🔄 [Poker] Transforming backend state:', {
        //   playerCount: backendState.players?.length,
        //   currentHand: backendState.gameSpecific?.handNumber,
        //   phase: backendState.gameSpecific?.bettingRound,
        //   pot: backendState.gameSpecific?.pot
        // });
      }
      
      // Transform players
      const players: (Player & { avatar: string; isAI: boolean })[] = backendState.players.map((p: any) => {
        const playerData = {
          id: p.id,
          name: p.name,
          chips: p.chips || p.resources?.chips || 0,
          cards: p.holeCards || p.cards || [],
          folded: p.folded || p.resources?.folded || false,
          allIn: p.isAllIn || p.allIn || p.resources?.allIn || false,
          bet: p.bet || p.resources?.bet || 0,
          position: p.position || 0, // Add required position field
          hasActed: p.hasActed || p.resources?.hasActed || false,
          isActive: !p.folded && (p.chips > 0 || p.resources?.chips > 0), // Add required isActive field
          avatar: getPlayerAvatar(p.id, tournament),
          isAI: true // All players are AI in this system
        };
        
        // Only log player details in normal mode, not during catch-up
        if (!isCatchUp && playerData.cards.length > 0) {
          // console.log('🃏 [Poker] Player transformed:', {
          //   id: playerData.id,
          //   name: playerData.name,
          //   cardCount: playerData.cards.length,
          //   chips: playerData.chips
          // });
        }
        
        return playerData;
      });

      // Get current player
      const currentPlayer = backendState.currentTurn ? 
        players.find((p: Player) => p.id === backendState.currentTurn) : null;

      // Update hand number if new hand started
      if (backendState.gameSpecific?.handNumber && 
          backendState.gameSpecific.handNumber !== currentHandNumber.current) {
        const newHandNumber = backendState.gameSpecific.handNumber;
        console.log(`🎲 [Poker] New hand started: ${currentHandNumber.current} -> ${newHandNumber}`);
        currentHandNumber.current = newHandNumber;
        handHistoryRef.current.set(newHandNumber, new Map());
      }

      const newCommunityCards = backendState.gameSpecific?.communityCards || [];
      
      // Debug logging for community cards and state structure
      if (newCommunityCards.length > 0 || backendState.gameSpecific?.bettingRound === 'flop' || 
          backendState.gameSpecific?.bettingRound === 'turn' || backendState.gameSpecific?.bettingRound === 'river') {
        console.log('🎴 [Poker] Community cards update:', {
          phase: backendState.gameSpecific?.bettingRound,
          communityCards: newCommunityCards,
          communityCardsLength: newCommunityCards.length,
          hasGameSpecific: !!backendState.gameSpecific,
          gameSpecificKeys: backendState.gameSpecific ? Object.keys(backendState.gameSpecific) : [],
          rawBackendState: backendState
        });
      }
      
      // Always log when we receive a state update to track the flow
      if (!isCatchUp) {
        console.log('📊 [Poker] State update received:', {
          handNumber: backendState.gameSpecific?.handNumber || backendState.handNumber,
          phase: backendState.gameSpecific?.bettingRound || backendState.phase,
          hasGameSpecific: !!backendState.gameSpecific,
          stateKeys: Object.keys(backendState).slice(0, 10) // First 10 keys to avoid spam
        });
      }
      
      setGameState(prev => ({
        ...prev,
        players,
        communityCards: newCommunityCards,
        pot: backendState.gameSpecific?.pot || 0,
        currentBet: backendState.gameSpecific?.currentBet || 0,
        phase: (backendState.gameSpecific?.bettingRound || 'preflop') as GamePhase,
        currentPlayer: currentPlayer || null,
        isHandComplete: backendState.gameSpecific?.handComplete || false,
        winners: backendState.gameSpecific?.winners || []
      }));

      // Check if game is complete
      if (backendState.status === 'completed') {
        console.log('🏁 [Poker] Game completed by backend');
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
      // console.log('🎮 [Poker] handleGameEvent processing:', {
      //   eventType: event.event,
      //   playerId: event.playerId,
      //   dataLength: event.data?.length
      // });
      
      const eventData = event.data ? JSON.parse(event.data) : {};
      
      switch (event.event) {
        case 'player_decision':
          // console.log('🎮 [Poker] Processing player_decision event');
          handlePlayerDecision(event.playerId, eventData);
          break;
        case 'thinking_start':
          // console.log('🎮 [Poker] Processing thinking_start event');
          setGameState(prev => ({
            ...prev,
            currentAIThinking: event.playerId,
            currentAIReasoning: null
          }));
          break;
        case 'thinking_complete':
          // console.log('🎮 [Poker] Processing thinking_complete event');
          setGameState(prev => ({
            ...prev,
            currentAIThinking: null
          }));
          break;
        case 'hand_complete':
          // console.log('🎮 [Poker] Processing hand_complete event');
          handleHandComplete(eventData);
          break;
        case 'style_bonus':
          // console.log('🎮 [Poker] Processing style_bonus event');
          handleStyleBonus(eventData);
          break;
        case 'achievement_unlocked':
          // console.log('🎮 [Poker] Processing achievement_unlocked event');
          handleAchievement(eventData);
          break;
        case 'misread_detected':
          // console.log('🎮 [Poker] Processing misread_detected event');
          handleMisread(eventData);
          break;
        default:
          // console.log('🎮 [Poker] Unknown event type:', event.event);
      }
    } catch (error) {
      console.error('❌ [Poker] Error handling game event:', error);
    }
  }, []);

  const handlePlayerDecision = useCallback((playerId: string, data: any, isCatchUp = false) => {
    if (!data.decision) {
      console.warn('⚠️ [Poker] No decision data in player_decision event');
      return;
    }

    // Use hand number from the decision data if available, otherwise use current
    const handNumber = data.handNumber || currentHandNumber.current;

    // In catch-up mode, only log final decisions, not every historical one
    if (!isCatchUp) {
      console.log('💭 [Poker] Processing player decision:', {
        playerId,
        action: data.decision.action,
        handNumber: handNumber,
        dataHandNumber: data.handNumber,
        currentHandNumber: currentHandNumber.current
      });
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
    
    // Debug logging for community cards
    if (!isCatchUp && currentState.communityCards.length > 0) {
      console.log('🃏 [Poker] Decision with community cards:', {
        playerId: player?.name,
        action: data.decision.action,
        phase: currentState.phase,
        communityCards: currentState.communityCards,
        handNumber: handNumber
      });
    }
    
    // Store in hand history using the hand number from the decision
    const handDecisions = handHistoryRef.current.get(handNumber) || new Map();
    handDecisions.set(playerId, decision);
    handHistoryRef.current.set(handNumber, handDecisions);
    
    // Trigger persistence by updating ref
    handHistoryRef.current = new Map(handHistoryRef.current);

    // Update AI decision history (but limit updates during catch-up)
    if (!isCatchUp || handDecisions.size <= 4) {
      setGameState(prev => ({
        ...prev,
        aiDecisionHistory: new Map(handDecisions),
        currentAIThinking: null,
        currentAIReasoning: null
      }));
    }
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
      description: data.description,
      playerId: data.playerId ?? (Array.isArray(data?.players) ? data.players[0] : undefined),
      handNumber: data.handNumber ?? currentHandNumber.current,
      timestamp: data.timestamp ?? Date.now()
    } as StyleBonus;

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

  // Initialize game state from match/tournament data for immediate UI display
  const initializeFromMatch = useCallback((matchData: any) => {
    if (!matchData?.participants || matchData.participants.length === 0 || hasInitializedFromMatch.current) {
      return;
    }

    console.log('🎮 [Poker] Initializing UI from match data:', {
      participantCount: matchData.participants.length,
      matchId: matchData.id
    });

    // Create initial player state from participants
    const initialPlayers: (Player & { avatar: string; isAI: boolean })[] = matchData.participants.map((participant: any) => ({
      id: participant.bot.id,
      name: participant.bot.name,
      chips: 100000, // Default starting chips
      cards: [], // No cards yet
      folded: false,
      allIn: false,
      bet: 0,
      position: 0, // Add required position field
      hasActed: false,
      isActive: true, // Add required isActive field
      avatar: participant.bot.avatar || `/api/placeholder/40/40`,
      isAI: true
    }));

    // Update game state with initial players
    setGameState(prev => ({
      ...prev,
      players: initialPlayers,
      phase: 'waiting' as GamePhase, // Show waiting state until real game starts
      communityCards: [],
      pot: 0,
      currentBet: 0
    }));

    hasInitializedFromMatch.current = true;
    console.log('✅ [Poker] UI initialized with', initialPlayers.length, 'players');
  }, []);

  // Mock functions to match the interface expected by TournamentView
  const pauseGame = useCallback(async () => {
    console.log('⏸️ [Poker] Pausing game...');
    setCurrentGameState('paused');
    setIsActive(false);
  }, []);

  const resumeGame = useCallback(async () => {
    console.log('▶️ [Poker] Resuming game...');
    setCurrentGameState('playing');
    setIsActive(true);
  }, []);

  const startGame = useCallback(async () => {
    console.log('🎲 [Poker] Starting game...');
    setCurrentGameState('playing');
    setIsActive(true);
  }, []);

  const stopGame = useCallback(async () => {
    console.log('🛑 [Poker] Stopping game...');
    setCurrentGameState('finished');
    setIsActive(false);
  }, []);

  const clearGame = useCallback(() => {
    console.log('🧹 [Poker] Clearing game state...');
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
    currentHandNumber.current = 1;
    handHistoryRef.current.clear();
  }, []);

  // Manual hand progression (should NOT be needed with auto-continuation)
  const startNewHand = useCallback(async () => {
    console.log('🎲 [Poker] Manual start new hand requested - this should not be needed!');
    console.log('🔧 [Poker] Auto-continuation should handle this automatically');
    // Force clear hand completion state to trigger progression
    setGameState(prev => ({
      ...prev,
      isHandComplete: false,
      winners: [],
      currentAIThinking: null
    }));
  }, []);

  const changeSpeed = useCallback((speed: string) => {
    setConfig(prev => ({ ...prev, speed }));
    
    // Update speed on backend
    if (gameId) {
      updateGameSpeed({
        variables: { gameId, speed }
      }).then(() => {
        console.log('✅ [Poker] Game speed updated to:', speed);
      }).catch((error) => {
        console.error('❌ [Poker] Failed to update game speed:', error);
      });
    }
  }, [gameId, updateGameSpeed]);

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
      // console.log(`  Hand ${handNumber}: ${decisions.size} decisions`);
      
      // Iterate through all decisions in this hand
      decisions.forEach((decision, playerId) => {
        const player = gameState.players.find(p => p.id === playerId);
        if (!player) {
          // console.warn(`  Player ${playerId} not found in gameState`);
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
        // console.log(`  Added decision for ${player.name}: ${decision.action.type}`);
      });
    });
    
    // Sort by hand number (descending) and timestamp (ascending)
    const sorted = history.sort((a, b) => {
      if (a.handNumber !== b.handNumber) {
        return b.handNumber - a.handNumber; // Newer hands first
      }
      return a.timestamp - b.timestamp; // Earlier decisions first within same hand
    });
    
    // console.log('📜 [Poker] Decision history compiled:', {
    //   totalEntries: sorted.length,
    //   hands: [...new Set(sorted.map(e => e.handNumber))],
    //   firstEntry: sorted[0]
    // });
    
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
      
      // Initialize UI immediately with match data for better UX
      initializeFromMatch(tournament);
    }
  }, [tournament, isInitialized, updateConfig, initializeFromMatch]);

  // Signal frontend ready immediately when tournament and gameId are available (like Connect4)
  useEffect(() => {
    if (gameId && !hasSignaledReady.current) {
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
  }, [gameId, signalFrontendReady]);

  // Auto-continuation: Handle hand completion and auto-start next hand
  useEffect(() => {
    if (gameState.isHandComplete && currentGameState === 'playing') {
      const currentHand = currentHandNumber.current;
      
      console.log(`🎯 [Poker] Hand completion detected:`, {
        currentHand,
        maxHands: config.maxHands,
        isHandComplete: gameState.isHandComplete,
        activePlayers: gameState.players.filter(p => p.chips > 0).length,
        winners: gameState.winners
      });
      
      // Check if we should continue to next hand
      const activePlayers = gameState.players.filter(p => p.chips > 0);
      const shouldContinue = activePlayers.length > 1 && (!config.maxHands || currentHand < config.maxHands);
      
      if (shouldContinue) {
        console.log(`🎲 [Poker] Hand ${currentHand} complete, will auto-continue to hand ${currentHand + 1}`);
        
        // Wait for backend to auto-progress, but if it doesn't happen in 5 seconds, force it
        const autoProgressTimeout = setTimeout(() => {
          if (gameState.isHandComplete && currentHandNumber.current === currentHand) {
            console.log('⚠️ [Poker] Backend did not auto-progress, triggering manually');
            // Manually trigger new hand by clearing hand completion
            setGameState(prev => ({
              ...prev,
              isHandComplete: false,
              winners: [],
              currentAIThinking: null
            }));
          }
        }, 5000);
        
        // Clear timeout if hand progresses naturally
        return () => clearTimeout(autoProgressTimeout);
      } else {
        console.log(`🏁 [Poker] Game complete after ${currentHand} hands (${config.maxHands} max)`);
        setCurrentGameState('finished');
        setIsActive(false);
      }
    }
  }, [gameState.isHandComplete, gameState.winners, currentGameState, config.maxHands, gameState.players]);

  // Also detect hand progression by monitoring hand number changes
  useEffect(() => {
    const currentHand = currentHandNumber.current;
    if (currentHand > 1) {
      console.log(`🎲 [Poker] Hand progressed to ${currentHand}`);
      // Reset hand completion when new hand starts
      if (gameState.isHandComplete) {
        console.log('🔄 [Poker] Clearing hand completion for new hand');
        setGameState(prev => ({
          ...prev,
          isHandComplete: false,
          winners: [],
          currentAIThinking: null
        }));
      }
    }
  }, [currentHandNumber.current, gameState.isHandComplete]);

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
    startNewHand,
    getGameConfig: () => config,
    getStyleStats: () => null,
    getAchievements: () => [],
    getPointScoringLeaderboard: () => [],
    evaluations: { recentEvaluations: [], averageScores: new Map() }
  };
}