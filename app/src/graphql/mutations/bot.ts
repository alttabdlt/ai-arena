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

export const DELETE_BOT = gql`
  mutation DeleteBot($botId: String!) {
    deleteBot(botId: $botId) {
      success
      message
      deletedBotId
      metaverseDeleted
    }
  }
`;