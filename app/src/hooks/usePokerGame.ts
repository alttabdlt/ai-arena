// Re-export everything from the adapter to maintain backward compatibility
export * from './usePokerGameAdapter';

// Legacy support - redirect to adapter
import { usePokerGame as usePokerGameAdapter } from './usePokerGameAdapter';
export const usePokerGame = (tournament?: any) => usePokerGameAdapter(tournament);

// Keep type exports for backward compatibility - aliased from new locations
export type { PokerGameConfig as GameConfig, PokerGameState as GameState } from '@/game-engine/games/poker/PokerTypes';
export type { PokerPhase as GamePhase, PokerPlayer as Player, Card } from '@/game-engine/games/poker/PokerTypes';
export type { IGameDecision as AIDecision } from '@/game-engine/core/interfaces';
export type { PokerStyleBonus as StyleBonus } from '@/game-engine/games/poker/scoring/PokerScoringSystem';
export type { IScoreBreakdown as PointEvent } from '@/game-engine/core/interfaces';
export type { IGameEvent as AchievementEvent } from '@/game-engine/core/interfaces';