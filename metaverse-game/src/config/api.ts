/**
 * API Configuration for Metaverse Frontend
 * Defines endpoints for both the Arena backend and Metaverse backend
 */

export const API_CONFIG = {
  // Main Arena Backend (tournaments, bot management)
  ARENA_BACKEND_URL: import.meta.env.VITE_ARENA_BACKEND_URL || 'http://localhost:4000',
  ARENA_GRAPHQL_URL: import.meta.env.VITE_ARENA_GRAPHQL_URL || 'http://localhost:4000/graphql',
  ARENA_WS_URL: import.meta.env.VITE_ARENA_WS_URL || 'ws://localhost:4000/graphql',

  // Metaverse Backend (world management, bot sync)
  METAVERSE_BACKEND_URL: import.meta.env.VITE_METAVERSE_BACKEND_URL || 'http://localhost:5000',
  METAVERSE_GRAPHQL_URL: import.meta.env.VITE_METAVERSE_GRAPHQL_URL || 'http://localhost:5000/graphql',
  METAVERSE_WS_URL: import.meta.env.VITE_METAVERSE_WS_URL || 'ws://localhost:5000/graphql',

  // Convex (real-time database)
  CONVEX_URL: import.meta.env.VITE_CONVEX_URL || import.meta.env.NEXT_PUBLIC_CONVEX_URL,
};

/**
 * Helper function to get the appropriate API endpoint
 */
export function getApiEndpoint(service: 'arena' | 'metaverse', type: 'rest' | 'graphql' | 'ws' = 'rest'): string {
  if (service === 'arena') {
    switch (type) {
      case 'graphql':
        return API_CONFIG.ARENA_GRAPHQL_URL;
      case 'ws':
        return API_CONFIG.ARENA_WS_URL;
      default:
        return API_CONFIG.ARENA_BACKEND_URL;
    }
  } else {
    switch (type) {
      case 'graphql':
        return API_CONFIG.METAVERSE_GRAPHQL_URL;
      case 'ws':
        return API_CONFIG.METAVERSE_WS_URL;
      default:
        return API_CONFIG.METAVERSE_BACKEND_URL;
    }
  }
}

/**
 * Check if we're in development mode
 */
export const isDevelopment = import.meta.env.DEV;

/**
 * Check if we're in production mode
 */
export const isProduction = import.meta.env.PROD;