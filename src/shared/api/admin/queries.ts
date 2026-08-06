import { keepPreviousData, queryOptions } from '@tanstack/vue-query'
import {
  reportQueue,
  reviewQueue,
  runOverrides,
  subjectReports,
  userBadges,
  userBans
} from './endpoints'
import { adminKeys } from './keys'
import type { ReportSubjectType, ReviewSort } from './types'

export const reportQueueQueryOptions = (type?: ReportSubjectType) =>
  queryOptions({
    queryKey: adminKeys.reportQueue(type),
    queryFn: () => reportQueue(type)
  })

export const subjectReportsQueryOptions = (type: string, id: string) =>
  queryOptions({
    queryKey: adminKeys.subjectReports(type, id),
    queryFn: () => subjectReports(type, id)
  })

export const playerBansQueryOptions = (identifier: string) =>
  queryOptions({
    queryKey: adminKeys.playerBans(identifier),
    queryFn: () => userBans(identifier),
    // An ambiguous identifier (409) or an unknown one (404) is an ANSWER the
    // card renders, not a transient to retry.
    retry: false
  })

export const playerBadgesQueryOptions = (identifier: string) =>
  queryOptions({
    queryKey: adminKeys.playerBadges(identifier),
    queryFn: () => userBadges(identifier),
    retry: false
  })

export const reviewQueueQueryOptions = (params: {
  minSuspicion?: number
  sort?: ReviewSort
  offset?: number
  limit?: number
} = {}) =>
  queryOptions({
    queryKey: adminKeys.reviewQueue(params.minSuspicion, params.sort, params.offset),
    queryFn: () => reviewQueue(params),
    // A page flip keeps the previous rows on screen instead of blanking.
    placeholderData: keepPreviousData
  })

export const runOverridesQueryOptions = (runId: string) =>
  queryOptions({
    queryKey: adminKeys.runOverrides(runId),
    queryFn: () => runOverrides(runId)
  })
