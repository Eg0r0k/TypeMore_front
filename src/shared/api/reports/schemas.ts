import * as v from 'valibot'

/**
 * Layer 1 — response schema for filing a report (backend `docs/REPORTS.md`,
 * "Endpoints").
 *
 * The server answers 201 for a new report and 200 with the SAME shape for one
 * the caller already has open on that subject — a double-tapped button is not
 * a client error. The transport layer does not surface the status code, and
 * the UI deliberately does not distinguish the two: both mean "we have your
 * report", which is the only thing the player needs to know.
 */
export const FiledReportSchema = v.object({
  id: v.string(),
  subject: v.object({
    type: v.string(),
    id: v.string()
  }),
  reason: v.string(),
  /** Omitted by the server when empty. */
  comment: v.optional(v.string()),
  status: v.string(),
  createdAt: v.string()
})
export type FiledReport = v.InferOutput<typeof FiledReportSchema>
