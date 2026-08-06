import type { ReportSubjectType } from '../reports/types'
import type { QueueSubject } from './schemas'

export type ResolveVerdict = 'actioned' | 'dismissed'

export interface ResolveReportsInput {
  subject: QueueSubject
  verdict: ResolveVerdict
  note?: string
}

export type { ReportSubjectType }
