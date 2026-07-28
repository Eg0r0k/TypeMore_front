import { computed, type ComputedRef, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import {
  dictionaryBodyByHashQueryOptions,
  quoteByIdQueryOptions,
  runReplayLogQueryOptions,
  runReplayQueryOptions
} from '@shared/api'
import type { ReplayData } from '@entities/game'
import { quoteRefOf, replayFromApi, type ReplayTextSource } from './replay-from-api'

/**
 * What a consumer of a public run needs to know while it assembles:
 *
 * - `loading`   — one of the three requests is still in flight.
 * - `not-found` — the run itself 404'd (under review / rejected / pending /
 *   banned owner all answer the same, on purpose).
 * - `error`     — the run exists but its payload did not arrive or did not
 *   verify (log failed, text failed, hash mismatch, malformed log).
 * - `ready`     — `replay` carries the reconstructed run.
 */
export type ReplaySourceState = 'loading' | 'not-found' | 'error' | 'ready'

export interface ReplaySource {
  readonly state: ComputedRef<ReplaySourceState>
  /** The reconstructed run, once `state` is `ready`. */
  readonly replay: ComputedRef<ReplayData | null>
  /** The player the run belongs to, as soon as the metadata lands. */
  readonly displayName: ComputedRef<string | undefined>
  readonly retry: () => void
}

/**
 * The public-replay assembly — metadata, event log and the run's text, the
 * same three requests and the same `replayFromApi` verification the replay
 * page performs — as a composable, for surfaces that need the DATA without
 * that page's stage-by-stage error taxonomy (the race seat: either the ghost
 * can be built, or the race cannot start and one honest error line will do).
 *
 * The log and the text are gated on the metadata SUCCEEDING, not settling:
 * asking for the log of a run the server just 404'd would burn a second
 * rate-limit token (the two replay routes share one bucket).
 */
export function useReplaySource(runId: Ref<string>): ReplaySource {
  const gatedBy = <T extends object>(options: T, enabled: boolean): T & { enabled: boolean } => ({
    ...options,
    enabled
  })

  const meta = useQuery(computed(() => runReplayQueryOptions(runId.value)))
  const runIsReal = computed(() => meta.isSuccess.value)

  const log = useQuery(
    computed(() => gatedBy(runReplayLogQueryOptions(runId.value), runIsReal.value))
  )

  const quoteRef = computed(() => {
    const m = meta.data.value
    return m ? quoteRefOf(m) : null
  })
  const isQuoteRun = computed(() => quoteRef.value !== null)

  const dictHash = computed(() => meta.data.value?.dictHash ?? '')
  const dict = useQuery(
    computed(() =>
      gatedBy(
        dictionaryBodyByHashQueryOptions(dictHash.value),
        runIsReal.value && !isQuoteRun.value && dictHash.value !== ''
      )
    )
  )
  const quote = useQuery(
    computed(() =>
      gatedBy(
        quoteByIdQueryOptions(quoteRef.value?.quoteId ?? ''),
        runIsReal.value && isQuoteRun.value
      )
    )
  )

  const textSource = computed<ReplayTextSource | null>(() => {
    if (isQuoteRun.value) {
      const q = quote.data.value
      return q ? { kind: 'quote', quote: q } : null
    }
    const d = dict.data.value
    return d ? { kind: 'dictionary', body: d } : null
  })

  const built = computed(() => {
    const m = meta.data.value
    const l = log.data.value
    const s = textSource.value
    if (!m || !l || !s) return null
    return replayFromApi(m, l, s)
  })

  const state = computed<ReplaySourceState>(() => {
    if (meta.isError.value) return 'not-found'
    if (!meta.data.value) return 'loading'
    if (log.isError.value) return 'error'
    if (isQuoteRun.value ? quote.isError.value : dict.isError.value) return 'error'
    const result = built.value
    if (!result) return 'loading'
    return result.isOk() ? 'ready' : 'error'
  })

  return {
    state,
    replay: computed(() => {
      const result = built.value
      return result?.isOk() === true ? result.value : null
    }),
    displayName: computed(() => meta.data.value?.displayName),
    retry: () => {
      if (meta.isError.value) void meta.refetch()
      if (log.isError.value) void log.refetch()
      if (dict.isError.value) void dict.refetch()
      if (quote.isError.value) void quote.refetch()
    }
  }
}
