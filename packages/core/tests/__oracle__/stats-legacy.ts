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
} from '@typemore/core'

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
  /**
   * Every inserted keystroke with its timestamp, frozen correctness, and the
   * word it landed in.
   */
  readonly keystrokes: readonly {
    readonly t: number
    readonly correct: boolean
    readonly wordIndex: number
  }[]
  /** Timestamp of each committed word separator (one per word advance). */
  readonly commitTimes: readonly number[]
  readonly commitWordIndex: readonly number[]
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
  const keystrokes: { t: number; correct: boolean; wordIndex: number }[] = []
  const commitTimes: number[] = []
  const commitWordIndex: number[] = []

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
        keystrokes.push({ t: event.t, correct, wordIndex })
      }
      if (wordFirstT[wordIndex] === undefined) wordFirstT[wordIndex] = event.t
      wordLastT[wordIndex] = event.t
    }

    const beforeIndex = state.wordIndex
    const result = reduce(ctx, state, event)
    if (result.isErr()) break
    state = result.value
    for (let j = beforeIndex; j < state.wordIndex; j++) {
      commitTimes.push(event.t)
      commitWordIndex.push(j)
    }
  }

  return {
    finalState: state,
    correctKeys,
    totalKeys,
    wordFirstT,
    wordLastT,
    keystrokes,
    commitTimes,
    commitWordIndex
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

/** Characters a run EARNED: whole correct words plus their separators. */
function netCharsFor(ctx: CoreContext, state: GameState): number {
  const committed = Math.min(state.wordIndex, ctx.words.length)
  const finishedByCount =
    state.phase === 'finished' && ctx.config.mode !== 'time' && ctx.config.mode !== 'free'
  let credited = 0
  for (let i = 0; i < committed; i++) {
    const target = ctx.words[i] ?? ''
    if ((state.input[i] ?? '') !== target) continue
    credited += target.length
    if (!endsLine(target) && !(finishedByCount && i === committed - 1)) credited += 1
  }
  if (state.wordIndex < ctx.words.length) {
    const target = ctx.words[state.wordIndex] ?? ''
    const buffer = state.input[state.wordIndex] ?? ''
    // Re-derived rather than imported: the oracle counts the correct prefix
    // itself, so agreeing with the shipped core is a result and not a shared
    // helper returning the same value twice.
    let i = 0
    const shared = Math.min(target.length, buffer.length)
    while (i < shared && buffer[i] === target[i]) i++
    credited += i
  }
  return credited
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

  // Net: only words that came out right pay (see `netCharsOf` in game-core).
  // Written out here from scratch rather than imported — an oracle that calls
  // the thing it checks checks nothing.
  const netChars = netCharsFor(ctx, analysis.finalState)
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
  // The cumulative line is NET, paid per CORRECT KEYSTROKE at the instant it
  // was struck — a curve paid only at word commits opens on nothing, because no
  // word commits inside the first second at any ordinary speed. Each commit
  // then settles up: the word is worth all of itself plus its separator if it
  // came out right and nothing at all if it did not, so a word that goes wrong
  // takes its letters back exactly where that became true.
  //
  // The SECOND cumulative line, `raw`, is paid on the same machinery for a
  // different quantity: every keystroke counts wherever it landed, right or
  // wrong, and each commit settles the word to the number of characters its
  // buffer actually holds plus the separator the run typed after it. That is
  // `getChars` read forwards — `correct + incorrect + extra` for any word is
  // just its buffer's length — which is what makes the last point land on
  // `Metrics.raw` rather than merely near it.
  const credits: { t: number; chars: number }[] = []
  const rawCredits: { t: number; chars: number }[] = []
  const paidPerWord: number[] = []
  const paidRawPerWord: number[] = []
  for (const key of analysis.keystrokes) {
    if (key.wordIndex < 0 || key.wordIndex >= ctx.words.length) continue
    rawCredits.push({ t: key.t, chars: 1 })
    paidRawPerWord[key.wordIndex] = (paidRawPerWord[key.wordIndex] ?? 0) + 1
    if (!key.correct) continue
    credits.push({ t: key.t, chars: 1 })
    paidPerWord[key.wordIndex] = (paidPerWord[key.wordIndex] ?? 0) + 1
  }
  // Each word settles at the LAST instant the caret advanced past it — which is
  // not the same as "the nth commit is word n" once `free` mode and
  // `freedomMode` let a backspace retreat into the previous word.
  const settledAt = new Map<number, number>()
  for (let i = 0; i < analysis.commitTimes.length; i++) {
    settledAt.set(analysis.commitWordIndex[i], analysis.commitTimes[i])
  }
  // Walked over the WORDS, in the three cases the final state has for them:
  // committed, in hand, or entered-and-retreated-out-of (worth nothing, so the
  // keystream's credit comes back off).
  const activeIndex = analysis.finalState.wordIndex
  const committed = Math.min(activeIndex, ctx.words.length)
  for (let i = 0; i < ctx.words.length; i++) {
    const target = ctx.words[i] ?? ''
    const typed = analysis.finalState.input[i] ?? ''
    let worth = 0
    let rawWorth = 0
    let at = end
    if (i < committed) {
      const earnsSeparator = !endsLine(target) && !(finishedByCount && i === committed - 1)
      if (typed === target) {
        worth = target.length
        if (earnsSeparator) worth++
      }
      rawWorth = typed.length + (earnsSeparator ? 1 : 0)
      at = settledAt.get(i) ?? end
    } else if (i === activeIndex) {
      let k = 0
      const shared = Math.min(target.length, typed.length)
      while (k < shared && typed[k] === target[k]) k++
      worth = k
      rawWorth = typed.length
    }
    const settlement = worth - (paidPerWord[i] ?? 0)
    if (settlement !== 0) credits.push({ t: at, chars: settlement })
    const rawSettlement = rawWorth - (paidRawPerWord[i] ?? 0)
    if (rawSettlement !== 0) rawCredits.push({ t: at, chars: rawSettlement })
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
    let rawInWindow = 0
    let errorsInBucket = 0
    for (const key of analysis.keystrokes) {
      // Errors stay bucket-local: they are a count, not a rate, and the windows
      // of the last two points overlap.
      if (key.t >= bucketStart && key.t < bucketEnd && !key.correct) errorsInBucket++
      // No keystroke is past `end`, so the tail window needs no upper bound.
      const inWindow = tail ? key.t >= rateStart : key.t >= bucketStart && key.t < bucketEnd
      if (inWindow) rawInWindow++
    }
    let netSoFar = 0
    for (const credit of credits) if (credit.t <= checkpoint) netSoFar += credit.chars
    let rawSoFar = 0
    for (const credit of rawCredits) if (credit.t <= checkpoint) rawSoFar += credit.chars
    // ONE expression for elapsed minutes, spelled as `metricsFrom` spells it
    // (`durationSec / 60`), not as `x / 60000`. Two roundings against one differ
    // in the last ulp for any duration that is not a whole number of seconds,
    // and the cumulative lines are asserted against the summary with `===`.
    const elapsedMin = Math.max(0, (checkpoint - startedAt) / 1000) / 60
    const rateMin = (checkpoint - rateStart) / 60000
    points.push({
      second: s,
      wpm: elapsedMin > 0 ? netSoFar / 5 / elapsedMin : 0,
      raw: elapsedMin > 0 ? rawSoFar / 5 / elapsedMin : 0,
      burst: rateMin > 0 ? rawInWindow / 5 / rateMin : 0,
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
