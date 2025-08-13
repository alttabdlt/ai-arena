import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LoggerOptions {
  level?: LogLevel;
  useColors?: boolean;
  includeTimestamp?: boolean;
  timeZone?: string;
}

class Logger {
  private level: LogLevel;
  private useColors: boolean;
  private includeTimestamp: boolean;
  private timeZone: string;

  constructor(options: LoggerOptions = {}) {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    this.level = options.level ?? (LogLevel[envLevel as keyof typeof LogLevel] ?? LogLevel.INFO);
    this.useColors = options.useColors ?? process.env.NODE_ENV !== 'production';
    this.includeTimestamp = options.includeTimestamp ?? true;
    this.timeZone = options.timeZone ?? 'Asia/Singapore';
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private formatMessage(level: string, message: string, data?: any): string {
    let formattedMessage = '';
    
    if (this.includeTimestamp) {
      const timestamp = new Date().toISOString();
      formattedMessage += `[${timestamp}] `;
    }
    
    formattedMessage += `[${level}] ${message}`;
    
    if (data !== undefined) {
      const dataStr = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
      formattedMessage += ` ${dataStr}`;
    }
    
    return formattedMessage;
  }

  private colorize(message: string, level: LogLevel): string {
    if (!this.useColors) return message;
    
    switch (level) {
      case LogLevel.DEBUG:
        return chalk.gray(message);
      case LogLevel.INFO:
        return chalk.blue(message);
      case LogLevel.WARN:
        return chalk.yellow(message);
      case LogLevel.ERROR:
        return chalk.red(message);
      default:
        return message;
    }
  }

  debug(message: string, data?: any) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const formatted = this.formatMessage('DEBUG', message, data);
      console.log(this.colorize(formatted, LogLevel.DEBUG));
    }
  }

  info(message: string, data?: any) {
    if (this.shouldLog(LogLevel.INFO)) {
      const formatted = this.formatMessage('INFO', message, data);
      console.log(this.colorize(formatted, LogLevel.INFO));
    }
  }

  // Overload for simple logging compatibility
  log(...args: any[]) {
    if (this.shouldLog(LogLevel.INFO)) {
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      
      const formatted = this.formatMessage('INFO', message);
      console.log(this.colorize(formatted, LogLevel.INFO));
    }
  }

  warn(message: string, data?: any) {
    if (this.shouldLog(LogLevel.WARN)) {
      const formatted = this.formatMessage('WARN', message, data);
      console.warn(this.colorize(formatted, LogLevel.WARN));
    }
  }

  error(message: string, error?: any) {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorData = error instanceof Error ? {
        errorMessage: error.message,
        stack: error.stack,
        name: error.name
      } : error;
      
      const formatted = this.formatMessage('ERROR', message, errorData);
      console.error(this.colorize(formatted, LogLevel.ERROR));
    }
  }

  // Set log level dynamically
  setLevel(level: LogLevel) {
    this.level = level;
  }

  // Get current log level
  getLevel(): LogLevel {
    return this.level;
  }
}

// Create default logger instance
export const logger = new Logger();

// Also export a simple logger for backwards compatibility
export const simpleLogger = {
  info: (...args: any[]) => console.info(...args),
  log: (...args: any[]) => console.log(...args),
  error: (...args: any[]) => console.error(...args),
  warn: (...args: any[]) => console.warn(...args),
  debug: (...args: any[]) => console.debug(...args),
};

// Export Logger class for custom instances
export default Logger;