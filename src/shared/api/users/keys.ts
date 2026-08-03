import { API_SCOPE } from '../keys'

/**
 * Layer 2 — Public profile cache keys, scoped per NAME: two profiles never
 * share an entry, and one profile's sections cache independently exactly like
 * the owner's own page (one failed aggregate retries alone).
 */
export const usersKeys = {
  all: [...API_SCOPE, 'users'] as const,
  profile: (name: string) => [...usersKeys.all, name] as const,
  header: (name: string) => [...usersKeys.profile(name), 'header'] as const,
  summary: (name: string) => [...usersKeys.profile(name), 'summary'] as const,
  activity: (name: string) => [...usersKeys.profile(name), 'activity'] as const,
  histogram: (name: string) => [...usersKeys.profile(name), 'histogram'] as const,
  timeseries: (name: string, from?: string, to?: string) =>
    [...usersKeys.profile(name), 'timeseries', from ?? null, to ?? null] as const,
  pbs: (name: string) => [...usersKeys.profile(name), 'pbs'] as const,
  portrait: (name: string) => [...usersKeys.profile(name), 'portrait'] as const,
  runs: (name: string, cursor?: string) =>
    [...usersKeys.profile(name), 'runs', cursor ?? null] as const,
  /**
   * Search hangs off `all`, NOT off `profile(name)`: a query string is not a
   * name, and nesting it there would put `search('bob')` inside the cache
   * subtree of a player actually called `bob`.
   */
  search: (query: string) => [...usersKeys.all, 'search', query] as const
} as const
