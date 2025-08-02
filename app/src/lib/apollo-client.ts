import { ApolloClient, InMemoryCache, split, createHttpLink, from, ApolloLink } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { setContext } from '@apollo/client/link/context';
import { RetryLink } from '@apollo/client/link/retry';
import { onError } from '@apollo/client/link/error';
import { formatTimestamp } from '@shared/utils/dateFormatter';

// HTTP connection to the API
const httpLink = createHttpLink({
  uri: import.meta.env.VITE_API_URL || '/graphql',
  credentials: 'include',
});

// WebSocket connection for subscriptions
const wsClient = createClient({
  url: import.meta.env.VITE_WS_URL || (() => {
    // Build WebSocket URL based on current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/graphql`;
  })(),
  connectionParams: () => {
    // Get auth token if needed
    const token = localStorage.getItem('ai-arena-access-token');
    console.log('🔌 WebSocket connectionParams:', {
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'none'
    });
    return {
      authorization: token ? `Bearer ${token}` : '',
    };
  },
  retryAttempts: 5,
  shouldRetry: () => true,
  on: {
    connected: () => console.log('✅ WebSocket connected', { timestamp: formatTimestamp() }),
    error: (error) => console.error('❌ WebSocket error:', { error, timestamp: formatTimestamp() }),
    closed: () => console.log('🔌 WebSocket closed', { timestamp: formatTimestamp() }),
    connecting: () => console.log('🔄 WebSocket connecting...', { timestamp: formatTimestamp() }),
    message: (message) => {
      // Log all WebSocket messages except SendDebugLog operations
      try {
        const parsed = typeof message === 'string' ? JSON.parse(message) : message;
        
        // Skip logging SendDebugLog messages
        const messageStr = JSON.stringify(parsed).toLowerCase();
        if (messageStr.includes('senddebuglog') || 
            messageStr.includes('send_debug_log')) {
          return;
        }
        
        console.log('📨 WebSocket message:', {
          type: parsed.type || 'unknown',
          id: parsed.id,
          payload: parsed.payload,
          timestamp: formatTimestamp()
        });
      } catch (e) {
        // Skip raw messages that might contain SendDebugLog
        const rawStr = String(message).toLowerCase();
        if (rawStr.includes('senddebuglog') || 
            rawStr.includes('send_debug_log')) {
          return;
        }
        console.log('📨 WebSocket message (raw):', { message, timestamp: formatTimestamp() });
      }
    },
  },
});

const wsLink = new GraphQLWsLink(wsClient);

// Retry link for handling transient failures
const retryLink = new RetryLink({
  delay: {
    initial: 300,
    max: Infinity,
    jitter: true
  },
  attempts: {
    max: 3,
    retryIf: (error, _operation) => {
      // Retry on network errors but not on GraphQL errors
      return !!error && (
        error.networkError?.message?.includes('Failed to fetch') ||
        error.networkError?.message?.includes('NetworkError') ||
        error.networkError?.message?.includes('ERR_CONNECTION_REFUSED')
      );
    }
  }
});

// Pre-filter link to completely block SendDebugLog operations from console
const preFilterLink = new ApolloLink((operation, forward) => {
  // Store original console methods before any operation
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug
  };
  
  const skipLogging = operation.operationName === 'SendDebugLog' || 
                      operation.operationName === 'SendDebugLogBatch';
  
  if (skipLogging) {
    // Temporarily disable console methods for SendDebugLog operations
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
    console.info = () => {};
    console.debug = () => {};
    
    return forward(operation).map(response => {
      // Restore console methods after operation completes
      Object.assign(console, originalConsole);
      return response;
    });
  }
  
  return forward(operation);
});

// Logging link to capture all GraphQL operations
const loggingLink = new ApolloLink((operation, forward) => {
  const startTime = Date.now();
  
  // Skip logging for debug log mutations to prevent feedback loop
  const skipLogging = operation.operationName === 'SendDebugLog' || 
                      operation.operationName === 'SendDebugLogBatch';
  
  if (!skipLogging) {
    // Log the operation
    const definition = operation.query.definitions[0];
    const operationType = definition && 'operation' in definition ? definition.operation : 'unknown';
    console.log('🔄 GraphQL Operation:', {
      type: operationType,
      name: operation.operationName,
      variables: operation.variables,
      timestamp: formatTimestamp()
    });
  }
  
  return forward(operation).map(response => {
    const duration = Date.now() - startTime;
    
    if (!skipLogging) {
      // Log the response
      console.log('✅ GraphQL Response:', {
        operationName: operation.operationName,
        duration: `${duration}ms`,
        data: response.data,
        errors: response.errors,
        timestamp: formatTimestamp()
      });
    }
    
    return response;
  });
});

// Error link to log GraphQL errors
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  // Skip logging for debug log mutations to prevent feedback loop
  const skipLogging = operation.operationName === 'SendDebugLog' || 
                      operation.operationName === 'SendDebugLogBatch';
  
  if (!skipLogging) {
    if (graphQLErrors) {
      graphQLErrors.forEach((error) => {
        console.error('❌ GraphQL Error:', {
          message: error.message,
          locations: error.locations,
          path: error.path,
          operation: operation.operationName,
          variables: operation.variables,
          timestamp: formatTimestamp()
        });
      });
    }
    
    if (networkError) {
      console.error('❌ Network Error:', {
        message: networkError.message,
        operation: operation.operationName,
        variables: operation.variables,
        timestamp: formatTimestamp()
      });
    }
  }
});

// Auth link to add headers
const authLink = setContext((operation, { headers }) => {
  const token = localStorage.getItem('ai-arena-access-token');
  const user = localStorage.getItem('ai-arena-user');
  let walletAddress = '';
  
  if (user) {
    try {
      const parsedUser = JSON.parse(user);
      walletAddress = parsedUser.address || '';
    } catch (e) {
      console.error('Failed to parse user data');
    }
  }
  
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
      'x-wallet-address': walletAddress,
    },
  };
});

// Split traffic between WebSocket and HTTP
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  from([preFilterLink, loggingLink, errorLink, wsLink]),
  from([preFilterLink, loggingLink, errorLink, retryLink, authLink, httpLink])
);

// Apollo Client instance
export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      Bot: {
        keyFields: ['id'],
      },
      User: {
        keyFields: ['address'],
      },
      BotStats: {
        // BotStats doesn't have an ID, so we tell Apollo to merge by reference
        keyFields: false,
        merge: true,
      },
      Query: {
        fields: {
          bots: {
            merge(existing = [], incoming) {
              return [...incoming];
            },
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});

// Export common queries and mutations
export { gql } from '@apollo/client';