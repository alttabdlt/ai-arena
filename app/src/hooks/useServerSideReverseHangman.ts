import { useState, useEffect, useCallback } from 'react';
import { useServerSideGame } from './useServerSideGame';
import { Tournament } from '@/types/tournament';
import { AnimationPhase } from '@/components/game/reverse-hangman/PromptGenerationAnimation';

interface UseServerSideReverseHangmanProps {
  tournament: Tournament | null;
}

export function useServerSideReverseHangman({ tournament }: UseServerSideReverseHangmanProps) {
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
    
    // Update animation based on phase
    if (state.phase === 'generating') {
      setAnimationPhase('generating');
      setShowDifficultySelect(false);
    } else if (state.phase === 'playing' && state.currentOutput) {
      setAnimationPhase('revealing');
      setAnimationOutput(state.currentOutput);
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
        setAnimationPhase('generating');
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
  useEffect(() => {
    if (tournament && !isInitialized) {
      initializeGame();
    }
  }, [tournament, isInitialized, initializeGame]);

  const startRound = useCallback((difficulty: 'easy' | 'medium' | 'hard' | 'expert') => {
    // In server-side mode, difficulty selection is handled by the server
    // Just hide the difficulty select and let the server start the round
    setShowDifficultySelect(false);
    setAnimationPhase('generating');
  }, []);

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