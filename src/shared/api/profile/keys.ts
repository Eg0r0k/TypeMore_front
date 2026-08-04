import { API_SCOPE } from '../keys'

/**
 * Layer 2 — Profile cache keys. Each section caches independently — that is
 * what lets one failed aggregate retry alone instead of blanking the page —
 * and `all` is the invalidation handle (e.g. after a run submission lands).
 * The timeseries key carries its range: every preset is its own cache entry.
 */
export const profileKeys = {
  all: [...API_SCOPE, 'profile'] as const,
  summary: () => [...profileKeys.all, 'summary'] as const,
  activity: (days?: number) => [...profileKeys.all, 'activity', days ?? null] as const,
  histogram: () => [...profileKeys.all, 'histogram'] as const,
  timeseries: (from?: string, to?: string) =>
    [...profileKeys.all, 'timeseries', from ?? null, to ?? null] as const,
  pbs: () => [...profileKeys.all, 'pbs'] as const,
  keyboard: () => [...profileKeys.all, 'keyboard'] as const,
  /** The OWNER's editable profile (bio, links, badge showcase). */
  own: () => [...profileKeys.all, 'own'] as const,
  layouts: () => [...API_SCOPE, 'layouts'] as const
} as const
