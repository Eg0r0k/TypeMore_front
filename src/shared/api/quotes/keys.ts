import { API_SCOPE } from '../keys'
import type { QuoteLengthGroup } from './schemas'

/**
 * Layer 2 — Quote cache keys. Pages are keyed by their whole filter plus the
 * cursor, exactly like the leaderboard pages: two different filters are two
 * different walks and must not share an entry.
 *
 * There is deliberately NO key for `/random`. A random draw is not cacheable —
 * see `queries.ts`.
 */
export const quoteKeys = {
  all: [...API_SCOPE, 'quotes'] as const,
  list: (lang?: string, group?: QuoteLengthGroup) =>
    [...quoteKeys.all, 'list', lang ?? null, group ?? null] as const,
  page: (lang?: string, group?: QuoteLengthGroup, cursor?: string) =>
    [...quoteKeys.list(lang, group), 'page', cursor ?? null] as const,
  byId: (id: string) => [...quoteKeys.all, 'by-id', id] as const
} as const
