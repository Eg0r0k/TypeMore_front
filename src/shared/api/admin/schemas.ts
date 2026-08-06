import * as v from 'valibot'

/**
 * The admin report queue (backend `internal/moderation/reports_http.go`,
 * `docs/REPORTS.md`). Go marshals a nil slice as `null`, so every array here
 * normalizes `null`/absent to `[]`.
 */
const arrayOrEmpty = <S extends v.GenericSchema>(schema: S) =>
  v.pipe(
    v.nullish(v.array(schema)),
    v.transform((value) => value ?? [])
  )

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
