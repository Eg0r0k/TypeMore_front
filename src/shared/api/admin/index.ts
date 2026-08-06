/** Admin surface — capability-gated moderation reads and writes. */
export { adminKeys } from './keys'
export {
  playerBadgesQueryOptions,
  playerBansQueryOptions,
  reportQueueQueryOptions,
  subjectReportsQueryOptions
} from './queries'
export {
  useGrantBadgeMutation,
  useIssueBanMutation,
  useResolveReportsMutation,
  useRevokeBadgeMutation,
  useRevokeBanMutation
} from './mutations'
export { ResolutionCandidatesSchema } from './schemas'
export type {
  AdminUser,
  BadgeGrant,
  Ban,
  BanIssued,
  QueueSubject,
  ReportQueue,
  ReportQueueItem,
  ResolveResult,
  SubjectReport,
  SubjectReports,
  UserBadges,
  UserBans
} from './schemas'
export type { IssueBanInput, ResolveReportsInput, ResolveVerdict } from './types'
