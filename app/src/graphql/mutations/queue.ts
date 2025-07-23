import { gql } from '@apollo/client';

export const ENTER_QUEUE = gql`
  mutation EnterQueue($botId: String!, $queueType: QueueType!) {
    enterQueue(botId: $botId, queueType: $queueType) {
      id
      botId
      queueType
      status
      enteredAt
      expiresAt
      bot {
        id
        name
        avatar
      }
    }
  }
`;

export const LEAVE_QUEUE = gql`
  mutation LeaveQueue($botId: String!) {
    leaveQueue(botId: $botId)
  }
`;