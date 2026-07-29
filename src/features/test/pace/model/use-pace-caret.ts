/**
 * The pace caret — a BOT caret racing the local field at a fixed wpm, rendered
 * through the same ghost-caret channel multiplayer opponents use. Modes
 * (config `paceCaret`): `pb` / `last` / `avg` resolve against the SERVER
 * profile (signed-in only — anonymous players see only off/custom), `custom`
 * runs at `paceCaretWpm`. The caret carries NO label: a pace bot is nobody —
 * not even the player themselves.
 *
 * Movement model: wpm is defined as 5 characters (space included) per word per
 * minute, so the bot spends `60000 / (wpm * 5)` ms on each character of the
 * TARGET text, anchored to the instant the run leaves `idle` — the same
 * starting gun the record ghost uses. Target positions only (a word costs
 * `length + 1` chars); the raw typed string is never measured.
 *
 * The bot STEPS, it does not sample. It emits one position per character, and
 * with it the time it has to get there, so the caret animates the whole way and
 * arrives exactly on the beat — monkeytype's pace-caret loop
 * (`frontend/src/ts/test/pace-caret.ts`: `duration = absoluteStepEnd - now`,
 * `easing: "linear"`, re-armed by a timer for the character after that).
 *
 * A per-frame sampler is what this replaces, and it is worth being explicit
 * about why, because it looks like the more precise of the two: a clock read
 * every frame still lands on a WHOLE character index, so the caret jumped a
 * full cell at a time and then stood still until the next one was due — the
 * per-character hopping the pace caret is supposed not to do. It also woke the
 * page every frame for a value that changes a handful of times a second. The
 * schedule below is both smoother and cheaper: no rAF at all, one write per
 * character, and the travel between two characters is the browser's to
 * interpolate.
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

/** A position plus the time the caret has to travel there. */
export interface PaceCaretStep extends PaceCaretPosition {
  /**
   * Milliseconds until this character is due — the caret's animation duration.
   * `0` is a snap (the starting line), which is the only place the bot is ever
   * placed rather than sent.
   */
  readonly glideMs: number
}

export interface PaceCaret {
  /** The bot's caret while it is on track; null renders nothing. */
  readonly caret: Ref<PaceCaretStep | null>
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
    computed(() =>
      gatedBy(profileSummaryQueryOptions(), wantsProfile.value && mode.value === 'avg')
    )
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

  const caret = shallowRef<PaceCaretStep | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null
  let startAt = 0
  /** Milliseconds per character at the captured speed. */
  let msPerChar = 0
  /** How many characters the bot has been SENT to (not how many it has reached). */
  let chars = 0

  /**
   * Send the bot to the NEXT character, giving it the whole time that is left
   * before that character is due, and re-arm for the one after it.
   *
   * The timer therefore fires when the caret ARRIVES, not when the next
   * character comes due — that one step of difference is what keeps the caret
   * permanently in motion instead of permanently a character behind.
   *
   * `dueAt` is measured off the starting gun rather than accumulated from the
   * previous step, so a late callback shortens the next glide instead of
   * pushing the whole schedule back — over a 60-second run a setTimeout that is
   * a few ms late on every character would otherwise cost the bot whole words.
   */
  const step = (): void => {
    chars += 1
    const position = pacePositionAt(game.words, chars)
    if (position === null) {
      // Out of text: the bot finished and leaves the track.
      caret.value = null
      timer = null
      return
    }
    const dueAt = startAt + chars * msPerChar
    const remaining = Math.max(0, dueAt - performance.now())
    caret.value = { ...position, glideMs: remaining }
    timer = setTimeout(step, remaining)
  }

  const stop = (): void => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    caret.value = null
  }

  watch(
    () => game.phase,
    (phase) => {
      if (phase === 'running') {
        const wpm = targetWpm.value
        if (wpm === null || opts.suspended()) return
        // Speed is captured at the starting gun — a mid-run config change never
        // warps the bot.
        msPerChar = MINUTE_MS / (wpm * CHARS_PER_WORD)
        startAt = performance.now()
        chars = 0
        if (timer !== null) clearTimeout(timer)
        // On the start line instantly; everything after this is travelled. The
        // first aim waits a macrotask so the caret is RENDERED at the start line
        // before it is sent anywhere — a brand-new element has no previous
        // transform to animate from, and would simply appear one character in.
        caret.value = { wordIndex: 0, charIndex: 0, glideMs: 0 }
        timer = setTimeout(step, 0)
        return
      }
      // idle (fresh setup) or finished — either way the bot leaves the track.
      stop()
    }
  )

  onScopeDispose(stop)

  return { caret, targetWpm }
}
