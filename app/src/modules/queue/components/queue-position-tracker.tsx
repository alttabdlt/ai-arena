import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Badge } from '@ui/badge';
import { Progress } from '@ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Users,
  Zap,
  Timer
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface QueuePosition {
  botId: string;
  botName: string;
  position: number;
  previousPosition?: number;
  estimatedWaitTime: number; // in seconds
  enteredAt: string;
  queueType: string;
}

interface QueuePositionTrackerProps {
  positions: QueuePosition[];
  totalInQueue: number;
  averageWaitTime: number;
  nextMatchTime?: string;
}

export function QueuePositionTracker({ 
  positions, 
  totalInQueue, 
  averageWaitTime,
  nextMatchTime 
}: QueuePositionTrackerProps) {
  const [previousPositions, setPreviousPositions] = useState<Map<string, number>>(new Map());

  // Track position changes
  useEffect(() => {
    const newMap = new Map();
    positions.forEach(pos => {
      const prev = previousPositions.get(pos.botId) || pos.position;
      newMap.set(pos.botId, pos.position);
      pos.previousPosition = prev;
    });
    setPreviousPositions(newMap);
  }, [positions]);

  const getPositionChange = (current: number, previous?: number) => {
    if (!previous || current === previous) return null;
    
    const change = previous - current;
    if (change > 0) {
      return (
        <div className="flex items-center gap-1 text-green-500">
          <TrendingUp className="h-3 w-3" />
          <span className="text-xs">+{change}</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1 text-red-500">
          <TrendingDown className="h-3 w-3" />
          <span className="text-xs">{change}</span>
        </div>
      );
    }
  };

  const formatWaitTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const getProgressPercentage = (position: number) => {
    return Math.max(0, Math.min(100, ((totalInQueue - position) / totalInQueue) * 100));
  };

  return (
    <div className="space-y-4">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total in Queue</p>
                <p className="text-2xl font-bold">{totalInQueue}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Wait Time</p>
                <p className="text-2xl font-bold">{formatWaitTime(averageWaitTime)}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Next Match</p>
                <p className="text-2xl font-bold">
                  {nextMatchTime 
                    ? formatDistanceToNow(new Date(nextMatchTime), { addSuffix: true })
                    : 'Soon'}
                </p>
              </div>
              <Timer className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Position Tracking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Your Bots in Queue</span>
            <Badge variant="secondary">{positions.length} bots</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AnimatePresence>
            {positions.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-8 text-muted-foreground"
              >
                <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>No bots in queue</p>
                <p className="text-sm">Deploy a bot to start competing!</p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {positions.map((pos, index) => (
                  <motion.div
                    key={pos.botId}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.1 }}
                    className="space-y-3 p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{pos.botName}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {pos.queueType}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            Entered {formatDistanceToNow(new Date(pos.enteredAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <motion.div
                            key={pos.position}
                            initial={{ scale: 1.2 }}
                            animate={{ scale: 1 }}
                            className="text-2xl font-bold"
                          >
                            #{pos.position}
                          </motion.div>
                          {getPositionChange(pos.position, pos.previousPosition)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          ~{formatWaitTime(pos.estimatedWaitTime)} wait
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Queue Progress</span>
                        <span>{Math.round(getProgressPercentage(pos.position))}%</span>
                      </div>
                      <Progress 
                        value={getProgressPercentage(pos.position)} 
                        className="h-2"
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}