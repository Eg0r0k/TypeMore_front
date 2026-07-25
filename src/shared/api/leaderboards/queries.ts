import { queryOptions } from '@tanstack/vue-query'
import { queryClient } from '../query-client'
import { getBoardMe, getBoardPage, listBuckets } from './endpoints'
import { leaderboardKeys } from './keys'
import type { BucketCatalogue } from './schemas'

/**
 * Layer 2 — Leaderboard server state.
 *
 * Boards move whenever the replay worker accepts a run, so nothing here is
 * immutable the way a hash-addressed dictionary is. They are also not urgent:
 * a rank is stale the moment it is read. A short `staleTime` keeps a page
 * change or a bucket switch from refetching what the user just looked at,
 * without pretending the numbers are frozen.
 */
const FRESH_FOR = 30_000

export const bucketCatalogueQueryOptions = () =>
  queryOptions({
    queryKey: leaderboardKeys.catalogue(),
    queryFn: () => listBuckets(),
    staleTime: FRESH_FOR,
    select: (catalogue: BucketCatalogue) => catalogue.buckets
  })

export const boardPageQueryOptions = (bucket: string, cursor?: string) =>
  queryOptions({
    queryKey: leaderboardKeys.page(bucket, cursor),
    queryFn: () => getBoardPage({ bucket, cursor }),
    staleTime: FRESH_FOR
  })

/**
 * The caller's own slot. `null` is a SUCCESSFUL answer (204 — no visible slot),
 * not an error, so the query resolves rather than rejects and the view can tell
 * "you are not on this board" from "we could not ask".
 */
export const boardMeQueryOptions = (bucket: string) =>
  queryOptions({
    queryKey: leaderboardKeys.me(bucket),
    queryFn: () => getBoardMe(bucket),
    staleTime: FRESH_FOR
  })

/** Imperative read for code outside the component tree (route guards, tests). */
export const loadBuckets = () => queryClient.ensureQueryData(bucketCatalogueQueryOptions())
