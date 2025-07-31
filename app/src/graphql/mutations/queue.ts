import { gql } from '@apollo/client';

export const ENTER_QUEUE = gql`
  mutation EnterQueue($botId: String!, $queueType: QueueType!) {
    enterQueue(botId: $botId, queueType: $queueType) {
      id
      queueType
      status
      enteredAt
      expiresAt
      bot {
        id
        name
        avatar
      }
    }
  }
`;

export const LEAVE_QUEUE = gql`
  mutation LeaveQueue($botId: String!) {
    leaveQueue(botId: $botId)
  }
`;

export const SIGNAL_FRONTEND_READY = gql`
  mutation SignalFrontendReady($matchId: String!) {
    signalFrontendReady(matchId: $matchId)
  }
`;

export const START_REVERSE_HANGMAN_ROUND = gql`
  mutation StartReverseHangmanRound($matchId: String!, $difficulty: String!) {
    startReverseHangmanRound(matchId: $matchId, difficulty: $difficulty)
  }
`;