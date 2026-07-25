/**
 * Metrics — pure functions of the event log. Nothing here is accumulated inside
 * the reducer; every value is recomputed from events + context, so the live UI,
 * a replay, and a server validator all arrive at the same numbers.
 *
 * Time never comes from a tick count. Durations come from event timestamps and
 * the completion instant (`finishedAt`, itself pinned to the deadline in timed
 * mode). A tick only supplies *which instant* to measure up to for live stats.
 */

import type { GameEvent, Ms } from './events'
import { asMs, sortEvents } from './events'
import type { CoreContext, GameState } from './game-core'
import { GameCore, endsLine, initialStateOf, reduce, separatorsOf, settle } from './game-core'

export interface CharCounts {
  readonly correct: number
  readonly incorrect: number
  readonly extra: number
  readonly missed: number
}

export interface Metrics {
  /** Net words per minute: correct characters + committed spaces. */
  readonly wpm: number
  /** Raw words per minute: all produced characters, correct or not. */
  readonly raw: number
  /** Fraction in [0, 1] of correct keypresses over all keypresses (typos included). */
  readonly accuracy: number
  /** Consistency in [0, 100] via kogasa over per-word burst speeds. */
  readonly consistency: number
  readonly chars: CharCounts
  /** Committed word separators (one per advanced word). */
  readonly spaces: number
  readonly durationSec: number
}

export interface TimelinePoint {
  /** 1-based second checkpoint from test start. */
  readonly second: number
  /** Cumulative net WPM at this checkpoint (trends to the final wpm). */
  readonly wpm: number
  /** Instantaneous raw WPM for this one-second bucket. */
  readonly raw: number
  /** Incorrect keystrokes produced during this one-second bucket. */
  readonly errors: number
}

export interface ErrorWord {
  /** The target word. */
  readonly expected: string
  /** What the player committed for it (may be shorter, longer, or mistyped). */
  readonly typed: string
}

interface Analysis {
  readonly finalState: GameState
  readonly correctKeys: number
  readonly totalKeys: number
  readonly wordFirstT: readonly (number | undefined)[]
  readonly wordLastT: readonly (number | undefined)[]
  /** Every inserted keystroke with its timestamp and frozen correctness. */
  readonly keystrokes: readonly { readonly t: number; readonly correct: boolean }[]
  /** Timestamp of each committed word separator (one per word advance). */
  readonly commitTimes: readonly number[]
}

/**
 * Single left-to-right pass over the log. Reuses the reducer for navigation (so
 * word/boundary semantics never diverge) and, per inserted character, freezes
 * its correctness at the position it landed — the keystream basis for accuracy.
 */
function analyze(ctx: CoreContext, events: readonly GameEvent[]): Analysis {
  let state = initialStateOf(ctx)
  let correctKeys = 0
  let totalKeys = 0
  const wordFirstT: (number | undefined)[] = []
  const wordLastT: (number | undefined)[] = []
  const keystrokes: { t: number; correct: boolean }[] = []
  const commitTimes: number[] = []

  for (const event of sortEvents(events)) {
    state = settle(ctx, state, event.t)
    if (state.phase === 'finished') break

    if (event.kind === 'insert' || event.kind === 'replace') {
      const wordIndex = state.wordIndex
      const target = ctx.words[wordIndex] ?? ''
      const startPos = event.kind === 'replace' ? event.from : (state.input[wordIndex] ?? '').length
      for (let k = 0; k < event.text.length; k++) {
        const pos = startPos + k
        totalKeys++
        const correct = pos < target.length && target[pos] === event.text[k]
        if (correct) correctKeys++
        keystrokes.push({ t: event.t, correct })
      }
      if (wordFirstT[wordIndex] === undefined) wordFirstT[wordIndex] = event.t
      wordLastT[wordIndex] = event.t
    }

    const beforeIndex = state.wordIndex
    const result = reduce(ctx, state, event)
    if (result.isErr()) break
    state = result.value
    for (let j = beforeIndex; j < state.wordIndex; j++) commitTimes.push(event.t)
  }

  return {
    finalState: state,
    correctKeys,
    totalKeys,
    wordFirstT,
    wordLastT,
    keystrokes,
    commitTimes
  }
}

function compareWord(target: string, typed: string, includeMissed: boolean): CharCounts {
  const common = Math.min(target.length, typed.length)
  let correct = 0
  let incorrect = 0
  for (let i = 0; i < common; i++) {
    if (typed[i] === target[i]) correct++
    else incorrect++
  }
  return {
    correct,
    incorrect,
    extra: Math.max(0, typed.length - target.length),
    missed: includeMissed ? Math.max(0, target.length - typed.length) : 0
  }
}

function getChars(ctx: CoreContext, state: GameState): { chars: CharCounts; spaces: number } {
  const committed = Math.min(state.wordIndex, ctx.words.length)
  let correct = 0
  let incorrect = 0
  let extra = 0
  let missed = 0
  for (let i = 0; i < committed; i++) {
    const word = compareWord(ctx.words[i], state.input[i] ?? '', true)
    correct += word.correct
    incorrect += word.incorrect
    extra += word.extra
    missed += word.missed
  }
  // Current, not-yet-committed word: typed characters count, but untyped tail is
  // not "missed" until the word is committed.
  if (state.wordIndex < ctx.words.length) {
    const buffer = state.input[state.wordIndex] ?? ''
    if (buffer.length > 0) {
      const word = compareWord(ctx.words[state.wordIndex], buffer, false)
      correct += word.correct
      incorrect += word.incorrect
      extra += word.extra
    }
  }
  return { chars: { correct, incorrect, extra, missed }, spaces: separatorsOf(ctx, state) }
}

/** Per-word burst speeds (WPM) from first to last insert of each word. */
function burstWpms(ctx: CoreContext, analysis: Analysis): number[] {
  const out: number[] = []
  for (let i = 0; i < analysis.wordFirstT.length; i++) {
    const first = analysis.wordFirstT[i]
    const last = analysis.wordLastT[i]
    if (first === undefined || last === undefined) continue
    const durationMs = last - first
    const chars = (analysis.finalState.input[i] ?? '').length
    if (durationMs <= 0 || chars === 0) continue
    out.push(chars / 5 / (durationMs / 60000))
  }
  return out
}

/**
 * kogasa: monkeytype's consistency curve. `cov` is the coefficient of variation
 * of the burst speeds; the odd-power tanh argument maps [0, ∞) onto [0, 100]
 * where lower variance ⇒ higher consistency.
 */
export function kogasa(cov: number): number {
  return 100 * (1 - Math.tanh(cov + cov ** 3 / 3 + cov ** 5 / 5))
}

function consistency(bursts: readonly number[]): number {
  if (bursts.length === 0) return 0
  const mean = bursts.reduce((sum, b) => sum + b, 0) / bursts.length
  if (mean === 0) return 0
  const variance = bursts.reduce((sum, b) => sum + (b - mean) ** 2, 0) / bursts.length
  return kogasa(Math.sqrt(variance) / mean)
}

/**
 * Compute all metrics from the log. `endMs` is the instant to measure up to
 * (use `finishedAt` for final results, the current tick instant for live UI).
 */
export function computeMetrics(ctx: CoreContext, events: readonly GameEvent[], endMs: Ms): Metrics {
  const analysis = analyze(ctx, events)
  const { chars, spaces } = getChars(ctx, analysis.finalState)
  const startedAt = analysis.finalState.startedAt
  const end = analysis.finalState.finishedAt ?? endMs
  // Uniform across modes: for a finished timed test `finishedAt` is the deadline,
  // so `end - startedAt` already equals the configured duration.
  const durationSec = startedAt === null ? 0 : Math.max(0, (end - startedAt) / 1000)
  const minutes = durationSec / 60

  const netChars = chars.correct + spaces
  const rawChars = chars.correct + chars.incorrect + chars.extra + spaces
  return {
    wpm: minutes > 0 ? netChars / 5 / minutes : 0,
    raw: minutes > 0 ? rawChars / 5 / minutes : 0,
    accuracy: analysis.totalKeys === 0 ? 0 : analysis.correctKeys / analysis.totalKeys,
    consistency: consistency(burstWpms(ctx, analysis)),
    chars,
    spaces,
    durationSec
  }
}

/** Convenience: metrics for a live core. Measures to `finishedAt`, else `nowMs`. */
export function metricsOf(core: GameCore, nowMs?: Ms): Metrics {
  const ctx: CoreContext = { config: core.config, words: core.words }
  const end = core.state.finishedAt ?? nowMs ?? core.state.startedAt ?? asMs(0)
  return computeMetrics(ctx, core.events, end)
}

/**
 * Per-second WPM/raw timeline with per-bucket error counts — a pure function of
 * the log, for the results chart. `wpm` is cumulative net (correct characters +
 * committed spaces) so its final point tracks the summary wpm; `raw` is the rate
 * of all characters produced over the second ending at the bucket's checkpoint.
 */
export function wpmOverTime(
  ctx: CoreContext,
  events: readonly GameEvent[],
  endMs: Ms
): TimelinePoint[] {
  const analysis = analyze(ctx, events)
  const startedAt = analysis.finalState.startedAt
  if (startedAt === null) return []
  const end = analysis.finalState.finishedAt ?? endMs
  const seconds = Math.ceil(Math.max(0, (end - startedAt) / 1000))
  // Mirror `separatorsOf`: a count-finished test's final word has no trailing
  // space, and a word that ends its own line already typed its separator as a
  // `\n` character — neither contributes a separator to the cumulative wpm.
  const finishedByCount =
    analysis.finalState.phase === 'finished' &&
    ctx.config.mode !== 'time' &&
    ctx.config.mode !== 'free'
  const spaceTimes: number[] = []
  for (let i = 0; i < analysis.commitTimes.length; i++) {
    if (finishedByCount && i === analysis.commitTimes.length - 1) continue
    if (endsLine(ctx.words[i] ?? '')) continue
    spaceTimes.push(analysis.commitTimes[i])
  }
  const points: TimelinePoint[] = []
  for (let s = 1; s <= seconds; s++) {
    const bucketStart = startedAt + (s - 1) * 1000
    const bucketEnd = startedAt + s * 1000
    const checkpoint = Math.min(bucketEnd, end)
    // A count-mode run finishes ON its last keystroke, so the trailing bucket is
    // usually a sliver (a few ms wide). `raw` is a RATE: dividing the keys inside
    // that sliver by its own width is what sent the last chart point past 1000
    // wpm. Its window is therefore always a full second — for the trailing bucket
    // the one ENDING at the finish (clamped at the run's start), not the sliver.
    const tail = checkpoint < bucketEnd
    const rateStart = Math.max(startedAt, checkpoint - 1000)
    let correctSoFar = 0
    let rawInWindow = 0
    let errorsInBucket = 0
    for (const key of analysis.keystrokes) {
      if (key.t <= checkpoint && key.correct) correctSoFar++
      // Errors stay bucket-local: they are a count, not a rate, and the windows
      // of the last two points overlap.
      if (key.t >= bucketStart && key.t < bucketEnd && !key.correct) errorsInBucket++
      // No keystroke is past `end`, so the tail window needs no upper bound.
      const inWindow = tail ? key.t >= rateStart : key.t >= bucketStart && key.t < bucketEnd
      if (inWindow) rawInWindow++
    }
    let spacesSoFar = 0
    for (const t of spaceTimes) if (t <= checkpoint) spacesSoFar++
    const elapsedMin = (checkpoint - startedAt) / 60000
    const rateMin = (checkpoint - rateStart) / 60000
    points.push({
      second: s,
      wpm: elapsedMin > 0 ? (correctSoFar + spacesSoFar) / 5 / elapsedMin : 0,
      raw: rateMin > 0 ? rawInWindow / 5 / rateMin : 0,
      errors: errorsInBucket
    })
  }
  return points
}

/** Committed words whose typed text differs from the target (word + what was typed). */
export function errorWords(ctx: CoreContext, events: readonly GameEvent[]): ErrorWord[] {
  const { finalState } = analyze(ctx, events)
  const committed = Math.min(finalState.wordIndex, ctx.words.length)
  const out: ErrorWord[] = []
  for (let i = 0; i < committed; i++) {
    const expected = ctx.words[i]
    const typed = finalState.input[i] ?? ''
    if (typed !== expected) out.push({ expected, typed })
  }
  return out
}

/** Convenience: WPM timeline for a live core (measures to finish, else `nowMs`). */
export function timelineOf(core: GameCore, nowMs?: Ms): TimelinePoint[] {
  const ctx: CoreContext = { config: core.config, words: core.words }
  const end = core.state.finishedAt ?? nowMs ?? core.state.startedAt ?? asMs(0)
  return wpmOverTime(ctx, core.events, end)
}

/** Convenience: error-word list for a finished/live core. */
export function errorWordsOf(core: GameCore): ErrorWord[] {
  return errorWords({ config: core.config, words: core.words }, core.events)
}

/** One-second AFK accounting over a run's window (see {@link afkOf}). */
export interface AfkStats {
  /** Idle time in ms — `buckets × 1000`. */
  readonly afkMs: number
  /** Number of whole one-second buckets that contained no input. */
  readonly buckets: number
}

const AFK_BUCKET_MS = 1000

/**
 * AFK time, log-derived and pure (monkeytype's `getAfkDuration`, ported to our
 * event log): the run window is cut into whole one-second buckets and every
 * bucket that contains NO event counts as one AFK second. Every event kind is a
 * keystroke — `insert`/`replace` are characters, `delete` is a backspace,
 * `commit` is a space — so "no event" is exactly "no key was pressed".
 *
 * The window is `startedAt → finishedAt`, pinned to the deadline in timed mode
 * (so a run that ends idle counts its trailing silence) and to `endMs` for a
 * still-running log. Bucket `i` spans `(start + (i-1)s, start + i·s]`, with the
 * start instant itself belonging to bucket 1 — the same half-open grid
 * monkeytype buckets on. A partial trailing bucket is never counted, so AFK can
 * never exceed the run duration.
 *
 * NOTE the window's honesty limit: an ABANDONED count-mode run has no end
 * instant in its log, so `endMs` falls back to the last event and the trailing
 * silence is invisible. Idle time is measurable exactly where the end is proven
 * — timed runs (deadline), completed runs, and MinSpeed fails (derived instant).
 */
export function afkOf(ctx: CoreContext, events: readonly GameEvent[], endMs: Ms): AfkStats {
  const { finalState } = analyze(ctx, events)
  const start = finalState.startedAt
  if (start === null) return { afkMs: 0, buckets: 0 }
  const end = finalState.finishedAt ?? endMs
  const bucketCount = Math.floor((end - start) / AFK_BUCKET_MS)
  if (bucketCount <= 0) return { afkMs: 0, buckets: 0 }

  // One flag per bucket: the bucket index is derived arithmetic, so a flat
  // array beats a Set of boxed numbers (and this runs on every results screen).
  const active = new Uint8Array(bucketCount + 1)
  let activeCount = 0
  for (const event of events) {
    const offset = event.t - start
    if (offset < 0) continue
    const bucket = offset <= 0 ? 1 : Math.ceil(offset / AFK_BUCKET_MS)
    if (bucket > bucketCount || active[bucket] === 1) continue
    active[bucket] = 1
    activeCount += 1
  }
  const buckets = bucketCount - activeCount
  return { afkMs: buckets * AFK_BUCKET_MS, buckets }
}

/** Convenience: AFK stats for a live core (measures to finish, else `nowMs`). */
export function afkStatsOf(core: GameCore, nowMs?: Ms): AfkStats {
  const ctx: CoreContext = { config: core.config, words: core.words }
  return afkOf(ctx, core.events, core.state.finishedAt ?? nowMs ?? core.state.startedAt ?? asMs(0))
}
