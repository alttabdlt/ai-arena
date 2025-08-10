import { useEffect, useRef, useState } from 'react';
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
  AlertTriangle,
  Users,
  HeartHandshake,
  Sparkles,
  Shield,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface ActivityLogsProps {
  worldId: Id<'worlds'>;
  aiArenaBotId?: string;
  playerId?: string;
  agentId?: string;
}

interface ConversationGroup {
  startLog: any;
  messages: any[];
  endLog?: any;
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
  | 'message'
  | 'relationship_milestone'
  | 'marriage'
  | 'friendship_formed'
  | 'rivalry_formed'
  | 'xp_gained'
  | 'level_up';

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
    case 'relationship_milestone':
      return <Users className="w-4 h-4" />;
    case 'marriage':
      return <HeartHandshake className="w-4 h-4" />;
    case 'friendship_formed':
      return <Sparkles className="w-4 h-4" />;
    case 'rivalry_formed':
      return <Shield className="w-4 h-4" />;
    case 'xp_gained':
      return <Sparkles className="w-4 h-4" />;
    case 'level_up':
      return <Sparkles className="w-4 h-4" />;
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
    case 'relationship_milestone':
      return 'text-blue-500';
    case 'marriage':
      return 'text-pink-500';
    case 'friendship_formed':
      return 'text-yellow-500';
    case 'rivalry_formed':
      return 'text-orange-500';
    case 'xp_gained':
      return 'text-purple-400';
    case 'level_up':
      return 'text-yellow-400';
    default:
      return 'text-gray-400';
  }
};

export default function ActivityLogs({ worldId, aiArenaBotId, playerId, agentId }: ActivityLogsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedConversations, setExpandedConversations] = useState<Set<string>>(new Set());
  
  // Query activity logs from Convex
  // @ts-ignore - TypeScript depth issue with Convex types
  const logs = useQuery(api.world.getActivityLogs, {
    worldId,
    aiArenaBotId,
    playerId,
    limit: 200, // Increased to get more conversation history
  });

  // Group conversation messages together
  const groupedLogs = useRef<any[]>([]);
  
  useEffect(() => {
    if (!logs) return;
    
    const grouped: any[] = [];
    const conversationMap = new Map<string, ConversationGroup>();
    let currentConversation: ConversationGroup | null = null;
    
    for (const log of logs) {
      if (log.type === 'conversation_start') {
        currentConversation = {
          startLog: log,
          messages: [],
        };
      } else if (log.type === 'message' && currentConversation) {
        currentConversation.messages.push(log);
      } else if (log.type === 'conversation_end' && currentConversation) {
        currentConversation.endLog = log;
        grouped.push(currentConversation);
        currentConversation = null;
      } else {
        // Non-conversation log or orphaned message
        if (currentConversation && currentConversation.messages.length > 0) {
          grouped.push(currentConversation);
          currentConversation = null;
        }
        grouped.push(log);
      }
    }
    
    // Add any remaining conversation
    if (currentConversation && currentConversation.messages.length > 0) {
      grouped.push(currentConversation);
    }
    
    groupedLogs.current = grouped;
  }, [logs]);

  const displayLogs = groupedLogs.current;
  
  const toggleConversation = (logId: string) => {
    setExpandedConversations(prev => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };
  
  // Check if a log is conversation-related
  const isConversationLog = (type: LogType) => {
    return type === 'conversation_start' || type === 'conversation_end' || type === 'message';
  };

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
        {displayLogs.map((item, index) => {
          // Check if this is a conversation group
          if (item.startLog) {
            const conversationGroup = item as ConversationGroup;
            const isExpanded = expandedConversations.has(conversationGroup.startLog._id);
            
            return (
              <div
                key={`conv-${conversationGroup.startLog._id}`}
                className="bg-gray-800/30 rounded-lg p-3 space-y-2"
              >
                {/* Conversation header */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleConversation(conversationGroup.startLog._id)}
                    className="p-0.5 hover:bg-gray-700 rounded transition-colors"
                  >
                    {isExpanded ? 
                      <ChevronDown className="w-4 h-4 text-gray-400" /> : 
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    }
                  </button>
                  <MessageSquare className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium text-gray-200">
                    Conversation ({conversationGroup.messages.length} messages)
                  </span>
                  <span className="text-xs text-gray-500 ml-auto">
                    {formatDistanceToNow(conversationGroup.startLog.timestamp, { addSuffix: true })}
                  </span>
                </div>
                
                {/* Conversation participants */}
                <div className="text-xs text-gray-400 ml-7">
                  {conversationGroup.startLog.description}
                </div>
                
                {/* Expanded conversation messages */}
                {isExpanded && (
                  <div className="ml-7 space-y-2 border-l-2 border-gray-700 pl-3">
                    {conversationGroup.messages.map((msg) => (
                      <div key={msg._id} className="space-y-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold text-gray-300">
                            {msg.description.split(':')[0]}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDistanceToNow(msg.timestamp, { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-100 bg-gray-700/50 rounded px-2 py-1">
                          {msg.details?.message || msg.description.split(':')[1]?.trim()}
                        </p>
                      </div>
                    ))}
                    {conversationGroup.endLog && (
                      <div className="text-xs text-red-400 italic">
                        {conversationGroup.endLog.description}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }
          
          // Regular log item
          const log = item;
          
          return (
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
          );
        })}
      </div>
    </div>
  );
}