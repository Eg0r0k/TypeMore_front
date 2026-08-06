import { request } from '../transport'
import {
  ReportQueueSchema,
  ResolveResultSchema,
  SubjectReportsSchema,
  type ReportQueue,
  type ResolveResult,
  type SubjectReports
} from './schemas'
import type { ReportSubjectType, ResolveReportsInput } from './types'

export const reportQueue = (type?: ReportSubjectType, limit?: number): Promise<ReportQueue> =>
  request('/admin/reports', ReportQueueSchema, {
    query: {
      ...(type === undefined ? {} : { type }),
      ...(limit === undefined ? {} : { limit })
    }
  })

export const subjectReports = (type: string, id: string): Promise<SubjectReports> =>
  request(`/admin/reports/${type}/${id}`, SubjectReportsSchema)

export const resolveReports = (input: ResolveReportsInput): Promise<ResolveResult> =>
  request(`/admin/reports/${input.subject.type}/${input.subject.id}/resolve`, ResolveResultSchema, {
    method: 'POST',
    body: { verdict: input.verdict, ...(input.note ? { note: input.note } : {}) }
  })
