import { gql } from '@apollo/client';

export const DEPLOY_BOT = gql`
  mutation DeployBot($input: DeployBotInput!) {
    deployBot(input: $input) {
      id
      name
      avatar
      prompt
      modelType
      isActive
      stats {
        wins
        losses
        earnings
        winRate
        avgFinishPosition
      }
      creator {
        id
        address
        username
      }
      queuePosition
      createdAt
    }
  }
`;