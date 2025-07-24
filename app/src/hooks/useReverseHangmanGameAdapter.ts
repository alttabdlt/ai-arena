import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  gameRegistry, 
  ContextFactory
} from '@/game-engine';
import {
  ReverseHangmanGameManager,
  ReverseHangmanGameState,
  ReverseHangmanGameConfig,
  ReverseHangmanEvent
} from '@/game-engine/games/reverse-hangman';
import { registerGames } from '@/game-engine/games';
import { Tournament } from '@/types';
import { AnimationPhase } from '@/reverse-hangman/components/PromptGenerationAnimation';
import { toast } from 'sonner';

interface AIAgentConfig {
  id: string;
  name: string;
  model: string;
  strategy?: string;
  avatar?: string;
}

export interface UseReverseHangmanGameProps {
  tournament: Tournament | null;
}

export interface UseReverseHangmanGameReturn {
  gameState: ReverseHangmanGameState | null;
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

// Adapter to use new framework with legacy interface
class ReverseHangmanGameAdapter {
  private manager: ReverseHangmanGameManager;
  private context: any;
  private eventHandlers: Map<string, (data: any) => void> = new Map();

  constructor(config: any) {
    // Register games if not already done
    if (gameRegistry.getAll().length === 0) {
      registerGames();
    }

    // Create game instance
    const descriptor = gameRegistry.get('reverse-hangman');
    if (!descriptor) {
      throw new Error('Reverse Hangman game not registered');
    }

    this.context = ContextFactory.create({ gameId: 'reverse-hangman-' + Date.now() });
    const factory = descriptor.factory;
    
    // Convert to new config format
    const rhConfig: ReverseHangmanGameConfig = {
      thinkingTime: config.thinkingTime || 2000,
      playerConfigs: config.playerConfigs || [],
      maxAttempts: 7,
      maxRounds: config.maxRounds || 5,
      difficulty: 'mixed',
      categories: ['all']
    };

    this.manager = factory.createManager(rhConfig, this.context) as unknown as ReverseHangmanGameManager;
  }

  on(event: string, handler: (data: any) => void): void {
    this.eventHandlers.set(event, handler);
    
    // Map new framework events to legacy events
    switch (event) {
      case 'animation:phase':
        this.manager.on('animation-phase', (data: ReverseHangmanEvent) => {
          handler({ phase: data.animationPhase, output: '' });
        });
        break;
      
      case 'round:start':
        this.manager.on('round-started', (data: ReverseHangmanEvent) => {
          const state = this.manager.getState();
          handler({ gameState: state, roundNumber: data.roundNumber });
        });
        break;
      
      case 'ai:thinking':
        this.manager.on('thinking', (data: ReverseHangmanEvent) => {
          handler({ agentId: data.playerId, agentName: data.playerName });
        });
        break;
      
      case 'ai:decision':
        this.manager.on('decision-made', (data: ReverseHangmanEvent) => {
          handler({ decision: { guess: data.guess } });
        });
        break;
      
      case 'guess:made':
        this.manager.on('guess-made', (data: ReverseHangmanEvent) => {
          const state = this.manager.getState();
          handler({ gameState: state, attempt: data.matchResult });
        });
        break;
      
      case 'round:end':
        this.manager.on('round-complete', (data: ReverseHangmanEvent) => {
          const state = this.manager.getState();
          const scoringSystem = this.context.services.scoring;
          const score = scoringSystem.calculateScore(state);
          
          handler({ 
            round: {
              roundNumber: data.roundNumber,
              score: {
                totalScore: score.totalScore
              }
            },
            revealedPrompt: this.manager.getRevealedPrompt()
          });
        });
        break;
      
      case 'round:request-difficulty':
        // This is handled internally by checking round completion
        break;
      
      case 'tournament:end':
        this.manager.on('game-complete', (data: ReverseHangmanEvent) => {
          const state = this.manager.getState();
          const scoringSystem = this.context.services.scoring;
          const finalScore = scoringSystem.calculateScore(state);
          
          handler({ 
            stats: { 
              totalScore: finalScore.totalScore 
            } 
          });
        });
        break;
      
      case 'ai:error':
        // AI errors are handled internally by the framework
        break;
    }
  }

  off(event: string): void {
    this.eventHandlers.delete(event);
    // Note: The new framework doesn't have an off method, so handlers persist
  }

  async startTournament(): Promise<void> {
    await this.manager.startGame();
  }

  async startNewRound(difficulty?: string): Promise<void> {
    try {
      // Check if game is initialized first
      let state = null;
      try {
        state = this.manager.getState();
      } catch (e) {
        // Game not initialized yet
      }
      
      if (!state) {
        await this.manager.startGame();
      }
      // Pass difficulty to the manager
      const validDifficulty = difficulty as 'easy' | 'medium' | 'hard' | 'expert' | undefined;
      await this.manager.startNewRound(validDifficulty);
    } catch (error) {
      console.error('Error in startNewRound:', error);
      throw error;
    }
  }

  getState(): ReverseHangmanGameState | null {
    try {
      return this.manager.getState();
    } catch {
      return null;
    }
  }

  getCurrentOutput(): string | null {
    return this.manager.getCurrentPromptOutput();
  }

  getAttemptsRemaining(): number {
    return this.manager.getAttemptsRemaining();
  }
}

export function useReverseHangmanGame({ tournament }: UseReverseHangmanGameProps): UseReverseHangmanGameReturn {
  const [gameState, setGameState] = useState<ReverseHangmanGameState | null>(null);
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
  const [isInitialized, setIsInitialized] = useState(false);
  
  const gameAdapterRef = useRef<ReverseHangmanGameAdapter | null>(null);

  useEffect(() => {
    if (!tournament) {
      // Reset state when tournament is null
      setGameState(null);
      setIsAIThinking(false);
      setCurrentAgent(null);
      setShowDifficultySelect(true);
      setAnimationPhase('idle');
      setAnimationOutput('');
      setIsInitialized(false);
      gameAdapterRef.current = null;
      return;
    }

    try {
      // Initialize game adapter
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

      const adapter = new ReverseHangmanGameAdapter(config);
      gameAdapterRef.current = adapter;
    } catch (error) {
      console.error('Failed to initialize game adapter:', error);
      toast.error('Failed to initialize game. Please try refreshing the page.');
      setIsInitialized(false);
      return;
    }

    const adapter = gameAdapterRef.current;
    if (!adapter) {
      return;
    }

    // Set up event listeners
    adapter.on('animation:phase', ({ phase, output }) => {
      setAnimationPhase(phase);
      if (output) {
        setAnimationOutput(output);
      }
    });

    adapter.on('round:start', ({ gameState, roundNumber }) => {
      setGameState(gameState);
      setShowDifficultySelect(false);
      setAnimationPhase('idle');
      setTournamentStats(prev => ({ ...prev, currentRound: roundNumber }));
    });

    adapter.on('ai:thinking', ({ agentId, agentName }) => {
      setIsAIThinking(true);
      const agent = playerConfigs.find(p => p.id === agentId);
      if (agent) {
        setCurrentAgent(agent);
      }
    });

    adapter.on('ai:decision', ({ decision }) => {
      setIsAIThinking(false);
    });

    adapter.on('guess:made', ({ gameState, attempt }) => {
      setGameState(gameState);
    });

    adapter.on('round:end', ({ round, revealedPrompt }) => {
      setGameState(null);
      setTournamentStats(prev => ({ ...prev, totalScore: prev.totalScore + round.score.totalScore }));
      toast.success(`Round ${round.roundNumber} complete! Score: ${round.score.totalScore}`);
      
      // Check if we need to show difficulty select for next round
      setTimeout(() => {
        const currentState = adapter.getState();
        if (currentState && currentState.roundNumber < currentState.maxRounds) {
          setShowDifficultySelect(true);
          setAnimationPhase('idle');
          setAnimationOutput('');
        }
      }, 3000);
    });

    adapter.on('tournament:end', ({ stats }) => {
      toast.success(`Tournament complete! Total Score: ${stats.totalScore}`);
    });

    // Mark as initialized
    setIsInitialized(true);
    
    // Don't auto-start the tournament - wait for user to select difficulty
    // The game will start when user clicks "Start Round"

    return () => {
      // Cleanup
      gameAdapterRef.current = null;
      setIsInitialized(false);
    };
  }, [tournament]);

  const startRound = useCallback(async (difficulty: 'easy' | 'medium' | 'hard' | 'expert') => {
    if (gameAdapterRef.current) {
      try {
        await gameAdapterRef.current.startNewRound(difficulty);
      } catch (error) {
        console.error('Failed to start round:', error);
        toast.error('Failed to start round. Please try again.');
      }
    } else {
      console.error('Game adapter not initialized');
      toast.error('Game not initialized. Please refresh the page.');
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