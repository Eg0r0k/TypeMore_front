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
import { EVENT_LOG_VERSION, asMs, sortEvents } from './events'
import type { CoreConfig, CoreContext, GameState } from './game-core'
import { foldLog, minSpeedFailInstant, settle } from './game-core'
import type { Dictionary, GenerationConfig } from './words'
import { generateWords, makeSeedContext } from './words'
import type { Metrics } from './stats'
import { afkOf, computeMetrics } from './stats'

/** The immutable snapshot that governed the match (reducer config + generation config). */
export interface ConfigSnapshot {
  readonly config: CoreConfig
  readonly generation: GenerationConfig
}

export interface PlausibilityThresholds {
  /** Inter-keystroke intervals below this (ms) are physically implausible. */
  readonly minKeyIntervalMs: number
  /** Intervals within ±this (ms) of the mean count as "uniform" (bot-like cadence). */
  readonly uniformToleranceMs: number
  /** Uniform-interval fraction at/above this raises the uniform-cadence flag. */
  readonly uniformFlagRatio: number
  /** Net WPM above this with flawless accuracy is superhuman. */
  readonly maxBurstWpm: number
  /** AFK share of the run duration at/above which the run is flagged afk-heavy. */
  readonly afkFlagShare: number
  /** Idle tail (ms) between the last event and the run's end that raises trailing-afk. */
  readonly trailingAfkMs: number
}

export const DEFAULT_THRESHOLDS: PlausibilityThresholds = {
  minKeyIntervalMs: 15,
  uniformToleranceMs: 2,
  uniformFlagRatio: 0.9,
  maxBurstWpm: 250,
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
  const flags: ScoredFlag[] = []
  const invalid = (reason: string): Result<ValidationReport, ValidationError> =>
    ok({ verdict: 'invalid', reason, flags, metrics: ZERO_METRICS })

  // (1) Structural: version, contiguous seq (no gaps/dups), monotonic t.
  if (input.log.version !== EVENT_LOG_VERSION) {
    return invalid(`log version ${input.log.version} != ${EVENT_LOG_VERSION}`)
  }
  for (let i = 0; i < events.length; i++) {
    if (events[i].seq !== i + 1)
      return invalid(`seq gap or duplicate at index ${i}: expected ${i + 1}, got ${events[i].seq}`)
    if (i > 0 && events[i].t < events[i - 1].t)
      return invalid(`time went backwards at seq ${events[i].seq}`)
  }
  if (events.length > 0 && events[0].t < 0) return invalid('first event has negative t')

  // (3) Commit-consistency, branched on nospace (from the snapshot).
  if (config.nospace && events.some((e) => e.kind === 'commit')) {
    return invalid(
      'nospace log must contain no commit events (progression is derived from inserts)'
    )
  }

  // (6) Two-clock: cross-check the event timeline against the configured-duration
  // clock. In timed mode no event may fall on/after the deadline (time teleport).
  // The zero point follows the START POLICY: a match log is anchored at the go
  // instant (t = 0), a solo log at its first event.
  const startT = config.startPolicy === 'go' ? asMs(0) : (events[0]?.t ?? asMs(0))
  const deadline = startT + config.durationMs
  if (config.mode === 'time') {
    const past = events.find((e) => e.t >= deadline)
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
  if (metrics.wpm > thresholds.maxBurstWpm && metrics.accuracy === 1) {
    flags.push({
      code: 'superhuman-burst',
      score: Math.min(1, metrics.wpm / (thresholds.maxBurstWpm * 2)),
      detail: `${Math.round(metrics.wpm)} wpm at 100% accuracy`
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
    finalState.finishedAt ?? endMs ?? (events.length > 0 ? events[events.length - 1].t : startT)
  const afk = afkOf(ctx, events, runEnd)
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
  const lastEventT = events.length > 0 ? events[events.length - 1].t : null
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

  return ok({ verdict: 'valid', flags, metrics })
}
