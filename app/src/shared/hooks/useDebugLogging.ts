import { useEffect } from 'react';
import { useApolloClient } from '@apollo/client';
import { debugLogger } from '@shared/services/debugLogger';

export function useDebugLogging(gameType: string) {
  const client = useApolloClient();

  useEffect(() => {
    // Start capturing logs
    debugLogger.startCapture(gameType);

    // Intercept Apollo Client operations
    const link = client.link;
    
    // Log GraphQL operations
    const originalRequest = (link as any).request;
    if (originalRequest) {
      (link as any).request = (operation: any) => {
        console.log('🔄 GraphQL Operation:', {
          type: operation.query.definitions[0].operation,
          name: operation.operationName,
          variables: operation.variables,
        });
        return originalRequest.call(link, operation);
      };
    }

    // Intercept WebSocket messages
    const wsClient = (client as any).wsClient || (client.link as any)?.subscriptionClient;
    if (wsClient) {
      const originalOnMessage = wsClient.onMessage;
      if (originalOnMessage) {
        wsClient.onMessage = (message: any) => {
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
    
    const handleSubscriptionData = (event: any) => {
      if (event.detail?.data?.gameStateUpdate) {
        window.dispatchEvent(new CustomEvent('backend-log', {
          detail: {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'Game state update from backend',
            data: event.detail.data,
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