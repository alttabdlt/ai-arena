import { gql } from '@apollo/client';

// Bot fragments
export const BOT_FRAGMENT = gql`
  fragment BotFields on Bot {
    id
    tokenId
    name
    avatar
    prompt
    personality
    isActive
    isDemo
    createdAt
    updatedAt
    creator {
      id
    }
    stats {
      power
      defense
      speed
      intelligence
      psyche
      energy
    }
    socialStats {
      likes
      comments
      followers
    }
    experience {
      id
      level
      currentXP
      totalXP
      xpToNextLevel
    }
    character
  }
`;

// User queries
export const GET_USER = gql`
  query GetUser($address: String!) {
    user(address: $address) {
      id
      address
      kycTier
      createdAt
      bots {
        ...BotFields
      }
    }
  }
  ${BOT_FRAGMENT}
`;

export const GET_ME = gql`
  query GetMe {
    me {
      id
      address
      kycTier
      createdAt
    }
  }
`;

// Bot queries
export const GET_BOT = gql`
  query GetBot($id: String!) {
    bot(id: $id) {
      ...BotFields
    }
  }
  ${BOT_FRAGMENT}
`;

export const GET_BOTS = gql`
  query GetBots($filter: BotFilter, $sort: BotSort, $limit: Int, $offset: Int) {
    bots(filter: $filter, sort: $sort, limit: $limit, offset: $offset) {
      ...BotFields
    }
  }
  ${BOT_FRAGMENT}
`;

export const GET_TRENDING_BOTS = gql`
  query GetTrendingBots($limit: Int) {
    trendingBots(limit: $limit) {
      ...BotFields
    }
  }
  ${BOT_FRAGMENT}
`;

export const GET_RECENT_LAUNCHES = gql`
  query GetRecentLaunches($limit: Int) {
    recentLaunches(limit: $limit) {
      ...BotFields
    }
  }
  ${BOT_FRAGMENT}
`;

// Tournament queries
export const GET_TOURNAMENT = gql`
  query GetTournament($id: String!) {
    tournament(id: $id) {
      id
      name
      type
      status
      entryFee
      prizePool
      startTime
      endTime
      participants {
        id
        bot {
          ...BotFields
        }
        score
        rank
      }
      createdAt
    }
  }
  ${BOT_FRAGMENT}
`;

export const GET_TOURNAMENTS = gql`
  query GetTournaments($type: TournamentType, $status: TournamentStatus, $limit: Int, $offset: Int) {
    tournaments(type: $type, status: $status, limit: $limit, offset: $offset) {
      id
      name
      type
      status
      entryFee
      prizePool
      startTime
      endTime
      createdAt
    }
  }
`;

export const GET_UPCOMING_TOURNAMENTS = gql`
  query GetUpcomingTournaments($limit: Int) {
    upcomingTournaments(limit: $limit) {
      id
      name
      type
      status
      entryFee
      prizePool
      startTime
      endTime
    }
  }
`;

// Analytics queries
export const GET_PLATFORM_STATS = gql`
  query GetPlatformStats {
    platformStats {
      totalBots
      totalVolume
      totalUsers
      activeUsers24h
      graduatedBots
      avgGraduationTime
    }
  }
`;

export const GET_USER_PORTFOLIO = gql`
  query GetUserPortfolio($address: String!) {
    userPortfolio(address: $address) {
      totalValue
      totalPnL
      totalPnLPercent
      holdings {
        bot {
          ...BotFields
        }
        amount
        avgPrice
        currentValue
        pnl
        pnlPercent
      }
    }
  }
  ${BOT_FRAGMENT}
`;

// AI Evaluation queries
export const GET_MODEL_EVALUATIONS = gql`
  query GetModelEvaluations {
    getModelEvaluations {
      modelName
      handsPlayed
      handMisreads {
        handNumber
        actual
        aiThought
        holeCards
        boardCards
        phase
      }
      illogicalDecisions {
        handNumber
        decision
        reason
        gameState {
          pot
          toCall
          canCheck
        }
      }
      misreadRate
      illogicalRate
    }
  }
`;

export const GET_MODEL_EVALUATION = gql`
  query GetModelEvaluation($model: String!) {
    getModelEvaluation(model: $model) {
      modelName
      handsPlayed
      handMisreads {
        handNumber
        actual
        aiThought
        holeCards
        boardCards
        phase
      }
      illogicalDecisions {
        handNumber
        decision
        reason
        gameState {
          pot
          toCall
          canCheck
        }
      }
      misreadRate
      illogicalRate
    }
  }
`;