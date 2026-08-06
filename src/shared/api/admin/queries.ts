import { queryOptions } from '@tanstack/vue-query'
import { reportQueue, subjectReports } from './endpoints'
import { adminKeys } from './keys'
import type { ReportSubjectType } from './types'

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
