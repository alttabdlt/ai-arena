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
      modelType
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
  modelType?: string;
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
  
  // For demo, use mock data if GraphQL fails
  const { data, loading, error } = useQuery(GET_ALL_BOTS, {
    pollInterval: 30000, // Poll every 30 seconds
    onError: (error) => {
      console.error('Failed to fetch bots:', error);
      // Use mock data as fallback
      setBots([
        {
          id: 'bot-1',
          name: 'Alpha Bot',
          level: 5,
          personality: 'CRIMINAL',
          isActive: true,
          character: 'f1'
        },
        {
          id: 'bot-2',
          name: 'Beta Bot',
          level: 3,
          personality: 'GAMBLER',
          isActive: true,
          character: 'f5'
        },
        {
          id: 'bot-3',
          name: 'Gamma Bot',
          level: 7,
          personality: 'WORKER',
          isActive: true,
          character: 'f7'
        }
      ]);
    }
  });

  useEffect(() => {
    if (data?.bots) {
      // Map bots from GraphQL response
      const mappedBots = data.bots.map((bot: any) => ({
        id: bot.id,
        name: bot.name,
        avatar: bot.avatar,
        level: bot.experience?.level || 1,
        personality: bot.personality,
        modelType: bot.modelType,
        isActive: bot.isActive,
        character: bot.character || getCharacterForPersonality(bot.personality),
        experience: bot.experience
      }));
      setBots(mappedBots);
    }
  }, [data]);

  return {
    bots: bots.filter(b => b.isActive), // Only show active bots
    loading: loading && bots.length === 0,
    error
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