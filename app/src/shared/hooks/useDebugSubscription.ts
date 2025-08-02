import { useEffect } from 'react';
import { useSubscription } from '@apollo/client';
import { DocumentNode } from 'graphql';

interface UseDebugSubscriptionOptions {
  skip?: boolean;
  variables?: any;
  onSubscriptionData?: (options: any) => void;
  onError?: (error: any) => void;
}

export function useDebugSubscription(
  subscription: DocumentNode,
  options?: UseDebugSubscriptionOptions
) {
  const result = useSubscription(subscription, {
    ...options,
    onSubscriptionData: (data) => {
      // Log subscription data
      const definition = subscription.definitions[0];
      const subscriptionName = definition && 'name' in definition && definition.name ? definition.name.value : 'Unknown';
      console.log('📡 Subscription data received:', {
        subscription: subscriptionName,
        data: data.subscriptionData,
        variables: options?.variables,
      });
      
      // Call original handler
      options?.onSubscriptionData?.(data);
    },
    onError: (error) => {
      // Log subscription error
      const definition = subscription.definitions[0];
      const subscriptionName = definition && 'name' in definition && definition.name ? definition.name.value : 'Unknown';
      console.error('❌ Subscription error:', {
        subscription: subscriptionName,
        error: error.message,
        graphQLErrors: error.graphQLErrors,
        networkError: error.networkError,
        variables: options?.variables,
      });
      
      // Call original handler
      options?.onError?.(error);
    },
  });

  useEffect(() => {
    if (result.loading) {
      const definition = subscription.definitions[0];
      const subscriptionName = definition && 'name' in definition && definition.name ? definition.name.value : 'Unknown';
      console.log('⏳ Subscription loading:', {
        subscription: subscriptionName,
        variables: options?.variables,
      });
    }
  }, [result.loading, subscription, options?.variables]);

  return result;
}