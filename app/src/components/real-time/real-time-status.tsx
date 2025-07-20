import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Wifi, 
  WifiOff, 
  Activity, 
  Clock, 
  AlertCircle,
  RefreshCw,
  Zap
} from 'lucide-react';

interface ConnectionStatus {
  isConnected: boolean;
  lastUpdate: Date;
  latency: number;
  messageCount: number;
}

export function RealTimeStatus() {
  const [status, setStatus] = useState<ConnectionStatus>({
    isConnected: false,
    lastUpdate: new Date(),
    latency: 0,
    messageCount: 0
  });

  // Simulate connection status (will be replaced with actual WebSocket connection)
  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(prev => ({
        isConnected: Math.random() > 0.1, // 90% uptime simulation
        lastUpdate: new Date(),
        latency: Math.floor(Math.random() * 50) + 10,
        messageCount: prev.messageCount + Math.floor(Math.random() * 5)
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleReconnect = () => {
    setStatus(prev => ({
      ...prev,
      isConnected: true,
      lastUpdate: new Date(),
      messageCount: 0
    }));
  };

  return (
    <Card className="w-full max-w-md mx-auto lg:max-w-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Real-Time Status</span>
          </div>
          <Badge 
            variant={status.isConnected ? "default" : "destructive"}
            className="flex items-center space-x-1"
          >
            {status.isConnected ? (
              <Wifi className="h-3 w-3" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
            <span>{status.isConnected ? 'Connected' : 'Disconnected'}</span>
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Connection Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">Latency</p>
              <p className="text-muted-foreground">{status.latency}ms</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">Messages</p>
              <p className="text-muted-foreground">{status.messageCount}</p>
            </div>
          </div>
        </div>

        {/* Last Update */}
        <div className="text-xs text-muted-foreground">
          Last update: {status.lastUpdate.toLocaleTimeString()}
        </div>

        {/* Connection Actions */}
        {!status.isConnected && (
          <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              <span>Connection lost. Real-time updates paused.</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleReconnect}
              className="flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Reconnect</span>
            </Button>
          </div>
        )}

        {/* WebSocket Integration Status */}
        <div className="bg-muted/50 rounded-lg p-3 text-sm">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-info mt-0.5" />
            <div>
              <p className="font-medium text-info mb-1">Real-Time Status</p>
              <p className="text-muted-foreground text-xs">
                WebSocket connection will enable live price updates, 
                tournament streams, and social activity feeds.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}