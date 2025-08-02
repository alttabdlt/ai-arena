// Re-export from useServerSideConnect4 for backward compatibility
export { useServerSideConnect4 as useConnect4Game } from './useServerSideConnect4';
export type { UseServerSideConnect4Options as UseConnect4GameProps } from './useServerSideConnect4';

// Define return type alias
export type UseConnect4GameReturn = ReturnType<typeof import('./useServerSideConnect4').useServerSideConnect4>;