import { request } from '../transport'
import {
  ProfileActivitySchema,
  ProfileHistogramSchema,
  ProfileKeyboardSchema,
  ProfilePBsSchema,
  ProfileSummarySchema,
  ProfileTimeseriesSchema,
  type ProfileActivity,
  type ProfileHistogram,
  type ProfileKeyboard,
  type ProfilePBs,
  type ProfileSummary,
  type ProfileTimeseries
} from '../profile/schemas'
import {
  PublicProfileSchema,
  PublicRunListSchema,
  UserSearchSchema,
  type PublicProfile,
  type PublicRunList,
  type UserSearch
} from './schemas'

/**
 * Layer 1 — Public profile endpoints (`GET /api/v1/users/{name}/…`, backend
 * `docs/PROFILE.md` "Public profiles"). Sessionless; the server itself lets an
 * owner through their own closed profile when a cookie rides along.
 *
 * Privacy is the SERVER's: a closed profile answers 403 `profile_closed` on
 * every data route here, and the page renders that state — the client never
 * decides what to hide, it renders what it was refused.
 */

const base = (name: string): string => `/users/${encodeURIComponent(name)}`

export const getPublicProfile = (name: string): Promise<PublicProfile> =>
  request(base(name), PublicProfileSchema)

export const getPublicProfileSummary = (name: string): Promise<ProfileSummary> =>
  request(`${base(name)}/summary`, ProfileSummarySchema)

export const getPublicProfileActivity = (name: string): Promise<ProfileActivity> =>
  request(`${base(name)}/activity`, ProfileActivitySchema)

export const getPublicProfileHistogram = (name: string): Promise<ProfileHistogram> =>
  request(`${base(name)}/histogram`, ProfileHistogramSchema)

export const getPublicProfileTimeseries = (
  name: string,
  params: { from?: string; to?: string } = {}
): Promise<ProfileTimeseries> =>
  request(`${base(name)}/timeseries`, ProfileTimeseriesSchema, {
    query: { from: params.from, to: params.to }
  })

export const getPublicProfilePBs = (name: string): Promise<ProfilePBs> =>
  request(`${base(name)}/pbs`, ProfilePBsSchema)

/**
 * The keyboard portrait — served only when its owner's own opt-in is on
 * (403 `portrait_closed` otherwise; 403 `profile_closed` when the whole
 * profile is closed). The page renders those refusals as states.
 */
export const getPublicProfilePortrait = (name: string): Promise<ProfileKeyboard> =>
  request(`${base(name)}/portrait`, ProfileKeyboardSchema)

export const getPublicProfileRuns = (name: string, cursor?: string): Promise<PublicRunList> =>
  request(`${base(name)}/runs`, PublicRunListSchema, { query: { cursor } })

/**
 * Bounds the SERVER enforces on `q`, mirrored so the client can decline to ask
 * instead of collecting a 400. Both are its rules, not ours:
 *
 * - 3 because a trigram index cannot serve a shorter pattern — below it the
 *   search silently degrades into a sequential scan over every account — and
 *   because a display name shorter than 3 characters cannot exist anyway.
 * - 20 because that is the display-name CHECK's upper bound: a longer `q`
 *   cannot be contained in any name, so there is nothing to look for.
 *
 * Counted in CODE POINTS, like the server counts them (runes, not bytes), so a
 * Cyrillic handle is measured the same on both sides.
 */
export const SEARCH_MIN_QUERY_LEN = 3
export const SEARCH_MAX_QUERY_LEN = 20

/** Whether `query` is worth sending — the client-side twin of the 400 above. */
export const isSearchable = (query: string): boolean => {
  const length = [...query.trim()].length
  return length >= SEARCH_MIN_QUERY_LEN && length <= SEARCH_MAX_QUERY_LEN
}

/**
 * `GET /users?q=&limit=` — find a player by part of their name.
 *
 * No cursor by design (the server's): a search box is refined, not paged. No
 * hits is an empty list and a 200, never a 404 — the question "who is called
 * something like this" was answered, and the answer was nobody.
 *
 * CLOSED profiles are in the results, with `public: false`. That is deliberate
 * server-side — search finds a profile, it is never a second way to READ one —
 * and it is why the caller must render them as a state rather than filter them
 * out: a player looking for someone who closed their profile has to find them.
 */
export const searchUsers = (query: string, limit?: number): Promise<UserSearch> =>
  request('/users', UserSearchSchema, { query: { q: query.trim(), limit } })
