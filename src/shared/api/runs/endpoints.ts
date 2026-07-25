import * as v from 'valibot'
import { request } from '../transport'
import {
  RunListSchema,
  RunReplayLogSchema,
  RunReplaySchema,
  RunSubmitResultSchema,
  RunSummarySchema,
  type RunList,
  type RunReplay,
  type RunReplayLog,
  type RunSubmitResult,
  type RunSummary
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

export const getRun = (id: string): Promise<RunSummary> => request(`/runs/${id}`, RunSummarySchema)

/**
 * The OWNER's own log, at any status, via the authenticated detail route.
 * Distinct from the public replay pair below, which serves accepted runs to
 * anyone and is what a leaderboard row links to.
 */
export const getRunLog = (id: string): Promise<unknown> =>
  request(`/runs/${id}`, v.unknown(), { query: { log: 1 } })

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
