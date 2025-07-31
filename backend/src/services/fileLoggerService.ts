import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { formatTimestamp } from '../utils/dateFormatter';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);

interface LogEntry {
  timestamp: string;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  source: 'frontend' | 'backend' | 'websocket' | 'graphql';
  message: string;
  data?: any;
  stack?: string;
}

class FileLoggerService {
  private baseLogDir: string;
  private currentGameType: string | null = null;
  private currentLogFile: string | null = null;
  private logBuffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Create logs directory in project root
    // From compiled location: dist/services/fileLoggerService.js
    // Need to go up: dist/services -> dist -> backend -> project root
    this.baseLogDir = path.join(__dirname, '..', '..', '..', 'debug-logs');
    this.ensureLogDirectory();
    
    // Flush logs every 5 seconds
    this.startFlushInterval();
  }

  private async ensureLogDirectory() {
    try {
      await mkdir(this.baseLogDir, { recursive: true });
      
      // Create subdirectories for each game type (no general folder)
      const gameTypes = ['poker', 'connect4', 'reverse-hangman'];
      for (const gameType of gameTypes) {
        await mkdir(path.join(this.baseLogDir, gameType), { recursive: true });
      }
      
      console.log(`📁 Debug logs directory created at: ${this.baseLogDir}`);
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  private startFlushInterval() {
    this.flushInterval = setInterval(() => {
      if (this.logBuffer.length > 0) {
        this.flushLogs();
      }
    }, 5000); // Flush every 5 seconds
  }

  startGameLogging(gameType: string, matchId?: string) {
    this.currentGameType = gameType;
    
    // Create simple filename - just backend.log
    const filename = 'backend.log';
    
    this.currentLogFile = path.join(this.baseLogDir, gameType, filename);
    
    // Clear existing file content
    try {
      fs.writeFileSync(this.currentLogFile, '');
    } catch (error) {
      // File might not exist yet, that's okay
    }
    
    // Write initial log entry
    this.addLog({
      timestamp: formatTimestamp(),
      level: 'info',
      source: 'backend',
      message: `=== Started logging for ${gameType} game${matchId ? ` (Match: ${matchId})` : ''} ===`
    });
    
    console.log(`📝 Logging to file: ${this.currentLogFile}`);
    
    return this.currentLogFile;
  }

  addLog(entry: LogEntry) {
    if (!this.currentLogFile || !this.currentGameType) {
      // If no game logging active, don't log
      return;
    }
    
    // Filter out any logs that mention SendDebugLog to prevent flooding
    const message = (entry.message || '').toLowerCase();
    const dataStr = JSON.stringify(entry.data || {}).toLowerCase();
    
    if (message.includes('senddebuglog') || 
        message.includes('send_debug_log') ||
        message.includes('debuglog') ||
        dataStr.includes('senddebuglog') ||
        dataStr.includes('send_debug_log')) {
      return; // Skip logging SendDebugLog references
    }
    
    this.logBuffer.push(entry);
    
    // Flush immediately for errors
    if (entry.level === 'error') {
      this.flushLogs();
    }
  }

  private async flushLogs() {
    if (this.logBuffer.length === 0 || !this.currentLogFile) return;
    
    const logsToWrite = [...this.logBuffer];
    this.logBuffer = [];
    
    try {
      const logContent = logsToWrite.map(entry => {
        const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.source.toUpperCase()}]`;
        let content = `${prefix} ${entry.message}`;
        
        if (entry.stack) {
          content += `\nStack trace:\n${entry.stack}`;
        }
        
        if (entry.data && typeof entry.data === 'object' && Object.keys(entry.data).length > 0) {
          try {
            content += `\nData: ${JSON.stringify(entry.data, null, 2)}`;
          } catch {
            content += `\nData: [Unable to stringify]`;
          }
        }
        
        return content;
      }).join('\n\n');
      
      // Append to file
      await writeFile(
        this.currentLogFile,
        logContent + '\n\n',
        { flag: 'a' } // Append mode
      );
    } catch (error) {
      console.error('Failed to write logs to file:', error);
    }
  }

  async stopGameLogging() {
    if (this.currentGameType) {
      this.addLog({
        timestamp: formatTimestamp(),
        level: 'info',
        source: 'backend',
        message: `=== Stopped logging for ${this.currentGameType} game ===`
      });
      
      // Flush remaining logs
      await this.flushLogs();
      
      const logFile = this.currentLogFile;
      this.currentGameType = null;
      this.currentLogFile = null;
      
      return logFile;
    }
    return null;
  }

  async getRecentLogs(gameType: string, limit: number = 5): Promise<string[]> {
    try {
      const gameDir = path.join(this.baseLogDir, gameType);
      const files = await readdir(gameDir);
      
      // Sort files by modification time (newest first)
      const sortedFiles = files
        .filter(f => f.endsWith('.log'))
        .sort((a, b) => b.localeCompare(a))
        .slice(0, limit);
      
      return sortedFiles.map(f => path.join(gameDir, f));
    } catch (error) {
      console.error(`Failed to get recent logs for ${gameType}:`, error);
      return [];
    }
  }

  async readLogFile(filePath: string): Promise<string> {
    try {
      const content = await readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      console.error(`Failed to read log file ${filePath}:`, error);
      return '';
    }
  }

  getLogDirectory(): string {
    return this.baseLogDir;
  }

  cleanup() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushLogs();
  }
}

// Create singleton instance
export const fileLoggerService = new FileLoggerService();

// Cleanup on process exit
process.on('exit', () => {
  fileLoggerService.cleanup();
});

process.on('SIGINT', () => {
  fileLoggerService.cleanup();
  process.exit();
});

process.on('SIGTERM', () => {
  fileLoggerService.cleanup();
  process.exit();
});