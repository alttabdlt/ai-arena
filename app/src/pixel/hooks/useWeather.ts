/**
 * Weather state — re-exported from useTownData for convenience.
 * This hook provides weather + economicState if you need them standalone.
 */
export type { TownDataState } from './useTownData';

// Weather is already computed inside useTownData.
// This file exists for the plan's module structure; components import weather from useTownData directly.
