import { BaseGameManager } from '../../base/BaseGameManager';
import { IGamePlayer, IPlayerConfig, IGameAction } from '../../core/interfaces';
import { IGameContext } from '../../core/context';
import { IGameAIAgent } from '../../core/interfaces';
import { GameAIService } from '../../services/AIService';
import { 
  Connect4GameState, 
  Connect4GameAction, 
  Connect4GameConfig,
  Connect4GamePlayer 
} from './Connect4Types';
import { Connect4GameEngine } from './engine/Connect4GameEngine';
import { Connect4AIAgentFactory } from './ai/Connect4AIAgentFactory';
import { Connect4ScoringSystem } from './scoring/Connect4ScoringSystem';

export class Connect4GameManager extends BaseGameManager<Connect4GameState, Connect4GameConfig> {
  private moveStartTime: number = 0;
  private aiService: GameAIService;

  constructor(config: Connect4GameConfig, context: IGameContext, aiService: GameAIService) {
    const engine = new Connect4GameEngine(context);
    const scoringSystem = new Connect4ScoringSystem(context);
    super(engine, config, context, scoringSystem);
    this.aiService = aiService;
  }

  // Public method to submit an action (used by UI/adapter)
  public submitAction(action: Connect4GameAction): void {
    // Emit the action as a human action for the base manager to handle
    this.emit('human:action', { action });
  }

  protected async initializePlayers(): Promise<IGamePlayer[]> {
    const players: IGamePlayer[] = [];
    
    // Connect4 requires exactly 2 players
    if (this.config.playerConfigs.length !== 2) {
      throw new Error('Connect4 requires exactly 2 players');
    }

    for (let i = 0; i < 2; i++) {
      const playerConfig = this.config.playerConfigs[i];
      const player: Connect4GamePlayer = {
        id: playerConfig.id,
        name: playerConfig.name || `Player ${i + 1}`,
        isActive: true,
        isAI: !!playerConfig.aiModel,
        playerNumber: (i + 1) as 1 | 2,
        wins: 0,
        totalMoves: 0,
        timeouts: 0,
      };
      players.push(player);
    }

    return players;
  }

  protected async createAIAgent(config: IPlayerConfig): Promise<IGameAIAgent<Connect4GameState, Connect4GameAction>> {
    console.log('Connect4GameManager.createAIAgent called for:', config.id, config.aiModel);
    
    // Import aiModels from the games index
    const { aiModels } = await import('../index');
    
    const agentFactory = new Connect4AIAgentFactory(
      {
        aiService: this.aiService,
        models: aiModels,
        defaultModel: config.aiModel || 'gpt-4o'
      },
      this.context
    );
    
    const agent = agentFactory.createAgent(config);
    console.log('Connect4GameManager created agent:', agent.constructor.name);
    return agent;
  }

  protected async processGameTick(): Promise<void> {
    const state = this.engine.getState();
    if (!state || state.gamePhase !== 'playing') {
      return;
    }

    // The base class handles turn management
    // This method is called when there's no current turn (e.g., between phases)
    // For Connect4, we don't have phases, so this might not be called often
    
    // Check if the game should end
    if (this.engine.isGameOver()) {
      await this.endGame();
    }
  }

  protected getFallbackAction(playerId: string): Connect4GameAction {
    return {
      type: 'timeout',
      playerId,
      timestamp: new Date(),
    };
  }

  protected async cleanup(): Promise<void> {
    // Reset move timer
    this.moveStartTime = 0;
    
    // Clear AI agents
    this.aiAgents.clear();
  }

  // Connect4-specific public methods
  public getBoard(): number[][] | null {
    const state = this.engine.getState();
    return state?.board ?? null;
  }

  public getValidColumns(): number[] {
    const state = this.engine.getState();
    if (!state || state.gamePhase !== 'playing') {
      return [];
    }

    const currentPlayer = state.players[state.currentPlayerIndex];
    const actions = this.engine.getValidActions(currentPlayer.id);
    
    return actions
      .filter(a => a.type === 'place' && (a as Connect4GameAction).column !== undefined)
      .map(a => (a as Connect4GameAction).column!);
  }

  public checkForThreats(playerNumber: 1 | 2): Array<{ row: number; col: number; type: 'win' | 'block' }> {
    return (this.engine as Connect4GameEngine).checkForThreats(playerNumber);
  }
}