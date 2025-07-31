import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Trash2, Copy, Filter, X } from 'lucide-react';
import { debugLogger, type LogEntry } from '@/services/debugLogger';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DebugLogViewerProps {
  onClose?: () => void;
}

export function DebugLogViewer({ onClose }: DebugLogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<{
    source: 'all' | LogEntry['source'];
    level: 'all' | LogEntry['level'];
  }>({ source: 'all', level: 'all' });
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    // Load initial logs
    setLogs(debugLogger.getLogs());

    // Listen for new logs
    const handleNewLog = (event: CustomEvent<LogEntry>) => {
      setLogs(prev => [...prev, event.detail]);
    };

    const handleClear = () => {
      setLogs([]);
    };

    window.addEventListener('debug-log-added', handleNewLog as EventListener);
    window.addEventListener('debug-logs-cleared', handleClear);

    return () => {
      window.removeEventListener('debug-log-added', handleNewLog as EventListener);
      window.removeEventListener('debug-logs-cleared', handleClear);
    };
  }, []);

  const filteredLogs = logs.filter(log => {
    if (filter.source !== 'all' && log.source !== filter.source) return false;
    if (filter.level !== 'all' && log.level !== filter.level) return false;
    return true;
  });

  const copyLogs = () => {
    const content = debugLogger.exportLogs();
    navigator.clipboard.writeText(content);
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return 'text-red-500';
      case 'warn': return 'text-yellow-500';
      case 'info': return 'text-blue-500';
      case 'debug': return 'text-gray-500';
      default: return 'text-foreground';
    }
  };

  const getSourceColor = (source: LogEntry['source']) => {
    switch (source) {
      case 'frontend': return 'bg-blue-500/20 text-blue-500';
      case 'backend': return 'bg-green-500/20 text-green-500';
      case 'websocket': return 'bg-purple-500/20 text-purple-500';
      default: return 'bg-gray-500/20 text-gray-500';
    }
  };

  return (
    <Card className="fixed bottom-4 right-4 w-[800px] h-[600px] z-50 shadow-2xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">Debug Logs</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{filteredLogs.length} logs</Badge>
          <Button
            size="icon"
            variant="ghost"
            onClick={copyLogs}
            title="Copy logs"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => debugLogger.downloadLogs()}
            title="Download logs"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => debugLogger.clearLogs()}
            title="Clear logs"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-4 pb-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={filter.source}
              onValueChange={(value) => setFilter(prev => ({ ...prev, source: value as any }))}
            >
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="frontend">Frontend</SelectItem>
                <SelectItem value="backend">Backend</SelectItem>
                <SelectItem value="websocket">WebSocket</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filter.level}
              onValueChange={(value) => setFilter(prev => ({ ...prev, level: value as any }))}
            >
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="log">Log</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warn</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded"
              />
              Auto-scroll
            </label>
          </div>
        </div>
        <ScrollArea className="h-[480px] px-4">
          <div className="space-y-2 pb-4 font-mono text-xs">
            {filteredLogs.map((log, index) => (
              <div
                key={index}
                className="p-2 rounded bg-muted/50 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <Badge variant="outline" className={getSourceColor(log.source)}>
                    {log.source}
                  </Badge>
                  <span className={`font-semibold ${getLevelColor(log.level)}`}>
                    [{log.level.toUpperCase()}]
                  </span>
                </div>
                <div className="whitespace-pre-wrap break-all">
                  {log.message}
                </div>
                {log.stack && (
                  <details className="cursor-pointer">
                    <summary className="text-muted-foreground hover:text-foreground">
                      Stack trace
                    </summary>
                    <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
                      {log.stack}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}