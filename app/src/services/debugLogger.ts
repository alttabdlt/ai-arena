import { formatTimestamp } from '@/utils/dateFormatter';

interface LogEntry {
  timestamp: string;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  source: 'frontend' | 'backend' | 'websocket';
  message: string;
  data?: any;
  stack?: string;
}

// Apollo client will be injected
let apolloClient: any = null;
export const setApolloClient = (client: any) => {
  apolloClient = client;
};

class DebugLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 2000; // Reduced to prevent memory issues
  private isCapturing = false;
  private gameType: string | null = null;
  private logBatch: LogEntry[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isSendingLogs = false;
  private originalConsole: {
    log: typeof console.log;
    warn: typeof console.warn;
    error: typeof console.error;
    info: typeof console.info;
    debug: typeof console.debug;
  };

  constructor() {
    // Store original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      info: console.info.bind(console),
      debug: console.debug.bind(console),
    };

    // Override console methods to capture logs
    this.overrideConsole();
  }

  private overrideConsole() {
    const capture = (level: LogEntry['level']) => {
      return (...args: any[]) => {
        // Always call original console method
        this.originalConsole[level](...args);

        // Only capture if enabled
        if (this.isCapturing) {
          const entry: LogEntry = {
            timestamp: formatTimestamp(),
            level,
            source: 'frontend',
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

          this.addLog(entry);
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
    this.logs = []; // Clear previous logs
    this.isCapturing = true;
    
    // Clear old localStorage data to prevent quota issues
    this.clearOldStorageData();
    
    // Add initial log
    const initialLog = {
      timestamp: formatTimestamp(),
      level: 'info' as const,
      source: 'frontend' as const,
      message: `🎮 Started capturing logs for ${gameType} game`,
      data: { gameType }
    };
    
    this.addLog(initialLog);

    // Save game type and start time to localStorage
    const sessionId = `${gameType}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    localStorage.setItem('debugLoggerSession', sessionId);

    // Listen for backend logs via WebSocket
    this.setupBackendLogCapture();
  }

  stopCapture() {
    if (this.isCapturing) {
      this.addLog({
        timestamp: formatTimestamp(),
        level: 'info',
        source: 'frontend',
        message: `🛑 Stopped capturing logs for ${this.gameType} game`,
      });
      
      // Send any remaining logs in batch
      this.sendBatch();
      
      // Clear batch timer
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
      }
      
      // Save logs to localStorage
      this.saveLogsToStorage();
    }
    this.isCapturing = false;
  }

  private setupBackendLogCapture() {
    // Listen for custom backend log events
    window.addEventListener('backend-log', ((event: CustomEvent) => {
      if (this.isCapturing) {
        this.addLog({
          ...event.detail,
          source: 'backend',
        });
      }
    }) as EventListener);

    // Listen for WebSocket events
    window.addEventListener('websocket-log', ((event: CustomEvent) => {
      if (this.isCapturing) {
        this.addLog({
          ...event.detail,
          source: 'websocket',
        });
      }
    }) as EventListener);
  }

  private addLog(entry: LogEntry) {
    this.logs.push(entry);
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Emit event for real-time log viewers
    window.dispatchEvent(new CustomEvent('debug-log-added', { detail: entry }));
    
    // Add to batch for backend logging if capturing and not a filtered log
    if (this.isCapturing && entry.source === 'frontend' && !this.shouldFilterLog(entry)) {
      this.addToBatch(entry);
    }
    
    // Save to localStorage less frequently (every 500 logs)
    if (this.logs.length % 500 === 0) {
      this.saveLogsToStorage();
    }
  }
  
  private shouldFilterLog(entry: LogEntry): boolean {
    // Filter out GraphQL operation logs to prevent feedback loop
    if (entry.message.includes('🔄 GraphQL Operation') || 
        entry.message.includes('✅ GraphQL Response') ||
        entry.message.includes('❌ GraphQL Error')) {
      return true;
    }
    
    // Filter out any logs mentioning SendDebugLog operations
    const lowerMessage = entry.message.toLowerCase();
    if (lowerMessage.includes('senddebuglog') || 
        lowerMessage.includes('send_debug_log') ||
        lowerMessage.includes('debuglog')) {
      return true;
    }
    
    // Check data for SendDebugLog references
    if (entry.data && typeof entry.data === 'object') {
      const dataStr = JSON.stringify(entry.data).toLowerCase();
      if (dataStr.includes('senddebuglog') || 
          dataStr.includes('send_debug_log')) {
        return true;
      }
    }
    
    // Filter out logs created during log sending
    if (this.isSendingLogs) {
      return true;
    }
    
    return false;
  }
  
  private addToBatch(entry: LogEntry) {
    this.logBatch.push(entry);
    
    // Send batch if it reaches 50 logs
    if (this.logBatch.length >= 50) {
      this.sendBatch();
    } else if (!this.batchTimer) {
      // Start timer to send batch after 2 seconds
      this.batchTimer = setTimeout(() => this.sendBatch(), 2000);
    }
  }
  
  private async sendBatch() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    if (this.logBatch.length === 0 || this.isSendingLogs) {
      return;
    }
    
    const logsToSend = [...this.logBatch];
    this.logBatch = [];
    
    // Set flag to prevent logs during sending
    this.isSendingLogs = true;
    
    try {
      await this.sendLogBatchToBackend(logsToSend);
    } finally {
      this.isSendingLogs = false;
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getLogsBySource(source: LogEntry['source']): LogEntry[] {
    return this.logs.filter(log => log.source === source);
  }

  getLogsByLevel(level: LogEntry['level']): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  exportLogs(): string {
    const header = `=== Debug Logs for ${this.gameType} ===\n`;
    const timestamp = new Date().toISOString();
    const separator = '='.repeat(50);
    
    let output = `${header}Exported at: ${timestamp}\nTotal logs: ${this.logs.length}\n${separator}\n\n`;

    this.logs.forEach(log => {
      const prefix = `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.source.toUpperCase()}]`;
      output += `${prefix} ${log.message}\n`;
      
      if (log.stack) {
        output += `Stack trace:\n${log.stack}\n`;
      }
      
      if (log.data && typeof log.data === 'object' && Object.keys(log.data).length > 0) {
        try {
          output += `Data: ${JSON.stringify(log.data, null, 2)}\n`;
        } catch {
          output += `Data: [Unable to stringify]\n`;
        }
      }
      
      output += '\n';
    });

    return output;
  }

  downloadLogs() {
    const content = this.exportLogs();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.gameType}-debug-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  clearLogs() {
    this.logs = [];
    window.dispatchEvent(new CustomEvent('debug-logs-cleared'));
  }

  private saveLogsToStorage() {
    if (!this.gameType) return;
    
    try {
      const sessionId = localStorage.getItem('debugLoggerSession') || 
                       `${this.gameType}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      
      // Keep only last 1000 logs to prevent quota issues
      const logsToSave = this.logs.slice(-1000);
      
      const logData = {
        sessionId,
        gameType: this.gameType,
        timestamp: formatTimestamp(),
        logs: logsToSave
      };
      
      // Try to save to localStorage
      try {
        localStorage.setItem(`debugLogs_${sessionId}`, JSON.stringify(logData));
      } catch (e) {
        // If quota exceeded, try to clear old sessions
        const sessions = JSON.parse(localStorage.getItem('debugLogSessions') || '[]');
        if (sessions.length > 0) {
          // Remove oldest session
          const oldestSession = sessions.shift();
          localStorage.removeItem(`debugLogs_${oldestSession}`);
          localStorage.setItem('debugLogSessions', JSON.stringify(sessions));
          
          // Try again
          localStorage.setItem(`debugLogs_${sessionId}`, JSON.stringify(logData));
        }
      }
      
      // Also save a list of all sessions
      const sessions = JSON.parse(localStorage.getItem('debugLogSessions') || '[]');
      if (!sessions.includes(sessionId)) {
        sessions.push(sessionId);
        // Keep only last 5 sessions (reduced from 10)
        if (sessions.length > 5) {
          const removed = sessions.shift();
          localStorage.removeItem(`debugLogs_${removed}`);
        }
        localStorage.setItem('debugLogSessions', JSON.stringify(sessions));
      }
    } catch (error) {
      // Silently fail - localStorage might be full or disabled
      // Logs are still available in memory and sent to backend
    }
  }

  getSavedSessions(): string[] {
    return JSON.parse(localStorage.getItem('debugLogSessions') || '[]');
  }

  loadSession(sessionId: string): LogEntry[] {
    const data = localStorage.getItem(`debugLogs_${sessionId}`);
    if (data) {
      const parsed = JSON.parse(data);
      return parsed.logs || [];
    }
    return [];
  }

  downloadSession(sessionId: string) {
    const data = localStorage.getItem(`debugLogs_${sessionId}`);
    if (data) {
      const parsed = JSON.parse(data);
      const content = this.exportLogs();
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sessionId}.log`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }
  
  clearOldStorageData() {
    try {
      // Get all keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('debugLogs_')) {
          keysToRemove.push(key);
        }
      }
      
      // Remove all debug log entries
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          // Ignore errors
        }
      });
      
      // Clear sessions list
      localStorage.removeItem('debugLogSessions');
      
      console.log(`🧹 Cleared ${keysToRemove.length} old debug log entries from localStorage`);
    } catch (e) {
      // Ignore errors
    }
  }
  
  private async sendLogToBackend(entry: LogEntry) {
    if (!apolloClient) return;
    
    try {
      // Include game type in the log data
      const logWithGameType = {
        ...entry,
        data: {
          ...entry.data,
          gameType: this.gameType
        }
      };
      
      const { SEND_DEBUG_LOG } = await import('@/graphql/mutations/debug');
      await apolloClient.mutate({
        mutation: SEND_DEBUG_LOG,
        variables: {
          log: logWithGameType
        }
      });
    } catch (error) {
      // Don't log this error to avoid infinite loop
      // Just silently fail - the logs are still saved locally
    }
  }
  
  private async sendLogBatchToBackend(entries: LogEntry[]) {
    if (!apolloClient || entries.length === 0) return;
    
    try {
      // Include game type in all logs
      const logsWithGameType = entries.map(entry => ({
        ...entry,
        data: {
          ...entry.data,
          gameType: this.gameType
        }
      }));
      
      const { SEND_DEBUG_LOG_BATCH } = await import('@/graphql/mutations/debug');
      await apolloClient.mutate({
        mutation: SEND_DEBUG_LOG_BATCH,
        variables: {
          logs: logsWithGameType
        }
      });
    } catch (error) {
      // Don't log this error to avoid infinite loop
      // Just silently fail - the logs are still saved locally
    }
  }
}

// Create singleton instance
export const debugLogger = new DebugLogger();

// Make debugLogger available globally for easy console access
if (typeof window !== 'undefined') {
  (window as any).debugLogger = debugLogger;
  (window as any).getLogs = () => debugLogger.getLogs();
  (window as any).exportLogs = () => {
    const logs = debugLogger.exportLogs();
    console.log(logs);
    return logs;
  };
  (window as any).saveLogs = () => debugLogger.downloadLogs();
  (window as any).getSessions = () => {
    const sessions = debugLogger.getSavedSessions();
    console.log('📁 Saved debug sessions:');
    sessions.forEach(s => console.log(`  - ${s}`));
    return sessions;
  };
  (window as any).loadSession = (sessionId: string) => {
    const logs = debugLogger.loadSession(sessionId);
    console.log(`📂 Loaded ${logs.length} logs from session ${sessionId}`);
    return logs;
  };
  (window as any).downloadSession = (sessionId: string) => {
    debugLogger.downloadSession(sessionId);
    console.log(`💾 Downloading logs for session ${sessionId}`);
  };
  
  console.log('🐛 Debug Logger initialized. Available commands:');
  console.log('  - window.getLogs() - Get current logs as array');
  console.log('  - window.exportLogs() - Export logs as formatted text');
  console.log('  - window.saveLogs() - Download current logs to file');
  console.log('  - window.getSessions() - List all saved debug sessions');
  console.log('  - window.loadSession(sessionId) - Load logs from a saved session');
  console.log('  - window.downloadSession(sessionId) - Download logs from a saved session');
  console.log('  - window.clearDebugStorage() - Clear all debug logs from localStorage');
  console.log('  - Press Ctrl/Cmd + D to toggle debug viewer');
  
  // Add clear storage command
  (window as any).clearDebugStorage = () => {
    debugLogger.clearOldStorageData();
    console.log('✅ Debug log storage cleared');
  };
}

// Also export the type for use in components
export type { LogEntry };