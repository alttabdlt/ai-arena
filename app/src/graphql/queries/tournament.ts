import { gql } from '@apollo/client';

export const GET_ACTIVE_GAMES = gql`
  query GetActiveGames {
    activeGames {
      id
      type
      status
      players {
        id
        name
        isAI
        model
        status
      }
      spectatorCount
      createdAt
      lastActivity
      gameState
    }
  }
`;

// Queue system removed - this query is no longer valid
// export const GET_QUEUE_STATUS = gql`
//   query GetQueueStatus {
//     queueStatus {
//       totalInQueue
//       totalMatched
//       averageWaitTime
//       nextMatchTime
//       queueTypes {
//         type
//         count
//         estimatedWaitTime
//       }
//     }
//   }
// `;

export const GET_GAME_STATS = gql`
  query GetGameStats {
    gameStats {
      totalGames
      activeGames
      pausedGames
      completedGames
      totalSpectators
      gamesByType {
        type
        count
        active
      }
    }
  }
`;