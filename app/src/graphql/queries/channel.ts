import { gql } from '@apollo/client';

export const GET_CHANNELS = gql`
  query GetChannels($type: ChannelType, $status: ChannelStatus) {
    channels(type: $type, status: $status) {
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
    channel(name: $name) {
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

export const GET_MY_BOT_CHANNELS = gql`
  query GetMyBotChannels {
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

export const SWITCH_CHANNEL = gql`
  mutation SwitchChannel($botId: String!, $channelName: String!) {
    switchChannel(botId: $botId, channelName: $channelName) {
      id
      name
      channel
      isActive
    }
  }
`;