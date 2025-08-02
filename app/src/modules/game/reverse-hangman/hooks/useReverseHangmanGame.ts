// Re-export from useServerSideReverseHangman for backward compatibility
export { useServerSideReverseHangman as useReverseHangmanGame } from './useServerSideReverseHangman';
export type { UseServerSideReverseHangmanProps as UseReverseHangmanGameProps } from './useServerSideReverseHangman';

// Define return type alias
export type UseReverseHangmanGameReturn = ReturnType<typeof import('./useServerSideReverseHangman').useServerSideReverseHangman>;