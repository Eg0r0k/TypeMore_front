/** Layer 1 — Runs request payloads. */

export interface ListRunsParams {
  cursor?: string
  /** Defaults to 20 server-side, clamped to 100. */
  limit?: number
}

/**
 * POST /runs body. `setup`/`clientMetrics`/`clientScore`/`log` are opaque JSON
 * produced by the game core (fenced) and stored verbatim. Exactly one of
 * `durationMs` / `wordCount` is set.
 */
export interface RunSubmitInput {
  mode: string
  durationMs?: number
  wordCount?: number
  lang: string
  seed: number
  dictHash: string
  scoreVersion: number
  setup: unknown
  clientMetrics: unknown
  clientScore: unknown
  log: unknown
}
