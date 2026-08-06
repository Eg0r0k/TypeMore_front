import * as v from 'valibot'

/**
 * The admin report queue (backend `internal/moderation/reports_http.go`,
 * `docs/REPORTS.md`). Go marshals a nil slice as `null`, so every array here
 * normalizes `null`/absent to `[]`.
 */
const arrayOrEmpty = <S extends v.GenericSchema>(
  schema: S
): v.GenericSchema<unknown, v.InferOutput<S>[]> =>
  v.pipe(
    v.nullish(v.array(schema)),
    v.transform((value) => value ?? [])
  ) as v.GenericSchema<unknown, v.InferOutput<S>[]>

/** `type` stays a plain string: a subject type this build predates must not fail the whole queue parse. */
export const QueueSubjectSchema = v.object({
  type: v.string(),
  id: v.string()
})
export type QueueSubject = v.InferOutput<typeof QueueSubjectSchema>

/** Per-type fields; the server omits the ones the subject type has no use for. */
export const QueueSnapshotSchema = v.object({
  userName: v.optional(v.string()),
  quoteText: v.optional(v.string()),
  quoteLang: v.optional(v.string()),
  quoteWithdrawn: v.optional(v.boolean(), false),
  runOwnerName: v.optional(v.string()),
  runStatus: v.optional(v.string())
})

export const ReportQueueItemSchema = v.object({
  subject: QueueSubjectSchema,
  openReports: v.number(),
  firstReported: v.string(),
  lastReported: v.string(),
  reasons: arrayOrEmpty(v.string()),
  snapshot: QueueSnapshotSchema
})
export type ReportQueueItem = v.InferOutput<typeof ReportQueueItemSchema>

export const ReportQueueSchema = v.object({
  items: arrayOrEmpty(ReportQueueItemSchema)
})
export type ReportQueue = v.InferOutput<typeof ReportQueueSchema>

export const SubjectReportSchema = v.object({
  id: v.string(),
  reason: v.string(),
  comment: v.optional(v.string()),
  status: v.string(),
  createdAt: v.string(),
  resolvedAt: v.optional(v.string()),
  resolutionNote: v.optional(v.string()),
  reporterName: v.string(),
  resolverName: v.optional(v.string())
})
export type SubjectReport = v.InferOutput<typeof SubjectReportSchema>

export const SubjectReportsSchema = v.object({
  subject: QueueSubjectSchema,
  reports: arrayOrEmpty(SubjectReportSchema)
})
export type SubjectReports = v.InferOutput<typeof SubjectReportsSchema>

export const ResolveResultSchema = v.object({
  subject: QueueSubjectSchema,
  status: v.string(),
  resolved: v.number()
})
export type ResolveResult = v.InferOutput<typeof ResolveResultSchema>

/** The ban surface (backend `internal/moderation/handler.go`, docs/MODERATION.md). */
export const AdminUserSchema = v.object({
  id: v.string(),
  displayName: v.string()
})
export type AdminUser = v.InferOutput<typeof AdminUserSchema>

export const BanSchema = v.object({
  id: v.string(),
  userId: v.string(),
  displayName: v.optional(v.string()),
  reason: v.string(),
  issuedBy: v.string(),
  issuedAt: v.string(),
  expiresAt: v.optional(v.string()),
  revokedAt: v.optional(v.string()),
  active: v.boolean()
})
export type Ban = v.InferOutput<typeof BanSchema>

export const UserBansSchema = v.object({
  user: AdminUserSchema,
  restricted: v.boolean(),
  bans: arrayOrEmpty(BanSchema)
})
export type UserBans = v.InferOutput<typeof UserBansSchema>

/** `POST /bans` answers a DIFF — `amended` + `previous` — never a bare "ok". */
export const BanIssuedSchema = v.object({
  user: AdminUserSchema,
  ban: BanSchema,
  amended: v.boolean(),
  previous: v.optional(BanSchema)
})
export type BanIssued = v.InferOutput<typeof BanIssuedSchema>

export const BanRevokedSchema = v.object({
  revoked: v.boolean(),
  ban: v.optional(BanSchema)
})
export type BanRevoked = v.InferOutput<typeof BanRevokedSchema>

/** The resolution 409: an ambiguous identifier answers its candidates. */
export const ResolutionCandidatesSchema = v.object({
  candidates: arrayOrEmpty(AdminUserSchema)
})

/** The badge surface (backend `internal/moderation/badges_http.go`). */
export const BadgeGrantSchema = v.object({
  code: v.string(),
  grantedAt: v.string(),
  grantedBy: v.optional(v.string()),
  revokedAt: v.optional(v.string()),
  revokedBy: v.optional(v.string()),
  granted: v.boolean(),
  shown: v.boolean()
})
export type BadgeGrant = v.InferOutput<typeof BadgeGrantSchema>

export const UserBadgesSchema = v.object({
  user: AdminUserSchema,
  badges: arrayOrEmpty(BadgeGrantSchema),
  knownBadges: arrayOrEmpty(v.string())
})
export type UserBadges = v.InferOutput<typeof UserBadgesSchema>

export const BadgeGrantedSchema = v.object({
  user: AdminUserSchema,
  badge: BadgeGrantSchema
})
export type BadgeGranted = v.InferOutput<typeof BadgeGrantedSchema>

export const BadgeRevokedSchema = v.object({
  user: AdminUserSchema,
  code: v.string(),
  revoked: v.boolean()
})
export type BadgeRevoked = v.InferOutput<typeof BadgeRevokedSchema>

/** The run review surface (backend `internal/runs/override.go`, docs/MODERATION.md). */
export const ReviewRowSchema = v.object({
  id: v.string(),
  userId: v.optional(v.string()),
  displayName: v.optional(v.string()),
  status: v.string(),
  mode: v.string(),
  lang: v.optional(v.string()),
  suspicion: v.number(),
  overridden: v.boolean(),
  /** The server's recomputed metrics, verbatim; the screen picks what it can read. */
  metrics: v.nullish(
    v.object({
      wpm: v.optional(v.number()),
      raw: v.optional(v.number()),
      acc: v.optional(v.number())
    })
  ),
  createdAt: v.string()
})
export type ReviewRow = v.InferOutput<typeof ReviewRowSchema>

export const ReviewQueueSchema = v.object({
  runs: arrayOrEmpty(ReviewRowSchema),
  minSuspicion: v.number()
})
export type ReviewQueue = v.InferOutput<typeof ReviewQueueSchema>

export const StatusOverrideSchema = v.object({
  id: v.string(),
  runId: v.string(),
  fromStatus: v.string(),
  toStatus: v.string(),
  reason: v.string(),
  decidedByName: v.optional(v.string()),
  decidedAt: v.string()
})
export type StatusOverride = v.InferOutput<typeof StatusOverrideSchema>

export const RunOverridesSchema = v.object({
  overrides: arrayOrEmpty(StatusOverrideSchema)
})
export type RunOverrides = v.InferOutput<typeof RunOverridesSchema>
