import { useEffect, useRef } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@radix-ui/react-scroll-area';
import { 
  Activity, 
  MessageSquare, 
  Swords, 
  DollarSign, 
  MapPin, 
  Heart,
  Package,
  ArrowRightLeft,
  AlertTriangle
} from 'lucide-react';

interface ActivityLogsProps {
  worldId: Id<'worlds'>;
  aiArenaBotId?: string;
  playerId?: string;
  agentId?: string;
}

type LogType = 
  | 'zone_change'
  | 'conversation_start'
  | 'conversation_end'
  | 'robbery_attempt'
  | 'combat'
  | 'knocked_out'
  | 'hospital_recovery'
  | 'activity_start'
  | 'activity_end'
  | 'item_collected'
  | 'trade'
  | 'message';

const getLogIcon = (type: LogType) => {
  switch (type) {
    case 'zone_change':
      return <MapPin className="w-4 h-4" />;
    case 'conversation_start':
    case 'conversation_end':
    case 'message':
      return <MessageSquare className="w-4 h-4" />;
    case 'robbery_attempt':
      return <DollarSign className="w-4 h-4" />;
    case 'combat':
      return <Swords className="w-4 h-4" />;
    case 'knocked_out':
      return <AlertTriangle className="w-4 h-4" />;
    case 'hospital_recovery':
      return <Heart className="w-4 h-4" />;
    case 'activity_start':
    case 'activity_end':
      return <Activity className="w-4 h-4" />;
    case 'item_collected':
      return <Package className="w-4 h-4" />;
    case 'trade':
      return <ArrowRightLeft className="w-4 h-4" />;
    default:
      return <Activity className="w-4 h-4" />;
  }
};

const getLogColor = (type: LogType) => {
  switch (type) {
    case 'zone_change':
      return 'text-blue-400';
    case 'conversation_start':
    case 'conversation_end':
    case 'message':
      return 'text-green-400';
    case 'robbery_attempt':
      return 'text-yellow-400';
    case 'combat':
      return 'text-red-400';
    case 'knocked_out':
      return 'text-red-600';
    case 'hospital_recovery':
      return 'text-pink-400';
    case 'item_collected':
      return 'text-purple-400';
    case 'trade':
      return 'text-cyan-400';
    default:
      return 'text-gray-400';
  }
};

export default function ActivityLogs({ worldId, aiArenaBotId, playerId, agentId }: ActivityLogsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Query activity logs from Convex
  const logs = useQuery(api.world.getActivityLogs, {
    worldId,
    aiArenaBotId,
    playerId,
    limit: 100,
  });

  // Use real logs if available, otherwise use mock data
  const displayLogs = logs && logs.length > 0 ? logs : [
    {
      _id: '1',
      timestamp: Date.now() - 5000,
      type: 'zone_change' as LogType,
      description: 'Entered Dark Alley',
      emoji: '🌃',
      details: { zone: 'darkAlley' }
    },
    {
      _id: '2',
      timestamp: Date.now() - 30000,
      type: 'robbery_attempt' as LogType,
      description: 'Attempted to rob Lucky',
      emoji: '💰',
      details: { targetPlayer: 'player2', success: true, amount: 150 }
    },
    {
      _id: '3',
      timestamp: Date.now() - 60000,
      type: 'conversation_start' as LogType,
      description: 'Started conversation with Grinder',
      emoji: '💬',
      details: { targetPlayer: 'player3' }
    },
    {
      _id: '4',
      timestamp: Date.now() - 120000,
      type: 'activity_start' as LogType,
      description: 'Started gambling at the slots',
      emoji: '🎰',
      details: {}
    },
    {
      _id: '5',
      timestamp: Date.now() - 180000,
      type: 'zone_change' as LogType,
      description: 'Entered Casino',
      emoji: '🎲',
      details: { zone: 'casino' }
    },
  ];

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayLogs]);

  if (!displayLogs || displayLogs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No activity logs yet</p>
          <p className="text-sm mt-1">Bot activities will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-semibold text-gray-300">Activity Logs</h3>
        <span className="text-xs text-gray-500">{displayLogs.length} entries</span>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-2 pr-2"
        style={{ maxHeight: 'calc(100vh - 300px)' }}
      >
        {displayLogs.map((log) => (
          <div
            key={log._id}
            className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800/70 transition-colors"
          >
            <div className={`mt-0.5 ${getLogColor(log.type)}`}>
              {getLogIcon(log.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {log.emoji && <span className="text-sm">{log.emoji}</span>}
                <p className="text-sm text-gray-200">{log.description}</p>
              </div>
              
              {log.details && (
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  {log.details.success !== undefined && (
                    <span className={log.details.success ? 'text-green-500' : 'text-red-500'}>
                      {log.details.success ? '✅ Success' : '❌ Failed'}
                    </span>
                  )}
                  {log.details.amount !== undefined && (
                    <span className="text-yellow-500">
                      +{log.details.amount} HYPE
                    </span>
                  )}
                  {log.details.zone && (
                    <span className="capitalize">{log.details.zone}</span>
                  )}
                </div>
              )}
              
              <p className="text-xs text-gray-600 mt-1">
                {formatDistanceToNow(log.timestamp, { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}