import { gql } from '@apollo/client';
import { BOT_FRAGMENT } from './queries';

// Bot mutations
export const CREATE_BOT = gql`
  mutation AdoptCompanion($input: AdoptCompanionInput!) {
    adoptCompanion(input: $input) {
      ...BotFields
    }
  }
  ${BOT_FRAGMENT}
`;

export const BUY_BOT = gql`
  mutation BuyBot($input: BuyBotInput!) {
    buyBot(input: $input) {
      id
      type
      amount
      price
      totalCost
      txHash
      createdAt
    }
  }
`;

export const SELL_BOT = gql`
  mutation SellBot($input: SellBotInput!) {
    sellBot(input: $input) {
      id
      type
      amount
      price
      totalCost
      txHash
      createdAt
    }
  }
`;

// Tournament mutations
export const ENTER_TOURNAMENT = gql`
  mutation EnterTournament($tournamentId: String!, $botId: String!) {
    enterTournament(tournamentId: $tournamentId, botId: $botId) {
      id
      tournament {
        id
        name
      }
      bot {
        id
        name
      }
      createdAt
    }
  }
`;

// Social mutations
export const LIKE_BOT = gql`
  mutation LikeBot($botId: String!) {
    likeBot(botId: $botId) {
      id
      socialStats {
        likes
        comments
        followers
      }
    }
  }
`;

export const UNLIKE_BOT = gql`
  mutation UnlikeBot($botId: String!) {
    unlikeBot(botId: $botId) {
      id
      socialStats {
        likes
        comments
        followers
      }
    }
  }
`;

export const COMMENT_ON_BOT = gql`
  mutation CommentOnBot($botId: String!, $content: String!) {
    commentOnBot(botId: $botId, content: $content) {
      id
      content
      user {
        id
        address
      }
      bot {
        id
      }
      createdAt
    }
  }
`;

export const FOLLOW_USER = gql`
  mutation FollowUser($address: String!) {
    followUser(address: $address) {
      id
      address
    }
  }
`;

export const UNFOLLOW_USER = gql`
  mutation UnfollowUser($address: String!) {
    unfollowUser(address: $address) {
      id
      address
    }
  }
`;

// KYC mutations
export const COMPLETE_KYC_TIER = gql`
  mutation CompleteKYCTier($tier: Int!) {
    completeKYCTier(tier: $tier) {
      id
      address
      kycTier
    }
  }
`;