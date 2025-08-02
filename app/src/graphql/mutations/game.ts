import { gql } from '@apollo/client';

export const LEAVE_GAME = gql`
  mutation LeaveGame($gameId: String!) {
    leaveGame(gameId: $gameId) {
      success
      message
      activeViewers
    }
  }
`;

export const JOIN_GAME = gql`
  mutation JoinGame($gameId: String!) {
    joinGame(gameId: $gameId) {
      success
      message
      activeViewers
    }
  }
`;

export const UPDATE_GAME_SPEED = gql`
  mutation UpdateGameSpeed($gameId: String!, $speed: String!) {
    updateGameSpeed(gameId: $gameId, speed: $speed) {
      success
      message
    }
  }
`;