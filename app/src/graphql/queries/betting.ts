import { gql } from '@apollo/client';

// Query to get unclaimed winnings for a specific bot
export const GET_UNCLAIMED_WINNINGS = gql`
  query GetUnclaimedWinnings($botId: String!) {
    myBets(companionId: $botId, status: WON) {
      id
      amount
      actualPayout
      status
      tournament {
        id
        gameType
        startTime
      }
      participant {
        id
        name
        aiModel
      }
    }
  }
`;

// Mutation to claim winnings from a bet
export const CLAIM_WINNINGS = gql`
  mutation ClaimWinnings($betId: String!) {
    claimWinnings(betId: $betId) {
      id
      xpClaimed
      newBalance
      companionId
    }
  }
`;

// Mutation to update bot experience
export const UPDATE_BOT_EXPERIENCE = gql`
  mutation UpdateBotExperience($botId: ID!, $xpGained: Int!) {
    updateBotExperience(botId: $botId, xpGained: $xpGained) {
      id
      level
      currentXP
      totalXP
      xpToNextLevel
    }
  }
`;

// Query to check for any unclaimed winnings across all bots
export const CHECK_ALL_UNCLAIMED_WINNINGS = gql`
  query CheckAllUnclaimedWinnings {
    myBets(status: WON) {
      id
      botId
      amount
      actualPayout
      status
      tournament {
        id
        gameType
        startTime
      }
    }
  }
`;