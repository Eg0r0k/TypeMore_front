import { API_SCOPE } from '../keys'

/** Layer 2 — Theme cache keys. */
export const themeKeys = {
  all: [...API_SCOPE, 'themes'] as const,
  list: () => [...themeKeys.all, 'list'] as const
} as const
