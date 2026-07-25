import { API_SCOPE } from '../keys'

/**
 * Layer 2 — Auth cache keys. `me` is the session probe guards and layouts read;
 * every session-changing mutation invalidates it.
 */
export const authKeys = {
  all: [...API_SCOPE, 'auth'] as const,
  me: () => [...authKeys.all, 'me'] as const
} as const
