import { API_SCOPE } from '../keys'

/**
 * Layer 2 — Leaderboard cache keys. The cursor participates in the page key so
 * each page caches independently, exactly like the runs list.
 */
export const leaderboardKeys = {
  all: [...API_SCOPE, 'leaderboards'] as const,
  catalogue: () => [...leaderboardKeys.all, 'catalogue'] as const,
  board: (bucket: string) => [...leaderboardKeys.all, 'board', bucket] as const,
  page: (bucket: string, cursor?: string) =>
    [...leaderboardKeys.board(bucket), 'page', cursor ?? null] as const,
  pageBefore: (bucket: string, before: string) =>
    [...leaderboardKeys.board(bucket), 'page-before', before] as const,
  around: (bucket: string) => [...leaderboardKeys.board(bucket), 'around-me'] as const,
  me: (bucket: string) => [...leaderboardKeys.board(bucket), 'me'] as const
} as const
