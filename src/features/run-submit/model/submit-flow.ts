/**
 * Framework-free submission state machine. Owns the trigger gate, the exactly-once
 * network retry, and the mid-flight 401 → guest transition. Kept pure (deps are
 * injected) so it is testable without Vue, Pinia, or a live query client.
 */
import type { RunSubmitInput } from '@shared/api'

/**
 * Observable result-screen state:
 * - `idle`       run not finished / nothing to show
 * - `ineligible` finished but mode is not ranked-eligible (no save UI)
 * - `guest`      not authed, or session lost mid-flight → "sign in to save" hint
 * - `saving`     POST in flight
 * - `saved`      accepted as PENDING (saved ≠ counted — awaiting validation)
 * - `error`      network failure persisted after one retry, or a rejected body
 */
export type SubmitState = 'idle' | 'ineligible' | 'guest' | 'saving' | 'saved' | 'error'

/** The three independent trigger conditions; submit fires only when all hold. */
export interface SubmissionGate {
  readonly finished: boolean
  readonly authed: boolean
  readonly eligible: boolean
}

export interface RunSubmissionDeps {
  /** Perform one POST; rejects on failure (S1 mutation `mutateAsync`). */
  readonly submit: (payload: RunSubmitInput) => Promise<unknown>
  /** Assemble the payload; called only once the gate passes. */
  readonly buildPayload: () => RunSubmitInput
  /** True for a transport failure (ApiError status 0) — the only retryable class. */
  readonly isNetworkError: (error: unknown) => boolean
  /** True for a 401 — session lost; degrade to the guest hint. */
  readonly isAuthError: (error: unknown) => boolean
  /** Emitted on every state transition so the view stays in sync. */
  readonly onState: (state: SubmitState) => void
}

/**
 * Run the gated submission. Returns the terminal state and reports every
 * transition through `onState`. Retries EXACTLY once, and ONLY on a network
 * error — 4xx (validation, 401) never auto-retries at this layer (S1's query
 * layer already skips 4xx retry). A 401 at any point collapses to `guest`.
 */
export async function runSubmissionFlow(
  gate: SubmissionGate,
  deps: RunSubmissionDeps
): Promise<SubmitState> {
  const set = (state: SubmitState): SubmitState => {
    deps.onState(state)
    return state
  }

  if (!gate.finished) return set('idle')
  if (!gate.eligible) return set('ineligible')
  if (!gate.authed) return set('guest')

  set('saving')
  const payload = deps.buildPayload()

  try {
    await deps.submit(payload)
    return set('saved')
  } catch (first) {
    if (deps.isAuthError(first)) return set('guest')
    if (!deps.isNetworkError(first)) return set('error')
    // Single automatic re-submit for the network case.
    try {
      await deps.submit(payload)
      return set('saved')
    } catch (second) {
      if (deps.isAuthError(second)) return set('guest')
      return set('error')
    }
  }
}
