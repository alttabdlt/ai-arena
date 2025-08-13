import { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { apolloClient } from '../lib/apolloClient';
import { GET_MY_CHANNELS, GET_ALL_CHANNELS } from '../graphql/queries/channels';

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

export function useUserChannels() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        // First try to get user-specific channels if authenticated
        const result = await apolloClient.query({
          query: GET_MY_CHANNELS,
          fetchPolicy: 'network-only'
        });
        
        if (result.data?.myBotChannels) {
          setChannels(result.data.myBotChannels);
          console.log('✅ Loaded user-specific channels');
        }
        setLoading(false);
      } catch (err) {
        console.warn('Could not fetch user channels, trying public channels...', err);
        
        // If auth fails, try to get all public channels
        try {
          const publicResult = await apolloClient.query({
            query: GET_ALL_CHANNELS,
            variables: { status: 'ACTIVE' },
            fetchPolicy: 'network-only'
          });
          
          if (publicResult.data?.channels) {
            setChannels(publicResult.data.channels);
            console.log('✅ Loaded public channels as fallback');
          }
          setLoading(false);
        } catch (publicErr) {
          console.error('Error fetching public channels:', publicErr);
          setError(publicErr as Error);
          
          // Last resort: provide default main channel
          setChannels([{
            id: 'default',
            name: 'main',
            type: 'MAIN',
            status: 'ACTIVE',
            currentBots: 0,
            maxBots: 30,
            loadPercentage: 0,
            worldId: 'default-world', // Ensure we have a worldId for the default channel
            region: null,
            description: 'Default main channel'
          }]);
          setLoading(false);
        }
      }
    };

    fetchChannels();
  }, []);

  return { channels, loading, error };
}