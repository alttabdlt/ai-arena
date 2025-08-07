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

        // Get user address from URL parameters first
        const urlParams = new URLSearchParams(window.location.search);
        const urlAddress = urlParams.get('address');
        
        // Determine which address to use:
        // 1. URL parameter (from main app)
        // 2. Stored address in localStorage
        // 3. Default test address as fallback
        let userAddress: string;
        
        if (urlAddress) {
          // Address passed from main app - save it for future use
          userAddress = urlAddress;
          localStorage.setItem('metaverseUserAddress', urlAddress);
          console.log('Using address from URL:', userAddress);
        } else {
          // Try to get previously saved address
          const storedAddress = localStorage.getItem('metaverseUserAddress');
          if (storedAddress) {
            userAddress = storedAddress;
            console.log('Using stored address:', userAddress);
          } else {
            // Fallback to test address for development
            userAddress = localStorage.getItem('testUserAddress') || '0x2487155df829977813ea9b4f992c229f86d4f16a';
            console.log('Using fallback test address:', userAddress);
          }
        }
        
        console.log('Fetching bots for address:', userAddress);

        const data = await graphqlClient.request<UserBotsResponse>(
          GET_USER_BOTS_QUERY,
          { userAddress: userAddress }
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

// Helper function to set user address manually (for development/testing)
export function setMetaverseUserAddress(address: string) {
  localStorage.setItem('metaverseUserAddress', address);
  window.location.reload(); // Reload to fetch bots for new address
}

// Helper function to clear stored address and use a different account
export function clearMetaverseUserAddress() {
  localStorage.removeItem('metaverseUserAddress');
  window.location.reload();
}

// Legacy helper for backwards compatibility
export function setTestUserAddress(address: string) {
  setMetaverseUserAddress(address);
}