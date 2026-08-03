import { keepPreviousData, queryOptions } from '@tanstack/vue-query'
import { isApiError } from '../transport'
import {
  getPublicProfile,
  getPublicProfileActivity,
  getPublicProfileHistogram,
  getPublicProfilePBs,
  getPublicProfilePortrait,
  getPublicProfileRuns,
  getPublicProfileSummary,
  getPublicProfileTimeseries,
  searchUsers
} from './endpoints'
import { usersKeys } from './keys'

/**
 * Layer 2 — Public profile queryOptions. One factory per section, mirroring
 * the owner's own page: each section retries alone and never blanks its
 * neighbours.
 *
 * A 403 here is an ANSWER (profile_closed / portrait_closed), not a transient
 * failure — retrying it would hammer a server that just said no, so retries
 * are disabled for the two codes the page renders as states. Everything else
 * keeps the client's default retry behaviour.
 */

/** Retry transient failures only — a privacy refusal or a 404 is an answer. */
const retryUnlessAnswered = (failureCount: number, error: unknown): boolean => {
  if (isApiError(error) && (error.status === 403 || error.status === 404)) return false
  return failureCount < 3
}

export const publicProfileQueryOptions = (name: string) =>
  queryOptions({
    queryKey: usersKeys.header(name),
    queryFn: () => getPublicProfile(name),
    retry: retryUnlessAnswered
  })

export const publicProfileSummaryQueryOptions = (name: string) =>
  queryOptions({
    queryKey: usersKeys.summary(name),
    queryFn: () => getPublicProfileSummary(name),
    retry: retryUnlessAnswered
  })

export const publicProfileActivityQueryOptions = (name: string) =>
  queryOptions({
    queryKey: usersKeys.activity(name),
    queryFn: () => getPublicProfileActivity(name),
    retry: retryUnlessAnswered
  })

export const publicProfileHistogramQueryOptions = (name: string) =>
  queryOptions({
    queryKey: usersKeys.histogram(name),
    queryFn: () => getPublicProfileHistogram(name),
    retry: retryUnlessAnswered
  })

export const publicProfileTimeseriesQueryOptions = (name: string, from?: string, to?: string) =>
  queryOptions({
    queryKey: usersKeys.timeseries(name, from, to),
    queryFn: () => getPublicProfileTimeseries(name, { from, to }),
    placeholderData: keepPreviousData,
    retry: retryUnlessAnswered
  })

export const publicProfilePBsQueryOptions = (name: string) =>
  queryOptions({
    queryKey: usersKeys.pbs(name),
    queryFn: () => getPublicProfilePBs(name),
    retry: retryUnlessAnswered
  })

export const publicProfilePortraitQueryOptions = (name: string) =>
  queryOptions({
    queryKey: usersKeys.portrait(name),
    queryFn: () => getPublicProfilePortrait(name),
    retry: retryUnlessAnswered
  })

export const publicProfileRunsQueryOptions = (name: string, cursor?: string) =>
  queryOptions({
    queryKey: usersKeys.runs(name, cursor),
    queryFn: () => getPublicProfileRuns(name, cursor),
    retry: retryUnlessAnswered
  })

/**
 * Player search. Deliberately carries NO `enabled`: gating is the consumer's,
 * exactly like every other factory here — the search box knows when its query
 * is long enough, this does not.
 *
 * `placeholderData` keeps the previous hits on screen while a refined query is
 * in flight, so the list does not blank on every keystroke; the endpoint is
 * rate-limited server-side, which is the other reason callers debounce.
 */
export const userSearchQueryOptions = (query: string) =>
  queryOptions({
    queryKey: usersKeys.search(query.trim()),
    queryFn: () => searchUsers(query),
    // A 400 is the server saying the query is out of bounds — an answer, and
    // one `isSearchable` should have prevented us asking in the first place.
    retry: (failureCount: number, error: unknown) =>
      isApiError(error) && error.status === 400 ? false : retryUnlessAnswered(failureCount, error),
    placeholderData: keepPreviousData,
    // A name index does not move minute to minute; re-asking the same fragment
    // while the player edits around it should not re-hit a rate-limited route.
    staleTime: 30_000
  })
