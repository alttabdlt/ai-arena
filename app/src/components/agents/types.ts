import * as THREE from 'three';

export type AgentActivity = 'WALKING' | 'IDLE' | 'SHOPPING' | 'CHATTING' | 'BUILDING' | 'MINING' | 'PLAYING' | 'BEGGING' | 'SCHEMING';
export type AgentEconomicState = 'THRIVING' | 'COMFORTABLE' | 'STRUGGLING' | 'BROKE' | 'HOMELESS' | 'DEAD' | 'RECOVERING';
export type AgentState = AgentActivity | 'DEAD';

export interface AgentSim {
  id: string;
  position: THREE.Vector3;
  heading: THREE.Vector3;
  route: THREE.Vector3[];
  speed: number;
  walk: number;
  state: AgentState;
  stateTimer: number;
  targetPlotId: string | null;
  chatPartnerId: string | null;
  health: number;
}

export interface Agent {
  id: string;
  name: string;
  archetype: string;
  bankroll: number;
  reserveBalance: number;
  wins: number;
  losses: number;
  draws?: number;
  elo: number;
  apiCostCents?: number;
  isInMatch?: boolean;
}

export function getEconomicState(bankroll: number, isDead: boolean): AgentEconomicState {
  if (isDead) return 'DEAD';
  if (bankroll >= 1000) return 'THRIVING';
  if (bankroll >= 100) return 'COMFORTABLE';
  if (bankroll >= 10) return 'STRUGGLING';
  if (bankroll > 0) return 'BROKE';
  return 'HOMELESS';
}
