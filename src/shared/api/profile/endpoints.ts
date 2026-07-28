import { request } from '../transport'
import {
  KeyboardLayoutsSchema,
  ProfileActivitySchema,
  ProfileHistogramSchema,
  ProfileKeyboardSchema,
  ProfilePBsSchema,
  ProfileSummarySchema,
  ProfileTimeseriesSchema,
  type KeyboardLayouts,
  type ProfileActivity,
  type ProfileHistogram,
  type ProfileKeyboard,
  type ProfilePBs,
  type ProfileSummary,
  type ProfileTimeseries
} from './schemas'

/**
 * Layer 1 — Typed profile endpoints (backend `docs/PROFILE.md`). Every route is
 * session-scoped and answers about the CALLER only; there is no handle for
 * another player's profile in v1, so none is modelled here.
 */

export const getProfileSummary = (): Promise<ProfileSummary> =>
  request('/profile/summary', ProfileSummarySchema)

export const getProfileActivity = (days?: number): Promise<ProfileActivity> =>
  request('/profile/activity', ProfileActivitySchema, { query: { days } })

export const getProfileHistogram = (): Promise<ProfileHistogram> =>
  request('/profile/histogram', ProfileHistogramSchema)

/** `from`/`to` are YYYY-MM-DD dates; a date-only `to` is inclusive. */
export const getProfileTimeseries = (
  params: {
    from?: string
    to?: string
  } = {}
): Promise<ProfileTimeseries> =>
  request('/profile/timeseries', ProfileTimeseriesSchema, {
    query: { from: params.from, to: params.to }
  })

export const getProfilePBs = (): Promise<ProfilePBs> => request('/profile/pbs', ProfilePBsSchema)

export const getProfileKeyboard = (): Promise<ProfileKeyboard> =>
  request('/profile/keyboard', ProfileKeyboardSchema)

/** The layouts asset — public, immutable-ish, shared by heatmap and future consumers. */
export const getKeyboardLayouts = (): Promise<KeyboardLayouts> =>
  request('/layouts', KeyboardLayoutsSchema)
