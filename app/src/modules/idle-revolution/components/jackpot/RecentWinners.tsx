import React from 'react';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { motion } from 'framer-motion';

const JACKPOT_HISTORY_QUERY = gql`
  query JackpotHistory($limit: Int) {
    jackpotHistory(limit: $limit) {
      id
      botId
      botName
      personality
      amount
      wonAt
    }
    topJackpotWinners(limit: 5) {
      id
      botId
      botName
      personality
      amount
      wonAt
    }
  }
`;

interface RecentWinnersProps {
  limit?: number;
  showTopWinners?: boolean;
  className?: string;
}

interface JackpotWinner {
  id: string;
  botId: string;
  botName: string;
  personality: string;
  amount: number;
  wonAt: string;
}

interface JackpotHistoryQueryData {
  jackpotHistory: JackpotWinner[];
  topJackpotWinners: JackpotWinner[];
}

export const RecentWinners: React.FC<RecentWinnersProps> = ({ 
  limit = 5, 
  showTopWinners = true,
  className = '' 
}) => {
  const { data, loading, error } = useQuery<JackpotHistoryQueryData>(JACKPOT_HISTORY_QUERY, {
    variables: { limit },
    pollInterval: 60000 // Refresh every minute
  });

  const getPersonalityEmoji = (personality: string) => {
    switch (personality) {
      case 'CRIMINAL': return '🔫';
      case 'GAMBLER': return '🎲';
      case 'WORKER': return '⚒️';
      default: return '🤖';
    }
  };

  const getPersonalityColor = (personality: string) => {
    switch (personality) {
      case 'CRIMINAL': return 'text-red-400';
      case 'GAMBLER': return 'text-purple-400';
      case 'WORKER': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const won = new Date(timestamp);
    const diff = now.getTime() - won.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(2)}M`;
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toLocaleString();
  };

  if (loading) {
    return (
      <div className={`recent-winners loading ${className}`}>
        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center mb-3">
                <div className="w-8 h-8 bg-gray-700 rounded-full mr-3"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-700 rounded w-24 mb-1"></div>
                  <div className="h-3 bg-gray-700 rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data?.jackpotHistory) {
    return null;
  }

  const hasWinners = data.jackpotHistory.length > 0;

  return (
    <div className={`recent-winners ${className}`}>
      <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 rounded-lg p-4 border border-gray-700/50">
        <h3 className="text-sm font-semibold text-yellow-400 mb-3 flex items-center">
          <span className="mr-2">🏆</span>
          Recent Jackpot Winners
        </h3>

        {!hasWinners ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-2xl mb-2">🎰</div>
            <div className="text-sm">No winners yet!</div>
            <div className="text-xs mt-1">Be the first to hit the jackpot!</div>
          </div>
        ) : (
          <>
            {/* Recent Winners List */}
            <div className="space-y-2 mb-4">
              {data.jackpotHistory.map((winner, index: number) => (
                <motion.div
                  key={winner.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-2 bg-black/20 rounded-lg hover:bg-black/30 transition-colors"
                >
                  <div className="flex items-center flex-1">
                    <span className="text-lg mr-2">
                      {getPersonalityEmoji(winner.personality)}
                    </span>
                    <div className="flex-1">
                      <div className={`font-semibold text-sm ${getPersonalityColor(winner.personality)}`}>
                        {winner.botName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatTimeAgo(winner.wonAt)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-yellow-400 font-bold text-sm">
                      {formatAmount(winner.amount)} $IDLE
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Top Winners Section */}
            {showTopWinners && data.topJackpotWinners?.length > 0 && (
              <div className="border-t border-gray-700/50 pt-3">
                <h4 className="text-xs font-semibold text-gray-400 mb-2">
                  🔥 Biggest Wins All-Time
                </h4>
                <div className="grid grid-cols-1 gap-1">
                  {data.topJackpotWinners.slice(0, 3).map((winner, index: number) => (
                    <div
                      key={winner.id}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center">
                        <span className="mr-1">
                          {index === 0 && '🥇'}
                          {index === 1 && '🥈'}
                          {index === 2 && '🥉'}
                        </span>
                        <span className={`${getPersonalityColor(winner.personality)}`}>
                          {winner.botName}
                        </span>
                      </div>
                      <span className="text-yellow-500 font-bold">
                        {formatAmount(winner.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Jackpot Stats */}
        {hasWinners && (
          <div className="mt-3 pt-3 border-t border-gray-700/50">
            <div className="flex justify-between text-xs text-gray-500">
              <div>
                Total Winners: <span className="text-gray-400">{data.jackpotHistory.length}</span>
              </div>
              {data.topJackpotWinners?.[0] && (
                <div>
                  Record: <span className="text-yellow-500">
                    {formatAmount(data.topJackpotWinners[0].amount)} $IDLE
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentWinners;
