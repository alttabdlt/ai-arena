import { IGameState, IGamePlayer, IGameAction } from '../core/interfaces';

export interface NeutralGameData {
  gameId: string;
  gameType: string;
  phase: string;
  turnCount: number;
  players: NeutralPlayerData[];
  currentPlayer: NeutralPlayerData;
  gameSpecific: Record<string, any>;
  history?: GameHistoryEntry[];
}

export interface NeutralPlayerData {
  id: string;
  name: string;
  isActive: boolean;
  position?: number;
  score?: number;
  resources?: Record<string, any>;
}

export interface GameHistoryEntry {
  turn: number;
  playerId: string;
  action: any;
  result?: any;
}

export abstract class BaseGameDataCollector<TState extends IGameState> {
  protected includeHistory: boolean = false;
  protected historyLimit: number = 10;
  protected obfuscateHiddenInfo: boolean = true;

  collectNeutralData(state: TState, playerId: string): NeutralGameData {
    const player = state.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    const neutralPlayers = this.collectNeutralPlayers(state, playerId);
    const currentPlayer = this.createNeutralPlayer(player, state);
    const gameSpecific = this.collectGameSpecificData(state, playerId);
    
    const data: NeutralGameData = {
      gameId: state.gameId,
      gameType: this.getGameType(),
      phase: state.phase,
      turnCount: state.turnCount,
      players: neutralPlayers,
      currentPlayer,
      gameSpecific
    };

    if (this.includeHistory) {
      data.history = this.collectHistory(state, playerId);
    }

    return this.sanitizeData(data, playerId);
  }

  setHistoryOptions(include: boolean, limit: number = 10): void {
    this.includeHistory = include;
    this.historyLimit = limit;
  }

  protected collectNeutralPlayers(state: TState, playerId: string): NeutralPlayerData[] {
    return state.players.map(player => this.createNeutralPlayer(player, state));
  }

  protected createNeutralPlayer(player: IGamePlayer, state: TState): NeutralPlayerData {
    const neutralPlayer: NeutralPlayerData = {
      id: player.id,
      name: player.name,
      isActive: player.isActive
    };

    if (player.score !== undefined) {
      neutralPlayer.score = player.score;
    }

    const additionalData = this.getPlayerSpecificData(player, state);
    if (additionalData.position !== undefined) {
      neutralPlayer.position = additionalData.position;
    }
    if (additionalData.resources) {
      neutralPlayer.resources = additionalData.resources;
    }

    return neutralPlayer;
  }

  protected sanitizeData(data: NeutralGameData, playerId: string): NeutralGameData {
    if (this.obfuscateHiddenInfo) {
      data.gameSpecific = this.obfuscateHiddenInformation(data.gameSpecific, playerId);
    }

    data.players.forEach(player => {
      if (player.resources && this.obfuscateHiddenInfo && player.id !== playerId) {
        player.resources = this.obfuscatePlayerResources(player.resources, player.id, playerId);
      }
    });

    return data;
  }

  abstract getGameType(): string;
  abstract collectGameSpecificData(state: TState, playerId: string): Record<string, any>;
  abstract getPlayerSpecificData(player: IGamePlayer, state: TState): { 
    position?: number; 
    resources?: Record<string, any>; 
  };
  abstract obfuscateHiddenInformation(data: Record<string, any>, playerId: string): Record<string, any>;
  abstract obfuscatePlayerResources(resources: Record<string, any>, resourceOwnerId: string, viewerId: string): Record<string, any>;
  abstract collectHistory(state: TState, playerId: string): GameHistoryEntry[];
}

export class SimpleGameDataCollector<TState extends IGameState> 
  extends BaseGameDataCollector<TState> {
  
  private gameType: string;

  constructor(gameType: string) {
    super();
    this.gameType = gameType;
  }

  getGameType(): string {
    return this.gameType;
  }

  collectGameSpecificData(state: TState, playerId: string): Record<string, any> {
    const stateAny = state as any;
    const commonKeys = ['gameId', 'phase', 'startTime', 'endTime', 'currentTurn', 'turnCount', 'players', 'metadata'];
    
    const gameSpecific: Record<string, any> = {};
    for (const key in stateAny) {
      if (!commonKeys.includes(key)) {
        gameSpecific[key] = stateAny[key];
      }
    }
    
    return gameSpecific;
  }

  getPlayerSpecificData(player: IGamePlayer, state: TState): { 
    position?: number; 
    resources?: Record<string, any>; 
  } {
    const playerAny = player as any;
    const resources: Record<string, any> = {};
    
    const commonKeys = ['id', 'name', 'avatar', 'isAI', 'isActive', 'score', 'metadata'];
    for (const key in playerAny) {
      if (!commonKeys.includes(key)) {
        resources[key] = playerAny[key];
      }
    }

    return {
      position: state.players.findIndex(p => p.id === player.id),
      resources: Object.keys(resources).length > 0 ? resources : undefined
    };
  }

  obfuscateHiddenInformation(data: Record<string, any>, playerId: string): Record<string, any> {
    return data;
  }

  obfuscatePlayerResources(
    resources: Record<string, any>, 
    resourceOwnerId: string, 
    viewerId: string
  ): Record<string, any> {
    return resources;
  }

  collectHistory(state: TState, playerId: string): GameHistoryEntry[] {
    return [];
  }
}