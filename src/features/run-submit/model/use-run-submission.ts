/**
 * Observes the game finish surface and submits ranked runs through S1's
 * `useSubmitRunMutation`. Auth status is read (read-only) from S2's auth entity
 * barrel `@/entities/auth` (`isAuth`), which itself derives from S1's
 * `meQueryOptions`; this feature never fetches or mutates auth.
 *
 * Placement rationale (FSD): this slice orchestrates the game entity, the auth
 * entity, and the shared API layer at once. Entities MUST NOT depend on one
 * another, so cross-entity orchestration lives one layer up — hence a FEATURE,
 * not an entity. It depends only downward (shared/api, entities).
 */
import {
  computed,
  ref,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref
} from 'vue'

import { isApiError, useSubmitRunMutation } from '@shared/api'
import { useAuthStore } from '@/entities/auth'

import { buildRunPayload, isRankedMode, type RunSubmitContext } from './build-payload'
import { clearRestarts, peekRestarts } from './restart-counter'
import { runSubmissionFlow, type SubmitState } from './submit-flow'

export interface UseRunSubmissionOptions {
  /** True once the run finished normally (phase `finished`, not failed/aborted). */
  readonly finished: MaybeRefOrGetter<boolean>
  /** Assemble the finish context, or `null` when data isn't available yet. */
  readonly buildContext: () => RunSubmitContext | null
}

export interface RunSubmission {
  /** Current result-screen submission state. */
  readonly state: Ref<SubmitState>
  /** Reactive auth gate (mirrors the auth entity's `isAuth`). */
  readonly isAuthed: ComputedRef<boolean>
  /** Re-run the gated submission — wired to the results-screen retry button. */
  readonly retry: () => void
}

export function useRunSubmission(opts: UseRunSubmissionOptions): RunSubmission {
  const state = ref<SubmitState>('idle')
  const auth = useAuthStore()
  const mutation = useSubmitRunMutation()

  const isAuthed = computed(() => auth.isAuth)

  async function run(): Promise<void> {
    const ctx = opts.buildContext()
    const eligible = ctx !== null && isRankedMode(ctx.mode)
    const result = await runSubmissionFlow(
      { finished: toValue(opts.finished), authed: isAuthed.value, eligible },
      {
        submit: (payload) => mutation.mutateAsync(payload),
        // Only reached after the gate passes, so `ctx` is present. The payload
        // additionally carries the abandoned-run count (RUNS.md
        // `restartsSinceLastSubmit`) — omitted at zero, exactly what a client
        // that predates the field submits.
        buildPayload: () => {
          const restarts = peekRestarts()
          return {
            ...buildRunPayload(ctx as RunSubmitContext),
            ...(restarts > 0 ? { restartsSinceLastSubmit: restarts } : {})
          }
        },
        isNetworkError: (error) => isApiError(error) && error.status === 0,
        isAuthError: (error) => isApiError(error) && error.status === 401,
        // Matched on the CODE, not on the bare 403: a 403 is also what an
        // Origin check refuses with, and that one is a bug worth surfacing as
        // an error rather than telling the player their account is restricted.
        isRestrictedError: (error) =>
          isApiError(error) && error.status === 403 && error.code === 'account_restricted',
        onState: (next) => {
          state.value = next
        }
      }
    )
    // Accepted (as pending) — the reported window closed; start counting the
    // next one. Any non-saved terminal keeps the count for a later attempt.
    if (result === 'saved') clearRestarts()
  }

  // Auto-submit on the rising edge of `finished`; reset to idle when a fresh run
  // starts (the page rebuilds the game, flipping `finished` back to false).
  watch(
    () => toValue(opts.finished),
    (finished, previous) => {
      if (finished && !previous) void run()
      else if (!finished) state.value = 'idle'
    },
    { immediate: true }
  )

  return { state, isAuthed, retry: () => void run() }
}
