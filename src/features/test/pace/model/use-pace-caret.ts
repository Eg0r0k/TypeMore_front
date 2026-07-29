/**
 * The pace caret — a BOT caret racing the local field at a fixed wpm, rendered
 * through the same ghost-caret channel multiplayer opponents use. Modes
 * (config `paceCaret`): `pb` / `last` / `avg` resolve against the SERVER
 * profile (signed-in only — anonymous players see only off/custom), `custom`
 * runs at `paceCaretWpm`. The caret carries NO label: a pace bot is nobody —
 * not even the player themselves.
 *
 * Movement model: wpm is defined as 5 characters (space included) per word per
 * minute, so the bot advances through the TARGET text at `wpm * 5 / 60000`
 * chars per ms, anchored to the instant the run leaves `idle` — the same
 * starting gun the record ghost uses. Target positions only (a word costs
 * `length + 1` chars); the raw typed string is never measured.
 *
 * Placement rationale (FSD): reads the game entity, the auth entity and the
 * profile API at once — cross-entity orchestration, hence a feature.
 */
import { computed, onScopeDispose, shallowRef, watch, type ComputedRef, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'

import { useAuthStore } from '@/entities/auth'
import { useConfigStore } from '@/entities/config'
import type { useGameStore } from '@entities/game'
import { profilePBsQueryOptions, profileSummaryQueryOptions, runsQueryOptions } from '@shared/api'
import { ConfigModes } from '@/shared/constants/type'

export interface PaceCaretPosition {
  readonly wordIndex: number
  readonly charIndex: number
}

export interface PaceCaret {
  /** The bot's caret while it is on track; null renders nothing. */
  readonly caret: Ref<PaceCaretPosition | null>
  /** The speed the CURRENT mode resolves to, or null (off / no data yet). */
  readonly targetWpm: ComputedRef<number | null>
}

/** wpm → chars per millisecond (1 word = 5 chars, the metric's own definition). */
const CHARS_PER_WORD = 5
const MINUTE_MS = 60_000

/**
 * Where a bot that has consumed `chars` characters of the target text stands.
 * A word costs `length + 1` (its letters plus the committing space; the space
 * slot clamps to "past the last letter", which the measurer draws at the
 * letter's right edge). Past the last word's last letter → null: finished.
 * Pure and exported for the unit tests — the composable only adds the clock.
 */
export const pacePositionAt = (
  words: readonly string[],
  chars: number
): PaceCaretPosition | null => {
  if (words.length === 0) return null
  // A pre-start clock (negative chars) stands ON the start line, not at char -1.
  const consumed = Math.max(0, chars)
  let offset = 0
  let index = 0
  while (index < words.length - 1 && offset + words[index].length + 1 <= consumed) {
    offset += words[index].length + 1
    index += 1
  }
  const within = consumed - offset
  if (within >= words[index].length && index === words.length - 1) return null
  return { wordIndex: index, charIndex: Math.min(within, words[index].length) }
}

export function usePaceCaret(opts: {
  game: ReturnType<typeof useGameStore>
  /** True while something else owns the ghost channel (a record race). */
  suspended: () => boolean
}): PaceCaret {
  const { game } = opts
  const config = useConfigStore().config
  const auth = useAuthStore()

  const mode = computed(() => config.paceCaret)
  const wantsProfile = computed(
    () => auth.isAuth && (mode.value === 'pb' || mode.value === 'last' || mode.value === 'avg')
  )

  // Generic spread keeps the options' exact (const-keyed) type — an inline
  // object literal widens the queryKey and the overloads stop matching.
  const gatedBy = <T extends object>(options: T, enabled: boolean): T & { enabled: boolean } => ({
    ...options,
    enabled
  })

  // Profile-backed sources, fetched only when their mode is actually selected
  // (and never for a guest — those modes are not offered to one).
  const pbs = useQuery(
    computed(() => gatedBy(profilePBsQueryOptions(), wantsProfile.value && mode.value === 'pb'))
  )
  const summary = useQuery(
    computed(() => gatedBy(profileSummaryQueryOptions(), wantsProfile.value && mode.value === 'avg'))
  )
  const lastRuns = useQuery(
    computed(() => gatedBy(runsQueryOptions(), wantsProfile.value && mode.value === 'last'))
  )

  /** The PB bucket the CURRENT solo settings would rank on (seeded modes only). */
  const pbBucket = computed<string | null>(() => {
    if (config.mode === ConfigModes.Time) {
      return `time:${config.time * 1000}:${config.language}:seeded`
    }
    if (config.mode === ConfigModes.Words) {
      return `words:${config.words}:${config.language}:seeded`
    }
    return null
  })

  const pbWpm = computed<number | null>(() => {
    const bucket = pbBucket.value
    if (bucket === null) return null
    const pb = pbs.data.value?.pbs.find((entry) => entry.bucket === bucket)
    return pb === undefined ? null : pb.wpm
  })

  /** The latest submitted run's wpm — the verdict's number when judged, the client's until. */
  const lastWpm = computed<number | null>(() => {
    const run = lastRuns.data.value?.runs[0]
    if (run === undefined) return null
    const metrics = (run.serverMetrics ?? run.clientMetrics) as { wpm?: number } | null
    return typeof metrics?.wpm === 'number' && metrics.wpm > 0 ? metrics.wpm : null
  })

  const avgWpm = computed<number | null>(() => {
    const avg = summary.data.value?.wpm.averageLast10
    return typeof avg === 'number' && avg > 0 ? avg : null
  })

  const targetWpm = computed<number | null>(() => {
    switch (mode.value) {
      case 'custom':
        return config.paceCaretWpm > 0 ? config.paceCaretWpm : null
      case 'pb':
        return auth.isAuth ? pbWpm.value : null
      case 'last':
        return auth.isAuth ? lastWpm.value : null
      case 'avg':
        return auth.isAuth ? avgWpm.value : null
      default:
        return null
    }
  })

  const caret = shallowRef<PaceCaretPosition | null>(null)
  let rafId = 0
  let startAt = 0
  /** Speed is captured at the starting gun — a mid-run config change never warps the bot. */
  let runWpm = 0

  const frame = (now: number): void => {
    // The rAF timestamp is the frame's vsync instant and can PREDATE the
    // performance.now() taken at the starting gun — an unclamped first frame
    // floors to chars = -1 and walks the bot to charIndex -1.
    const chars = Math.floor((Math.max(0, now - startAt) * runWpm * CHARS_PER_WORD) / MINUTE_MS)
    const position = pacePositionAt(game.words, chars)
    caret.value = position
    if (position === null) return // The bot finished; nothing left to draw.
    rafId = requestAnimationFrame(frame)
  }

  const stop = (): void => {
    cancelAnimationFrame(rafId)
    caret.value = null
  }

  watch(
    () => game.phase,
    (phase) => {
      if (phase === 'running') {
        const wpm = targetWpm.value
        if (wpm === null || opts.suspended()) return
        runWpm = wpm
        startAt = performance.now()
        caret.value = { wordIndex: 0, charIndex: 0 }
        cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(frame)
        return
      }
      // idle (fresh setup) or finished — either way the bot leaves the track.
      stop()
    }
  )

  onScopeDispose(stop)

  return { caret, targetWpm }
}
