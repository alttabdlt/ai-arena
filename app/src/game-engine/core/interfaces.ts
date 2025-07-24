export interface IGameState {
  gameId: string;
  phase: string;
  startTime: Date;
  endTime?: Date;
  currentTurn?: string;
  turnCount: number;
  players: IGamePlayer[];
  metadata?: Record<string, any>;
}

export interface IGamePlayer {
  id: string;
  name: string;
  avatar?: string;
  isAI: boolean;
  isActive: boolean;
  score?: number;
  metadata?: Record<string, any>;
}

export interface IGameAction {
  playerId: string;
  type: string;
  timestamp: Date;
  data?: any;
}

export interface IGameConfig {
  thinkingTime: number;
  maxDuration?: number;
  playerConfigs: IPlayerConfig[];
  gameSpecificConfig?: Record<string, any>;
}

export interface IPlayerConfig {
  id: string;
  name: string;
  avatar?: string;
  aiModel?: string;
  aiStrategy?: string;
}

export interface IGameDecision {
  action: IGameAction;
  confidence: number;
  reasoning: string;
  metadata?: Record<string, any>;
}

export interface IGameValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface IGameEvent {
  type: string;
  timestamp: Date;
  data: any;
  playerId?: string;
}

export interface IGame<TState extends IGameState, TAction extends IGameAction, TConfig extends IGameConfig> {
  id: string;
  name: string;
  description: string;
  category: 'strategy' | 'card' | 'word' | 'puzzle' | 'other';
  minPlayers: number;
  maxPlayers: number;
  thumbnail?: string;
  
  createEngine(): IGameEngine<TState, TAction>;
  createManager(config: TConfig): IGameManager<TState, TConfig>;
  createAIAgent(config: IPlayerConfig): IGameAIAgent<TState, TAction>;
  createScoringSystem(): IGameScoringSystem<TState>;
  getDefaultConfig(): TConfig;
  validateConfig(config: TConfig): IGameValidationResult;
}

export interface IGameEngine<TState extends IGameState, TAction extends IGameAction> {
  initialize(players: IGamePlayer[]): void;
  getState(): TState;
  executeAction(action: TAction): void;
  getValidActions(playerId: string): TAction[];
  isGameOver(): boolean;
  getWinners(): string[];
  validateAction(action: TAction): IGameValidationResult;
}

export interface IGameManager<TState extends IGameState, TConfig extends IGameConfig> {
  startGame(): Promise<void>;
  pauseGame(): void;
  resumeGame(): void;
  endGame(): Promise<void>;
  
  getState(): TState;
  getConfig(): TConfig;
  
  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler: (data: any) => void): void;
}

export interface IGameAIAgent<TState extends IGameState, TAction extends IGameAction> {
  id: string;
  name: string;
  model: string;
  
  makeDecision(state: TState, validActions: TAction[]): Promise<IGameDecision>;
  getPersonality(): IAIPersonality;
}

export interface IAIPersonality {
  aggressiveness: number;
  riskTolerance: number;
  bluffingTendency: number;
  adaptability: number;
  metadata?: Record<string, any>;
}

export interface IGameScoringSystem<TState extends IGameState> {
  calculateScore(state: TState): IScoreResult;
  trackEvent(event: IGameEvent): void;
  getLeaderboard(): ILeaderboardEntry[];
  reset(): void;
}

export interface IScoreResult {
  playerId: string;
  basePoints: number;
  bonusPoints: number;
  penaltyPoints: number;
  totalScore: number;
  breakdown: IScoreBreakdown[];
}

export interface IScoreBreakdown {
  category: string;
  description: string;
  points: number;
}

export interface ILeaderboardEntry {
  playerId: string;
  playerName: string;
  score: number;
  rank: number;
}

export interface IGameAchievement {
  id: string;
  name: string;
  description: string;
  category: 'skill' | 'style' | 'milestone' | 'special';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points: number;
  icon?: string;
  
  checkCondition(state: IGameState, event?: IGameEvent): boolean;
}

export interface IGameError extends Error {
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  context?: any;
}