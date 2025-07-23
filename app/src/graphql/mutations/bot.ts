import { gql } from '@apollo/client';

export const TOGGLE_BOT_ACTIVE = gql`
  mutation ToggleBotActive($botId: String!) {
    toggleBotActive(botId: $botId) {
      id
      name
      isActive
    }
  }
`;

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