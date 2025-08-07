import { gql } from '@apollo/client';

export const PURCHASE_ENERGY = gql`
  mutation PurchaseEnergy($botId: String!, $packType: String!, $txHash: String!) {
    purchaseEnergy(botId: $botId, packType: $packType, txHash: $txHash) {
      success
      message
    }
  }
`;

export const PAUSE_BOT = gql`
  mutation PauseBot($botId: String!) {
    pauseBot(botId: $botId) {
      success
      message
    }
  }
`;

export const RESUME_BOT = gql`
  mutation ResumeBot($botId: String!) {
    resumeBot(botId: $botId) {
      success
      message
    }
  }
`;