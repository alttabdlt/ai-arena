import { useState, useEffect } from 'react';
import { useApolloClient } from '@apollo/client';

export function useWebSocketStatus() {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [wsClient, setWsClient] = useState<any>(null);
  const client = useApolloClient();

  useEffect(() => {
    // Try to find the WebSocket client in various locations within Apollo Client
    let wsClientFound: any = null;
    
    // Try to find GraphQLWsLink in the link chain
    const findWsLink = (link: any): any => {
      if (!link) return null;
      
      // Check if this is the WS link with client
      if (link?.options?.client) {
        return link.options.client;
      }
      
      // Check for WebSocketLink
      if (link?.subscriptionClient || link?.client) {
        return link.subscriptionClient || link.client;
      }
      
      // Check for GraphQLWsLink
      if (link?.graphqlWsClient) {
        return link.graphqlWsClient;
      }
      
      // Check left/right for split links
      if (link.left) {
        const leftResult = findWsLink(link.left);
        if (leftResult) return leftResult;
      }
      if (link.right) {
        const rightResult = findWsLink(link.right);
        if (rightResult) return rightResult;
      }
      
      // Check for concat link structure
      if (link.first) {
        const firstResult = findWsLink(link.first);
        if (firstResult) return firstResult;
      }
      if (link.second) {
        const secondResult = findWsLink(link.second);
        if (secondResult) return secondResult;
      }
      
      // Check request.operation for concat links
      if (link.request?.operation) {
        return findWsLink(link.request.operation);
      }
      
      return null;
    };
    
    wsClientFound = findWsLink((client as any).link);
    
    if (!wsClientFound) {
      console.warn('WebSocket client not found in Apollo Client link chain - assuming connected');
      // Assume connected if we can't find the client (subscriptions might still work)
      setIsConnected(true);
      return;
    }
    
    setWsClient(wsClientFound);

    const checkConnection = () => {
      // graphql-ws client structure
      const socket = wsClientFound.socket || wsClientFound._socket || wsClientFound.ws;
      if (socket && socket.readyState !== undefined) {
        const connected = socket.readyState === WebSocket.OPEN;
        setIsConnected(connected);
        console.log('🔌 WebSocket status:', {
          connected,
          readyState: socket.readyState,
          readyStateText: ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][socket.readyState]
        });
      } else {
        // If we can't find the socket, assume disconnected
        setIsConnected(false);
      }
    };

    // Initial check
    checkConnection();

    // Set up listeners
    const onOpen = () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);
      setReconnectAttempts(0);
    };

    const onClose = () => {
      console.log('❌ WebSocket disconnected');
      setIsConnected(false);
    };

    const onError = (error: any) => {
      console.error('❌ WebSocket error:', error);
      setIsConnected(false);
    };

    const onReconnectAttempt = () => {
      setReconnectAttempts(prev => prev + 1);
      console.log('🔄 WebSocket reconnection attempt:', reconnectAttempts + 1);
    };

    // Try to attach listeners
    if (wsClientFound.on) {
      wsClientFound.on('connected', onOpen);
      wsClientFound.on('closed', onClose);
      wsClientFound.on('error', onError);
      wsClientFound.on('connecting', onReconnectAttempt);
    }

    // Check connection status periodically
    const interval = setInterval(checkConnection, 5000);

    return () => {
      clearInterval(interval);
      if (wsClientFound.off) {
        wsClientFound.off('connected', onOpen);
        wsClientFound.off('closed', onClose);
        wsClientFound.off('error', onError);
        wsClientFound.off('connecting', onReconnectAttempt);
      }
    };
  }, [client, reconnectAttempts]);

  return { isConnected, reconnectAttempts, wsClient };
}