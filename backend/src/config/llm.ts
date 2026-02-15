const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function readBooleanEnv(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (typeof raw !== 'string' || raw.trim() === '') return fallback;
  return TRUE_VALUES.has(raw.trim().toLowerCase());
}

export function isOpenRouterEnabledFlag(): boolean {
  // Cost safety default: disabled unless explicitly enabled.
  return readBooleanEnv('OPENROUTER_ENABLED', false);
}

export function isOpenRouterActiveConfig(): boolean {
  return isOpenRouterEnabledFlag() && Boolean(process.env.OPENROUTER_API_KEY);
}
