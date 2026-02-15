// Privy app ID — set via VITE_PRIVY_APP_ID env var
export const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || '';

// Privy embedded wallets REQUIRE HTTPS (localhost gets a special exception)
const IS_SECURE = typeof window !== 'undefined' && (
  window.location.protocol === 'https:' ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
);

export const HAS_PRIVY = PRIVY_APP_ID.length > 5 && !PRIVY_APP_ID.includes('xxxx') && IS_SECURE;
