import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Users, AlertCircle, Zap } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  type: 'MAIN' | 'REGIONAL' | 'TOURNAMENT' | 'VIP' | 'TEST';
  status: 'ACTIVE' | 'FULL' | 'DRAINING' | 'MAINTENANCE';
  currentBots: number;
  maxBots: number;
  loadPercentage: number;
  worldId: string | null;
  region: string | null;
  description: string | null;
}

interface WorldSelectorProps {
  channels: Channel[];
  selectedChannelName: string;
  onChannelSelect: (channel: Channel) => void;
  loading?: boolean;
}

const WorldSelector: React.FC<WorldSelectorProps> = ({ 
  channels, 
  selectedChannelName, 
  onChannelSelect,
  loading = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const selectedChannel = channels.find(c => c.name === selectedChannelName) || channels[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getChannelIcon = (type: Channel['type']) => {
    switch (type) {
      case 'MAIN': return '🌍';
      case 'TOURNAMENT': return '🏆';
      case 'VIP': return '👑';
      case 'REGIONAL': return '🗺️';
      case 'TEST': return '🧪';
      default: return '🌍';
    }
  };

  const getStatusColor = (status: Channel['status']) => {
    switch (status) {
      case 'ACTIVE': return 'text-green-400';
      case 'FULL': return 'text-red-400';
      case 'DRAINING': return 'text-yellow-400';
      case 'MAINTENANCE': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getLoadColor = (percentage: number) => {
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2">
        <div className="flex items-center gap-2 animate-pulse">
          <Globe className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-500">Loading worlds...</span>
        </div>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <span className="text-sm text-gray-400">No worlds available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 rounded-lg px-3 py-2 flex items-center gap-2 transition-all"
        disabled={channels.length <= 1}
      >
        <Globe className="h-4 w-4 text-blue-400" />
        <div className="flex items-center gap-1">
          <span className="text-sm">{getChannelIcon(selectedChannel.type)}</span>
          <span className="text-sm font-medium text-gray-200">
            {selectedChannel.name}
          </span>
          {selectedChannel.status !== 'ACTIVE' && (
            <span className={`text-xs ${getStatusColor(selectedChannel.status)}`}>
              ({selectedChannel.status})
            </span>
          )}
        </div>
        {channels.length > 1 && (
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {isOpen && channels.length > 1 && (
        <div className="absolute top-full mt-2 left-0 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50 min-w-[280px]">
          <div className="p-2">
            <div className="text-xs text-gray-500 uppercase tracking-wider px-2 py-1">
              Available Worlds
            </div>
            {channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => {
                  onChannelSelect(channel);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-2 py-2 rounded hover:bg-gray-700/50 transition-colors ${
                  channel.name === selectedChannelName ? 'bg-gray-700/30' : ''
                }`}
                disabled={!channel.worldId || channel.status === 'MAINTENANCE'}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{getChannelIcon(channel.type)}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-200">
                          {channel.name}
                        </span>
                        <span className={`text-xs ${getStatusColor(channel.status)}`}>
                          {channel.status}
                        </span>
                      </div>
                      {channel.description && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {channel.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-400">
                        {channel.currentBots}/{channel.maxBots}
                      </span>
                    </div>
                    {channel.region && (
                      <span className="text-xs text-gray-500">
                        {channel.region}
                      </span>
                    )}
                  </div>
                </div>
                {channel.loadPercentage > 0 && (
                  <div className="mt-1 bg-gray-700 rounded-full h-1 overflow-hidden">
                    <div 
                      className={`h-full ${getLoadColor(channel.loadPercentage)} transition-all`}
                      style={{ width: `${channel.loadPercentage}%` }}
                    />
                  </div>
                )}
                {!channel.worldId && (
                  <div className="flex items-center gap-1 mt-1">
                    <Zap className="h-3 w-3 text-yellow-500" />
                    <span className="text-xs text-yellow-500">World initializing...</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorldSelector;