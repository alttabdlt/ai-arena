// Re-export everything from the adapter to maintain backward compatibility
export * from './usePokerGameAdapter';

// Legacy support - redirect to adapter  
// usePokerGameAdapter exports useServerSidePoker, so we import that
import { useServerSidePoker } from './usePokerGameAdapter';
export const usePokerGame = (tournament?: any) => useServerSidePoker({ gameId: '', tournament });

// Keep type exports for backward compatibility - aliased from new locations
export type { PokerGameConfig as GameConfig, PokerGameState as GameState, PokerPhase as GamePhase, PokerPlayer as Player, Card, PokerStyleBonus as StyleBonus } from '@game/shared/types';
export type { IGameDecision as AIDecision, IScoreBreakdown as PointEvent, IGameEvent as AchievementEvent } from '@game/shared/types';