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
  type PublicProfile,
  type PublicRunList
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
