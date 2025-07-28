import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  gameRegistry, 
  ContextFactory
} from '@/game-engine';
import {
  Connect4GameManager,
  Connect4GameState,
  Connect4GameConfig,
  Connect4GameAction
} from '@/game-engine/games/connect4';
import { registerGames } from '@/game-engine/games';
import { Tournament } from '@/types';
import { toast } from 'sonner';
import { Connect4Decision } from '@/components/game/connect4/Connect4DecisionHistory';

interface Connect4Player {
  id: string;
  name: string;
  color: 'red' | 'yellow';
  isAI: boolean;
  aiModel?: string;
}

export interface UseConnect4GameProps {
  tournament: Tournament | null;
}

export interface UseConnect4GameReturn {
  gameState: Connect4GameState | null;
  isAIThinking: boolean;
  currentPlayer: Connect4Player | null;
  makeMove: (column: number) => void;
  winner: Connect4Player | null;
  isDraw: boolean;
  isGameComplete: boolean;
  stats: {
    moveCount: number;
  };
  decisionHistory: Connect4Decision[];
}

// Adapter to use new framework with legacy interface
class Connect4GameAdapter {
  private manager: Connect4GameManager;
  private context: any;
  private eventHandlers: Map<string, (data: any) => void> = new Map();

  constructor(config: any) {
    // Register games if not already done
    if (gameRegistry.getAll().length === 0) {
      registerGames();
    }

    // Create game instance
    const descriptor = gameRegistry.get('connect4');
    if (!descriptor) {
      throw new Error('Connect4 game not registered');
    }

    this.context = ContextFactory.create({ gameId: 'connect4-' + Date.now() });
    const factory = descriptor.factory;
    
    // Convert to new config format
    const c4Config: Connect4GameConfig = {
      thinkingTime: config.thinkingTime || 30000, // Default 30s for AI API calls
      playerConfigs: config.playerConfigs || [],
      timeLimit: config.timeLimit || 60000,
      enableGravity: true
    };

    this.manager = factory.createManager(c4Config, this.context) as unknown as Connect4GameManager;
    
    console.log('Connect4GameAdapter created:', {
      hasManager: !!this.manager,
      managerType: this.manager?.constructor?.name,
      config: c4Config
    });
  }

  on(event: string, handler: (data: any) => void): void {
    this.eventHandlers.set(event, handler);
    // Subscribe to manager events
    this.manager.on(event, handler);
  }

  off(event: string): void {
    const handler = this.eventHandlers.get(event);
    if (handler) {
      this.manager.off(event, handler);
      this.eventHandlers.delete(event);
    }
  }

  async start(): Promise<void> {
    console.log('Connect4GameAdapter.start() called');
    try {
      await this.manager.startGame();
      console.log('Game started successfully, initial state:', this.manager.getState());
    } catch (error) {
      console.error('Failed to start game:', error);
      throw error;
    }
  }

  async makeMove(column: number): Promise<void> {
    const state = this.manager.getState();
    if (!state || state.gamePhase !== 'playing') return;
    
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (!currentPlayer) return;

    const action: Connect4GameAction = {
      type: 'place',
      column,
      playerId: currentPlayer.id,
      timestamp: new Date()
    };

    // Submit the action through the manager's public method
    this.manager.submitAction(action);
  }

  getState(): Connect4GameState | null {
    try {
      const state = this.manager.getState();
      console.log('getState() called, returning:', {
        hasState: !!state,
        stateKeys: state ? Object.keys(state) : [],
        board: state?.board ? 'has board' : 'no board',
        boardStructure: state?.board ? {
          isArray: Array.isArray(state.board),
          length: state.board.length,
          firstRow: state.board[0],
          firstRowLength: state.board[0]?.length,
          sample: state.board[0]?.[0]
        } : 'no board',
        gamePhase: state?.gamePhase,
        players: state?.players?.map(p => ({ id: p.id, name: p.name }))
      });
      return state;
    } catch (error) {
      console.error('Error getting state:', error);
      return null;
    }
  }

  getCurrentPlayer() {
    const state = this.manager.getState();
    if (!state || !state.players) return null;
    return state.players[state.currentPlayerIndex];
  }

  dispose(): void {
    // Clean up resources - unsubscribe from all events
    this.eventHandlers.forEach((handler, event) => {
      this.manager.off(event, handler);
    });
    this.eventHandlers.clear();
  }
}

export function useConnect4Game({ tournament }: UseConnect4GameProps): UseConnect4GameReturn {
  const [gameState, setGameState] = useState<Connect4GameState | null>(null);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<Connect4Player | null>(null);
  const [winner, setWinner] = useState<Connect4Player | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [isGameComplete, setIsGameComplete] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const [decisionHistory, setDecisionHistory] = useState<Connect4Decision[]>([]);
  
  const adapterRef = useRef<Connect4GameAdapter | null>(null);

  // Initialize game when tournament is available
  useEffect(() => {
    console.log('useConnect4Game useEffect triggered:', {
      hasTournament: !!tournament,
      gameType: tournament?.gameType,
      isConnect4: tournament?.gameType === 'connect4'
    });
    
    if (!tournament || tournament.gameType !== 'connect4') {
      console.log('Skipping Connect4 initialization - tournament not ready or wrong game type');
      return;
    }

    // Create adapter with tournament config
    const playerConfigs = tournament.players.map((player, index) => ({
      id: player.id,
      name: player.name,
      isHuman: false,
      aiModel: player.aiModel,
      aiStrategy: player.strategy || '',
      color: index === 0 ? 'red' : 'yellow'
    }));
    
    console.log('Creating Connect4 adapter with players:', playerConfigs);
    
    const config = {
      thinkingTime: tournament.config.speed === 'thinking' ? 60000 : 
                    tournament.config.speed === 'normal' ? 30000 : 30000,
      timeLimit: tournament.config.timeLimit || 60000,
      playerConfigs
    };

    const adapter = new Connect4GameAdapter(config);
    adapterRef.current = adapter;

    // Set up event handlers
    adapter.on('game:started', () => {
      console.log('game:started event received');
      setDecisionHistory([]); // Clear decision history for new game
      const state = adapter.getState();
      console.log('Initial game state:', {
        hasState: !!state,
        board: state?.board,
        boardIsArray: Array.isArray(state?.board),
        boardLength: state?.board?.length,
        boardFirstRow: state?.board?.[0],
        players: state?.players?.map(p => ({ id: p.id, name: p.name })),
        currentPlayerIndex: state?.currentPlayerIndex,
        gamePhase: state?.gamePhase
      });
      if (state) {
        console.log('Setting game state in React:', state);
        setGameState(state);
        updateCurrentPlayer(state);
      } else {
        console.error('No state available after game:started event');
      }
    });

    adapter.on('action:executed', () => {
      const state = adapter.getState();
      console.log('action:executed event received, state:', {
        hasState: !!state,
        board: state?.board,
        moveCount: state?.moveCount,
        currentPlayerIndex: state?.currentPlayerIndex
      });
      if (state) {
        setGameState(state);
        setMoveCount(state.moveCount);
        updateCurrentPlayer(state);
      }
    });

    adapter.on('game:complete', (data: any) => {
      setIsGameComplete(true);
      if (data.winner) {
        const winningPlayer = tournament.players.find(p => p.id === data.winner);
        if (winningPlayer) {
          setWinner({
            id: winningPlayer.id,
            name: winningPlayer.name,
            color: tournament.players.indexOf(winningPlayer) === 0 ? 'red' : 'yellow',
            isAI: true,
            aiModel: winningPlayer.aiModel
          });
        }
      } else if (data.isDraw) {
        setIsDraw(true);
      }
    });

    adapter.on('ai:thinking:start', (data: { playerId: string }) => {
      console.log('AI thinking started for player:', data.playerId);
      setIsAIThinking(true);
    });

    adapter.on('ai:thinking:end', () => {
      console.log('AI thinking ended');
      setIsAIThinking(false);
    });

    adapter.on('ai:decision', (data: any) => {
      console.log('AI decision made:', data);
      setIsAIThinking(false);
      
      // Extract decision details
      if (data && data.decision && data.decision.action.type === 'place') {
        const player = tournament.players.find(p => p.id === data.playerId);
        const playerIndex = tournament.players.findIndex(p => p.id === data.playerId);
        
        if (player && data.decision.action.column !== undefined) {
          const confidence = data.decision.confidence || 0;
          const reasoning = data.decision.reasoning || 'No reasoning provided';
          
          // Log fallback decisions
          if (confidence <= 0.1 || reasoning.toLowerCase().includes('fallback')) {
            console.warn('⚠️ Fallback AI decision detected:', {
              player: player.name,
              confidence,
              reasoning,
              column: data.decision.action.column,
              analysis: data.decision.analysis
            });
            
            // Show toast notification for fallback decisions
            toast.warning(`${player.name} used fallback logic (${(confidence * 100).toFixed(0)}% confident)`);
          }
          
          const newDecision: Connect4Decision = {
            playerId: data.playerId,
            playerName: player.name,
            playerColor: playerIndex === 0 ? 'red' : 'yellow',
            column: data.decision.action.column,
            reasoning,
            confidence,
            timestamp: new Date(),
            moveNumber: (data.state?.moveCount || 0) + 1
          };
          
          setDecisionHistory(prev => [...prev, newDecision]);
        }
      }
    });

    // Start the game
    adapter.start().catch(error => {
      console.error('Failed to start Connect4 game:', error);
      toast.error('Failed to start game');
    });

    // Add a periodic check to debug state availability
    const debugInterval = setInterval(() => {
      const currentState = adapter.getState();
      if (currentState && currentState.board) {
        console.log('Periodic state check - board found:', {
          boardLength: currentState.board.length,
          boardFirstRowLength: currentState.board[0]?.length,
          gamePhase: currentState.gamePhase
        });
        // Update React state if it's not set yet
        setGameState(prevState => {
          if (!prevState || !prevState.board) {
            console.log('Updating React state from periodic check');
            return currentState;
          }
          return prevState;
        });
      } else {
        console.log('Periodic state check - no board yet');
      }
    }, 1000);

    // Cleanup on unmount
    return () => {
      clearInterval(debugInterval);
      adapter.dispose();
    };
  }, [tournament]);

  const updateCurrentPlayer = useCallback((state: Connect4GameState) => {
    if (!tournament || state.gamePhase !== 'playing') {
      setCurrentPlayer(null);
      return;
    }

    const player = tournament.players[state.currentPlayerIndex];
    if (player) {
      setCurrentPlayer({
        id: player.id,
        name: player.name,
        color: state.currentPlayerIndex === 0 ? 'red' : 'yellow',
        isAI: true,
        aiModel: player.aiModel
      });
    }
  }, [tournament]);

  const makeMove = useCallback((column: number) => {
    if (!adapterRef.current || isAIThinking || isGameComplete) {
      return;
    }

    adapterRef.current.makeMove(column).catch(error => {
      console.error('Failed to make move:', error);
      toast.error('Invalid move');
    });
  }, [isAIThinking, isGameComplete]);

  return {
    gameState,
    isAIThinking,
    currentPlayer,
    makeMove,
    winner,
    isDraw,
    isGameComplete,
    stats: {
      moveCount
    },
    decisionHistory
  };
}