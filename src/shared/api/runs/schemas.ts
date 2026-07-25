import * as v from 'valibot'

/**
 * Layer 1 — Runs response schemas. Field names mirror the JSON in the backend's
 * `docs/RUNS.md` (camelCase).
 */

export const RunStatusSchema = v.picklist(['pending', 'accepted', 'flagged', 'rejected'])
export type RunStatus = v.InferOutput<typeof RunStatusSchema>

/** One run summary as returned by list/detail (never carries the log payload). */
export const RunSummarySchema = v.object({
  id: v.string(),
  mode: v.string(),
  durationMs: v.nullish(v.number()),
  wordCount: v.nullish(v.number()),
  lang: v.string(),
  seed: v.number(),
  dictHash: v.string(),
  setup: v.unknown(),
  clientMetrics: v.unknown(),
  clientScore: v.unknown(),
  scoreVersion: v.number(),
  status: RunStatusSchema,
  logBytes: v.number(),
  createdAt: v.string()
})
export type RunSummary = v.InferOutput<typeof RunSummarySchema>

/** Keyset-paginated run list. `nextCursor` is absent on the last page. */
export const RunListSchema = v.object({
  runs: v.array(RunSummarySchema),
  nextCursor: v.optional(v.string())
})
export type RunList = v.InferOutput<typeof RunListSchema>

/** `202 { id, status: "pending" }` from a successful submit. */
export const RunSubmitResultSchema = v.object({
  id: v.string(),
  status: RunStatusSchema
})
export type RunSubmitResult = v.InferOutput<typeof RunSubmitResultSchema>

/**
 * `GET /runs/{id}/replay` — one accepted run as a spectator sees it.
 *
 * METADATA ONLY: there is no `log` field. The event log moved to its own route
 * (`…/replay/log`) so the server can pass the stored gzip blob straight to the
 * socket instead of gunzipping it into a JSON string — see LEADERBOARDS.md,
 * "Why two requests".
 *
 * There is no word list either: `seed` + `dictHash` are what a client needs to
 * regenerate the exact text with the core's own generator, after checking the
 * dictionary it holds hashes to `dictHash`. `setup` and the server's numbers
 * stay opaque here and are typed by the core at the point of use, the same way
 * `RunSummarySchema` treats them.
 */
export const RunReplaySchema = v.object({
  runId: v.string(),
  displayName: v.string(),
  mode: v.string(),
  durationMs: v.optional(v.number()),
  wordCount: v.optional(v.number()),
  lang: v.string(),
  seed: v.number(),
  dictHash: v.string(),
  setup: v.unknown(),
  serverMetrics: v.unknown(),
  serverScore: v.unknown(),
  grade: v.string(),
  achievedAt: v.string()
})
export type RunReplay = v.InferOutput<typeof RunReplaySchema>

/**
 * `GET /runs/{id}/replay/log` — the run's event log.
 *
 * The wire body is gzip, but `Content-Encoding` is a transport detail: fetch
 * decompresses it before we see it, so this parses ordinary JSON. Only the
 * ENVELOPE is validated — the events themselves are the core's `GameEvent`
 * union, and the core's reducer is what validates those. Duplicating that union
 * as a valibot schema would be a second copy of the event contract to keep in
 * step.
 */
export const RunReplayLogSchema = v.object({
  version: v.number(),
  events: v.array(v.unknown())
})
export type RunReplayLog = v.InferOutput<typeof RunReplayLogSchema>
