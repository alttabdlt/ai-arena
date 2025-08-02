import { gql } from '@apollo/client';

// Queries
export const GET_BOT_EQUIPMENT = gql`
  query GetBotEquipment($botId: ID!) {
    getBotEquipment(botId: $botId) {
      id
      name
      equipmentType
      rarity
      powerBonus
      defenseBonus
      equipped
      metadata
      createdAt
    }
  }
`;

export const GET_BOT_HOUSE = gql`
  query GetBotHouse($botId: ID!) {
    getBotHouse(botId: $botId) {
      id
      houseScore
      defenseLevel
      lastRobbed
      robberyCooldown
      worldPosition
      furniture {
        id
        name
        furnitureType
        rarity
        scoreBonus
        defenseBonus
        position
        metadata
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_BOT_ACTIVITY_SCORE = gql`
  query GetBotActivityScore($botId: ID!) {
    getBotActivityScore(botId: $botId) {
      id
      matchesPlayed
      lootboxesOpened
      socialInteractions
      successfulRobberies
      defenseSuccesses
      tradesCompleted
      lastActive
    }
  }
`;

export const GET_PENDING_LOOTBOXES = gql`
  query GetPendingLootboxes($botId: ID!) {
    getPendingLootboxes(botId: $botId) {
      id
      matchId
      lootboxRarity
      equipmentRewards
      furnitureRewards
      currencyReward
      opened
      createdAt
    }
  }
`;

export const GET_ROBBERY_LOGS = gql`
  query GetRobberyLogs($botId: ID!, $role: String) {
    getRobberyLogs(botId: $botId, role: $role) {
      id
      robberBot {
        id
        name
        avatar
      }
      victimBot {
        id
        name
        avatar
      }
      success
      powerUsed
      defenseFaced
      lootValue
      itemsStolen
      timestamp
    }
  }
`;

export const GET_BOT_TRADES = gql`
  query GetBotTrades($botId: ID!, $status: String) {
    getBotTrades(botId: $botId, status: $status) {
      id
      initiatorBot {
        id
        name
        avatar
      }
      receiverBot {
        id
        name
        avatar
      }
      offeredItems
      requestedItems
      status
      createdAt
    }
  }
`;

export const CALCULATE_ROBBING_POWER = gql`
  query CalculateRobbingPower($botId: ID!) {
    calculateRobbingPower(botId: $botId)
  }
`;

export const CALCULATE_DEFENSE_LEVEL = gql`
  query CalculateDefenseLevel($botId: ID!) {
    calculateDefenseLevel(botId: $botId)
  }
`;

export const GET_HOUSE_LEADERBOARD = gql`
  query GetHouseLeaderboard($limit: Int) {
    getHouseLeaderboard(limit: $limit) {
      id
      bot {
        id
        name
        avatar
        creator {
          username
        }
      }
      houseScore
      defenseLevel
      furniture {
        id
        rarity
      }
    }
  }
`;

// Subscriptions
export const ROBBERY_ATTEMPTED_SUBSCRIPTION = gql`
  subscription RobberyAttempted($botId: ID!) {
    robberyAttempted(botId: $botId) {
      id
      robberBot {
        id
        name
        avatar
      }
      success
      lootValue
      itemsStolen
      timestamp
    }
  }
`;

export const TRADE_RECEIVED_SUBSCRIPTION = gql`
  subscription TradeReceived($botId: ID!) {
    tradeReceived(botId: $botId) {
      id
      initiatorBot {
        id
        name
        avatar
      }
      offeredItems
      requestedItems
      status
      createdAt
    }
  }
`;

export const HOUSE_SCORE_UPDATED_SUBSCRIPTION = gql`
  subscription HouseScoreUpdated($botId: ID!) {
    houseScoreUpdated(botId: $botId) {
      botId
      oldScore
      newScore
      factors
    }
  }
`;