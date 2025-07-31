import { useEffect } from 'react';
import { useSubscription, gql } from '@apollo/client';

const DEBUG_LOG_SUBSCRIPTION = gql`
  subscription DebugLog {
    debugLog {
      timestamp
      level
      source
      message
      data
      stack
    }
  }
`;

export function DebugSubscriptionListener() {
  const { data, error } = useSubscription(DEBUG_LOG_SUBSCRIPTION, {
    skip: false,
    onSubscriptionData: ({ subscriptionData }) => {
      if (subscriptionData.data?.debugLog) {
        // Dispatch backend log to debugLogger
        window.dispatchEvent(new CustomEvent('backend-log', {
          detail: subscriptionData.data.debugLog
        }));
      }
    },
    onError: (error) => {
      // Only log if it's not a "field doesn't exist" error
      if (!error.message.includes('debugLog')) {
        console.error('Debug subscription error:', error);
      }
    }
  });

  return null;
}