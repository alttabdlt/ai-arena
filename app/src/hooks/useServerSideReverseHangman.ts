import { useState, useEffect, useCallback, useRef } from 'react';
import { useServerSideGame } from './useServerSideGame';
import { Tournament } from '@/types/tournament';
import { AnimationPhase } from '@/components/game/reverse-hangman/PromptGenerationAnimation';
import { useMutation } from '@apollo/client';
import { START_REVERSE_HANGMAN_ROUND, SIGNAL_FRONTEND_READY } from '@/graphql/mutations/queue';

interface UseServerSideReverseHangmanProps {
  tournament: Tournament | null;
}

export function useServerSideReverseHangman({ tournament }: UseServerSideReverseHangmanProps) {
  const [startReverseHangmanRound] = useMutation(START_REVERSE_HANGMAN_ROUND);
  const [signalFrontendReady] = useMutation(SIGNAL_FRONTEND_READY);
  const hasSignaledReady = useRef(false);
  const [currentAgent, setCurrentAgent] = useState<any>(null);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [showDifficultySelect, setShowDifficultySelect] = useState(true);
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle');
  const [animationOutput, setAnimationOutput] = useState('');
  const [tournamentStats, setTournamentStats] = useState({
    currentRound: 0,
    totalRounds: tournament?.config?.maxRounds || 3,
    totalScore: 0
  });

  // Extract player IDs from tournament
  const playerIds = tournament?.players?.map(p => p.id) || [];

  const handleStateUpdate = useCallback((state: any) => {
    console.log('Reverse Hangman state update:', state);
    
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
    } else if (state.phase === 'playing' && !output) {
      // Still waiting for output
      setAnimationPhase('generating');
    } else if (state.phase === 'won' || state.phase === 'lost') {
      setAnimationPhase('complete');
    }

    // Update tournament stats
    if (state.roundNumber !== undefined) {
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
        break;
      
      case 'thinking_start':
        setIsAIThinking(true);
        break;
      
      case 'round_started':
        setShowDifficultySelect(false);
        // Extract output from event data if available
        const eventData = event.data ? JSON.parse(event.data) : {};
        if (eventData.output) {
          setAnimationPhase('revealing');
          setAnimationOutput(eventData.output);
        } else {
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

  const { 
    gameState, 
    isInitialized, 
    isActive, 
    initializeGame, 
    toggleGamePause 
  } = useServerSideGame({
    gameId: tournament?.id || '',
    gameType: 'REVERSE_HANGMAN',
    players: playerIds,
    onStateUpdate: handleStateUpdate,
    onEvent: handleEvent
  });

  // Initialize game when tournament is loaded
  const initRef = useRef(false);
  useEffect(() => {
    if (tournament && !isInitialized && !initRef.current) {
      initRef.current = true;
      initializeGame();
      
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
    startReverseHangmanRound({
      variables: {
        matchId: tournament.id,
        difficulty
      }
    }).then(() => {
      console.log('✅ Started reverse hangman round with difficulty:', difficulty);
    }).catch((error) => {
      console.error('❌ Failed to start reverse hangman round:', error);
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
    toggleGamePause
  };
}