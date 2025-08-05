import { GraphQLClient } from 'graphql-request';

// Create GraphQL client pointing to AI Arena backend
export const graphqlClient = new GraphQLClient('http://localhost:4000/graphql', {
  credentials: 'include', // Include cookies for auth
  headers: {
    'Content-Type': 'application/json',
  },
});

// Bot query to fetch user's bots
export const GET_USER_BOTS_QUERY = `
  query GetUserBots($userAddress: String!) {
    user(address: $userAddress) {
      id
      address
      bots {
        id
        tokenId
        name
        avatar
        personality
        modelType
        isActive
        stats {
          wins
          losses
        }
        botSync {
          id
          syncStatus
          convexAgentId
        }
        metaverseAgentId
        currentZone
      }
    }
  }
`;

// Types for the query response
export interface BotStats {
  wins: number;
  losses: number;
}

export interface BotSync {
  id: string;
  syncStatus: 'SYNCED' | 'SYNCING' | 'PENDING' | 'FAILED';
  convexAgentId?: string;
}

export interface Bot {
  id: string;
  tokenId: number;
  name: string;
  avatar: string;
  personality: 'CRIMINAL' | 'GAMBLER' | 'WORKER';
  modelType: string;
  isActive: boolean;
  stats: BotStats;
  botSync?: BotSync;
  metaverseAgentId?: string;
  currentZone?: string;
}

export interface UserBotsResponse {
  user: {
    id: string;
    address: string;
    bots: Bot[];
  } | null;
}