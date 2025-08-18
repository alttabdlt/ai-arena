import React from 'react';

interface Bot {
  id: string;
  name: string;
  level?: number;
}

interface BotSelectorProps {
  bots: Bot[];
  selectedBotId: string | null;
  onSelectBot: (botId: string) => void;
  loading: boolean;
}

const BotSelector: React.FC<BotSelectorProps> = ({ bots, selectedBotId, onSelectBot, loading }) => {
  return (
    <div className="bot-selector">
      <label style={{ opacity: 0.8 }}>Select Bot:</label>
      <select
        value={selectedBotId || ''}
        onChange={(e) => onSelectBot(e.target.value)}
        disabled={loading || bots.length === 0}
      >
        {loading ? (
          <option>Loading...</option>
        ) : bots.length === 0 ? (
          <option>No bots available</option>
        ) : (
          <>
            <option value="" disabled>Choose a bot</option>
            {bots.map(bot => (
              <option key={bot.id} value={bot.id}>
                {bot.name} {bot.level && `(Lv ${bot.level})`}
              </option>
            ))}
          </>
        )}
      </select>
    </div>
  );
};

export default BotSelector;