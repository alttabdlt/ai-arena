import { IGameContext, GameContext } from '../core/context';
import { GameEventEmitter } from './EventEmitter';
import { GameLogger, LogLevel } from './Logger';
import { GameRandomizer } from './Randomizer';
import { GameTimer } from './Timer';

export interface ContextFactoryOptions {
  gameId?: string;
  logLevel?: LogLevel;
  seed?: string;
  useConsoleLogger?: boolean;
}

export class ContextFactory {
  static create(options: ContextFactoryOptions = {}): IGameContext {
    const gameId = options.gameId || `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const logger = new GameLogger(options.logLevel || LogLevel.INFO);
    
    if (options.useConsoleLogger !== false) {
      logger.addHandler((entry) => {
        const level = LogLevel[entry.level];
        const msg = `[${level}] ${entry.message}`;
        
        switch (entry.level) {
          case LogLevel.DEBUG:
            console.debug(msg, entry.data);
            break;
          case LogLevel.INFO:
            console.info(msg, entry.data);
            break;
          case LogLevel.WARN:
            console.warn(msg, entry.data);
            break;
          case LogLevel.ERROR:
            console.error(msg, entry.error || entry.data);
            break;
        }
      });
    }
    
    const eventBus = new GameEventEmitter();
    const randomizer = new GameRandomizer(options.seed);
    const timer = new GameTimer();
    
    return new GameContext(gameId, logger, eventBus, randomizer, timer);
  }
  
  static createForTesting(gameId: string = 'test-game'): IGameContext {
    return this.create({
      gameId,
      logLevel: LogLevel.DEBUG,
      seed: 'test-seed',
      useConsoleLogger: false
    });
  }
}