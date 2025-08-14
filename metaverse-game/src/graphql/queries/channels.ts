import { gql } from '@apollo/client';

export const GET_MY_CHANNELS = gql`
  query GetMyChannels {
    myBotChannels {
      id
      name
      type
      status
      currentBots
      maxBots
      loadPercentage
      worldId
      region
      description
    }
  }
`;

export const GET_ALL_CHANNELS = gql`
  query GetAllChannels {
    channels(status: ACTIVE) {
      id
      name
      type
      status
      currentBots
      maxBots
      loadPercentage
      worldId
      region
      description
    }
  }
`;

export const GET_CHANNEL = gql`
  query GetChannel($name: String!) {
    channelByName(name: $name) {
      id
      name
      type
      status
      currentBots
      maxBots
      loadPercentage
      worldId
      region
      description
    }
  }
`;