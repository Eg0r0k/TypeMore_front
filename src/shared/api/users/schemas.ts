import * as v from 'valibot'
import { RunStatusSchema } from '../runs/schemas'

/**
 * Layer 1 — Public profile schemas, mirroring the backend's `docs/PROFILE.md`
 * ("Public profiles"). The data payloads (summary/activity/histogram/
 * timeseries/pbs/portrait) reuse the profile domain's schemas verbatim — the
 * server serves them from the same aggregation code, and a second copy here
 * would be a contract that can drift.
 */

/**
 * `GET /users/{name}` — the header. The ONE payload a closed profile still
 * answers with: identity plus the fact of being closed. `public: false` is a
 * state the page renders, never a 404.
 */
export const PublicProfileSchema = v.object({
  name: v.string(),
  joined: v.string(),
  public: v.boolean()
})
export type PublicProfile = v.InferOutput<typeof PublicProfileSchema>

/**
 * One public-history row — the server-side ALLOWLIST twin of `RunSummary`:
 * verdict numbers and derived display cells only. Everything a row needs to
 * render in the shared runs table is here; everything the owner reported and
 * everything moderation recorded is not, by the backend's contract
 * (`TestPublicRunPayloadIsAnAllowlist` pins the exact key set server-side).
 */
export const PublicRunSchema = v.object({
  id: v.string(),
  mode: v.string(),
  durationMs: v.nullish(v.number()),
  wordCount: v.nullish(v.number()),
  lang: v.string(),
  serverMetrics: v.nullish(v.unknown()),
  serverScore: v.nullish(v.unknown()),
  createdAt: v.string(),
  /** Constant "accepted" by construction — only accepted runs are public. */
  status: RunStatusSchema,
  grade: v.nullish(v.string()),
  consistency: v.nullish(v.number()),
  chars: v.nullish(
    v.object({
      correct: v.number(),
      incorrect: v.number(),
      extra: v.number(),
      missed: v.number()
    })
  ),
  quoteId: v.nullish(v.string()),
  adoptedFromRunId: v.nullish(v.string()),
  mods: v.nullish(v.unknown())
})
export type PublicRun = v.InferOutput<typeof PublicRunSchema>

/** Keyset-paginated public history. `nextCursor` absent on the last page. */
export const PublicRunListSchema = v.object({
  runs: v.array(PublicRunSchema),
  nextCursor: v.optional(v.string())
})
export type PublicRunList = v.InferOutput<typeof PublicRunListSchema>
