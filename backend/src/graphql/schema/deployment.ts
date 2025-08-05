import { gql } from 'graphql-tag';

export const deploymentTypeDefs = gql`
  type DeploymentStatus {
    worldsReady: Boolean!
    totalBots: Int!
    deployedBots: Int!
    pendingBots: Int!
    failedBots: Int!
    lastDeploymentAt: DateTime
    errors: [String!]!
  }

  type DeploymentResult {
    success: Boolean!
    message: String!
    deployed: Int!
    failed: Int!
    errors: [DeploymentError!]!
  }

  type DeploymentError {
    botId: String!
    botName: String!
    error: String!
    timestamp: DateTime!
  }

  type CleanupResult {
    success: Boolean!
    message: String!
    invalidSyncsCleared: Int!
    botsReset: Int!
  }

  type WorldStatus {
    zone: String!
    worldId: String!
    active: Boolean!
    botCount: Int!
    createdAt: DateTime!
  }

  extend type Query {
    # Get overall deployment status
    getDeploymentStatus: DeploymentStatus!
    
    # Get world instances status
    getWorldsStatus: [WorldStatus!]!
    
    # Check if a specific bot is deployed
    isBotDeployed(botId: ID!): Boolean!
    
    # Get failed deployments
    getFailedDeployments: [DeploymentError!]!
  }

  extend type Mutation {
    # Deploy all undeployed bots
    deployAllBots(force: Boolean = false): DeploymentResult!
    
    # Deploy a specific bot to metaverse
    deployBotToMetaverse(botId: ID!, retryIfFailed: Boolean = false): RegisterBotResponse!
    
    # Cleanup invalid bot syncs
    cleanupInvalidSyncs: CleanupResult!
    
    # Initialize world instances
    initializeWorlds: DeploymentResult!
    
    # Retry all failed deployments
    retryFailedDeployments: DeploymentResult!
    
    # Reset bot deployment (for debugging)
    resetBotDeployment(botId: ID!): RegisterBotResponse!
  }
`;