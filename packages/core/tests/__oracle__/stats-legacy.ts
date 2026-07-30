/**
 * ORACLE — the PRE-B2 metrics pass, copied verbatim from commit 432cef1, running
 * on the PRE-B2 reducer in `./reduce-legacy`.
 *
 * Same rules as `reduce-legacy.ts`: reference only, never shipped, never
 * imported outside `src/__tests__/core`, frozen on purpose. It exists so the
 * differential test can prove that collapsing `validateLog`'s third fold, the
 * scorer's fourth, and linearising `wpmOverTime`'s second-by-keystroke nest all
 * produced byte-identical numbers. Delete it together with its test as soon as
 * the next rewrite makes the diff meaningless.
 */
import type {
  AfkStats,
  CharCounts,
  CoreContext,
  ErrorWord,
  GameEvent,
  GameState,
  Metrics,
  Ms,
  TimelinePoint
} from '@shared/core'

import {
  legacyEndsLine as endsLine,
  legacyInitialStateOf as initialStateOf,
  legacyReduce as reduce,
  legacySeparatorsOf as separatorsOf,
  legacySettle as settle
} from './reduce-legacy'

/** The pre-B2 `sortEvents`: always copies, always sorts. */
function sortEvents(events: readonly GameEvent[]): GameEvent[] {
  return [...events].sort((a, b) => a.seq - b.seq)
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
function kogasa(cov: number): number {
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
function computeMetrics(ctx: CoreContext, events: readonly GameEvent[], endMs: Ms): Metrics {
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

function wpmOverTime(ctx: CoreContext, events: readonly GameEvent[], endMs: Ms): TimelinePoint[] {
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

function errorWords(ctx: CoreContext, events: readonly GameEvent[]): ErrorWord[] {
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
function afkOf(ctx: CoreContext, events: readonly GameEvent[], endMs: Ms): AfkStats {
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

export {
  afkOf as legacyAfkOf,
  analyze as legacyAnalyze,
  computeMetrics as legacyComputeMetrics,
  errorWords as legacyErrorWords,
  wpmOverTime as legacyWpmOverTime
}
