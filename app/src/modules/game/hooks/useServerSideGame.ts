import { useEffect, useState, useRef, useCallback } from 'react';
import { useSubscription, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { toast } from 'sonner';

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

const CREATE_GAME = gql`
  mutation CreateGame($gameId: String!, $type: GameType!, $players: [String!]!) {
    createGame(gameId: $gameId, type: $type, players: $players) {
      id
      type
      status
      players {
        id
        name
        isAI
        model
        status
      }
      gameState
    }
  }
`;

const START_GAME = gql`
  mutation StartGame($gameId: String!) {
    startGame(gameId: $gameId) {
      id
      status
    }
  }
`;

const PAUSE_GAME = gql`
  mutation PauseGame($gameId: String!) {
    pauseGame(gameId: $gameId) {
      id
      status
    }
  }
`;

const ADD_SPECTATOR = gql`
  mutation AddSpectator($gameId: String!, $userId: String!) {
    addSpectator(gameId: $gameId, userId: $userId)
  }
`;

const REMOVE_SPECTATOR = gql`
  mutation RemoveSpectator($gameId: String!, $userId: String!) {
    removeSpectator(gameId: $gameId, userId: $userId)
  }
`;

interface UseServerSideGameOptions {
  gameId: string;
  gameType: 'POKER' | 'REVERSE_HANGMAN';
  players?: string[];
  onStateUpdate?: (state: any) => void;
  onEvent?: (event: any) => void;
  onError?: (error: Error) => void;
}

export function useServerSideGame({
  gameId,
  gameType,
  players = [],
  onStateUpdate,
  onEvent,
  onError
}: UseServerSideGameOptions) {
  const [gameState, setGameState] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const spectatorAddedRef = useRef(false);
  const userIdRef = useRef(`user-${Date.now()}`);

  // Mutations
  const [createGame] = useMutation(CREATE_GAME);
  const [startGame] = useMutation(START_GAME);
  const [pauseGame] = useMutation(PAUSE_GAME);
  const [addSpectator] = useMutation(ADD_SPECTATOR);
  const [removeSpectator] = useMutation(REMOVE_SPECTATOR);

  // Subscriptions
  const { data: stateData, error: stateError } = useSubscription(GAME_STATE_UPDATE, {
    variables: { gameId },
    skip: !isInitialized,
    onSubscriptionData: ({ subscriptionData }) => {
      if (subscriptionData.data?.gameStateUpdate) {
        const update = subscriptionData.data.gameStateUpdate;
        console.log('Game state update received:', {
          gameId: update.gameId,
          type: update.type,
          dataLength: update.data?.length
        });
        try {
          const parsedData = JSON.parse(update.data);
          
          // Handle different update types
          if (update.type === 'STATE_CHANGE' || update.type === 'state') {
            console.log('Parsed game state:', {
              phase: parsedData.state?.phase,
              hasCurrentPromptPair: !!parsedData.state?.currentPromptPair,
              roundNumber: parsedData.state?.roundNumber
            });
            setGameState(parsedData.state);
            onStateUpdate?.(parsedData.state);
          } else if (update.type === 'decision') {
            console.log('Decision update received:', parsedData);
            // Forward decision events as game events
            onEvent?.({
              event: 'player_decision',
              playerId: parsedData.playerId,
              decision: parsedData.decision,
              timestamp: update.timestamp
            });
          }
        } catch (err) {
          console.error('Failed to parse game state:', err, 'Raw data:', update.data);
        }
      }
    }
  });

  const { data: eventData, error: eventError } = useSubscription(GAME_EVENT, {
    variables: { gameId },
    skip: !isInitialized,
    onSubscriptionData: ({ subscriptionData }) => {
      if (subscriptionData.data?.gameEvent) {
        const event = subscriptionData.data.gameEvent;
        console.log('Game event received:', {
          gameId: event.gameId,
          eventType: event.event,
          playerId: event.playerId,
          hasData: !!event.data
        });
        try {
          let eventPayload = {
            event: event.event,
            playerId: event.playerId
          };
          
          if (event.data) {
            const parsedData = JSON.parse(event.data);
            eventPayload = { ...eventPayload, ...parsedData };
          }
          
          console.log('Processed event payload:', eventPayload);
          onEvent?.(eventPayload);
        } catch (err) {
          console.error('Failed to parse game event:', err, 'Raw data:', event.data);
        }
      }
    }
  });

  // Initialize game
  const initializeGame = useCallback(async (skipCreate = false) => {
    // Prevent double initialization
    if (isInitialized) {
      console.log('Game already initialized, skipping...');
      return;
    }

    try {
      // For games created during matchmaking, skip the create step
      if (!skipCreate) {
        const result = await createGame({
          variables: {
            gameId,
            type: gameType,
            players
          }
        });

        if (result.data?.createGame) {
          const game = result.data.createGame;
          setIsInitialized(true);
          
          // Parse initial game state
          if (game.gameState) {
            const initialState = JSON.parse(game.gameState);
            setGameState(initialState);
            onStateUpdate?.(initialState);
          }
        }
      } else {
        // Game already exists, just mark as initialized
        console.log('Connecting to existing game:', gameId);
        setIsInitialized(true);
      }

      // Add as spectator
      await addSpectator({
        variables: {
          gameId,
          userId: userIdRef.current
        }
      });
      spectatorAddedRef.current = true;

      // Only start game if we created it
      if (!skipCreate) {
        await startGame({
          variables: { gameId }
        });
      }
      
      setIsActive(true);
      toast.success(skipCreate ? 'Connected to game' : 'Game initialized on server');
    } catch (err: any) {
      // Check if error is due to game already existing
      if (err.message && err.message.includes('already')) {
        console.log('Game already exists, marking as initialized');
        setIsInitialized(true);
        setIsActive(true);
        return;
      }
      
      console.error('Failed to initialize game:', err);
      onError?.(err as Error);
      toast.error('Failed to initialize game');
    }
  }, [gameId, gameType, players, createGame, addSpectator, startGame, onStateUpdate, onError, isInitialized]);

  // Pause/resume game
  const toggleGamePause = useCallback(async () => {
    try {
      if (isActive) {
        await pauseGame({ variables: { gameId } });
        setIsActive(false);
        toast.info('Game paused');
      } else {
        await startGame({ variables: { gameId } });
        setIsActive(true);
        toast.info('Game resumed');
      }
    } catch (err) {
      console.error('Failed to toggle game pause:', err);
      toast.error('Failed to toggle game state');
    }
  }, [gameId, isActive, pauseGame, startGame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (spectatorAddedRef.current) {
        removeSpectator({
          variables: {
            gameId,
            userId: userIdRef.current
          }
        }).catch(err => {
          console.error('Failed to remove spectator:', err);
        });
      }
    };
  }, [gameId, removeSpectator]);

  // Handle errors
  useEffect(() => {
    if (stateError || eventError) {
      const error = stateError || eventError;
      console.error('Subscription error:', error);
      onError?.(error as Error);
    }
  }, [stateError, eventError, onError]);

  return {
    gameState,
    isInitialized,
    isActive,
    initializeGame,
    toggleGamePause
  };
}