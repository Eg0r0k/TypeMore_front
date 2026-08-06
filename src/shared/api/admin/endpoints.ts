import { request } from '../transport'
import {
  BadgeGrantedSchema,
  BadgeRevokedSchema,
  BanIssuedSchema,
  BanRevokedSchema,
  ReportQueueSchema,
  ResolveResultSchema,
  SubjectReportsSchema,
  UserBadgesSchema,
  UserBansSchema,
  type BadgeGranted,
  type BadgeRevoked,
  type BanIssued,
  type BanRevoked,
  type ReportQueue,
  type ResolveResult,
  type SubjectReports,
  type UserBadges,
  type UserBans
} from './schemas'
import type { IssueBanInput, ReportSubjectType, ResolveReportsInput } from './types'

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

export const userBans = (identifier: string): Promise<UserBans> =>
  request(`/admin/users/${encodeURIComponent(identifier)}/bans`, UserBansSchema)

export const issueBan = (input: IssueBanInput): Promise<BanIssued> =>
  request('/admin/bans', BanIssuedSchema, {
    method: 'POST',
    body: {
      user: input.user,
      reason: input.reason,
      ...(input.until ? { until: input.until } : {})
    }
  })

export const revokeBan = (userId: string): Promise<BanRevoked> =>
  request(`/admin/users/${encodeURIComponent(userId)}/ban`, BanRevokedSchema, {
    method: 'DELETE'
  })

export const userBadges = (identifier: string): Promise<UserBadges> =>
  request(`/admin/users/${encodeURIComponent(identifier)}/badges`, UserBadgesSchema)

export const grantBadge = (identifier: string, code: string): Promise<BadgeGranted> =>
  request(`/admin/users/${encodeURIComponent(identifier)}/badges`, BadgeGrantedSchema, {
    method: 'POST',
    body: { code }
  })

export const revokeBadge = (identifier: string, code: string): Promise<BadgeRevoked> =>
  request(
    `/admin/users/${encodeURIComponent(identifier)}/badges/${encodeURIComponent(code)}`,
    BadgeRevokedSchema,
    { method: 'DELETE' }
  )
