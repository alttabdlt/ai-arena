import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Bot, User, Zap, Pause } from 'lucide-react';

interface BotData {
  id: string;
  name: string;
  tokenId: number;
  personality?: 'CRIMINAL' | 'GAMBLER' | 'WORKER';
  stats?: {
    wins: number;
    losses: number;
  };
  energy?: {
    currentEnergy: number;
    maxEnergy: number;
    isPaused: boolean;
    consumptionRate: number;
  };
  isActive?: boolean;
  metaverseAgentId?: string;
}

interface BotSelectorProps {
  selectedBotId?: string;
  onBotSelect: (bot: BotData) => void;
  className?: string;
  bots?: BotData[];
}

// Component now receives bots data from parent

export default function BotSelector({ selectedBotId, onBotSelect, className = '', bots = [] }: BotSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedBot, setSelectedBot] = useState<BotData | null>(
    bots.find(bot => bot.id === selectedBotId) || bots[0] || null
  );

  useEffect(() => {
    // Update selected bot when bots prop changes
    if (bots.length > 0) {
      const newSelectedBot = bots.find(bot => bot.id === selectedBotId) || bots[0];
      if (newSelectedBot && newSelectedBot.id !== selectedBot?.id) {
        setSelectedBot(newSelectedBot);
      }
    } else {
      setSelectedBot(null);
    }
  }, [bots, selectedBotId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedBot && selectedBot.id !== selectedBotId) {
      onBotSelect(selectedBot);
    }
  }, [selectedBot, selectedBotId, onBotSelect]);

  const handleBotSelect = (bot: BotData) => {
    setSelectedBot(bot);
    setIsOpen(false);
  };

  const getPersonalityIcon = (personality?: string) => {
    switch (personality) {
      case 'CRIMINAL':
        return '🔫';
      case 'GAMBLER':
        return '🎰';
      case 'WORKER':
        return '⚒️';
      default:
        return '🤖';
    }
  };

  const getPersonalityColor = (personality?: string) => {
    switch (personality) {
      case 'CRIMINAL':
        return 'text-red-400';
      case 'GAMBLER':
        return 'text-purple-400';
      case 'WORKER':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  if (!selectedBot || bots.length === 0) {
    return (
      <div className={`flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-lg ${className}`}>
        <User className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-400">
          {bots.length === 0 ? 'Loading bots...' : 'No bots available'}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-gray-800/50 to-gray-900/50 hover:from-gray-700/60 hover:to-gray-800/60 border border-gray-700/50 rounded-lg transition-all duration-200"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{getPersonalityIcon(selectedBot.personality)}</span>
          <div className="flex flex-col items-start">
            <span className="text-sm font-bold text-gray-200">{selectedBot.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">#{selectedBot.tokenId}</span>
              {selectedBot.energy && (
                <div className="flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 text-yellow-400" />
                  <span className="text-xs text-yellow-400">
                    {selectedBot.energy.currentEnergy}/{selectedBot.energy.maxEnergy}
                  </span>
                  {selectedBot.energy.isPaused && (
                    <Pause className="w-2.5 h-2.5 text-gray-400" />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {selectedBot.isActive && !selectedBot.energy?.isPaused && (
          <Zap className="w-3 h-3 text-green-400 animate-pulse" />
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full mt-2 right-0 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden z-[100]"
          >
            <div className="p-2">
              <div className="text-xs text-gray-500 uppercase tracking-wider px-3 py-1">Your Bots</div>
              <div className="max-h-64 overflow-y-auto">
                {bots.map((bot) => (
                  <motion.button
                    key={bot.id}
                    onClick={() => handleBotSelect(bot)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all ${
                      selectedBot.id === bot.id
                        ? 'bg-gray-800 border border-gray-700'
                        : 'hover:bg-gray-800/50'
                    }`}
                    whileHover={{ x: 5 }}
                  >
                    <span className="text-lg">{getPersonalityIcon(bot.personality)}</span>
                    <div className="flex-1 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-200">{bot.name}</span>
                        <div className="flex items-center gap-1">
                          {bot.energy && (
                            <>
                              <Zap className="w-3 h-3 text-yellow-400" />
                              <span className="text-xs text-yellow-400">
                                {bot.energy.currentEnergy}
                              </span>
                              {bot.energy.isPaused && <Pause className="w-3 h-3 text-gray-400" />}
                            </>
                          )}
                          {bot.isActive && !bot.energy?.isPaused && (
                            <Zap className="w-3 h-3 text-green-400" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-gray-500">#{bot.tokenId}</span>
                        {bot.stats && (
                          <span className="text-gray-400">
                            {bot.stats.wins}W / {bot.stats.losses}L
                          </span>
                        )}
                        {bot.energy && (
                          <span className="text-gray-400">
                            -{bot.energy.consumptionRate}⚡/h
                          </span>
                        )}
                      </div>
                    </div>
                    {bot.personality && (
                      <span className={`text-xs font-medium ${getPersonalityColor(bot.personality)}`}>
                        {bot.personality}
                      </span>
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
            {bots.length === 0 && (
              <div className="p-4 text-center text-sm text-gray-500">
                No bots found. Deploy one in the Arena!
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}