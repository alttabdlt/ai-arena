import { IGameLogger, IGameError } from '../core';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  level: LogLevel;
  timestamp: Date;
  message: string;
  data?: any;
  error?: IGameError;
}

export class GameLogger implements IGameLogger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 10000;
  private logLevel: LogLevel = LogLevel.INFO;
  private handlers: ((entry: LogEntry) => void)[] = [];

  constructor(logLevel: LogLevel = LogLevel.INFO) {
    this.logLevel = logLevel;
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: IGameError): void {
    this.log(LogLevel.ERROR, message, undefined, error);
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  addHandler(handler: (entry: LogEntry) => void): void {
    this.handlers.push(handler);
  }

  removeHandler(handler: (entry: LogEntry) => void): void {
    const index = this.handlers.indexOf(handler);
    if (index >= 0) {
      this.handlers.splice(index, 1);
    }
  }

  getLogs(level?: LogLevel, limit?: number): LogEntry[] {
    let filteredLogs = level !== undefined 
      ? this.logs.filter(log => log.level === level)
      : [...this.logs];

    if (limit && limit > 0) {
      filteredLogs = filteredLogs.slice(-limit);
    }

    return filteredLogs;
  }

  clearLogs(): void {
    this.logs = [];
  }

  private log(level: LogLevel, message: string, data?: any, error?: IGameError): void {
    if (level < this.logLevel) {
      return;
    }

    const entry: LogEntry = {
      level,
      timestamp: new Date(),
      message,
      data,
      error
    };

    this.logs.push(entry);
    
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    this.handlers.forEach(handler => {
      try {
        handler(entry);
      } catch (err) {
        console.error('Error in log handler:', err);
      }
    });

    if (typeof console !== 'undefined') {
      const prefix = `[${LogLevel[level]}] ${entry.timestamp.toISOString()}`;
      const logData = data ? ` - ${JSON.stringify(data)}` : '';
      
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(`${prefix} ${message}${logData}`);
          break;
        case LogLevel.INFO:
          console.info(`${prefix} ${message}${logData}`);
          break;
        case LogLevel.WARN:
          console.warn(`${prefix} ${message}${logData}`);
          break;
        case LogLevel.ERROR:
          console.error(`${prefix} ${message}${logData}`, error);
          break;
      }
    }
  }
}

export class ConsoleLogHandler {
  handle(entry: LogEntry): void {
    const levelStr = LogLevel[entry.level];
    const timestamp = entry.timestamp.toISOString();
    let output = `[${levelStr}] ${timestamp} - ${entry.message}`;
    
    if (entry.data) {
      output += `\nData: ${JSON.stringify(entry.data, null, 2)}`;
    }
    
    if (entry.error) {
      output += `\nError: ${entry.error.message}`;
      output += `\nCode: ${entry.error.code}`;
      output += `\nSeverity: ${entry.error.severity}`;
      if (entry.error.context) {
        output += `\nContext: ${JSON.stringify(entry.error.context, null, 2)}`;
      }
    }
    
    console.log(output);
  }
}

export class FileLogHandler {
  private fileName: string;
  private buffer: LogEntry[] = [];
  private bufferSize: number = 100;

  constructor(fileName: string) {
    this.fileName = fileName;
  }

  handle(entry: LogEntry): void {
    this.buffer.push(entry);
    
    if (this.buffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  flush(): void {
    if (this.buffer.length === 0) return;
    
    const logs = this.buffer.map(entry => ({
      level: LogLevel[entry.level],
      timestamp: entry.timestamp.toISOString(),
      message: entry.message,
      data: entry.data,
      error: entry.error ? {
        message: entry.error.message,
        code: entry.error.code,
        severity: entry.error.severity,
        context: entry.error.context
      } : undefined
    }));
    
    console.log(`[FileLogHandler] Would write ${logs.length} logs to ${this.fileName}`);
    
    this.buffer = [];
  }
}