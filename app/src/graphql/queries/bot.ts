import { gql } from '@apollo/client';

export const GET_BOT_DETAIL = gql`
  query GetBotDetail($id: String!) {
    bot(id: $id) {
      id
      name
      avatar
      prompt
      modelType
      isActive
      createdAt
      updatedAt
      creator {
        id
        address
        username
      }
      stats {
        wins
        losses
        earnings
        winRate
        avgFinishPosition
      }
      socialStats {
        likes
        comments
        followers
      }
      queuePosition
      queueEntries {
        id
        queueType
        status
        enteredAt
        expiresAt
      }
    }
  }
`;

export const GET_BOT_MATCHES = gql`
  query GetBotMatches($botId: String!, $limit: Int, $offset: Int) {
    matches(filter: { botId: $botId }, limit: $limit, offset: $offset) {
      id
      type
      status
      createdAt
      completedAt
      participants {
        bot {
          id
          name
          avatar
        }
        finalRank
        points
      }
      result {
        winner {
          id
          name
        }
        duration
        totalHands
      }
    }
  }
`;