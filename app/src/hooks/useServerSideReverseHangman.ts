import { useState, useEffect, useCallback, useRef } from 'react';
import { useServerSideGame } from './useServerSideGame';
import { Tournament } from '@/types/tournament';
import { AnimationPhase } from '@/components/game/reverse-hangman/PromptGenerationAnimation';
import { useMutation } from '@apollo/client';
import { START_REVERSE_HANGMAN_ROUND, SIGNAL_FRONTEND_READY } from '@/graphql/mutations/queue';
import { LEAVE_GAME, JOIN_GAME } from '@/graphql/mutations/game';

interface UseServerSideReverseHangmanProps {
  tournament: Tournament | null;
}

export function useServerSideReverseHangman({ tournament }: UseServerSideReverseHangmanProps) {
  const [startReverseHangmanRound] = useMutation(START_REVERSE_HANGMAN_ROUND);
  const [signalFrontendReady] = useMutation(SIGNAL_FRONTEND_READY);
  const [joinGame] = useMutation(JOIN_GAME);
  const [leaveGame] = useMutation(LEAVE_GAME);
  const hasSignaledReady = useRef(false);
  const hasJoinedGame = useRef(false);
  const gameStateRef = useRef<any>(null);
  const [currentAgent, setCurrentAgent] = useState<any>(null);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [showDifficultySelect, setShowDifficultySelect] = useState(true);
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle');
  const [animationOutput, setAnimationOutput] = useState('');
  const [decisionHistory, setDecisionHistory] = useState<any[]>([]);
  const [tournamentStats, setTournamentStats] = useState({
    currentRound: 1,
    totalRounds: tournament?.config?.maxRounds || 3,
    totalScore: 0
  });

  // Extract player IDs from tournament
  const playerIds = tournament?.players?.map(p => p.id) || [];

  const handleStateUpdate = useCallback((state: any) => {
    console.log('Reverse Hangman state update:', {
      phase: state.phase,
      hasCurrentPromptPair: !!state.currentPromptPair,
      promptPairOutput: state.currentPromptPair?.output,
      currentOutput: state.currentOutput,
      generatedOutput: state.generatedOutput,
      roundNumber: state.roundNumber,
      attempts: state.attempts?.length || 0
    });
    
    // Store the state in ref for event handlers
    gameStateRef.current = state;
    
    // Extract output from currentPromptPair if available
    const output = state.currentOutput || state.currentPromptPair?.output || state.generatedOutput || '';
    
    // Update animation based on phase
    if (state.phase === 'generating') {
      setAnimationPhase('generating');
      setShowDifficultySelect(false);
    } else if (state.phase === 'playing' && output) {
      // We have the output, show the game immediately
      setAnimationPhase('idle');
      setAnimationOutput(output);
      setShowDifficultySelect(false);
    } else if (state.phase === 'playing' && !output) {
      // Still waiting for output
      console.warn('Game in playing phase but no output available');
      setAnimationPhase('generating');
    } else if (state.phase === 'won' || state.phase === 'lost' || state.phase === 'round-complete') {
      setAnimationPhase('complete');
      // Don't change showDifficultySelect here - let user decide via buttons
    } else if (state.phase === 'waiting') {
      // Reset to show difficulty select for new games
      setShowDifficultySelect(true);
    }

    // Update tournament stats
    if (state.roundNumber !== undefined && state.roundNumber > 0) {
      setTournamentStats(prev => ({
        ...prev,
        currentRound: state.roundNumber,
        totalScore: state.players?.reduce((sum: number, p: any) => sum + (p.totalScore || 0), 0) || 0
      }));
    }

    // Update current player
    if (state.currentTurn) {
      const player = state.players?.find((p: any) => p.id === state.currentTurn);
      if (player) {
        setCurrentAgent({
          id: player.id,
          name: player.name,
          model: player.aiModel,
          avatar: player.avatar
        });
      }
    }
  }, []);

  const handleEvent = useCallback((event: any) => {
    console.log('Reverse Hangman event:', event);

    switch (event.event) {
      case 'player_decision':
        setIsAIThinking(false);
        // Add to decision history
        if (event.decision && event.playerId && gameStateRef.current) {
          const player = gameStateRef.current.players?.find((p: any) => p.id === event.playerId);
          if (player) {
            // Handle different decision structures
            const guess = event.decision.guess || event.decision.prompt_guess || 
                         (event.decision.type === 'guess' ? event.decision.guess : '');
            
            const historyEntry = {
              roundNumber: gameStateRef.current.roundNumber || 1,
              playerId: event.playerId,
              playerName: player.name,
              gamePhase: gameStateRef.current.phase || 'playing',
              decision: {
                action: { type: 'guess', guess: guess },
                reasoning: event.decision?.reasoning || event.reasoning || '' // Better reasoning extraction
              },
              timestamp: Date.now()
            };
            setDecisionHistory(prev => [...prev, historyEntry]);
          }
        }
        break;
      
      case 'thinking_start':
        setIsAIThinking(true);
        break;
      
      case 'round_started':
        console.log('Round started event received:', event);
        setShowDifficultySelect(false);
        // Extract output from event data if available
        const eventData = typeof event.data === 'string' ? JSON.parse(event.data) : event.data || {};
        console.log('Round started event data:', eventData);
        if (eventData.output || event.output) {
          setAnimationPhase('revealing');
          setAnimationOutput(eventData.output || event.output);
        } else {
          console.warn('Round started but no output in event data');
          setAnimationPhase('generating');
        }
        break;
      
      case 'prompt_revealed':
        setAnimationPhase('revealing');
        setAnimationOutput(event.output || '');
        break;
      
      case 'game_complete':
        setAnimationPhase('complete');
        break;
    }
  }, []);

  const gameId = tournament?.id || '';
  
  const { 
    gameState, 
    isInitialized, 
    isActive, 
    initializeGame, 
    toggleGamePause 
  } = useServerSideGame({
    gameId,
    gameType: 'REVERSE_HANGMAN',
    players: playerIds,
    onStateUpdate: handleStateUpdate,
    onEvent: handleEvent
  });

  // Join game when component mounts and leave when unmounts
  useEffect(() => {
    if (gameId && tournament && !hasJoinedGame.current) {
      hasJoinedGame.current = true;
      
      joinGame({
        variables: { gameId }
      }).then(result => {
        console.log('✅ Joined Reverse Hangman game:', gameId, 'Active viewers:', result.data?.joinGame?.activeViewers);
      }).catch(error => {
        console.error('❌ Failed to join Reverse Hangman game:', error);
      });
    }
    
    // Cleanup function - leave game when component unmounts
    return () => {
      if (gameId && hasJoinedGame.current) {
        console.log('👋 Leaving Reverse Hangman game:', gameId);
        leaveGame({
          variables: { gameId }
        }).catch(error => {
          console.error('❌ Failed to leave Reverse Hangman game:', error);
        });
      }
    };
  }, [gameId, tournament, joinGame, leaveGame]);

  // Initialize game when tournament is loaded
  const initRef = useRef(false);
  useEffect(() => {
    if (tournament && !isInitialized && !initRef.current) {
      initRef.current = true;
      // Reverse-hangman games are created during matchmaking, so skip the create step
      initializeGame(true);
      
      // Signal frontend ready immediately after initialization
      if (!hasSignaledReady.current && tournament.id) {
        hasSignaledReady.current = true;
        console.log('🎮 [Reverse Hangman] Signaling frontend ready on initialization...');
        signalFrontendReady({
          variables: { matchId: tournament.id }
        }).then(() => {
          console.log('✅ [Reverse Hangman] Signaled frontend ready for game:', tournament.id);
        }).catch((error) => {
          console.error('❌ [Reverse Hangman] Failed to signal frontend ready:', error);
          // Reset flag on error so it can be retried
          hasSignaledReady.current = false;
        });
      }
    }
  }, [tournament, isInitialized, initializeGame, signalFrontendReady]);

  const startRound = useCallback((difficulty: 'easy' | 'medium' | 'hard' | 'expert') => {
    if (!tournament?.id) {
      console.error('No tournament ID available to start round');
      return;
    }
    
    // Hide difficulty select and show generating animation
    setShowDifficultySelect(false);
    setAnimationPhase('generating');
    
    // Call mutation to start the round on the backend
    console.log('Starting reverse hangman round with:', { matchId: tournament.id, difficulty });
    
    startReverseHangmanRound({
      variables: {
        matchId: tournament.id,
        difficulty
      }
    }).then((result) => {
      console.log('✅ Started reverse hangman round with difficulty:', difficulty, 'Result:', result);
    }).catch((error) => {
      console.error('❌ Failed to start reverse hangman round:', {
        error,
        message: error?.message,
        graphQLErrors: error?.graphQLErrors,
        networkError: error?.networkError
      });
      // Reset on error
      setShowDifficultySelect(true);
      setAnimationPhase('idle');
    });
  }, [tournament?.id, startReverseHangmanRound, signalFrontendReady]);

  return {
    gameState,
    isAIThinking,
    currentAgent,
    tournamentStats,
    showDifficultySelect,
    startRound,
    animationPhase,
    animationOutput,
    isActive,
    toggleGamePause,
    decisionHistory
  };
}