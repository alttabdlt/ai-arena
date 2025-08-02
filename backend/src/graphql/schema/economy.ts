import { gql } from 'graphql-tag';

export const economyTypeDefs = gql`
  # Enums
  enum EquipmentType {
    WEAPON
    ARMOR
    TOOL
    ACCESSORY
  }

  enum ItemRarity {
    COMMON
    UNCOMMON
    RARE
    EPIC
    LEGENDARY
  }

  enum FurnitureType {
    DECORATION
    FUNCTIONAL
    DEFENSIVE
    TROPHY
  }

  enum TradeStatus {
    PENDING
    ACCEPTED
    REJECTED
    CANCELLED
    EXPIRED
  }

  # Types
  type BotEquipment {
    id: ID!
    botId: ID!
    bot: Bot!
    name: String!
    equipmentType: EquipmentType!
    rarity: ItemRarity!
    powerBonus: Int!
    defenseBonus: Int!
    equipped: Boolean!
    metadata: JSON!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type BotHouse {
    id: ID!
    botId: ID!
    bot: Bot!
    houseScore: Int!
    defenseLevel: Int!
    lastRobbed: DateTime
    robberyCooldown: DateTime
    worldPosition: JSON!
    furniture: [Furniture!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Furniture {
    id: ID!
    houseId: ID!
    house: BotHouse!
    name: String!
    furnitureType: FurnitureType!
    rarity: ItemRarity!
    scoreBonus: Int!
    defenseBonus: Int!
    position: JSON!
    metadata: JSON!
    createdAt: DateTime!
  }

  type RobberyLog {
    id: ID!
    robberBotId: ID!
    robberBot: Bot!
    victimBotId: ID!
    victimBot: Bot!
    success: Boolean!
    powerUsed: Int!
    defenseFaced: Int!
    lootValue: Int!
    itemsStolen: JSON!
    timestamp: DateTime!
  }

  type BotActivityScore {
    id: ID!
    botId: ID!
    bot: Bot!
    matchesPlayed: Int!
    lootboxesOpened: Int!
    socialInteractions: Int!
    successfulRobberies: Int!
    defenseSuccesses: Int!
    tradesCompleted: Int!
    lastActive: DateTime!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type LootboxReward {
    id: ID!
    matchId: ID!
    match: Match!
    botId: ID!
    bot: Bot!
    lootboxRarity: ItemRarity!
    equipmentRewards: JSON!
    furnitureRewards: JSON!
    currencyReward: Int!
    opened: Boolean!
    openedAt: DateTime
    createdAt: DateTime!
  }

  type Trade {
    id: ID!
    initiatorBotId: ID!
    initiatorBot: Bot!
    receiverBotId: ID!
    receiverBot: Bot!
    offeredItems: JSON!
    requestedItems: JSON!
    status: String!
    completedAt: DateTime
    createdAt: DateTime!
  }

  type RobberyAttemptResult {
    success: Boolean!
    robberId: ID!
    victimId: ID!
    powerUsed: Int!
    defenseFaced: Int!
    lootValue: Int!
    itemsStolen: JSON!
    message: String!
  }

  type HouseScoreUpdate {
    botId: ID!
    oldScore: Int!
    newScore: Int!
    factors: JSON!
  }

  # Queries
  extend type Query {
    # Get bot's equipment
    getBotEquipment(botId: ID!): [BotEquipment!]!
    
    # Get bot's house
    getBotHouse(botId: ID!): BotHouse
    
    # Get bot's activity score
    getBotActivityScore(botId: ID!): BotActivityScore
    
    # Get pending lootbox rewards
    getPendingLootboxes(botId: ID!): [LootboxReward!]!
    
    # Get robbery logs
    getRobberyLogs(botId: ID!, role: String): [RobberyLog!]!
    
    # Get trades
    getBotTrades(botId: ID!, status: String): [Trade!]!
    
    # Calculate robbing power
    calculateRobbingPower(botId: ID!): Int!
    
    # Calculate defense level
    calculateDefenseLevel(botId: ID!): Int!
    
    # Get house leaderboard
    getHouseLeaderboard(limit: Int): [BotHouse!]!
  }

  # Mutations
  extend type Mutation {
    # Open lootbox
    openLootbox(lootboxId: ID!): LootboxReward!
    
    # Equip/unequip item
    toggleEquipment(equipmentId: ID!, equipped: Boolean!): BotEquipment!
    
    # Place furniture
    placeFurniture(furnitureId: ID!, position: JSON!): Furniture!
    
    # Attempt robbery
    attemptRobbery(robberId: ID!, victimId: ID!): RobberyAttemptResult!
    
    # Create trade
    createTrade(
      initiatorBotId: ID!
      receiverBotId: ID!
      offeredItems: JSON!
      requestedItems: JSON!
    ): Trade!
    
    # Respond to trade
    respondToTrade(tradeId: ID!, accept: Boolean!): Trade!
    
    # Update house score
    updateHouseScore(botId: ID!): HouseScoreUpdate!
    
    # Initialize bot house
    initializeBotHouse(botId: ID!): BotHouse!
  }

  # Subscriptions
  extend type Subscription {
    # Listen for robbery attempts on your bot
    robberyAttempted(botId: ID!): RobberyLog!
    
    # Listen for trade offers
    tradeReceived(botId: ID!): Trade!
    
    # Listen for house score updates
    houseScoreUpdated(botId: ID!): HouseScoreUpdate!
  }
`;