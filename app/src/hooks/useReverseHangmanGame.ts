import { useState, useEffect, useCallback, useRef } from 'react';
import { ReverseHangmanGameManager, AnimationPhase } from '@/reverse-hangman/game/reverse-hangman-manager';
import { ReverseHangmanState } from '@/reverse-hangman/engine/reverse-hangman-engine';
import { Tournament } from '@/types/tournament';
import { AIAgentConfig } from '@/reverse-hangman/ai/ai-agents';
import { toast } from 'sonner';

export interface UseReverseHangmanGameProps {
  tournament: Tournament | null;
}

export interface UseReverseHangmanGameReturn {
  gameState: ReverseHangmanState | null;
  isAIThinking: boolean;
  currentAgent: AIAgentConfig | null;
  tournamentStats: {
    currentRound: number;
    totalRounds: number;
    totalScore: number;
  };
  showDifficultySelect: boolean;
  startRound: (difficulty: 'easy' | 'medium' | 'hard' | 'expert') => void;
  animationPhase: AnimationPhase;
  animationOutput: string;
}

export function useReverseHangmanGame({ tournament }: UseReverseHangmanGameProps): UseReverseHangmanGameReturn {
  const [gameState, setGameState] = useState<ReverseHangmanState | null>(null);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<AIAgentConfig | null>(null);
  const [showDifficultySelect, setShowDifficultySelect] = useState(true);
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle');
  const [animationOutput, setAnimationOutput] = useState('');
  const [tournamentStats, setTournamentStats] = useState({
    currentRound: 0,
    totalRounds: tournament?.config.maxRounds || 5,
    totalScore: 0
  });
  
  const gameManagerRef = useRef<ReverseHangmanGameManager | null>(null);

  useEffect(() => {
    // If no tournament, don't initialize anything
    if (!tournament) {
      return;
    }
    // Initialize game manager
    const playerConfigs: AIAgentConfig[] = tournament.players.map(player => ({
      id: player.id,
      name: player.name,
      model: player.aiModel,
      strategy: player.strategy,
      avatar: player.avatar
    }));

    const config = {
      maxRounds: tournament.config.maxRounds || 5,
      thinkingTime: 2000,
      playerConfigs
    };

    const manager = new ReverseHangmanGameManager(config);
    gameManagerRef.current = manager;

    // Set up event listeners
    manager.on('animation:phase', ({ phase, output }) => {
      setAnimationPhase(phase);
      if (output) {
        setAnimationOutput(output);
      }
    });

    manager.on('round:start', ({ gameState, roundNumber }) => {
      setGameState(gameState);
      setShowDifficultySelect(false);
      setAnimationPhase('idle');
      setTournamentStats(prev => ({ ...prev, currentRound: roundNumber }));
    });

    manager.on('ai:thinking', ({ agentId, agentName }) => {
      setIsAIThinking(true);
      const agent = playerConfigs.find(p => p.id === agentId);
      if (agent) {
        setCurrentAgent(agent);
      }
    });

    manager.on('ai:decision', ({ decision }) => {
      setIsAIThinking(false);
    });

    manager.on('guess:made', ({ gameState, attempt }) => {
      setGameState(gameState);
    });

    manager.on('round:end', ({ round, revealedPrompt }) => {
      setGameState(null);
      setTournamentStats(prev => ({ ...prev, totalScore: prev.totalScore + round.score.totalScore }));
      toast.success(`Round ${round.roundNumber} complete! Score: ${round.score.totalScore}`);
    });

    manager.on('round:request-difficulty', ({ nextRoundNumber }) => {
      setShowDifficultySelect(true);
      setGameState(null);
      setAnimationPhase('idle');
      setAnimationOutput('');
    });

    manager.on('tournament:end', ({ stats }) => {
      toast.success(`Tournament complete! Total Score: ${stats.totalScore}`);
    });

    manager.on('ai:error', ({ error }) => {
      toast.error(`AI Error: ${error}`);
      setIsAIThinking(false);
    });

    // Start the tournament
    manager.startTournament();

    return () => {
      // Cleanup if needed
    };
  }, [tournament]);

  const startRound = useCallback((difficulty: 'easy' | 'medium' | 'hard' | 'expert') => {
    if (gameManagerRef.current) {
      gameManagerRef.current.startNewRound(difficulty);
    }
  }, []);

  return {
    gameState,
    isAIThinking,
    currentAgent,
    tournamentStats,
    showDifficultySelect,
    startRound,
    animationPhase,
    animationOutput
  };
}