import { useState, useEffect, useCallback, useRef } from 'react';
import { useSubscription, gql, useMutation } from '@apollo/client';
import { Connect4GameState } from '@game/shared/types';
import { SIGNAL_FRONTEND_READY } from '@/graphql/mutations/queue';
import { Connect4Decision } from '@game/connect4/components/Connect4DecisionHistory';
import { LEAVE_GAME, JOIN_GAME } from '@/graphql/mutations/game';

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

const TOURNAMENT_UPDATE = gql`
  subscription TournamentUpdate($tournamentId: String!) {
    tournamentUpdate(tournamentId: $tournamentId) {
      tournamentId
      type
      data
    }
  }
`;

export interface UseServerSideConnect4Options {
  gameId: string;
  tournament?: any;
}

export function useServerSideConnect4({ gameId, tournament }: UseServerSideConnect4Options) {
  const [signalFrontendReady] = useMutation(SIGNAL_FRONTEND_READY);
  const [joinGame] = useMutation(JOIN_GAME);
  const [leaveGame] = useMutation(LEAVE_GAME);
  const hasSignaledReady = useRef(false);
  const hasJoinedGame = useRef(false);
  
  // Load persisted state from sessionStorage with staleness check
  const loadPersistedState = () => {
    if (!gameId) return { decisions: [], gameState: null };
    
    const persistedDecisions = sessionStorage.getItem(`connect4-decisions-${gameId}`);
    const persistedGameState = sessionStorage.getItem(`connect4-gamestate-${gameId}`);
    const persistedTimestamp = sessionStorage.getItem(`connect4-timestamp-${gameId}`);
    
    // Check if persisted state is stale (older than 30 seconds)
    if (persistedTimestamp) {
      const timestamp = parseInt(persistedTimestamp);
      const now = Date.now();
      const age = now - timestamp;
      
      // If state is older than 30 seconds, clear it to force server sync
      if (age > 30000) {
        console.log('🔄 Clearing stale Connect4 state, will sync from server');
        sessionStorage.removeItem(`connect4-decisions-${gameId}`);
        sessionStorage.removeItem(`connect4-gamestate-${gameId}`);
        sessionStorage.removeItem(`connect4-timestamp-${gameId}`);
        return { decisions: [], gameState: null };
      }
    }
    
    return {
      decisions: persistedDecisions ? JSON.parse(persistedDecisions) : [],
      gameState: persistedGameState ? JSON.parse(persistedGameState) : null
    };
  };
  
  const { decisions: persistedDecisions, gameState: persistedGameState } = loadPersistedState();
  
  const [gameState, setGameState] = useState<Connect4GameState | null>(persistedGameState);
  const [isInitialized, setIsInitialized] = useState(!!persistedGameState);
  const [isActive, setIsActive] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<any>(null);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [winner, setWinner] = useState<string | null>(persistedGameState?.winner || null);
  const [isDraw, setIsDraw] = useState(false);
  const [isGameComplete, setIsGameComplete] = useState(!!persistedGameState?.winner || persistedGameState?.phase === 'complete');
  const [decisionHistory, setDecisionHistory] = useState<Connect4Decision[]>(persistedDecisions);
  const [stats, setStats] = useState<any>({});
  const moveCountRef = useRef(0);
  const pendingDecisionsRef = useRef<Array<{playerId: string, data: any}>>([]);
  const tournamentRef = useRef(tournament);
  
  // Keep minimal logging for debugging
  if (!tournament) {
    console.log('🎯 useServerSideConnect4 waiting for tournament data...');
  }
  
  // Update tournament ref whenever tournament changes
  useEffect(() => {
    tournamentRef.current = tournament;
  }, [tournament]);
  
  // Persist decision history whenever it changes
  useEffect(() => {
    if (gameId && decisionHistory.length > 0) {
      sessionStorage.setItem(`connect4-decisions-${gameId}`, JSON.stringify(decisionHistory));
      sessionStorage.setItem(`connect4-timestamp-${gameId}`, Date.now().toString());
    }
  }, [gameId, decisionHistory]);
  
  // Persist game state whenever it changes
  useEffect(() => {
    if (gameId && gameState) {
      sessionStorage.setItem(`connect4-gamestate-${gameId}`, JSON.stringify(gameState));
      sessionStorage.setItem(`connect4-timestamp-${gameId}`, Date.now().toString());
    }
  }, [gameId, gameState]);
  
  // Join game when component mounts and leave when unmounts
  useEffect(() => {
    if (gameId && tournament && !hasJoinedGame.current) {
      hasJoinedGame.current = true;
      
      joinGame({
        variables: { gameId }
      }).then(result => {
        console.log('✅ Joined Connect4 game:', gameId, 'Active viewers:', result.data?.joinGame?.activeViewers);
      }).catch(error => {
        console.error('❌ Failed to join Connect4 game:', error);
      });
    }
    
    // Cleanup function - leave game when component unmounts
    return () => {
      if (gameId && hasJoinedGame.current) {
        console.log('👋 Leaving Connect4 game:', gameId);
        leaveGame({
          variables: { gameId }
        }).catch(error => {
          console.error('❌ Failed to leave Connect4 game:', error);
        });
      }
      
      // Don't clear sessionStorage on unmount - preserve for navigation
    };
  }, [gameId, tournament, joinGame, leaveGame]);
  
  // Clear persisted state when game completes (after delay)
  useEffect(() => {
    if (gameId && isGameComplete && winner) {
      // Keep data for a while after game ends (5 minutes)
      setTimeout(() => {
        sessionStorage.removeItem(`connect4-decisions-${gameId}`);
        sessionStorage.removeItem(`connect4-gamestate-${gameId}`);
        sessionStorage.removeItem(`connect4-timestamp-${gameId}`);
      }, 5 * 60 * 1000);
    }
  }, [gameId, isGameComplete, winner]);

  // Subscribe to game state updates
  const { data: stateData, error: stateError } = useSubscription(GAME_STATE_UPDATE, {
    variables: { gameId },
    skip: !gameId || !tournament,
    onSubscriptionData: ({ subscriptionData }) => {
      if (subscriptionData.data?.gameStateUpdate) {
        const update = subscriptionData.data.gameStateUpdate;
        try {
          const parsedData = JSON.parse(update.data);
          console.log('Connect4 state update received:', parsedData);
          if (parsedData.state) {
            updateGameStateFromBackend(parsedData.state);
            
            // Mark as initialized when we get first state
            if (!isInitialized) {
              setIsInitialized(true);
              setIsActive(true);
              
              // Signal to backend that frontend is ready
              if (!hasSignaledReady.current && gameId) {
                hasSignaledReady.current = true;
                console.log('🎮 [Connect4] Signaling frontend ready...');
                signalFrontendReady({
                  variables: { matchId: gameId }
                }).then(() => {
                  console.log('✅ [Connect4] Signaled frontend ready for game:', gameId);
                }).catch((error) => {
                  console.error('❌ [Connect4] Failed to signal frontend ready:', error);
                });
              }
            }
          }
        } catch (err) {
          console.error('Failed to parse Connect4 game state:', err);
        }
      }
    },
    onError: (error) => {
      console.error('Connect4 game state subscription error:', error);
    }
  });

  // Subscribe to game events
  const { data: eventData, error: eventError } = useSubscription(GAME_EVENT, {
    variables: { gameId },
    skip: !gameId || !tournament,
    onSubscriptionData: ({ subscriptionData }) => {
      if (subscriptionData.data?.gameEvent) {
        const event = subscriptionData.data.gameEvent;
        handleGameEvent(event);
      }
    },
    onError: (error) => {
      console.error('Connect4 game event subscription error:', error);
    }
  });

  // Transform backend state to match frontend expectations
  const updateGameStateFromBackend = useCallback((backendState: any) => {
    try {
      console.log('Updating Connect4 state from backend:', backendState);
      
      // Transform players
      const players = backendState.players?.map((p: any, index: number) => ({
        id: p.id,
        name: p.name,
        avatar: getPlayerAvatar(p.id, tournament),
        color: index === 0 ? 'red' : 'yellow',
        isAI: true
      })) || [];

      // Get current player - currentTurn is a player ID, not an index
      const currentPlayerId = backendState.currentTurn;
      const currentPlayerIndex = currentPlayerId ? 
        players.findIndex(p => p.id === currentPlayerId) : 0;
      const currentPlayerData = players[currentPlayerIndex] || null;

      // Create game state
      const newGameState: Connect4GameState = {
        // Required IGameState properties
        gameId: gameId,
        phase: backendState.phase || 'playing',
        startTime: tournament?.startedAt ? new Date(tournament.startedAt) : new Date(),
        endTime: tournament?.completedAt ? new Date(tournament.completedAt) : undefined,
        currentTurn: currentPlayerId,
        turnCount: backendState.moveCount || 0,
        players: players,
        
        // Connect4-specific properties
        board: backendState.board || Array(8).fill(null).map(() => Array(8).fill(null)),
        currentPlayerIndex: currentPlayerIndex,
        winner: backendState.winner || null,
        winningCells: backendState.winningCells || null,
        gamePhase: backendState.phase || 'playing',
        moveCount: backendState.moveCount || 0
      };

      setGameState(newGameState);
      setCurrentPlayer(currentPlayerData);
      
      // Update move count ref
      moveCountRef.current = backendState.moveCount || 0;
      
      // Update game status
      if (backendState.phase === 'complete' || backendState.winner) {
        setIsGameComplete(true);
        setWinner(backendState.winner);
        setIsActive(false);
      } else if (backendState.phase === 'draw') {
        setIsGameComplete(true);
        setIsDraw(true);
        setIsActive(false);
      }
    } catch (error) {
      console.error('Error transforming Connect4 backend state:', error);
    }
  }, [tournament, gameId]);

  // Handle game events
  const handleGameEvent = useCallback((event: any) => {
    try {
      const eventData = event.data ? JSON.parse(event.data) : {};
      
      switch (event.event) {
        case 'player_decision':
          handlePlayerDecision(event.playerId, eventData);
          break;
        case 'thinking_start':
          setIsAIThinking(true);
          break;
        case 'thinking_complete':
          setIsAIThinking(false);
          break;
        case 'game_completed':
          setIsGameComplete(true);
          if (eventData.winner) {
            setWinner(eventData.winner);
          } else if (eventData.draw) {
            setIsDraw(true);
          }
          break;
      }
    } catch (error) {
      console.error('Error handling Connect4 game event:', error);
    }
  }, []);

  const handlePlayerDecision = useCallback((playerId: string, data: any) => {
    if (!data.decision) return;
    
    const currentTournament = tournamentRef.current;
    if (!currentTournament) {
      // Store for later processing
      pendingDecisionsRef.current.push({ playerId, data });
      return;
    }

    // Find player info from tournament data instead of gameState
    const participant = currentTournament?.participants?.find((p: any) => p.bot.id === playerId);
    if (!participant) {
      console.warn('Player not found in tournament participants:', playerId);
      return;
    }
    
    const playerIndex = currentTournament?.participants?.findIndex((p: any) => p.bot.id === playerId) || 0;
    const player = {
      id: playerId,
      name: participant.bot.name || 'Unknown Player',
      color: playerIndex === 0 ? 'red' : 'yellow'
    };
    
    // Increment move count
    moveCountRef.current += 1;

    // Extract decision details - handle both direct properties and nested decision object
    const column = data.decision.column !== undefined ? data.decision.column : data.decision;
    const reasoning = data.decision.reasoning || data.reasoning || 'No reasoning provided';
    const confidence = data.decision.confidence !== undefined ? data.decision.confidence : (data.confidence || 0.7);

    // Create decision object

    const decision: Connect4Decision = {
      playerId,
      playerName: player.name || 'Unknown Player',
      playerColor: playerIndex === 0 ? 'red' : 'yellow',
      column,
      reasoning,
      confidence,
      timestamp: new Date(),
      moveNumber: moveCountRef.current
    };

    // Add to decision history
    setDecisionHistory(prev => {
      const newHistory = [...prev, decision];
      console.log(`✅ AI decision added: ${player.name} placed in column ${column + 1}`);
      return newHistory;
    });
  }, []);

  // Helper to get player avatar
  const getPlayerAvatar = (playerId: string, tournament: any) => {
    const participant = tournament?.participants?.find((p: any) => 
      p.bot.id === playerId
    );
    return participant?.bot?.avatar || `/api/placeholder/40/40`;
  };

  // Mock makeMove function (moves are made by server)
  const makeMove = useCallback((column: number) => {
    console.log('makeMove called but moves are controlled by server');
    // In server-side games, moves are made by the AI agents
  }, []);

  // Process pending decisions when tournament data becomes available
  useEffect(() => {
    if (tournament && pendingDecisionsRef.current.length > 0) {
      const pending = [...pendingDecisionsRef.current];
      pendingDecisionsRef.current = [];
      
      pending.forEach(({ playerId, data }) => {
        handlePlayerDecision(playerId, data);
      });
    }
  }, [tournament, handlePlayerDecision]);

  // Signal frontend ready immediately when tournament and gameId are available
  useEffect(() => {
    if (tournament && gameId && !hasSignaledReady.current) {
      hasSignaledReady.current = true;
      console.log('🎮 [Connect4] Signaling frontend ready immediately on mount...');
      signalFrontendReady({
        variables: { matchId: gameId }
      }).then(() => {
        console.log('✅ [Connect4] Signaled frontend ready for game:', gameId);
      }).catch((error) => {
        console.error('❌ [Connect4] Failed to signal frontend ready:', error);
        // Reset flag on error so it can be retried
        hasSignaledReady.current = false;
      });
    }
  }, [tournament, gameId, signalFrontendReady]);

  return {
    gameState,
    isInitialized,
    isActive,
    isAIThinking,
    currentPlayer,
    winner,
    isDraw,
    isGameComplete,
    stats,
    decisionHistory,
    makeMove
  };
}