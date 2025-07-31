import { PubSub } from 'graphql-subscriptions';

interface BackendLogEntry {
  timestamp: string;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  source: string;
  message: string;
  data?: any;
  stack?: string;
}

class BackendDebugLogger {
  private pubsub: PubSub;
  private isCapturing = false;
  private gameType: string | null = null;
  private originalConsole: {
    log: typeof console.log;
    warn: typeof console.warn;
    error: typeof console.error;
    info: typeof console.info;
    debug: typeof console.debug;
  };

  constructor(pubsub: PubSub) {
    this.pubsub = pubsub;
    
    // Store original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      info: console.info.bind(console),
      debug: console.debug.bind(console),
    };

    // Override console methods to capture and publish logs
    this.overrideConsole();
  }

  private overrideConsole() {
    const capture = (level: BackendLogEntry['level']) => {
      return (...args: any[]) => {
        // Always call original console method
        this.originalConsole[level](...args);

        // Only capture and publish if enabled
        if (this.isCapturing) {
          const entry: BackendLogEntry = {
            timestamp: new Date().toISOString(),
            level,
            source: 'backend',
            message: args.map(arg => {
              if (typeof arg === 'object') {
                try {
                  return JSON.stringify(arg, null, 2);
                } catch {
                  return String(arg);
                }
              }
              return String(arg);
            }).join(' '),
            data: args.length > 1 ? args : args[0],
          };

          // Capture stack trace for errors
          if (level === 'error' && args[0] instanceof Error) {
            entry.stack = args[0].stack;
          }

          // Publish to frontend via GraphQL subscription
          this.publishLog(entry);
        }
      };
    };

    console.log = capture('log');
    console.warn = capture('warn');
    console.error = capture('error');
    console.info = capture('info');
    console.debug = capture('debug');
  }

  startCapture(gameType: string) {
    this.gameType = gameType;
    this.isCapturing = true;
    
    // Log initial message
    console.log(`🎮 Backend: Started capturing logs for ${gameType} game`);
  }

  stopCapture() {
    if (this.isCapturing) {
      console.log(`🛑 Backend: Stopped capturing logs for ${this.gameType} game`);
    }
    this.isCapturing = false;
    this.gameType = null;
  }

  private publishLog(entry: BackendLogEntry) {
    // Publish to a special debug channel
    this.pubsub.publish('DEBUG_LOG', {
      debugLog: entry
    });
  }

  // Method to manually log important events
  logGameEvent(event: string, data?: any) {
    if (this.isCapturing) {
      const entry: BackendLogEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        source: 'backend-game',
        message: `Game Event: ${event}`,
        data
      };
      
      this.originalConsole.log(`🎮 ${event}`, data);
      this.publishLog(entry);
    }
  }
}

export default BackendDebugLogger;