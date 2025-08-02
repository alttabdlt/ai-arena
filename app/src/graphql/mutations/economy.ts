import { gql } from '@apollo/client';

export const OPEN_LOOTBOX = gql`
  mutation OpenLootbox($lootboxId: ID!) {
    openLootbox(lootboxId: $lootboxId) {
      id
      equipmentRewards
      furnitureRewards
      currencyReward
      opened
      openedAt
    }
  }
`;

export const TOGGLE_EQUIPMENT = gql`
  mutation ToggleEquipment($equipmentId: ID!, $equipped: Boolean!) {
    toggleEquipment(equipmentId: $equipmentId, equipped: $equipped) {
      id
      equipped
      bot {
        id
        equipment {
          id
          equipped
          powerBonus
          defenseBonus
        }
      }
    }
  }
`;

export const PLACE_FURNITURE = gql`
  mutation PlaceFurniture($furnitureId: ID!, $position: JSON!) {
    placeFurniture(furnitureId: $furnitureId, position: $position) {
      id
      position
      house {
        id
        houseScore
        furniture {
          id
          position
        }
      }
    }
  }
`;

export const ATTEMPT_ROBBERY = gql`
  mutation AttemptRobbery($robberId: ID!, $victimId: ID!) {
    attemptRobbery(robberId: $robberId, victimId: $victimId) {
      success
      robberId
      victimId
      powerUsed
      defenseFaced
      lootValue
      itemsStolen
      message
    }
  }
`;

export const CREATE_TRADE = gql`
  mutation CreateTrade(
    $initiatorBotId: ID!
    $receiverBotId: ID!
    $offeredItems: JSON!
    $requestedItems: JSON!
  ) {
    createTrade(
      initiatorBotId: $initiatorBotId
      receiverBotId: $receiverBotId
      offeredItems: $offeredItems
      requestedItems: $requestedItems
    ) {
      id
      status
      createdAt
    }
  }
`;

export const RESPOND_TO_TRADE = gql`
  mutation RespondToTrade($tradeId: ID!, $accept: Boolean!) {
    respondToTrade(tradeId: $tradeId, accept: $accept) {
      id
      status
      completedAt
    }
  }
`;

export const UPDATE_HOUSE_SCORE = gql`
  mutation UpdateHouseScore($botId: ID!) {
    updateHouseScore(botId: $botId) {
      botId
      oldScore
      newScore
      factors
    }
  }
`;

export const INITIALIZE_BOT_HOUSE = gql`
  mutation InitializeBotHouse($botId: ID!) {
    initializeBotHouse(botId: $botId) {
      id
      botId
      houseScore
      defenseLevel
      worldPosition
      createdAt
    }
  }
`;