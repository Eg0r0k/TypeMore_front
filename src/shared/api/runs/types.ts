/** Layer 1 — Runs request payloads. */

export interface ListRunsParams {
  cursor?: string
  /** Defaults to 20 server-side, clamped to 100. */
  limit?: number
}

/**
 * POST /runs body. `setup`/`clientMetrics`/`clientScore`/`log` are opaque JSON
 * produced by the game core (fenced) and stored verbatim.
 *
 * Exactly one of `durationMs` / `wordCount` is set — EXCEPT on a quote run,
 * which carries neither: its length is the quote's, named by the `quoteId` in
 * `setup.generation.textSource` (RUNS.md, "Dimensions are conditional on the
 * text source"). `build-payload.ts` is the one place that decides which.
 */
export interface RunSubmitInput {
  mode: string
  durationMs?: number
  wordCount?: number
  lang: string
  seed: number
  dictHash: string
  scoreVersion: number
  /**
   * Tests started and abandoned since the previous submission (RUNS.md §
   * restartsSinceLastSubmit). Optional — omitted means 0; server-clamped to
   * [0, 10 000]. Client-counted and unverifiable by design; feeds profile
   * statistics only.
   */
  restartsSinceLastSubmit?: number
  setup: unknown
  clientMetrics: unknown
  clientScore: unknown
  log: unknown
}
