import { request } from '../transport'
import {
  RunListSchema,
  RunReplayLogSchema,
  RunReplaySchema,
  RunSubmitResultSchema,
  type RunList,
  type RunReplay,
  type RunReplayLog,
  type RunSubmitResult
} from './schemas'
import type { ListRunsParams, RunSubmitInput } from './types'

/**
 * Layer 1 — Typed run endpoints mirroring the backend's `docs/RUNS.md`. Each
 * returns a parsed, validated payload; components go through the server-state
 * layer instead.
 */

export const submitRun = (input: RunSubmitInput): Promise<RunSubmitResult> =>
  request('/runs', RunSubmitResultSchema, { method: 'POST', body: input })

export const listRuns = (params: ListRunsParams = {}): Promise<RunList> =>
  request('/runs', RunListSchema, { query: { cursor: params.cursor, limit: params.limit } })

/**
 * `GET /runs/{id}/replay` — public replay METADATA for one accepted run.
 * No session, no log payload. Every refusal is a 404 by design, so a spectator
 * cannot tell "under review" from "never existed".
 */
export const getRunReplay = (id: string): Promise<RunReplay> =>
  request(`/runs/${id}/replay`, RunReplaySchema)

/**
 * `GET /runs/{id}/replay/log` — the event log for the same run.
 *
 * A PLAIN JSON request. The server sends the stored gzip bytes with
 * `Content-Encoding: gzip`, and fetch decompresses them before ofetch parses
 * them — there is nothing to decode by hand here, and deliberately no base64
 * and no `DecompressionStream`. Doing either would mean re-implementing what
 * the HTTP stack already did.
 */
export const getRunReplayLog = (id: string): Promise<RunReplayLog> =>
  request(`/runs/${id}/replay/log`, RunReplayLogSchema)
