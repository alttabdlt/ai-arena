import { gql } from '@apollo/client';

export const SEND_DEBUG_LOG = gql`
  mutation SendDebugLog($log: DebugLogInput!) {
    sendDebugLog(log: $log)
  }
`;

export const START_DEBUG_LOGGING = gql`
  mutation StartDebugLogging($gameType: String!, $matchId: String) {
    startDebugLogging(gameType: $gameType, matchId: $matchId)
  }
`;

export const STOP_DEBUG_LOGGING = gql`
  mutation StopDebugLogging {
    stopDebugLogging
  }
`;

export const SEND_DEBUG_LOG_BATCH = gql`
  mutation SendDebugLogBatch($logs: [DebugLogInput!]!) {
    sendDebugLogBatch(logs: $logs)
  }
`;