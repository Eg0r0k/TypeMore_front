import type { ReportSubjectType } from '../reports/types'
import type { QueueSubject } from './schemas'

export type ResolveVerdict = 'actioned' | 'dismissed'

export interface ResolveReportsInput {
  subject: QueueSubject
  verdict: ResolveVerdict
  note?: string
}

export interface IssueBanInput {
  /** A display name, a uuid, or an email — the server resolves in that order of certainty. */
  user: string
  reason: string
  /** A duration (`72h`) or an RFC3339 instant; OMITTED means a permanent ban. */
  until?: string
}

export type { ReportSubjectType }
