/**
 * Layer 0 — request types for player reports (backend `docs/REPORTS.md`).
 *
 * The subject vocabulary and the per-subject reason sets MIRROR the server's
 * `reasonsBySubject` map (which itself mirrors a CHECK constraint in migration
 * 00026). The database is the authority; this copy exists so the modal can
 * offer only reasons that apply to what is being reported, instead of letting
 * a player pick one the server will refuse with a 400.
 */

/** What can be reported — the server's three v1 subject types. */
export const REPORT_SUBJECT_TYPES = ['user', 'quote', 'run'] as const
export type ReportSubjectType = (typeof REPORT_SUBJECT_TYPES)[number]

/** The thing a report is about: a type and that type's row id (uuid). */
export interface ReportSubject {
  type: ReportSubjectType
  id: string
}

/**
 * The reason vocabulary, per subject. Order is presentation order in the
 * modal; `other` is deliberately last everywhere — it is the fallback, not
 * the suggestion.
 */
export const REPORT_REASONS = {
  user: ['offensive_name', 'impersonation', 'cheating', 'other'],
  quote: ['typo', 'wrong_language', 'offensive', 'other'],
  run: ['cheating', 'impossible_score', 'other']
} as const satisfies Record<ReportSubjectType, readonly string[]>

export type ReportReason = (typeof REPORT_REASONS)[ReportSubjectType][number]

/**
 * The server counts RUNES, not bytes (`maxComment` in
 * `internal/moderation/reports_http.go`), so a plain `maxlength` — which
 * counts UTF-16 code units — is strictly tighter and can never let through a
 * comment the server would refuse.
 */
export const REPORT_COMMENT_MAX = 1000

/** `POST /reports` request body. `comment` is optional and trimmed server-side. */
export interface FileReportInput {
  subject: ReportSubject
  reason: ReportReason
  comment?: string
}
