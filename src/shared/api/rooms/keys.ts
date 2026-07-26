import { API_SCOPE } from '../keys'

/**
 * Layer 2 — Room list cache keys. One list, no filters, so one key: the server
 * owns both the "open" predicate and the ordering, leaving nothing for a key to
 * vary by.
 */
export const roomKeys = {
  all: [...API_SCOPE, 'rooms'] as const,
  list: () => [...roomKeys.all, 'list'] as const
} as const
