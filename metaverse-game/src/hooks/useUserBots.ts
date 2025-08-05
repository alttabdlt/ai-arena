import { useState, useEffect } from 'react';
import { graphqlClient, GET_USER_BOTS_QUERY, UserBotsResponse, Bot } from '../lib/graphql';

// Transform bot data from GraphQL to match BotSelector interface
interface BotData {
  id: string;
  name: string;
  tokenId: number;
  personality?: 'CRIMINAL' | 'GAMBLER' | 'WORKER';
  stats?: {
    wins: number;
    losses: number;
  };
  isActive?: boolean;
  metaverseAgentId?: string;
}

export function useUserBots() {
  const [bots, setBots] = useState<BotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBots() {
      try {
        setLoading(true);
        setError(null);

        // TODO: Get actual user address from authentication
        // For now, use a test address or get from localStorage
        const testAddress = localStorage.getItem('testUserAddress') || '0x1234567890123456789012345678901234567890';
        
        console.log('Fetching bots for address:', testAddress);

        const data = await graphqlClient.request<UserBotsResponse>(
          GET_USER_BOTS_QUERY,
          { userAddress: testAddress }
        );

        if (data.user && data.user.bots) {
          const transformedBots: BotData[] = data.user.bots.map(bot => ({
            id: bot.id,
            name: bot.name,
            tokenId: bot.tokenId,
            personality: bot.personality,
            stats: {
              wins: bot.stats.wins,
              losses: bot.stats.losses,
            },
            isActive: bot.isActive,
            metaverseAgentId: bot.metaverseAgentId || bot.botSync?.convexAgentId,
          }));

          console.log('Fetched and transformed bots:', transformedBots);
          setBots(transformedBots);
        } else {
          console.log('No user or bots found');
          setBots([]);
        }
      } catch (err: any) {
        console.error('Error fetching bots:', err);
        setError(err.message || 'Failed to fetch bots');
        setBots([]);
      } finally {
        setLoading(false);
      }
    }

    fetchBots();
    
    // Refresh bots every 30 seconds
    const interval = setInterval(fetchBots, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return { bots, loading, error };
}

// Helper function to set test user address for development
export function setTestUserAddress(address: string) {
  localStorage.setItem('testUserAddress', address);
  window.location.reload(); // Reload to fetch bots for new address
}