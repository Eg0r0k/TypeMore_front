/**
 * Server-side log validation / anti-cheat. Pure function, runs in plain Node (no
 * DOM, no framework — part of the framework-free core verified by the purity test).
 *
 * The client's reported numbers are NOT trusted — they are not even inputs. Words
 * are regenerated from the seed + dictionary, the event log is replayed through the
 * reducer, and every metric is recomputed here. The result is a verdict plus a set
 * of *scored* plausibility flags (not a binary human/bot judgement).
 */
import { Result, err, ok } from 'neverthrow'

import type { EventLog, Ms } from './events'
import {
  EVENT_LOG_VERSION,
  EVENT_LOG_VERSION_TELEMETRY,
  asMs,
  isTelemetryEvent,
  sortEvents
} from './events'
import type { CoreConfig, CoreContext, GameState } from './game-core'
import { bufferOf, foldLog, initialStateOf, minSpeedFailInstant, reduce, settle } from './game-core'
import { CANARY_CODEPOINTS, canaryAt } from './canary'
import type { Dictionary, GenerationConfig } from './words'
import { generateWords, makeSeedContext } from './words'
import type { Metrics } from './stats'
import { afkBetween, computeMetrics } from './stats'

/** The immutable snapshot that governed the match (reducer config + generation config). */
export interface ConfigSnapshot {
  readonly config: CoreConfig
  readonly generation: GenerationConfig
}

/** One point on the speed ceiling: "at this distance, this is the edge". */
export interface BurstCeilingAnchor {
  readonly durationSec: number
  readonly wpm: number
}

/**
 * THE speed ceiling, as a function of how long the run lasted — one table, and
 * the only place these numbers appear.
 *
 * WHY IT IS A FUNCTION AT ALL. Sustained speed falls with distance, for the same
 * reason it does in running: a sprint is not a pace. A single global ceiling is
 * therefore either too lenient at the long distances or too strict at the short
 * ones, and the constant 250 it replaces was the first — it let a 336 wpm run
 * held for a full minute pass while a 251 wpm two-second flurry would not.
 *
 * WHERE THE NUMBERS COME FROM. Two sources, and they disagree, so both are
 * written down rather than one being quietly preferred.
 *
 *   The published records are HIGHER than every anchor here. monkeytype's
 *   all-time English leaderboards are in the 280s at 15 s, the 290s at 30 s and
 *   the 270s at 60 s, and the current record holder has been reported at 305.
 *   Judged against those alone, a ceiling would start near 310 and this
 *   detector would never fire on anything but a machine.
 *
 *   The population THIS instance actually has tops out far lower. Over the 127
 *   runs of the honest export of 2026-08-03: 166.4 wpm at ≤15 s, 88.4 at 30 s,
 *   96.6 at 60 s, 62.5 beyond. Against that, every anchor below carries between
 *   1.5× and 2.4× headroom over the fastest honest run at its distance, and
 *   there is not one honest run within 80 wpm of the 30 s or 60 s anchor.
 *
 * The anchors follow the population, and they are set exactly where they are
 * because of what they have to catch: the confirmed cheating account's four
 * implausible runs are 282 wpm at 10 s, 212.4 at 30 s, and 336.2 and 373.4 at
 * 60 s. Catching the 212.4 one is what pins the 30 s anchor below it, and
 * monotonicity then pins the 60 s anchor below that.
 *
 * SO READ THIS BEFORE RAISING THEM. A world-class player — a real one, at the
 * published record pace — WILL raise this flag here, and because
 * `sustained_superhuman` bypasses the suspicion threshold, their run will go to
 * review. That is a deliberate trade for a deployment whose fastest honest run
 * is 166 wpm: review is a human looking, not a rejection, and on this
 * population the flag has never once fired on an honest run. It is the wrong
 * trade for a deployment that has actual record-pace players, and the fix then
 * is this table, not the detector.
 */
export const BURST_CEILING: readonly BurstCeilingAnchor[] = [
  { durationSec: 15, wpm: 250 },
  { durationSec: 30, wpm: 210 },
  { durationSec: 60, wpm: 200 }
]

/**
 * The ceiling at a given distance: flat below the first anchor, flat above the
 * last, linearly interpolated between them.
 *
 * CONTINUOUS ON PURPOSE. A step table would mean a run of 29.9 s is judged
 * against 250 and one of 30.1 s against 210 — a 40 wpm cliff that two identical
 * typists land on opposite sides of because one of them was a fifth of a second
 * slower to stop. Interpolating removes the cliff without changing what the
 * anchors say, and monotonicity is preserved because the anchors are themselves
 * non-increasing (asserted by the tests, not assumed).
 */
export function maxBurstWpmFor(
  durationSec: number,
  anchors: readonly BurstCeilingAnchor[] = BURST_CEILING
): number {
  if (anchors.length === 0) return Infinity
  const first = anchors[0]
  if (!(durationSec > first.durationSec)) return first.wpm
  for (let i = 1; i < anchors.length; i++) {
    const prev = anchors[i - 1]
    const next = anchors[i]
    if (durationSec <= next.durationSec) {
      const span = next.durationSec - prev.durationSec
      if (span <= 0) return next.wpm
      return prev.wpm + ((durationSec - prev.durationSec) * (next.wpm - prev.wpm)) / span
    }
  }
  return anchors[anchors.length - 1].wpm
}

/**
 * The speed at which `superhuman-burst` severity saturates. Deliberately NOT
 * the ceiling: the ceiling answers "is this run implausible for its distance",
 * and severity answers "how implausible, in absolute terms" — 400 wpm is the
 * same phenomenon whether it was held for ten seconds or sixty, and should be
 * worth the same. Keeping it a constant also means the two runs that already
 * flagged under the old rule keep the exact severities they had (0.75 and 0.56),
 * so a revalidate pass moves the runs that were being missed and nothing else.
 */
const SUPERHUMAN_SEVERITY_SCALE = 500

const ACCURACY_WEIGHT_FLOOR = 0.25
const ACCURACY_WEIGHT_EXPONENT = 4

/**
 * How much a run's accuracy scales its speed severity. Monotone, `f(1) = 1`,
 * and — the whole point — never zero.
 *
 * WHAT THIS REPLACES. The old rule was `wpm > ceiling && accuracy === 1`: a
 * STRICT equality with one, as a gate. A single mistyped character therefore
 * switched the only speed-based detector off completely, and with it
 * `sustained_superhuman`, which cannot fire without it. That is how a 336.2 wpm
 * run held for a minute was accepted at suspicion 0.0074 while a 282 wpm run of
 * ten seconds was flagged: the fast one had 99.6% accuracy. It is trivially
 * gameable — make one deliberate typo — and it also fires or not by luck.
 *
 * WHY NOT JUST A LOWER GATE. `accuracy >= 0.98` is the same hole one centimetre
 * further along: a bot makes two typos instead of one. Any gate on accuracy can
 * be stepped over, so accuracy stops being a gate at all. Speed alone decides
 * WHETHER the flag fires; accuracy only scales HOW MUCH it is worth.
 *
 * THE SHAPE. `floor + (1 - floor) · accuracy⁴`.
 *
 *   The floor exists so the function cannot be driven to zero. A detector that
 *   can be switched off by being sloppy is the hole this change closes, so
 *   0.25 is the guarantee that a superhuman speed always counts for something.
 *   0.25 is also chosen against the arithmetic downstream: the flag's weight is
 *   0.80 and the review threshold is 1.0, so a floor-severity run contributes
 *   at most 0.20 and cannot reach review on its own. That is the right pair of
 *   statements — someone typing 400 wpm at 50% accuracy is mashing keys, which
 *   is worth noticing and is not proof of a bot.
 *
 *   The fourth power puts the curve's resolution where real runs live. Accuracy
 *   is a compressed scale: everything interesting happens above 0.95, and
 *   everything below 0.9 is one undifferentiated "made a lot of mistakes".
 *   Concretely, `f(0.996) = 0.988` — one typo in a minute now costs 1.2% of the
 *   severity, where the old rule cost 100% of it — while `f(0.9) = 0.74` and
 *   `f(0.5) = 0.30` still separate a fast accurate run from a fast messy one.
 */
export function burstAccuracyWeight(accuracy: number): number {
  const acc = Math.min(1, Math.max(0, accuracy))
  return ACCURACY_WEIGHT_FLOOR + (1 - ACCURACY_WEIGHT_FLOOR) * acc ** ACCURACY_WEIGHT_EXPONENT
}

export interface PlausibilityThresholds {
  /** Inter-keystroke intervals below this (ms) are physically implausible. */
  readonly minKeyIntervalMs: number
  /** Intervals within ±this (ms) of the mean count as "uniform" (bot-like cadence). */
  readonly uniformToleranceMs: number
  /** Uniform-interval fraction at/above this raises the uniform-cadence flag. */
  readonly uniformFlagRatio: number
  /**
   * Net WPM STRICTLY above the ceiling for the run's own duration is
   * superhuman ({@link BURST_CEILING}). Accuracy is not part of this test — see
   * {@link burstAccuracyWeight} for what it does instead.
   */
  readonly burstCeiling: readonly BurstCeilingAnchor[]
  /** AFK share of the run duration at/above which the run is flagged afk-heavy. */
  readonly afkFlagShare: number
  /** Idle tail (ms) between the last event and the run's end that raises trailing-afk. */
  readonly trailingAfkMs: number
}

export const DEFAULT_THRESHOLDS: PlausibilityThresholds = {
  minKeyIntervalMs: 15,
  uniformToleranceMs: 2,
  uniformFlagRatio: 0.9,
  burstCeiling: BURST_CEILING,
  afkFlagShare: 0.5,
  trailingAfkMs: 10_000
}

export interface ValidateLogInput {
  readonly seed: number
  readonly dictionary: Dictionary
  /** The dictionary version the client claims it played against (drift check). */
  readonly dictVersion: string
  readonly configSnapshot: ConfigSnapshot
  readonly log: EventLog
  readonly thresholds?: Partial<PlausibilityThresholds>
  /**
   * Arm the canary detectors (canary.ts) for this run. DEFAULT `false`, and the
   * default is a load-bearing contract: a disarmed validateLog is bit-identical
   * to the pre-canary validateLog — same flags, same order, same report — so
   * every stored run, golden vector and re-judgement predating the canary
   * render deploy reconstructs exactly. The CALLER decides per run (the server
   * gates on the run's creation instant vs. the canary epoch); arming a run
   * whose client never rendered canaries would score coincidental early
   * commits as evidence, which is why this can never default to `true`.
   */
  readonly canariesArmed?: boolean
}

export type FlagCode =
  | 'multi-grapheme-insert'
  | 'paste'
  | 'min-interval'
  | 'uniform-intervals'
  | 'zero-variance'
  | 'superhuman-burst'
  | 'afk-heavy'
  | 'trailing-afk'
  | 'unpaired-keyup'
  /** An `insert` carried an invisible canary codepoint — direct scrape evidence. */
  | 'canary-grapheme'
  /** Commits repeatedly landing exactly on seed-scheduled canary offsets. */
  | 'canary-commit'

export interface ScoredFlag {
  readonly code: FlagCode
  /** Severity in [0, 1]. */
  readonly score: number
  readonly detail?: string
}

export type Verdict = 'valid' | 'invalid'

export interface ValidationReport {
  readonly verdict: Verdict
  /** Present when `invalid`. */
  readonly reason?: string
  readonly flags: readonly ScoredFlag[]
  /** Server-recomputed metrics (never the client's). */
  readonly metrics: Metrics
}

export type ValidationErrorKind = 'DictVersionMismatch' | 'GenerationFailed'
export interface ValidationError {
  readonly kind: ValidationErrorKind
  readonly message: string
}

const ZERO_METRICS: Metrics = {
  wpm: 0,
  raw: 0,
  accuracy: 0,
  consistency: 0,
  chars: { correct: 0, incorrect: 0, extra: 0, missed: 0 },
  spaces: 0,
  durationSec: 0
}

function graphemeCount(text: string): number {
  return [...text].length
}

export function validateLog(input: ValidateLogInput): Result<ValidationReport, ValidationError> {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...input.thresholds }
  const { config, generation } = input.configSnapshot

  // Regenerate the exact word list from the seed; refuse if the dictionary drifted.
  const seedContext = makeSeedContext(input.dictionary, input.seed, generation)
  if (input.dictVersion !== seedContext.dictVersion) {
    return err({
      kind: 'DictVersionMismatch',
      message: `claimed dictVersion ${input.dictVersion} != dictionary ${seedContext.dictVersion}`
    })
  }
  const generated = generateWords(input.dictionary, seedContext)
  if (generated.isErr()) return err({ kind: 'GenerationFailed', message: generated.error.message })

  const ctx: CoreContext = { config, words: generated.value.words }
  const events = sortEvents(input.log.events)
  // The state-event view of the log. Telemetry (`down`/`up`, log v2) is folded
  // as a no-op and MUST be invisible to every measured quantity: metrics, AFK,
  // the two-clock deadline and the run-window instants all read this view, so a
  // v2 log judges bit-identically to the same run captured as v1 (the stripping
  // property). The full `events` view feeds only the structural pass (telemetry
  // consumes `seq`, so contiguity is its tamper-evidence) and the replay fold.
  const stateEvents = events.filter((e) => !isTelemetryEvent(e))
  const telemetry = events.filter(isTelemetryEvent)
  const flags: ScoredFlag[] = []
  const invalid = (reason: string): Result<ValidationReport, ValidationError> =>
    ok({ verdict: 'invalid', reason, flags, metrics: ZERO_METRICS })

  // (1) Structural: version, contiguous seq (no gaps/dups), monotonic t.
  if (
    input.log.version !== EVENT_LOG_VERSION &&
    input.log.version !== EVENT_LOG_VERSION_TELEMETRY
  ) {
    return invalid(`log version ${input.log.version} != ${EVENT_LOG_VERSION}`)
  }
  // Telemetry is what v2 IS: a v1 log carrying it is structurally invalid (a v1
  // producer cannot emit these kinds; only a tampered or mislabeled log can).
  if (input.log.version === EVENT_LOG_VERSION && telemetry.length > 0) {
    return invalid(`log version ${EVENT_LOG_VERSION} must not contain telemetry events`)
  }
  for (let i = 0; i < events.length; i++) {
    if (events[i].seq !== i + 1)
      return invalid(`seq gap or duplicate at index ${i}: expected ${i + 1}, got ${events[i].seq}`)
    if (i > 0 && events[i].t < events[i - 1].t)
      return invalid(`time went backwards at seq ${events[i].seq}`)
  }
  if (events.length > 0 && events[0].t < 0) return invalid('first event has negative t')

  // (1b) Telemetry pairing sanity — a structural FLAG, not a verdict: a release
  // without a preceding press is physically possible (the key was held before
  // the log started, focus was lost mid-hold on another surface), so it is
  // reported, never invalidating. A press without a release is normal (the last
  // key of the run is released after capture stops) and is not flagged.
  if (telemetry.length > 0) {
    const held = new Map<string, number>()
    let unpaired = 0
    for (const e of telemetry) {
      if (e.kind === 'down') {
        held.set(e.code, (held.get(e.code) ?? 0) + 1)
      } else {
        const open = held.get(e.code) ?? 0
        if (open > 0) held.set(e.code, open - 1)
        else unpaired++
      }
    }
    if (unpaired > 0) {
      flags.push({
        code: 'unpaired-keyup',
        score: Math.min(1, unpaired / telemetry.length),
        detail: `${unpaired} key release(s) without a preceding press`
      })
    }
  }

  // (3) Commit-consistency, branched on nospace (from the snapshot).
  if (config.nospace && events.some((e) => e.kind === 'commit')) {
    return invalid(
      'nospace log must contain no commit events (progression is derived from inserts)'
    )
  }

  // (6) Two-clock: cross-check the event timeline against the configured-duration
  // clock. In timed mode no STATE event may fall on/after the deadline (time
  // teleport). The zero point follows the START POLICY: a match log is anchored
  // at the go instant (t = 0), a solo log at its first STATE event — a v2 log's
  // opening key-down lands before the first insert, and anchoring on it would
  // move the deadline relative to the same run captured as v1. Telemetry is
  // exempt from the deadline rule for the same reason it is a fold no-op: it
  // cannot score, and the release of the key that typed the final grapheme
  // legitimately lands after a timed run's deadline.
  const startT = config.startPolicy === 'go' ? asMs(0) : (stateEvents[0]?.t ?? asMs(0))
  const deadline = startT + config.durationMs
  if (config.mode === 'time') {
    const past = stateEvents.find((e) => e.t >= deadline)
    if (past)
      return invalid(`event at seq ${past.seq} (t=${past.t}) is at/after the deadline ${deadline}`)
  }
  const endMs: Ms | undefined = config.mode === 'time' ? asMs(deadline) : undefined

  // (2, 4-delete, 5) Replay: foldLog rejects events after finished (master/expert
  // fails, count/time completion), invalid ranges, and locked backspaces into a
  // correctly-committed word — any of these means an invalid log.
  const folded = foldLog(ctx, events, endMs)
  if (folded.isErr()) {
    return invalid(`replay rejected event seq ${folded.error.at}: ${folded.error.error.kind}`)
  }
  let finalState: GameState = folded.value
  // (5) Difficulty — MinSpeed tail: the floor can be breached AFTER the last event
  // (the player stopped typing). foldLog settled only to the last event/deadline;
  // surface the derived fail instant here so finishedAt/metrics match the client.
  // Events landing at/after the fail instant were already rejected by the replay
  // layer above (settle finishes the run, the next event hits `TestFinished`).
  if (config.minWpm > 0 && finalState.phase === 'running') {
    const failAt = minSpeedFailInstant(ctx, finalState)
    if (failAt !== null) finalState = settle(ctx, finalState, failAt)
  }

  // Metrics are recomputed from the log — the client's numbers are irrelevant.
  const metrics = computeMetrics(ctx, events, finalState.finishedAt ?? endMs ?? startT)

  // (4) Input-rule flags (suspicious, not invalidating).
  const multiGrapheme = events.filter(
    (e) => e.kind === 'insert' && graphemeCount(e.text) > 1
  ).length
  if (multiGrapheme > 0) {
    flags.push({
      code: 'multi-grapheme-insert',
      score: Math.min(1, multiGrapheme / Math.max(1, events.length)),
      detail: `${multiGrapheme} insert event(s) carried more than one grapheme`
    })
  }
  const pastes = events.filter((e) => e.kind === 'replace' && e.source === 'paste').length
  if (pastes > 0) {
    flags.push({
      code: 'paste',
      score: Math.min(1, pastes / Math.max(1, events.length)),
      detail: `${pastes} paste event(s)`
    })
  }

  // (7) Physical plausibility (scored) from inter-keystroke intervals.
  const insertTimes = events.filter((e) => e.kind === 'insert').map((e) => e.t)
  const intervals: number[] = []
  for (let i = 1; i < insertTimes.length; i++) intervals.push(insertTimes[i] - insertTimes[i - 1])
  if (intervals.length >= 2) {
    const tooFast = intervals.filter((d) => d < thresholds.minKeyIntervalMs).length
    if (tooFast > 0) {
      flags.push({
        code: 'min-interval',
        score: tooFast / intervals.length,
        detail: `${tooFast}/${intervals.length} intervals < ${thresholds.minKeyIntervalMs}ms`
      })
    }
    const mean = intervals.reduce((sum, d) => sum + d, 0) / intervals.length
    const variance = intervals.reduce((sum, d) => sum + (d - mean) ** 2, 0) / intervals.length
    const uniform = intervals.filter(
      (d) => Math.abs(d - mean) <= thresholds.uniformToleranceMs
    ).length
    const uniformRatio = uniform / intervals.length
    if (uniformRatio >= thresholds.uniformFlagRatio) {
      flags.push({
        code: 'uniform-intervals',
        score: uniformRatio,
        detail: `${Math.round(uniformRatio * 100)}% of intervals within ±${thresholds.uniformToleranceMs}ms of the mean`
      })
    }
    if (variance === 0) {
      flags.push({ code: 'zero-variance', score: 1, detail: 'all keystroke intervals identical' })
    }
  }
  // Speed decides WHETHER, accuracy only decides HOW MUCH. `>` and not `>=`:
  // the ceiling is the last speed that is still allowed, so a run landing
  // exactly on it is not flagged. (`maxBurstWpmFor`, `burstAccuracyWeight`.)
  const burstCeiling = maxBurstWpmFor(metrics.durationSec, thresholds.burstCeiling)
  if (metrics.wpm > burstCeiling) {
    flags.push({
      code: 'superhuman-burst',
      score:
        Math.min(1, metrics.wpm / SUPERHUMAN_SEVERITY_SCALE) *
        burstAccuracyWeight(metrics.accuracy),
      detail:
        `${Math.round(metrics.wpm)} wpm over ${Math.round(metrics.durationSec)}s ` +
        `(ceiling ${Math.round(burstCeiling)}) at ${Math.round(metrics.accuracy * 100)}% accuracy`
    })
  }

  // (8) AFK plausibility (scored, never a verdict): a run that is mostly idle,
  // or that ends with a long idle tail, is reported — the run itself stays
  // valid, and matches are covered by the server's hard deadline anyway.
  // Both flags are only as good as the run's END instant: a timed run pins it to
  // the deadline, a completed or MinSpeed-failed run to its derived finish, but
  // an ABANDONED count-mode log ends at its own last event, so its trailing
  // silence cannot be seen from the log alone (it needs the server's receive
  // clock — the "second clock" of the network phase).
  const runEnd =
    finalState.finishedAt ??
    endMs ??
    (stateEvents.length > 0 ? stateEvents[stateEvents.length - 1].t : startT)
  // `runEnd` already resolves `finalState.finishedAt`, so this is byte-for-byte
  // the window `afkOf` would have re-folded the entire log to rediscover.
  const afk = afkBetween(events, finalState.startedAt, runEnd)
  const runMs = Math.max(0, runEnd - (finalState.startedAt ?? startT))
  if (afk.afkMs > 0 && runMs > 0) {
    const share = afk.afkMs / runMs
    if (share >= thresholds.afkFlagShare) {
      flags.push({
        code: 'afk-heavy',
        score: Math.min(1, share),
        detail: `${afk.buckets}s of ${Math.round(runMs / 1000)}s idle (${Math.round(share * 100)}%)`
      })
    }
  }
  const lastEventT = stateEvents.length > 0 ? stateEvents[stateEvents.length - 1].t : null
  if (lastEventT !== null) {
    const tailMs = runEnd - lastEventT
    if (tailMs >= thresholds.trailingAfkMs) {
      flags.push({
        code: 'trailing-afk',
        score: runMs > 0 ? Math.min(1, tailMs / runMs) : 1,
        detail: `${Math.round(tailMs / 1000)}s idle after the last keystroke`
      })
    }
  }

  // (9) Canary detectors — ONLY when the caller armed them for this run (see
  // `canariesArmed`; disarmed is bit-identical to the pre-canary validator).
  // Appended after every legacy flag so an armed report is the disarmed report
  // plus a suffix — nothing existing moves.
  if (input.canariesArmed === true) {
    // (9a) Direct: an `insert` carrying any invisible-operator codepoint. No
    // positional condition — no keyboard, layout or IME produces these, paste
    // is already its own flag, so one occurrence is evidence by itself
    // (zero-variance class: score 1 regardless of count).
    let canaryInserts = 0
    for (const event of stateEvents) {
      if (event.kind !== 'insert') continue
      for (const char of event.text) {
        if (CANARY_CODEPOINTS.has(char)) {
          canaryInserts++
          break
        }
      }
    }
    if (canaryInserts > 0) {
      flags.push({
        code: 'canary-grapheme',
        score: 1,
        detail: `${canaryInserts} insert event(s) carry an invisible canary codepoint`
      })
    }

    // (9b) Positional: commits landing EXACTLY on the seed-scheduled canary
    // offset of the word they commit. One is a coincidence a sloppy human can
    // produce (a mid-word double-space); three-plus at seed-derived positions
    // is a scraper feeding the rendered text back through the input adapter.
    //
    // The pass re-folds the state events through the SAME `reduce`/`settle`
    // the replay used, reading the active buffer length BEFORE each commit is
    // applied — no bespoke caret tracker that could drift from the reducer.
    // `foldLog` already succeeded above, so this fold cannot fail; if it
    // somehow does, the detector is silently skipped — the verdict is long
    // decided, and a plausibility flag is never worth failing the pipeline.
    //
    // Skipped under nospace by construction: a nospace log carries no commit
    // events at all (the structural gate above enforced it), so the fold
    // would be pure cost for a detector that can never fire.
    if (!config.nospace) {
      let hits = 0
      let aborted = false
      try {
        let replayState = initialStateOf(ctx)
        for (const event of stateEvents) {
          replayState = settle(ctx, replayState, event.t)
          if (event.kind === 'commit') {
            const index = replayState.wordIndex
            const canary = canaryAt(input.seed, index, ctx.words[index] ?? '')
            if (canary !== null && bufferOf(replayState, index).length === canary.slot) hits++
          }
          const next = reduce(ctx, replayState, event)
          if (next.isErr()) {
            aborted = true
            break
          }
          replayState = next.value
        }
      } catch {
        aborted = true
      }
      if (!aborted && hits >= 3) {
        flags.push({
          code: 'canary-commit',
          score: Math.min(1, (hits - 2) * 0.25),
          detail: `${hits} commit(s) landed exactly on a seed-scheduled canary offset`
        })
      }
    }
  }

  return ok({ verdict: 'valid', flags, metrics })
}
