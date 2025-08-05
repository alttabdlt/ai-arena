import { gql } from '@apollo/client';

export const GET_DEPLOYMENT_STATUS = gql`
  query GetDeploymentStatus {
    getDeploymentStatus {
      worldsReady
      totalBots
      deployedBots
      pendingBots
      failedBots
      lastDeploymentAt
      errors
    }
  }
`;

export const GET_WORLDS_STATUS = gql`
  query GetWorldsStatus {
    getWorldsStatus {
      zone
      worldId
      active
      botCount
      createdAt
    }
  }
`;

export const GET_FAILED_DEPLOYMENTS = gql`
  query GetFailedDeployments {
    getFailedDeployments {
      botId
      botName
      error
      timestamp
    }
  }
`;

export const DEPLOY_ALL_BOTS = gql`
  mutation DeployAllBots($force: Boolean) {
    deployAllBots(force: $force) {
      success
      message
      deployed
      failed
      errors {
        botId
        botName
        error
        timestamp
      }
    }
  }
`;

export const CLEANUP_INVALID_SYNCS = gql`
  mutation CleanupInvalidSyncs {
    cleanupInvalidSyncs {
      success
      message
      invalidSyncsCleared
      botsReset
    }
  }
`;

export const INITIALIZE_WORLDS = gql`
  mutation InitializeWorlds {
    initializeWorlds {
      success
      message
      deployed
      failed
      errors {
        botId
        botName
        error
        timestamp
      }
    }
  }
`;

export const RETRY_FAILED_DEPLOYMENTS = gql`
  mutation RetryFailedDeployments {
    retryFailedDeployments {
      success
      message
      deployed
      failed
      errors {
        botId
        botName
        error
        timestamp
      }
    }
  }
`;