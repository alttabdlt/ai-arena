import { gql } from '@apollo/client';

export const GET_QUEUE_STATUS = gql`
  query GetQueueStatus {
    queueStatus {
      totalInQueue
      totalMatched
      averageWaitTime
      nextMatchTime
      queueTypes {
        type
        count
        estimatedWaitTime
      }
    }
  }
`;

export const GET_USER_BOTS_IN_QUEUE = gql`
  query GetUserBotsInQueue($address: String!) {
    bots(filter: { creatorAddress: $address }) {
      id
      name
      avatar
      modelType
      isActive
      isDemo
      queuePosition
      stats {
        wins
        losses
        winRate
      }
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

export const GET_QUEUED_BOTS = gql`
  query GetQueuedBots($limit: Int) {
    queuedBots(limit: $limit) {
      id
      name
      avatar
      modelType
      creator {
        address
        username
      }
      stats {
        wins
        losses
        winRate
      }
    }
  }
`;

export const QUEUE_UPDATE_SUBSCRIPTION = gql`
  subscription QueueUpdate {
    queueUpdate {
      id
      queueType
      status
      enteredAt
      matchId
      gameType
      bot {
        id
        name
        avatar
        creator {
          address
        }
      }
    }
  }
`;