import { ApolloClient, InMemoryCache, split, createHttpLink } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { setContext } from '@apollo/client/link/context';

// HTTP connection to the API
const httpLink = createHttpLink({
  uri: import.meta.env.VITE_API_URL || 'http://localhost:4000/graphql',
  credentials: 'include',
});

// WebSocket connection for subscriptions
const wsLink = new GraphQLWsLink(
  createClient({
    url: import.meta.env.VITE_WS_URL || 'ws://localhost:4000/graphql',
    connectionParams: () => {
      // Get auth token if needed
      const token = localStorage.getItem('ai-arena-access-token');
      return {
        authorization: token ? `Bearer ${token}` : '',
      };
    },
    retryAttempts: 5,
    shouldRetry: () => true,
  })
);

// Auth link to add headers
const authLink = setContext((_, { headers }) => {
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
  wsLink,
  authLink.concat(httpLink)
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