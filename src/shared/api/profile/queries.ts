import { keepPreviousData, queryOptions } from '@tanstack/vue-query'
import {
  getKeyboardLayouts,
  getProfileActivity,
  getProfileHistogram,
  getProfileKeyboard,
  getProfilePBs,
  getProfileSummary,
  getProfileTimeseries
} from './endpoints'
import { profileKeys } from './keys'

/**
 * Layer 2 — Profile queryOptions factories. One factory per section: the page
 * renders each behind its own query so one failed aggregate retries alone and
 * never blanks its neighbours (docs/PROFILE.md; the states contract of the
 * /profile page).
 */

export const profileSummaryQueryOptions = () =>
  queryOptions({
    queryKey: profileKeys.summary(),
    queryFn: () => getProfileSummary()
  })

export const profileActivityQueryOptions = (days?: number) =>
  queryOptions({
    queryKey: profileKeys.activity(days),
    queryFn: () => getProfileActivity(days)
  })

export const profileHistogramQueryOptions = () =>
  queryOptions({
    queryKey: profileKeys.histogram(),
    queryFn: () => getProfileHistogram()
  })

/**
 * The range presets change the query KEY, and a key change is a fresh query —
 * which, left alone, unmounts the chart, collapses the card to nothing and
 * remounts it a moment later. `keepPreviousData` keeps the previous range on
 * screen while the new one loads, so the page only ever swaps the numbers
 * inside a chart that never left.
 */
export const profileTimeseriesQueryOptions = (from?: string, to?: string) =>
  queryOptions({
    queryKey: profileKeys.timeseries(from, to),
    queryFn: () => getProfileTimeseries({ from, to }),
    placeholderData: keepPreviousData
  })

export const profilePBsQueryOptions = () =>
  queryOptions({
    queryKey: profileKeys.pbs(),
    queryFn: () => getProfilePBs()
  })

export const profileKeyboardQueryOptions = () =>
  queryOptions({
    queryKey: profileKeys.keyboard(),
    queryFn: () => getProfileKeyboard()
  })

/** The layouts asset never changes within a session (served immutable-cached). */
export const keyboardLayoutsQueryOptions = () =>
  queryOptions({
    queryKey: profileKeys.layouts(),
    queryFn: () => getKeyboardLayouts(),
    staleTime: Infinity,
    gcTime: Infinity
  })
