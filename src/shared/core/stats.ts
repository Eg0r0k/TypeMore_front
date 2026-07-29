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
import { asMs, isTelemetryEvent, sortEvents } from './events'
import type { CoreContext, GameState } from './game-core'
import {
  GameCore,
  bufferOf,
  endsLine,
  initialStateOf,
  reduce,
  separatorsOf,
  settle
} from './game-core'

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
  /**
   * Fraction in [0, 1]: {@link kogasa} over the coefficient of variation of the
   * per-second raw WPM series (monkeytype's consistency, on accuracy's scale).
   */
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

/**
 * The result of one replay pass over a log. Exported because `score.ts` needs
 * BOTH the metrics and the fold's final state, and paying for two identical
 * trajectories over a 40,000-event log is the whole reason this exists.
 */
export interface LogAnalysis {
  /** The state the log folds to, WITHOUT the trailing `settle` that `foldLog` applies. */
  readonly finalState: GameState
  /**
   * The pass stopped before the end of the log — the run had already finished, or
   * the reducer rejected an event. Exactly where `foldLog` would return an error.
   */
  readonly aborted: boolean
  readonly correctKeys: number
  readonly totalKeys: number
  readonly wordFirstT: readonly (number | undefined)[]
  readonly wordLastT: readonly (number | undefined)[]
  /**
   * Every inserted keystroke, as two parallel arrays: timestamp, and correctness
   * frozen at the position it landed. Parallel rather than an object per key so a
   * long log does not allocate one short-lived object per character.
   */
  readonly keyTimes: readonly number[]
  readonly keyCorrect: readonly boolean[]
  /** Third parallel array: the word index each keystroke landed in. */
  readonly keyWordIndex: readonly number[]
  /** Timestamp of each committed word separator (one per word advance). */
  readonly commitTimes: readonly number[]
}

/**
 * Single left-to-right pass over the log. Reuses the reducer for navigation (so
 * word/boundary semantics never diverge) and, per inserted character, freezes
 * its correctness at the position it landed — the keystream basis for accuracy.
 */
export function analyzeLog(ctx: CoreContext, events: readonly GameEvent[]): LogAnalysis {
  let state = initialStateOf(ctx)
  let correctKeys = 0
  let totalKeys = 0
  let aborted = false
  const wordFirstT: (number | undefined)[] = []
  const wordLastT: (number | undefined)[] = []
  const keyTimes: number[] = []
  const keyCorrect: boolean[] = []
  const keyWordIndex: number[] = []
  const commitTimes: number[] = []

  // Metrics and score are functions of the STATE events alone: log-v2 telemetry
  // (`down`/`up`) is invisible here by contract — a v2 log must analyze
  // bit-identically to the same run captured as v1 (the stripping property).
  // Filtering also keeps the trailing-`up`-after-finish case from reading as an
  // aborted replay. On a v1 log this filter is the identity.
  events = events.some(isTelemetryEvent) ? events.filter((e) => !isTelemetryEvent(e)) : events

  for (const event of sortEvents(events)) {
    state = settle(ctx, state, event.t)
    if (state.phase === 'finished') {
      aborted = true
      break
    }

    if (event.kind === 'insert' || event.kind === 'replace') {
      const wordIndex = state.wordIndex
      const target = ctx.words[wordIndex] ?? ''
      const startPos = event.kind === 'replace' ? event.from : bufferOf(state, wordIndex).length
      for (let k = 0; k < event.text.length; k++) {
        const pos = startPos + k
        totalKeys++
        const correct = pos < target.length && target[pos] === event.text[k]
        if (correct) correctKeys++
        keyTimes.push(event.t)
        keyCorrect.push(correct)
        keyWordIndex.push(wordIndex)
      }
      if (wordFirstT[wordIndex] === undefined) wordFirstT[wordIndex] = event.t
      wordLastT[wordIndex] = event.t
    }

    const beforeIndex = state.wordIndex
    const result = reduce(ctx, state, event)
    if (result.isErr()) {
      aborted = true
      break
    }
    state = result.value
    for (let j = beforeIndex; j < state.wordIndex; j++) commitTimes.push(event.t)
  }

  return {
    finalState: state,
    aborted,
    correctKeys,
    totalKeys,
    wordFirstT,
    wordLastT,
    keyTimes,
    keyCorrect,
    keyWordIndex,
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
  // One materialization, then plain indexing — `state.input` is a getter now.
  const input = state.input
  let correct = 0
  let incorrect = 0
  let extra = 0
  let missed = 0
  for (let i = 0; i < committed; i++) {
    const word = compareWord(ctx.words[i], input[i] ?? '', true)
    correct += word.correct
    incorrect += word.incorrect
    extra += word.extra
    missed += word.missed
  }
  // Current, not-yet-committed word: typed characters count, but untyped tail is
  // not "missed" until the word is committed.
  if (state.wordIndex < ctx.words.length) {
    const buffer = input[state.wordIndex] ?? ''
    if (buffer.length > 0) {
      const word = compareWord(ctx.words[state.wordIndex], buffer, false)
      correct += word.correct
      incorrect += word.incorrect
      extra += word.extra
    }
  }
  return { chars: { correct, incorrect, extra, missed }, spaces: separatorsOf(ctx, state) }
}

/**
 * kogasa: monkeytype's consistency curve, on a [0, 1] scale. `cov` is the
 * coefficient of variation of the per-second raw WPM series; the odd-power tanh
 * argument (the first terms of artanh's series, so the curve hugs `1 − cov`
 * near zero and saturates smoothly) maps [0, ∞) onto (0, 1] where lower
 * variance ⇒ higher consistency. Monkeytype scales the same curve ×100
 * (`packages/util/numbers.ts`); we keep the fraction so consistency and
 * accuracy share one convention, formatted as % only at the display edge.
 */
export function kogasa(cov: number): number {
  return 1 - Math.tanh(cov + cov ** 3 / 3 + cov ** 5 / 5)
}

/**
 * Consistency of a per-second raw WPM series — monkeytype's definition
 * (`test-logic.ts`: `kogasa(stdDev(rawPerSecond) / mean(rawPerSecond))`),
 * mirrored behavior for behavior: population standard deviation over the mean
 * (the coefficient of variation) through {@link kogasa}, with monkeytype's NaN
 * guard as an explicit zero — an empty series or a zero mean (a run that
 * produced no characters) reads 0, never NaN. A single bucket has zero
 * variance and reads 1: a one-second run is perfectly consistent with itself.
 */
export function consistencyOf(rawPerSecond: readonly number[]): number {
  if (rawPerSecond.length === 0) return 0
  let sum = 0
  for (const r of rawPerSecond) sum += r
  const mean = sum / rawPerSecond.length
  if (mean === 0) return 0
  let sq = 0
  for (const r of rawPerSecond) sq += (r - mean) ** 2
  const value = kogasa(Math.sqrt(sq / rawPerSecond.length) / mean)
  return Number.isNaN(value) ? 0 : value
}

/**
 * The per-second raw WPM series consistency consumes — the SAME buckets the
 * results chart plots as `TimelinePoint.raw`, computed expression-for-expression
 * like the timeline builder so the two cannot disagree in the last bit
 * (`stats.test.ts` pins the equality): whole one-second windows, and a trailing
 * bucket whose rate window is the full second ending at the finish (clamped at
 * the start), never the sliver the run actually ended inside.
 */
function rawPerSecondOf(analysis: LogAnalysis, endMs: Ms): number[] {
  const startedAt = analysis.finalState.startedAt
  if (startedAt === null) return []
  const end = analysis.finalState.finishedAt ?? endMs
  const seconds = Math.ceil(Math.max(0, (end - startedAt) / 1000))
  if (seconds <= 0) return []
  const { keyTimes } = analysis
  const counts = new Float64Array(seconds + 1)
  for (let k = 0; k < keyTimes.length; k++) {
    const offset = keyTimes[k] - startedAt
    if (offset < 0) continue
    const bucket = Math.floor(offset / 1000) + 1
    if (bucket <= seconds) counts[bucket]++
  }
  const out: number[] = []
  const fullRateMin = 1000 / 60000
  for (let s = 1; s < seconds; s++) out.push(counts[s] / 5 / fullRateMin)
  const bucketEnd = startedAt + seconds * 1000
  const checkpoint = Math.min(bucketEnd, end)
  if (checkpoint < bucketEnd) {
    const rateStart = Math.max(startedAt, checkpoint - 1000)
    let rawInWindow = 0
    for (let k = 0; k < keyTimes.length; k++) if (keyTimes[k] >= rateStart) rawInWindow++
    const rateMin = (checkpoint - rateStart) / 60000
    out.push(rateMin > 0 ? rawInWindow / 5 / rateMin : 0)
  } else {
    out.push(counts[seconds] / 5 / fullRateMin)
  }
  return out
}

/**
 * Compute all metrics from the log. `endMs` is the instant to measure up to
 * (use `finishedAt` for final results, the current tick instant for live UI).
 */
export function computeMetrics(ctx: CoreContext, events: readonly GameEvent[], endMs: Ms): Metrics {
  return metricsFrom(ctx, analyzeLog(ctx, events), endMs)
}

/**
 * {@link computeMetrics} over a replay pass that has already been made. The
 * server's scorer needs the pass's final state for the authoritative finish
 * instant anyway, so it computes both from one traversal instead of two.
 */
export function metricsFrom(ctx: CoreContext, analysis: LogAnalysis, endMs: Ms): Metrics {
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
    consistency: consistencyOf(rawPerSecondOf(analysis, endMs)),
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
  return timelineFrom(ctx, analyzeLog(ctx, events), endMs)
}

/**
 * {@link wpmOverTime} over a replay pass that has already been made — the
 * timeline needs nothing but the analysis. A results surface derives four
 * things from one log (metrics, timeline, AFK, word history); sharing the pass
 * is what keeps that one fold instead of four (~4× on a long log).
 */
export function timelineFrom(ctx: CoreContext, analysis: LogAnalysis, endMs: Ms): TimelinePoint[] {
  const startedAt = analysis.finalState.startedAt
  if (startedAt === null) return []
  const end = analysis.finalState.finishedAt ?? endMs
  const seconds = Math.ceil(Math.max(0, (end - startedAt) / 1000))
  if (seconds <= 0) return []
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

  // Every query below is a range over the same second grid, so bucket once and
  // prefix-sum instead of rescanning the whole keystream per second: the naive
  // nest is O(seconds × keystrokes), which on an hour-long log is ~1e8 iterations
  // for a chart. Only the TRAILING bucket has a window that is not a whole
  // second, so it keeps the exact original scan — the counts are integers either
  // way, so the points are identical to the last bit.
  const { keyTimes, keyCorrect } = analysis
  // `perBucket[s]` = events landing in `[start + (s-1)s, start + s·s)`;
  // `byCheckpoint[s]` = events with `t <= start + s·1000`, as a prefix sum.
  const rawInBucket = new Float64Array(seconds + 2)
  const errorsInBucket = new Float64Array(seconds + 2)
  const correctByCheckpoint = new Float64Array(seconds + 2)
  for (let k = 0; k < keyTimes.length; k++) {
    const offset = keyTimes[k] - startedAt
    if (offset >= 0) {
      const bucket = Math.floor(offset / 1000) + 1
      if (bucket <= seconds) {
        rawInBucket[bucket]++
        if (!keyCorrect[k]) errorsInBucket[bucket]++
      }
    }
    if (keyCorrect[k]) {
      // `t <= start + s·1000` first holds at `s = ceil(offset / 1000)`; a key at or
      // before the start instant is inside every checkpoint.
      const from = offset <= 0 ? 0 : Math.ceil(offset / 1000)
      if (from <= seconds) correctByCheckpoint[from]++
    }
  }
  const spacesByCheckpoint = new Float64Array(seconds + 2)
  for (const t of spaceTimes) {
    const offset = t - startedAt
    const from = offset <= 0 ? 0 : Math.ceil(offset / 1000)
    if (from <= seconds) spacesByCheckpoint[from]++
  }
  for (let s = 1; s <= seconds; s++) {
    correctByCheckpoint[s] += correctByCheckpoint[s - 1]
    spacesByCheckpoint[s] += spacesByCheckpoint[s - 1]
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
    let correctSoFar: number
    let rawInWindow: number
    let errors: number
    let spacesSoFar: number
    if (s < seconds) {
      correctSoFar = correctByCheckpoint[s]
      rawInWindow = rawInBucket[s]
      errors = errorsInBucket[s]
      spacesSoFar = spacesByCheckpoint[s]
    } else {
      correctSoFar = 0
      rawInWindow = 0
      errors = 0
      spacesSoFar = 0
      for (let k = 0; k < keyTimes.length; k++) {
        const t = keyTimes[k]
        const correct = keyCorrect[k]
        if (t <= checkpoint && correct) correctSoFar++
        // Errors stay bucket-local: they are a count, not a rate, and the windows
        // of the last two points overlap.
        if (t >= bucketStart && t < bucketEnd && !correct) errors++
        // No keystroke is past `end`, so the tail window needs no upper bound.
        const inWindow = tail ? t >= rateStart : t >= bucketStart && t < bucketEnd
        if (inWindow) rawInWindow++
      }
      for (const t of spaceTimes) if (t <= checkpoint) spacesSoFar++
    }
    const elapsedMin = (checkpoint - startedAt) / 60000
    const rateMin = (checkpoint - rateStart) / 60000
    points.push({
      second: s,
      wpm: elapsedMin > 0 ? (correctSoFar + spacesSoFar) / 5 / elapsedMin : 0,
      raw: rateMin > 0 ? rawInWindow / 5 / rateMin : 0,
      errors
    })
  }
  return points
}

/** Committed words whose typed text differs from the target (word + what was typed). */
export function errorWords(ctx: CoreContext, events: readonly GameEvent[]): ErrorWord[] {
  const { finalState } = analyzeLog(ctx, events)
  const committed = Math.min(finalState.wordIndex, ctx.words.length)
  const input = finalState.input
  const out: ErrorWord[] = []
  for (let i = 0; i < committed; i++) {
    const expected = ctx.words[i]
    const typed = input[i] ?? ''
    if (typed !== expected) out.push({ expected, typed })
  }
  return out
}

/** One reached word of a run, for the results input-history view. */
export interface WordHistoryEntry {
  /** The target word. */
  readonly target: string
  /** What the player left in the word's buffer. */
  readonly typed: string
  /** The word was committed (its untyped tail counts as missed). */
  readonly committed: boolean
  /**
   * Burst WPM of the word — first to last insert, the same window the
   * consistency metric uses. `Infinity` for a word whose window is zero (a
   * single keystroke has no duration); `undefined` when nothing was typed.
   */
  readonly burst: number | undefined
}

/**
 * Per-word history of a run: target, typed text, and burst speed for every
 * REACHED word (committed words plus the in-flight one if it has input).
 * Pure function of the log — the results screen renders it, a replay could.
 */
export function wordHistory(ctx: CoreContext, events: readonly GameEvent[]): WordHistoryEntry[] {
  return wordHistoryFrom(ctx, analyzeLog(ctx, events))
}

/** {@link wordHistory} over an existing analysis — see {@link timelineFrom} for why. */
export function wordHistoryFrom(ctx: CoreContext, analysis: LogAnalysis): WordHistoryEntry[] {
  const state = analysis.finalState
  const input = state.input
  const committed = Math.min(state.wordIndex, ctx.words.length)
  const inFlight =
    state.wordIndex < ctx.words.length && (input[state.wordIndex] ?? '') !== '' ? 1 : 0
  const out: WordHistoryEntry[] = []
  for (let i = 0; i < committed + inFlight; i++) {
    const typed = input[i] ?? ''
    const first = analysis.wordFirstT[i]
    const last = analysis.wordLastT[i]
    let burst: number | undefined
    if (first !== undefined && last !== undefined && typed.length > 0) {
      const durationMs = last - first
      burst = durationMs > 0 ? typed.length / 5 / (durationMs / 60000) : Infinity
    }
    out.push({ target: ctx.words[i], typed, committed: i < committed, burst })
  }
  return out
}

/** Convenience: {@link wordHistory} for a finished/live core. */
export function wordHistoryOf(core: GameCore): WordHistoryEntry[] {
  return wordHistory({ config: core.config, words: core.words }, core.events)
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
  const { finalState } = analyzeLog(ctx, events)
  return afkBetween(events, finalState.startedAt, finalState.finishedAt ?? endMs)
}

/**
 * {@link afkOf} for a caller that already knows the run's window. The fold inside
 * `afkOf` exists only to recover `startedAt`/`finishedAt`; the actual work is the
 * bucket scan below, which needs no replay at all. `validateLog` holds both
 * instants on the state it just folded, so it skips a whole traversal of the log.
 */
export function afkBetween(
  events: readonly GameEvent[],
  startedAt: Ms | null,
  endMs: Ms
): AfkStats {
  const start = startedAt
  if (start === null) return { afkMs: 0, buckets: 0 }
  const end = endMs
  const bucketCount = Math.floor((end - start) / AFK_BUCKET_MS)
  if (bucketCount <= 0) return { afkMs: 0, buckets: 0 }

  // One flag per bucket: the bucket index is derived arithmetic, so a flat
  // array beats a Set of boxed numbers (and this runs on every results screen).
  const active = new Uint8Array(bucketCount + 1)
  let activeCount = 0
  for (const event of events) {
    // Telemetry does not count as activity: AFK measures typing participation,
    // and a v2 log must produce the same buckets as its stripped v1 twin.
    if (isTelemetryEvent(event)) continue
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
