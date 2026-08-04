/**
 * scoreV1 — the base arcade scoring layer (SCORING_CONCEPT.md §1).
 *
 * This module is pure and framework-free by design (enforced by the purity
 * scan): the server executes THIS EXACT bundle via goja to recompute a run's
 * score authoritatively from the event log. The client's live number is only
 * for dopamine — the log is the source of truth (SCORING_CONCEPT.md §7.1).
 *
 * Two forms, one per-event core, so they are equivalent by construction:
 *   - `scoreStep(state, event, ctx)` — O(1) incremental step, advanced per
 *     dispatched event; drives the live HUD.
 *   - `scoreOfLog(log, setup)` — batch fold of `scoreStep` for finals and
 *     server replay, then the final acc²/timeBonus/round pass.
 *
 * Formula (SCORING_CONCEPT.md §1, made precise here):
 *   total = round(base × acc² [× timeBonus])
 *   base  = Σ over scoring keystrokes of 10 × comboMultiplier(streak)
 *
 * A keystroke scores iff it is an `insert` producing a CORRECT letter at a
 * position typed for the FIRST TIME in this run (first-attempt correct). Any
 * later insert at an already-attempted position is a correction and scores 0
 * (SCORING_CONCEPT.md §1 "Исправление"). Combo (the scoring streak) resets to
 * 0 on any incorrect insert (extra letters included) and on committing a word
 * that skipped letters; it is NEVER restored by a correction, and points are
 * never subtracted ("Отрицательных очков нет").
 *
 * OUT OF SCOPE (scoreV2+): mod multipliers, text star-rating, and TP are NOT
 * applied here. scoreV1 IGNORES active mods entirely — the modMultiplier and
 * textDifficulty factors of the §1 formula are pinned to 1.0. When any of those
 * land, bump SCORE_VERSION and add `scoreV2` ALONGSIDE this — never edit v1 in
 * place (SCORING_CONCEPT.md §7.6, version discipline).
 *
 * Determinism: plain IEEE double math; the only rounding is the single
 * `Math.round` on `total`. No intermediate rounding, so the incremental and
 * batch forms cannot drift.
 *
 * VERSIONS LIVE SIDE BY SIDE, NEVER EDITED: v1 (`scoreStep`/`scoreOfLog`),
 * v2 (+ mod multiplier, `scoreV2OfLog`), v3 (+ ime replaces score,
 * `scoreStepV3`/`scoreV3OfLog`). A stored run replays through the fold its
 * `score_version` names, forever.
 */
import type { GameEvent, Ms } from './events'
import { asMs, isTelemetryEvent, sortEvents } from './events'
import type { CoreContext } from './game-core'
import { minSpeedFailInstant, settle } from './game-core'
import type { Metrics } from './stats'
import { analyzeLog, computeMetrics, metricsFrom } from './stats'
import type { GenerationConfig, GenerationMode } from './words'
import type { ModsDeclaration } from './mods'
import { modMultiplierV1 } from './mods'

/** Scoring formula version, stored beside every result (SCORING_CONCEPT.md §7.6). */
export const SCORE_VERSION = 1 as const
/** scoreV2 formula version (SCORING_CONCEPT §7.6): base × acc² [× timeBonus] × modMult. */
export const SCORE_VERSION_2 = 2 as const
/**
 * scoreV3 formula version (SCORING_CONCEPT §7.6): v2 with ONE change — an
 * `'ime'` replace scores its graphemes like the keystrokes they are.
 *
 * Why: Android keyboards drive PLAIN typing through a composition session, so a
 * mobile player's every word reaches the log as `replace(..., 'ime')` — and
 * under v1/v2's "replace never scores" rule an entire legitimately-typed run
 * totals 0. That rule was aimed at paste, and for `'paste'` it still holds
 * unchanged. stats.ts has always counted replace graphemes for accuracy/WPM;
 * v3 makes the score agree with the metrics.
 */
export const SCORE_VERSION_3 = 3 as const

/** Points awarded for one scoring keystroke, before the combo multiplier. */
const POINTS_PER_KEYSTROKE = 10
/** Streak needed to grow the multiplier by one tier (+0.25×). */
const COMBO_TIER = 25
/** Per-tier multiplier increment. */
const COMBO_STEP = 0.25
/** Multiplier ceiling — ×2.5, reached at streak 150 (SCORING_CONCEPT.md §1). */
const MAX_MULTIPLIER = 2.5
/** WPM the word-mode time bonus is measured against (SCORING_CONCEPT.md §1). */
const REFERENCE_WPM = 80
/** Characters per "word" — the same unit stats.ts uses for WPM. */
const CHARS_PER_WORD = 5

/**
 * Combo multiplier for a given scoring streak: +0.25× per full 25 of streak,
 * capped at ×2.5 (streak ≥ 150). A pure function of the streak, so the HUD and
 * the fold agree.
 */
export function comboMultiplier(streak: number): number {
  const mult = 1 + COMBO_STEP * Math.floor(streak / COMBO_TIER)
  return mult > MAX_MULTIPLIER ? MAX_MULTIPLIER : mult
}

/** Letter grade by accuracy (SCORING_CONCEPT.md §4). `acc` is a fraction [0, 1]. */
export type Grade = 'SS' | 'S' | 'A' | 'B' | 'C'

export function gradeOf(acc: number): Grade {
  if (acc >= 1) return 'SS'
  if (acc >= 0.98) return 'S'
  if (acc >= 0.95) return 'A'
  if (acc >= 0.9) return 'B'
  return 'C'
}

/** The finished-run score, as the results screen and the server comparison read it. */
export interface ScoreResult {
  /** Formula version (`SCORE_VERSION`). */
  readonly version: number
  /** Final score: `round(base × accMultiplier × (timeBonus ?? 1))`. */
  readonly total: number
  /** Raw combo points before accuracy/time factors (unrounded). */
  readonly base: number
  /** Highest scoring streak reached during the run. */
  readonly comboPeak: number
  /** Accuracy factor `acc²`. */
  readonly accMultiplier: number
  /** Word-mode speed factor `referenceTime / actualTime`; `null` in time/free modes. */
  readonly timeBonus: number | null
  /** Combined mod multiplier (scoreV2). Absent/`undefined` for scoreV1 (mods ignored). */
  readonly modMultiplier?: number
}

/**
 * Incremental accumulator for `scoreStep`. A minimal shadow of the reducer: it
 * tracks only what scoring needs — the active word, per-word typed length, and
 * the per-word high-water mark that distinguishes a first attempt from a
 * correction. Correctness itself is derived from `(event char, target, pos)`,
 * so no typed content is stored. Mutated in place for the O(1)-per-step
 * guarantee; `scoreOfLog` and the store each own a private instance.
 */
export interface ScoreState {
  /** Accumulated combo points, unrounded. */
  base: number
  /** Current scoring streak (the live "combo"). */
  streak: number
  /** Largest streak reached so far. */
  comboPeak: number
  /** Active word index (shadow of the reducer's `wordIndex`). */
  wordIndex: number
  /** True once a count-mode run has committed its last word — further events are ignored. */
  finished: boolean
  /** Typed length of word `i`'s buffer (`state.input[i].length`). */
  bufLen: number[]
  /** High-water typed length ever reached for word `i` (the first-attempt frontier). */
  reached: number[]
}

export function initialScoreState(): ScoreState {
  return {
    base: 0,
    streak: 0,
    comboPeak: 0,
    wordIndex: 0,
    finished: false,
    bufLen: [],
    reached: []
  }
}

function isCountMode(mode: GenerationMode): boolean {
  // Modes that finish by word count (mirrors stats.ts `finishedByCount`). Only
  // these carry a time bonus; `time` bakes speed into keystroke volume already
  // and `free` has no reference length (SCORING_CONCEPT.md §1, §7.3).
  return mode !== 'time' && mode !== 'free'
}

/** Advance the shadow to the next word, marking a count-mode run finished at the last one. */
function advanceWord(state: ScoreState, ctx: CoreContext): void {
  state.wordIndex += 1
  if (isCountMode(ctx.config.mode) && state.wordIndex >= ctx.words.length) state.finished = true
}

function applyInsert(state: ScoreState, text: string, ctx: CoreContext): void {
  // Score per character: one grapheme per insert is the protocol norm, but a
  // multi-char insert is folded the same way stats.ts counts keys.
  for (const char of text) {
    const wi = state.wordIndex
    const target = ctx.words[wi] ?? ''
    const pos = state.bufLen[wi] ?? 0
    const reached = state.reached[wi] ?? 0
    const correct = pos < target.length && target[pos] === char
    const firstAttempt = pos >= reached

    if (correct && firstAttempt) {
      state.streak += 1
      if (state.streak > state.comboPeak) state.comboPeak = state.streak
      state.base += POINTS_PER_KEYSTROKE * comboMultiplier(state.streak)
    } else if (!correct) {
      // Incorrect insert (a wrong letter or an extra past the word) breaks combo.
      state.streak = 0
    }
    // correct && !firstAttempt: a correction — 0 points, combo untouched.

    const nextLen = pos + 1
    state.bufLen[wi] = nextLen
    if (nextLen > reached) state.reached[wi] = nextLen

    // nospace: reaching the target length auto-commits (extras are impossible,
    // so the buffer equals the target — no skipped letters, no combo reset).
    if (ctx.config.nospace && nextLen >= target.length) {
      advanceWord(state, ctx)
      if (state.finished) return
    }
  }
}

function applyReplace(
  state: ScoreState,
  from: number,
  to: number,
  text: string,
  ctx: CoreContext
): void {
  // Replace (IME/paste) is never a scoring keystroke; keep the shadow buffer in
  // sync so later first-attempt decisions stay correct.
  const wi = state.wordIndex
  const bufLen = state.bufLen[wi] ?? 0
  const nextLen = from + text.length + (bufLen - to)
  state.bufLen[wi] = nextLen
  if (nextLen > (state.reached[wi] ?? 0)) state.reached[wi] = nextLen
  const target = ctx.words[wi] ?? ''
  if (ctx.config.nospace && nextLen >= target.length) advanceWord(state, ctx)
}

function applyDelete(state: ScoreState, unit: 'char' | 'word'): void {
  // Deletes never score and never touch combo. Valid logs never contain a
  // backspace into a fully-correct committed word (the reducer rejects it), so
  // no lock check is needed here. `reached` stays put — deleted positions have
  // still been attempted, so retyping them scores 0.
  const wi = state.wordIndex
  const bufLen = state.bufLen[wi] ?? 0
  if (unit === 'word') {
    if (bufLen > 0) state.bufLen[wi] = 0
    else if (wi > 0) {
      state.wordIndex = wi - 1
      state.bufLen[wi - 1] = 0
    }
    return
  }
  if (bufLen > 0) state.bufLen[wi] = bufLen - 1
  else if (wi > 0) state.wordIndex = wi - 1
}

function applyCommit(state: ScoreState, ctx: CoreContext): void {
  // nospace derives progression from inserts; stray commits are ignored (mirrors reduce).
  if (ctx.config.nospace) return
  const wi = state.wordIndex
  const bufLen = state.bufLen[wi] ?? 0
  if (bufLen === 0) return // empty commit: no advance (leading space / no buffer)
  const target = ctx.words[wi] ?? ''
  // Committing a word that skipped letters breaks combo (those positions were
  // never typed, so no incorrect-insert reset fired for them).
  if (bufLen < target.length) state.streak = 0
  advanceWord(state, ctx)
}

/**
 * scoreV3's replace arm. An `'ime'` replace is a composed word — on Android the
 * ONLY form ordinary typing takes — so its graphemes score exactly as
 * `applyInsert` scores keystrokes: correct at a first-attempt position pays
 * `10 × comboMultiplier`, incorrect breaks combo, a correction pays 0.
 *
 * First-attempt is judged against the frontier AS IT STOOD BEFORE this event
 * for every grapheme: the composition replaces `[from, to)` in one act, so a
 * suggestion that rewrites an already-attempted prefix scores only the
 * positions beyond the old frontier — accepting "сделать" over a typed "чдела"
 * pays for the tail, not for the five corrections.
 *
 * `'paste'` keeps the v1/v2 rule (never a scoring keystroke), and ALL shadow
 * bookkeeping (buffer length, frontier, nospace auto-commit) is delegated to
 * the one existing `applyReplace`, so v3 cannot drift from v1/v2 in how the
 * buffer moves — the versions differ in points alone.
 */
function applyReplaceV3(
  state: ScoreState,
  from: number,
  to: number,
  text: string,
  source: 'ime' | 'paste',
  ctx: CoreContext
): void {
  if (source === 'ime') {
    const wi = state.wordIndex
    const target = ctx.words[wi] ?? ''
    const reached = state.reached[wi] ?? 0
    let pos = from
    for (const char of text) {
      const correct = pos < target.length && target[pos] === char
      if (correct && pos >= reached) {
        state.streak += 1
        if (state.streak > state.comboPeak) state.comboPeak = state.streak
        state.base += POINTS_PER_KEYSTROKE * comboMultiplier(state.streak)
      } else if (!correct) {
        state.streak = 0
      }
      // correct && pos < reached: a correction — 0 points, combo untouched.
      pos += 1
    }
  }
  applyReplace(state, from, to, text, ctx)
}

/**
 * Advance the score accumulator by one event. Mutates and returns `state`
 * (O(1) per step). Only `insert` can score; `delete`/`commit`/`replace` move
 * the shadow. Events after a count-mode finish are ignored.
 */
export function scoreStep(state: ScoreState, event: GameEvent, ctx: CoreContext): ScoreState {
  if (state.finished) return state
  switch (event.kind) {
    case 'insert':
      applyInsert(state, event.text, ctx)
      break
    case 'replace':
      applyReplace(state, event.from, event.to, event.text, ctx)
      break
    case 'delete':
      applyDelete(state, event.unit)
      break
    case 'commit':
      applyCommit(state, ctx)
      break
    default:
      break
  }
  return state
}

/**
 * The scoreV3 per-event step: `scoreStep` with the one v3 difference — an
 * `'ime'` replace scores (see `applyReplaceV3`). Live HUD and ghost folds on
 * v3 runs advance through this; v1/v2 folds keep `scoreStep` untouched.
 */
export function scoreStepV3(state: ScoreState, event: GameEvent, ctx: CoreContext): ScoreState {
  if (state.finished) return state
  if (event.kind === 'replace') {
    applyReplaceV3(state, event.from, event.to, event.text, event.source, ctx)
    return state
  }
  return scoreStep(state, event, ctx)
}

/**
 * Finish a run's score: apply acc² and (word modes only) the time bonus, then
 * the single rounding of `total`. `metrics` reuses stats.ts's accuracy and its
 * char/space accounting — the reference time is the run's net-char count typed
 * at REFERENCE_WPM, which reduces to `netWpm / REFERENCE_WPM` (so exactly 1.0 at
 * 80 WPM) without a parallel counting scheme.
 */
export function finalizeScore(
  base: number,
  comboPeak: number,
  metrics: Metrics,
  mode: GenerationMode
): ScoreResult {
  const accMultiplier = metrics.accuracy * metrics.accuracy
  let timeBonus: number | null = null
  if (isCountMode(mode)) {
    const netChars = metrics.chars.correct + metrics.spaces
    const referenceMinutes = netChars / CHARS_PER_WORD / REFERENCE_WPM
    const actualMinutes = metrics.durationSec / 60
    timeBonus = actualMinutes > 0 ? referenceMinutes / actualMinutes : 1
  }
  const total = Math.round(base * accMultiplier * (timeBonus ?? 1))
  return { version: SCORE_VERSION, total, base, comboPeak, accMultiplier, timeBonus }
}

/**
 * Batch score a complete log — the finals path and the server's authoritative
 * recompute. Folds `scoreStep` over the ordered log, then finalizes with the
 * metrics computed from the same log, so it is bit-identical to the live
 * accumulation of the same events.
 */
export function scoreOfLog(log: readonly GameEvent[], setup: CoreContext): ScoreResult {
  const ctx: CoreContext = { config: setup.config, words: setup.words }
  // Score is a function of the STATE events alone: log-v2 telemetry is inert in
  // `scoreStep` and must not move `endMs` either (a trailing key release after
  // the last insert is not part of the measured run) — the stripping property.
  const ordered = sortEvents(log).filter((e) => !isTelemetryEvent(e))
  const state = initialScoreState()
  for (const event of ordered) scoreStep(state, event, ctx)
  const endMs = ordered.length > 0 ? ordered[ordered.length - 1].t : asMs(0)
  const metrics = computeMetrics(ctx, ordered, endMs)
  return finalizeScore(state.base, state.comboPeak, metrics, ctx.config.mode)
}

/** The scoreV2 batch input: reducer context + the generation config the multiplier reads. */
export interface ScoreSetup extends CoreContext {
  readonly generation: GenerationConfig
}

/**
 * Finish a run's score WITH the mod layer (scoreV2, SCORING_CONCEPT §1–2):
 * `total = round(base × acc² [× timeBonus] × modMultiplier)` — the SAME single
 * rounding as v1, so with `modMultiplier === 1` (no active mods) the total is
 * bit-identical to `finalizeScore` (regression invariant, score.test.ts). scoreV1
 * is NOT edited: this reuses it only for the unrounded acc²/timeBonus factors.
 */
export function finalizeScoreV2(
  base: number,
  comboPeak: number,
  metrics: Metrics,
  mode: GenerationMode,
  modMultiplier: number
): ScoreResult {
  const v1 = finalizeScore(base, comboPeak, metrics, mode)
  const total = Math.round(base * v1.accMultiplier * (v1.timeBonus ?? 1) * modMultiplier)
  return {
    version: SCORE_VERSION_2,
    total,
    base,
    comboPeak,
    accMultiplier: v1.accMultiplier,
    timeBonus: v1.timeBonus,
    modMultiplier
  }
}

/**
 * Batch scoreV2 — the server's authoritative recompute and the finals path.
 * Replays the log ONCE for the authoritative finish instant (time deadline +
 * MinSpeed tail) so a count-mode + MinSpeed run measures its time bonus to the
 * fail instant exactly as the client did, then applies the mod multiplier from
 * setup + declaration.
 *
 * That replay used to be a `foldLog` on top of the one `computeMetrics` already
 * performs — two identical trajectories over the same log. `analyzeLog` carries
 * the fold's final state, so one pass now feeds both: `settle` to the last event
 * reproduces `foldLog`'s trailing settle exactly, and `aborted` marks the point
 * where `foldLog` would have returned an error (in which case, as before, the
 * finish instant falls back to the last event).
 */
export function scoreV2OfLog(
  log: readonly GameEvent[],
  setup: ScoreSetup,
  declaration: ModsDeclaration
): ScoreResult {
  const ctx: CoreContext = { config: setup.config, words: setup.words }
  // State events only — see scoreOfLog: telemetry is inert for the score and
  // must not move the finish-instant fallback.
  const ordered = sortEvents(log).filter((e) => !isTelemetryEvent(e))
  const lastT = ordered.length > 0 ? ordered[ordered.length - 1].t : asMs(0)

  // Authoritative finish instant (mirrors validateLog): replay, then surface a
  // post-last-event MinSpeed breach so the measured duration matches the client.
  const analysis = analyzeLog(ctx, ordered)
  let end: Ms = lastT
  if (!analysis.aborted) {
    let finalState = settle(ctx, analysis.finalState, lastT)
    if (ctx.config.minWpm > 0 && finalState.phase === 'running') {
      const failAt = minSpeedFailInstant(ctx, finalState)
      if (failAt !== null) finalState = settle(ctx, finalState, failAt)
    }
    if (finalState.finishedAt !== null) end = finalState.finishedAt
  }

  const state = initialScoreState()
  for (const event of ordered) scoreStep(state, event, ctx)
  const metrics = metricsFrom(ctx, analysis, end)
  const modMultiplier = modMultiplierV1(
    { generation: setup.generation, config: ctx.config },
    declaration
  )
  return finalizeScoreV2(state.base, state.comboPeak, metrics, ctx.config.mode, modMultiplier)
}

/**
 * Finish a run's score under scoreV3. The FORMULA is v2's unchanged —
 * `total = round(base × acc² [× timeBonus] × modMultiplier)`, same single
 * rounding — because v3 changes what accumulates into `base` (ime replaces
 * score), not how the base is finished. Stamped with its own version so the
 * stored result routes back to the v3 fold on replay.
 */
export function finalizeScoreV3(
  base: number,
  comboPeak: number,
  metrics: Metrics,
  mode: GenerationMode,
  modMultiplier: number
): ScoreResult {
  return {
    ...finalizeScoreV2(base, comboPeak, metrics, mode, modMultiplier),
    version: SCORE_VERSION_3
  }
}

/**
 * Batch scoreV3 — the server's authoritative recompute for `score_version` 3
 * and the finals path of v3 clients. `scoreV2OfLog` line for line with the two
 * v3 substitutions (`scoreStepV3`, `finalizeScoreV3`); kept as its own function
 * rather than a parameter on v2 because a stored formula must never move —
 * every historical run replays through the fold its version names
 * (SCORING_CONCEPT §7.6).
 */
export function scoreV3OfLog(
  log: readonly GameEvent[],
  setup: ScoreSetup,
  declaration: ModsDeclaration
): ScoreResult {
  const ctx: CoreContext = { config: setup.config, words: setup.words }
  // State events only — see scoreOfLog: telemetry is inert for the score and
  // must not move the finish-instant fallback.
  const ordered = sortEvents(log).filter((e) => !isTelemetryEvent(e))
  const lastT = ordered.length > 0 ? ordered[ordered.length - 1].t : asMs(0)

  // Authoritative finish instant (mirrors validateLog): replay, then surface a
  // post-last-event MinSpeed breach so the measured duration matches the client.
  const analysis = analyzeLog(ctx, ordered)
  let end: Ms = lastT
  if (!analysis.aborted) {
    let finalState = settle(ctx, analysis.finalState, lastT)
    if (ctx.config.minWpm > 0 && finalState.phase === 'running') {
      const failAt = minSpeedFailInstant(ctx, finalState)
      if (failAt !== null) finalState = settle(ctx, finalState, failAt)
    }
    if (finalState.finishedAt !== null) end = finalState.finishedAt
  }

  const state = initialScoreState()
  for (const event of ordered) scoreStepV3(state, event, ctx)
  const metrics = metricsFrom(ctx, analysis, end)
  const modMultiplier = modMultiplierV1(
    { generation: setup.generation, config: ctx.config },
    declaration
  )
  return finalizeScoreV3(state.base, state.comboPeak, metrics, ctx.config.mode, modMultiplier)
}
