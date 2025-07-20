import { gql } from '@apollo/client';

// Price update subscription
export const PRICE_UPDATE_SUBSCRIPTION = gql`
  subscription PriceUpdate($botId: String!) {
    priceUpdate(botId: $botId) {
      botId
      price
      marketCap
      volume24h
      holders
      timestamp
    }
  }
`;

// All price updates subscription
export const ALL_PRICE_UPDATES_SUBSCRIPTION = gql`
  subscription AllPriceUpdates {
    allPriceUpdates {
      botId
      price
      marketCap
      volume24h
      holders
      timestamp
    }
  }
`;

// Graduation event subscription
export const GRADUATION_EVENT_SUBSCRIPTION = gql`
  subscription GraduationEvent {
    graduationEvent {
      botId
      botName
      finalPrice
      totalRaised
      holders
      timestamp
    }
  }
`;

// Tournament update subscription
export const TOURNAMENT_UPDATE_SUBSCRIPTION = gql`
  subscription TournamentUpdate($tournamentId: String!) {
    tournamentUpdate(tournamentId: $tournamentId) {
      id
      status
      participants {
        id
        bot {
          id
          name
        }
        score
        rank
      }
    }
  }
`;