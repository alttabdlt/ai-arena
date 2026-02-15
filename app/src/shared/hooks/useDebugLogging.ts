import { useEffect } from 'react';
import { useApolloClient } from '@apollo/client';
import { debugLogger } from '@shared/services/debugLogger';

interface GraphQLOperation {
  query?: {
    definitions?: Array<{
      operation?: string;
    }>;
  };
  operationName?: string;
  variables?: unknown;
}

interface ApolloLinkWithRequest {
  request?: (...args: unknown[]) => unknown;
  subscriptionClient?: WebSocketClientLike;
}

interface WebSocketClientLike {
  onMessage?: (message: unknown) => unknown;
}

interface ApolloClientWithSocket {
  wsClient?: WebSocketClientLike;
  link?: ApolloLinkWithRequest;
}

export function useDebugLogging(gameType: string) {
  const client = useApolloClient();

  useEffect(() => {
    // Start capturing logs
    debugLogger.startCapture(gameType);

    // Intercept Apollo Client operations
    const link = client.link as unknown as ApolloLinkWithRequest;
    
    // Log GraphQL operations
    const originalRequest = link.request;
    if (typeof originalRequest === 'function') {
      link.request = (...requestArgs: unknown[]) => {
        const operation = requestArgs[0] as GraphQLOperation | undefined;
        console.log('🔄 GraphQL Operation:', {
          type: operation?.query?.definitions?.[0]?.operation,
          name: operation?.operationName,
          variables: operation?.variables,
        });
        return originalRequest.call(link, ...requestArgs);
      };
    }

    // Intercept WebSocket messages
    const socketClient = client as unknown as ApolloClientWithSocket;
    const wsClient = socketClient.wsClient || socketClient.link?.subscriptionClient;
    if (wsClient) {
      const originalOnMessage = wsClient.onMessage;
      if (typeof originalOnMessage === 'function') {
        wsClient.onMessage = (message: unknown) => {
          window.dispatchEvent(new CustomEvent('websocket-log', {
            detail: {
              timestamp: new Date().toISOString(),
              level: 'info',
              message: 'WebSocket message received',
              data: message,
            }
          }));
          return originalOnMessage.call(wsClient, message);
        };
      }
    }

    // Cleanup on unmount
    return () => {
      // Don't stop capture on unmount - let it continue until explicitly stopped
    };
  }, [gameType, client]);
}

// Hook to listen for backend logs via WebSocket
export function useBackendLogListener() {
  useEffect(() => {
    // This would be connected to your backend WebSocket that streams logs
    // For now, we'll simulate it by parsing certain console messages
    
    const handleSubscriptionData = (event: Event) => {
      const customEvent = event as CustomEvent<{
        data?: {
          gameStateUpdate?: unknown;
        };
      }>;

      if (customEvent.detail?.data?.gameStateUpdate) {
        window.dispatchEvent(new CustomEvent('backend-log', {
          detail: {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'Game state update from backend',
            data: customEvent.detail.data,
          }
        }));
      }
    };

    window.addEventListener('apollo-subscription-data', handleSubscriptionData);

    return () => {
      window.removeEventListener('apollo-subscription-data', handleSubscriptionData);
    };
  }, []);
}
