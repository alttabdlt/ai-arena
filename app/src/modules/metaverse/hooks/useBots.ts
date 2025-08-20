import { useState, useEffect } from 'react';
import { useQuery, gql } from '@apollo/client';

// GraphQL query to fetch all bots (simplified for demo)
const GET_ALL_BOTS = gql`
  query GetAllBots {
    bots {
      id
      name
      avatar
      personality
      isActive
      character
      experience {
        id
        level
        currentXP
        totalXP
        xpToNextLevel
      }
    }
  }
`;

export interface Bot {
  id: string;
  name: string;
  avatar?: string;
  level: number;
  personality: string;
  isActive: boolean;
  character?: string;
  experience?: {
    level: number;
    currentXP: number;
    totalXP: number;
    xpToNextLevel: number;
  };
}

export const useBots = () => {
  const [bots, setBots] = useState<Bot[]>([]);
  
  // Query real bots from GraphQL
  const { data, loading, error, refetch } = useQuery(GET_ALL_BOTS, {
    pollInterval: 30000, // Poll every 30 seconds
    onError: (error) => {
      console.error('Failed to fetch bots:', error);
      // No mock data - only show real deployed bots
    }
  });

  useEffect(() => {
    if (data?.bots) {
      // Map bots from GraphQL response
      const mappedBots = data.bots.map((bot: any) => ({
        id: bot.id,
        name: bot.name,
        avatar: bot.avatar,  // This contains the randomly selected character from deployment
        level: bot.experience?.level || 1,
        personality: bot.personality,
        isActive: bot.isActive,
        character: bot.character || bot.avatar || getCharacterForPersonality(bot.personality),  // Fallback chain: character -> avatar -> personality default
        experience: bot.experience
      }));
      setBots(mappedBots);
    }
  }, [data]);

  return {
    bots: bots.filter(b => b.isActive), // Only show active bots
    loading: loading && bots.length === 0,
    error,
    refetch
  };
};

// Helper to map personality to character sprite
function getCharacterForPersonality(personality: string): string {
  switch (personality?.toUpperCase()) {
    case 'CRIMINAL':
      return 'f1';
    case 'GAMBLER':
      return 'f5';
    case 'WORKER':
    default:
      return 'f7';
  }
}