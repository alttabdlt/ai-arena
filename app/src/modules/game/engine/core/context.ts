import { IGameEvent, IGameError } from './interfaces';

export interface IGameContext {
  gameId: string;
  logger: IGameLogger;
  eventBus: IGameEventBus;
  randomizer: IGameRandomizer;
  timer: IGameTimer;
}

export interface IGameLogger {
  debug(message: string, data?: any): void;
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, error?: IGameError): void;
}

export interface IGameEventBus {
  emit(event: IGameEvent): void;
  on(eventType: string, handler: (event: IGameEvent) => void): void;
  off(eventType: string, handler: (event: IGameEvent) => void): void;
  once(eventType: string, handler: (event: IGameEvent) => void): void;
}

export interface IGameRandomizer {
  seed(value: string): void;
  nextInt(min: number, max: number): number;
  nextFloat(): number;
  shuffle<T>(array: T[]): T[];
  pick<T>(array: T[]): T;
  pickMultiple<T>(array: T[], count: number): T[];
}

export interface IGameTimer {
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  getElapsedTime(): number;
  setCountdown(seconds: number, callback: () => void): void;
  clearCountdown(): void;
}

export interface IGameSerializer<TState> {
  serialize(state: TState): string;
  deserialize(data: string): TState;
}

export interface IGameReplay<TState, TAction> {
  id: string;
  gameId: string;
  startState: TState;
  actions: TAction[];
  endState: TState;
  metadata: {
    players: string[];
    winner?: string;
    duration: number;
    timestamp: Date;
  };
}

export class GameContext implements IGameContext {
  constructor(
    public gameId: string,
    public logger: IGameLogger,
    public eventBus: IGameEventBus,
    public randomizer: IGameRandomizer,
    public timer: IGameTimer
  ) {}
}