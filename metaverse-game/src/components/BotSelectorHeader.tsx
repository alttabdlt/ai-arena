import React from 'react';
import { ChevronDown, Bot, Activity, Eye } from 'lucide-react';

interface BotInfo {
  id: string;
  name: string;
  personality: string;
  isActive: boolean;
  currentZone?: string;
  aiArenaBotId?: string;
}

interface BotSelectorHeaderProps {
  bots: BotInfo[];
  selectedBotId?: string;
  onBotSelect: (botId: string) => void;
  className?: string;
}

const BotSelectorHeader: React.FC<BotSelectorHeaderProps> = ({
  bots,
  selectedBotId,
  onBotSelect,
  className = ''
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedBot = bots.find(bot => bot.id === selectedBotId) || bots[0];

  const getPersonalityColor = (personality: string) => {
    switch (personality) {
      case 'CRIMINAL':
        return 'text-red-400';
      case 'GAMBLER':
        return 'text-yellow-400';
      case 'WORKER':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  const getZoneDisplay = (zone?: string) => {
    if (!zone) return 'Unknown Location';
    const zoneNames: Record<string, string> = {
      casino: '🎰 Casino',
      darkAlley: '🌃 Dark Alley',
      suburb: '🏘️ Suburb',
      downtown: '🏢 Downtown',
      underground: '⚔️ Underground'
    };
    return zoneNames[zone] || zone;
  };

  if (bots.length === 0) {
    return (
      <div className={`flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-lg ${className}`}>
        <Bot className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-400">No bots available</span>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors min-w-[250px]"
      >
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" />
          <span className="text-xs text-gray-400">Watching:</span>
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-white">
              {selectedBot?.name || 'Select Bot'}
            </span>
            {selectedBot && (
              <span className={`text-xs ${getPersonalityColor(selectedBot.personality)}`}>
                {selectedBot.personality}
              </span>
            )}
          </div>
          {selectedBot?.currentZone && (
            <div className="text-xs text-gray-400 mt-0.5">
              {getZoneDisplay(selectedBot.currentZone)}
            </div>
          )}
        </div>
        <ChevronDown 
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-72 max-h-96 overflow-y-auto bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50">
          <div className="p-2">
            <div className="text-xs text-gray-400 px-2 py-1 mb-1">Your Bots</div>
            {bots.map(bot => (
              <button
                key={bot.id}
                onClick={() => {
                  onBotSelect(bot.id);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 rounded-md transition-colors text-left flex items-center gap-3 ${
                  bot.id === selectedBotId
                    ? 'bg-primary/20 text-white'
                    : 'hover:bg-gray-800 text-gray-200'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{bot.name}</span>
                    <span className={`text-xs ${getPersonalityColor(bot.personality)}`}>
                      {bot.personality}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {bot.currentZone && (
                      <span className="text-xs text-gray-400">
                        {getZoneDisplay(bot.currentZone)}
                      </span>
                    )}
                    {bot.isActive && (
                      <div className="flex items-center gap-1">
                        <Activity className="w-3 h-3 text-green-400" />
                        <span className="text-xs text-green-400">Active</span>
                      </div>
                    )}
                  </div>
                </div>
                {bot.id === selectedBotId && (
                  <Eye className="w-4 h-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BotSelectorHeader;