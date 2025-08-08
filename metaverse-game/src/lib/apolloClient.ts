import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:4000/graphql',
  credentials: 'include', // Send cookies
});

// Auth link to add JWT token to headers
const authLink = setContext((_, { headers }) => {
  // Get the authentication token from local storage if it exists
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
  
  // Return the headers to the context so httpLink can read them
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
      'x-wallet-address': walletAddress,
    },
  };
});

export const apolloClient = new ApolloClient({
  link: from([authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});