import { gql } from '@apollo/client';

export const GET_BOT_ENERGY = gql`
  query GetBotEnergy($botId: String!) {
    botEnergy(botId: $botId) {
      currentEnergy
      maxEnergy
      isPaused
      consumptionRate
      regenerationRate
      netConsumption
    }
  }
`;

export const GET_USER_BOTS_ENERGY = gql`
  query GetUserBotsEnergy {
    userBotsEnergy {
      botId
      botName
      modelType
      currentEnergy
      maxEnergy
      isPaused
      consumptionRate
    }
  }
`;

export const GET_ENERGY_PURCHASE_HISTORY = gql`
  query GetEnergyPurchaseHistory($botId: String!) {
    energyPurchaseHistory(botId: $botId) {
      id
      botId
      energyAmount
      hypeSpent
      packType
      txHash
      purchasedAt
    }
  }
`;