export const ONBOARDED_KEY = 'aitown_onboarded';
export const MY_AGENT_KEY = 'aitown_my_agent_id';
export const MY_WALLET_KEY = 'aitown_my_wallet';
export const DEGEN_TOUR_KEY = 'aitown_degen_tour_v2';

export function isOnboarded(): boolean {
  return localStorage.getItem(ONBOARDED_KEY) === '1';
}

export function getMyAgentId(): string | null {
  return localStorage.getItem(MY_AGENT_KEY);
}

export function getMyWallet(): string | null {
  return localStorage.getItem(MY_WALLET_KEY);
}
