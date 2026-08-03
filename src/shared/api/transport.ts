import { ofetch, FetchError, type FetchOptions } from 'ofetch'
import * as v from 'valibot'

/**
 * Layer 1 — Transport.
 *
 * A single ofetch instance plus response-boundary parsing and error
 * normalization. Nothing in this file knows about Vue Query; components MUST
 * NOT import it directly (they touch the server-state layer + the error type).
 */

/**
 * Configured API base (includes the `/api/v1` prefix), never trailing-slashed.
 * `VITE_API_BASE_URL` is a legacy alias kept for older deployment configs.
 * Lazy so module load never touches `window` — some test envs have no DOM.
 */
export const apiBase = (): string => {
  const env = import.meta.env
  const base = env.VITE_API_URL ?? env.VITE_API_BASE_URL ?? globalThis.location?.origin ?? ''
  return base.replace(/\/$/, '')
}

/** Responses with no meaningful typed body (cookie side effects only). */
export const NoContentSchema = v.unknown()

/** Normalized shape every failed request collapses to. */
export interface ApiErrorShape {
  status: number
  code: string
  message?: string
}

/** The only error type the app ever catches from the API layer. */
export class ApiError extends Error implements ApiErrorShape {
  readonly status: number
  readonly code: string

  constructor(shape: ApiErrorShape) {
    super(shape.message ?? shape.code)
    this.name = 'ApiError'
    this.status = shape.status
    this.code = shape.code
  }
}

/** Type guard: narrows an unknown caught value to {@link ApiError}. */
export const isApiError = (value: unknown): value is ApiError => value instanceof ApiError

/** Server error envelope: `{"error":"<code>","message":"..."}`. */
const ErrorBodySchema = v.object({
  error: v.string(),
  message: v.optional(v.string())
})

/**
 * Maps an HTTP status + raw response body to a normalized {@link ApiError}.
 * Exported for unit testing the normalization table.
 */
export const apiErrorFromResponse = (
  status: number,
  body: unknown,
  fallbackMessage?: string
): ApiError => {
  const parsed = v.safeParse(ErrorBodySchema, body)
  if (parsed.success) {
    return new ApiError({ status, code: parsed.output.error, message: parsed.output.message })
  }
  return new ApiError({
    status,
    code: status === 0 ? 'network_error' : 'unknown',
    message: fallbackMessage
  })
}

/** Collapses any thrown value into a normalized {@link ApiError}. */
export const normalizeError = (err: unknown): ApiError => {
  if (isApiError(err)) return err
  if (err instanceof FetchError) {
    return apiErrorFromResponse(err.response?.status ?? 0, err.data, err.message)
  }
  return new ApiError({
    status: 0,
    code: 'network_error',
    message: err instanceof Error ? err.message : String(err)
  })
}

/** Shared ofetch instance. `retry: 0` guarantees 4xx (and everything) never auto-retries. */
export const http = ofetch.create({
  baseURL: apiBase(),
  credentials: 'include',
  retry: 0,
  headers: { Accept: 'application/json' }
})

/**
 * Performs a request and valibot-parses the response at the boundary.
 * Transport failures → normalized {@link ApiError}; a malformed body that fails
 * the schema also throws a normalized {@link ApiError} (`code: 'invalid_response'`).
 */
export const request = async <S extends v.GenericSchema>(
  url: string,
  schema: S,
  opts?: FetchOptions
): Promise<v.InferOutput<S>> => {
  let raw: unknown
  /**
   * DEV ONLY — the profile preview (`shared/dev-preview`) answers here, before
   * the network, when its flag is on. The import is inside a DEV-guarded branch
   * so the whole module (fixtures included) is dead code a production build
   * drops. A fixture still goes through the parse below: a preview that would
   * fail the contract must fail here too.
   */
  const preview = import.meta.env.DEV
    ? (await import('../dev-preview/handler')).devPreviewResponse(url, {
        query: opts?.query,
        method: typeof opts?.method === 'string' ? opts.method : undefined
      })
    : null

  if (preview !== null) {
    if (preview.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, preview.delayMs))
    raw = preview.body
  } else {
    try {
      raw = await http(url, opts)
    } catch (err) {
      throw normalizeError(err)
    }
  }

  const parsed = v.safeParse(schema, raw)
  if (!parsed.success) {
    throw new ApiError({
      status: 0,
      code: 'invalid_response',
      message: 'Response body failed schema validation'
    })
  }
  return parsed.output
}
