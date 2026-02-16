const trim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const explicitApiBase = stripTrailingSlash(trim(import.meta.env.VITE_API_BASE_URL));
const backendOrigin = stripTrailingSlash(trim(import.meta.env.VITE_BACKEND_URL));

/**
 * Local default uses Vite proxy (/api -> localhost:4000).
 * Production can set either:
 * - VITE_API_BASE_URL=https://backend.example.com/api/v1
 * - VITE_BACKEND_URL=https://backend.example.com
 */
export const API_BASE = explicitApiBase || (backendOrigin ? `${backendOrigin}/api/v1` : '/api/v1');

export function apiUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${suffix}`;
}
