/**
 * ORACLE — the PRE-B2 game-core reducer, copied verbatim from commit 432cef1.
 *
 * WHAT THIS IS: the reference implementation that `reduce-differential.test.ts`
 * diffs the current core against, event by event, on randomised logs. It is the
 * proof that making `reduce` O(1) amortized (shared copy-on-read input buffers,
 * incremental separator/char counters) changed no observable output.
 *
 * WHAT THIS IS NOT: shipped code. Nothing outside `src/__tests__/core` may import
 * it, it is not re-exported from `@shared/core`, and it is deliberately frozen —
 * do not "fix" or modernise it. Its only value is being the old thing.
 *
 * WHEN TO DELETE IT: the moment the next rewrite of the reducer makes a
 * byte-for-byte diff against this snapshot meaningless. An oracle that no longer
 * describes a contract anyone believes in is dead weight; delete the file and
 * its test together rather than porting them forward.
 */
import { Result, err, ok } from 'neverthrow'

import type {
  CoreContext,
  CoreError,
  FailReason,
  FoldError,
  GameEvent,
  GameState,
  Ms,
  Seq
} from '@shared/core'
import { asMs } from '@shared/core'

/** The pre-B2 `sortEvents`: always copies, always sorts. */
function sortEvents(events: readonly GameEvent[]): GameEvent[] {
  return [...events].sort((a, b) => a.seq - b.seq)
}

function initialState(): GameState {
  return {
    phase: 'idle',
    wordIndex: 0,
    input: [],
    startedAt: null,
    finishedAt: null,
    lastSeq: null,
    failReason: null
  }
}

/**
 * The initial state for `ctx` — the ONLY place the start policy is applied. A
 * `'go'` run is already running at `t = 0`, so `settle` (and therefore the
 * deadline, the MinSpeed floor and every fold) is live without a single event.
 */
function initialStateOf(ctx: CoreContext): GameState {
  const state = initialState()
  if (ctx.config.startPolicy !== 'go') return state
  return { ...state, phase: 'running', startedAt: asMs(0) }
}

// Copy-on-write helper: never mutates the source array (property: reduce is pure).
function setInput(input: readonly string[], index: number, value: string): string[] {
  const next = input.slice()
  next[index] = value
  return next
}

// Every accepted transition records the event's seq; callers pass only the fields
// that change, keeping the merge honest and the source state untouched.
function withEvent(state: GameState, patch: Partial<GameState>, event: GameEvent): GameState {
  return { ...state, ...patch, lastSeq: event.seq }
}

/** MinSpeed grace: the floor is never evaluated before this many ms after the first event. */
const MINSPEED_GRACE_MS = 3000

/**
 * A target that ends with a newline carries its OWN separator: the `\n` is a
 * typed character of that word (a code/quote line end — monkeytype's commit
 * character), so crediting a phantom space on top of it would count the break
 * twice. Prose dictionaries never contain one, which is why this rule leaves
 * every existing run bit-identical.
 */
function endsLine(word: string): boolean {
  return word.endsWith('\n')
}

/**
 * Separators credited for the advanced words: one per committed word, MINUS
 * every word that ends its own line (`endsLine`) and minus the final word of a
 * count-finished test, which has no trailing space typed after it.
 *
 * THE single definition — `netCharsOf` below, `stats.getChars` and
 * `stats.wpmOverTime` all read it, so the three can never drift apart.
 */
function separatorsOf(ctx: CoreContext, state: GameState): number {
  const committed = Math.min(state.wordIndex, ctx.words.length)
  const finishedByCount =
    state.phase === 'finished' && ctx.config.mode !== 'time' && ctx.config.mode !== 'free'
  let spaces = 0
  for (let i = 0; i < committed; i++) {
    if (finishedByCount && i === committed - 1) continue
    if (endsLine(ctx.words[i] ?? '')) continue
    spaces++
  }
  return spaces
}

/**
 * Net chars for WPM — correct characters (committed words + the current buffer)
 * plus the separators of `separatorsOf`. Mirrors `stats.getChars` (correct +
 * spaces) exactly; the character half is kept here (not imported from stats) so
 * game-core stays at the bottom of the dependency graph.
 * `core.equivalence`/minspeed tests pin the match.
 */
function netCharsOf(ctx: CoreContext, state: GameState): number {
  const committed = Math.min(state.wordIndex, ctx.words.length)
  let correct = 0
  for (let i = 0; i < committed; i++) {
    const target = ctx.words[i] ?? ''
    const typed = state.input[i] ?? ''
    const n = Math.min(target.length, typed.length)
    for (let k = 0; k < n; k++) if (typed[k] === target[k]) correct++
  }
  if (state.wordIndex < ctx.words.length) {
    const target = ctx.words[state.wordIndex] ?? ''
    const buffer = state.input[state.wordIndex] ?? ''
    const n = Math.min(target.length, buffer.length)
    for (let k = 0; k < n; k++) if (buffer[k] === target[k]) correct++
  }
  return correct + separatorsOf(ctx, state)
}

/**
 * Canonical progress, in TARGET positions: every character of each committed
 * word plus the filled target positions of the active word. Extra (over-typed)
 * characters NEVER advance it — they shift the caret, not the position in the
 * text — so two players are compared on the same axis regardless of their
 * mistakes. Monotonic within a word (the buffer only grows toward the target)
 * and across words (committing adds the whole target). This is the single
 * progress definition: HUD, peer rows, standings tie-breaks, and the anchor for
 * in-field ghost carets all read it.
 */
function targetCharsOf(ctx: CoreContext, state: GameState): number {
  const committed = Math.min(state.wordIndex, ctx.words.length)
  let chars = 0
  for (let i = 0; i < committed; i++) chars += (ctx.words[i] ?? '').length
  if (state.wordIndex < ctx.words.length) {
    const target = (ctx.words[state.wordIndex] ?? '').length
    const typed = (state.input[state.wordIndex] ?? '').length
    chars += typed < target ? typed : target
  }
  return chars
}

/** Total target positions of the generated text — `progressOf`'s denominator. */
function totalTargetCharsOf(ctx: CoreContext): number {
  let chars = 0
  for (const word of ctx.words) chars += word.length
  return chars
}

/**
 * {@link targetCharsOf} as a fraction of the whole text, clamped to [0, 1]. No
 * special case for a finished run: a count-mode run that consumed the text has
 * committed every target character and therefore reads exactly 1 on its own,
 * while a timed run that ran out of clock keeps its true share of the text —
 * claiming 1 there would report a player who typed nothing as having finished it.
 */
function progressOf(ctx: CoreContext, state: GameState): number {
  const total = totalTargetCharsOf(ctx)
  if (total <= 0) return 0
  const fraction = targetCharsOf(ctx, state) / total
  return fraction > 1 ? 1 : fraction
}

/**
 * The instant a running test would fail the MinSpeed floor, or `null` when the
 * mod is off / not started. Net WPM = `netChars × 12000 / elapsedMs`, so it first
 * dips below the floor at `elapsed = 12000 × netChars / floor`; the grace window
 * forbids failing before `MINSPEED_GRACE_MS` after the first event. A pure
 * function of the state, so `settle` (live tick) and `validateLog` (batch) derive
 * the identical instant — the tick only surfaces it.
 */
function minSpeedFailInstant(ctx: CoreContext, state: GameState): Ms | null {
  const floor = ctx.config.minWpm
  // `!(floor > 0)` and not `floor <= 0`: a foreign snapshot (server jsonb) can
  // hand us a missing/NaN floor, and that comparison would fall THROUGH into a
  // NaN fail instant instead of "the mod is off".
  if (!(floor > 0) || state.startedAt === null || state.phase !== 'running') return null
  const netChars = netCharsOf(ctx, state)
  const failElapsed = Math.max((12000 * netChars) / floor, MINSPEED_GRACE_MS)
  return asMs(state.startedAt + failElapsed)
}

/**
 * Time-driven completion. Pure: given the current instant `nowMs`, decide whether
 * a running test crossed the earliest of its completion instants — the timed
 * deadline (`start + duration`) or the MinSpeed floor breach. `finishedAt` is
 * pinned to that exact instant (never to when the tick fired), so final
 * duration/metrics are tick-independent and reproducible from the log.
 */
function settle(ctx: CoreContext, state: GameState, nowMs: Ms): GameState {
  if (state.phase !== 'running' || state.startedAt === null) return state
  let finishAt: Ms | null = null
  let reason: FailReason | null = null
  if (ctx.config.mode === 'time') {
    finishAt = asMs(state.startedAt + ctx.config.durationMs)
  }
  if (ctx.config.minWpm > 0) {
    const failAt = minSpeedFailInstant(ctx, state)
    if (failAt !== null && (finishAt === null || failAt < finishAt)) {
      finishAt = failAt
      reason = 'minSpeed'
    }
  }
  if (finishAt !== null && nowMs >= finishAt) {
    return { ...state, phase: 'finished', finishedAt: finishAt, failReason: reason }
  }
  return state
}

/** Whether any of `text`'s characters, placed starting at `at`, mismatches the target. */
function hasWrongChar(target: string, text: string, at: number): boolean {
  for (let k = 0; k < text.length; k++) {
    const pos = at + k
    if (pos >= target.length || target[pos] !== text[k]) return true
  }
  return false
}

/** A `stopOnError` refusal: the event is rejected outright, so no counter moves. */
function stoppedOnError(message: string, event: GameEvent): CoreError {
  return { kind: 'StoppedOnError', message, seq: event.seq }
}

/**
 * Commit the current word: advance to the next, or finish the test. Shared by the
 * explicit `commit` event and by nospace auto-commit. In `expert` difficulty a word
 * committed with any error ends the test (`failReason: 'expert'`).
 */
function commitCurrentWord(
  ctx: CoreContext,
  state: GameState,
  event: GameEvent
): Result<GameState, CoreError> {
  const wordIndex = state.wordIndex
  const buffer = state.input[wordIndex] ?? ''
  const target = ctx.words[wordIndex] ?? ''
  if (ctx.config.difficulty === 'expert' && buffer !== target) {
    return ok(
      withEvent(state, { phase: 'finished', finishedAt: event.t, failReason: 'expert' }, event)
    )
  }
  const nextIndex = wordIndex + 1
  const finishesByCount =
    ctx.config.mode !== 'time' && ctx.config.mode !== 'free' && nextIndex >= ctx.words.length
  if (finishesByCount) {
    return ok(
      withEvent(state, { wordIndex: nextIndex, phase: 'finished', finishedAt: event.t }, event)
    )
  }
  return ok(withEvent(state, { wordIndex: nextIndex }, event))
}

/**
 * Apply a text edit (insert or replace) to the current word buffer. `insertedText`
 * are the freshly added characters and `insertedAt` their starting position (for the
 * per-keystroke checks). Four rules fire here:
 *   - master: any incorrect character ends the test at once (`failReason: 'master'`).
 *   - stopOnError 'letter': a wrong character is REJECTED, leaving the state untouched
 *     — nothing is logged and no counter moves. `master` is checked first and wins.
 *   - nospace: reaching the target length auto-commits (extras impossible), so word
 *     progression is derived purely from inserts — a nospace log carries no `commit`
 *     events.
 *   - quickEnd (count modes): filling the LAST word's target auto-commits it right
 *     there, correct or not, so the run ends without a trailing space or commit.
 */
function applyEdit(
  ctx: CoreContext,
  state: GameState,
  event: GameEvent,
  next: string,
  insertedText: string,
  insertedAt: number
): Result<GameState, CoreError> {
  const target = ctx.words[state.wordIndex] ?? ''
  if (next.length > target.length + ctx.config.maxExtraChars) {
    return err({
      kind: 'WordLengthExceeded',
      message: `word ${state.wordIndex} exceeds length cap`,
      seq: event.seq
    })
  }
  const wrongInsert = hasWrongChar(target, insertedText, insertedAt)
  const withBuffer: GameState = {
    ...state,
    phase: 'running',
    startedAt: state.startedAt ?? event.t,
    input: setInput(state.input, state.wordIndex, next)
  }
  if (ctx.config.difficulty === 'master' && wrongInsert) {
    return ok(
      withEvent(withBuffer, { phase: 'finished', finishedAt: event.t, failReason: 'master' }, event)
    )
  }
  if (ctx.config.stopOnError === 'letter' && wrongInsert) {
    return err(stoppedOnError(`wrong character refused in word ${state.wordIndex}`, event))
  }
  if (ctx.config.nospace && next.length >= target.length) {
    return commitCurrentWord(ctx, withBuffer, event)
  }
  const countsWords = ctx.config.mode !== 'time' && ctx.config.mode !== 'free'
  const isLastWord = state.wordIndex + 1 >= ctx.words.length
  if (ctx.config.quickEnd === true && countsWords && isLastWord && next.length >= target.length) {
    // Same auto-commit path as nospace, so `expert` and `finishesByCount` keep their
    // usual meaning on the final word.
    return commitCurrentWord(ctx, withBuffer, event)
  }
  return ok(withEvent(withBuffer, {}, event))
}

// The previous word is "locked" when it was committed fully correct (buffer equals
// target — no incorrect, missed, or extra). A backspace must not cross back into it.
// `freedomMode` lifts the guard entirely: it lives in CoreConfig (input-validity slot,
// optional with a legacy default of locked) so replay / validateLog reconstruct it.
function prevWordLocked(ctx: CoreContext, state: GameState): boolean {
  if (ctx.config.freedomMode === true) return false
  const previous = state.wordIndex - 1
  if (previous < 0) return false
  return (state.input[previous] ?? '') === (ctx.words[previous] ?? '')
}

function reduceDelete(
  ctx: CoreContext,
  state: GameState,
  event: Extract<GameEvent, { kind: 'delete' }>
): Result<GameState, CoreError> {
  const buffer = state.input[state.wordIndex] ?? ''
  const crossesBoundary = buffer.length === 0 && state.wordIndex > 0
  // A backspace must not re-enter a word committed fully correct. Rejected (not a
  // no-op that mutates), so the store never logs it and a valid log never contains
  // it — a log that does is caught by foldLog / validateLog.
  if (crossesBoundary && prevWordLocked(ctx, state)) {
    return err({
      kind: 'BackspaceLocked',
      message: `backspace blocked at correct word ${state.wordIndex - 1}`,
      seq: event.seq
    })
  }
  if (event.unit === 'word') {
    if (buffer.length > 0)
      return ok(withEvent(state, { input: setInput(state.input, state.wordIndex, '') }, event))
    if (crossesBoundary) {
      return ok(
        withEvent(
          state,
          { wordIndex: state.wordIndex - 1, input: setInput(state.input, state.wordIndex - 1, '') },
          event
        )
      )
    }
    return ok(withEvent(state, {}, event)) // at the very start: nothing to delete
  }
  // Single character.
  if (buffer.length > 0) {
    return ok(
      withEvent(
        state,
        { input: setInput(state.input, state.wordIndex, buffer.slice(0, -1)) },
        event
      )
    )
  }
  if (crossesBoundary) return ok(withEvent(state, { wordIndex: state.wordIndex - 1 }, event))
  return ok(withEvent(state, {}, event)) // at the very start: no-op
}

function reduceCommit(
  ctx: CoreContext,
  state: GameState,
  event: GameEvent
): Result<GameState, CoreError> {
  // In nospace there is no separator to press: progression is derived from the
  // inserts alone. A commit is REFUSED rather than folded as a no-op, because an
  // accepted event is a logged event — and `validateLog` rejects an entire
  // nospace log that contains one. A rejected event never reaches the log (and
  // the client returns its seq), so a habitual space press is simply inert
  // instead of quietly invalidating an honest run. Checked before the phase gate:
  // a space pressed before the first keystroke must not be logged either.
  if (ctx.config.nospace) {
    return err({
      kind: 'NospaceCommit',
      message: 'nospace: word advance is derived from inserts, commits are inert',
      seq: event.seq
    })
  }
  // Commit before the first insert is a no-op (leading space).
  if (state.phase !== 'running') return ok(withEvent(state, {}, event))
  const buffer = state.input[state.wordIndex] ?? ''
  // stopOnError 'word': the advance is refused while the buffer differs from the target
  // — an empty buffer included, so a word cannot be skipped either.
  const stoppedOnWrongWord =
    ctx.config.stopOnError === 'word' && buffer !== (ctx.words[state.wordIndex] ?? '')
  if (buffer.length === 0) {
    if (stoppedOnWrongWord)
      return err(stoppedOnError(`word ${state.wordIndex} cannot be skipped`, event))
    return ok(withEvent(state, {}, event)) // empty commit: no advance
  }
  // `expert` wins: an errored commit ends the run there rather than being refused.
  if (stoppedOnWrongWord && ctx.config.difficulty !== 'expert') {
    return err(stoppedOnError(`word ${state.wordIndex} is not correct yet`, event))
  }
  return commitCurrentWord(ctx, state, event)
}

/**
 * The reducer. Applies a single event to a state, returning the next state or a
 * typed error. Pure and total: same (ctx, state, event) => same result, always.
 */
function reduce(
  ctx: CoreContext,
  state: GameState,
  event: GameEvent
): Result<GameState, CoreError> {
  if (state.lastSeq !== null && event.seq <= state.lastSeq) {
    return err({
      kind: 'NonMonotonicSeq',
      message: `seq ${event.seq} <= lastSeq ${state.lastSeq}`,
      seq: event.seq
    })
  }
  if (state.phase === 'finished') {
    return err({ kind: 'TestFinished', message: 'test already finished', seq: event.seq })
  }

  switch (event.kind) {
    case 'insert': {
      const buffer = state.input[state.wordIndex] ?? ''
      return applyEdit(ctx, state, event, buffer + event.text, event.text, buffer.length)
    }
    case 'replace': {
      const buffer = state.input[state.wordIndex] ?? ''
      if (event.from < 0 || event.to < event.from || event.to > buffer.length) {
        return err({
          kind: 'InvalidRange',
          message: `replace range [${event.from},${event.to}) invalid for buffer length ${buffer.length}`,
          seq: event.seq
        })
      }
      const next = buffer.slice(0, event.from) + event.text + buffer.slice(event.to)
      return applyEdit(ctx, state, event, next, event.text, event.from)
    }
    case 'delete':
      return reduceDelete(ctx, state, event)
    case 'commit':
      return reduceCommit(ctx, state, event)
    default: {
      // Total over foreign input: a kind unknown to this build (e.g. relayed from
      // a newer client) is a typed rejection, never a throw. `dispatch` handles it
      // exactly like every other rejected event — the state stays at the settled
      // state and nothing is logged; `foldLog` aborts at this seq.
      const unknown = event as { readonly kind: string; readonly seq: Seq }
      return err({
        kind: 'UnknownEventKind',
        message: `unknown event kind '${String(unknown.kind)}'`,
        seq: unknown.seq
      })
    }
  }
}

function foldLog(
  ctx: CoreContext,
  events: readonly GameEvent[],
  endMs?: Ms
): Result<GameState, FoldError> {
  const ordered = sortEvents(events)
  let state = initialStateOf(ctx)
  for (const event of ordered) {
    state = settle(ctx, state, event.t)
    const result = reduce(ctx, state, event)
    if (result.isErr()) return err({ error: result.error, at: event.seq })
    state = result.value
  }
  const end = endMs ?? (ordered.length > 0 ? ordered[ordered.length - 1].t : asMs(0))
  return ok(settle(ctx, state, end))
}

export {
  endsLine as legacyEndsLine,
  foldLog as legacyFoldLog,
  initialState as legacyInitialState,
  initialStateOf as legacyInitialStateOf,
  minSpeedFailInstant as legacyMinSpeedFailInstant,
  netCharsOf as legacyNetCharsOf,
  progressOf as legacyProgressOf,
  reduce as legacyReduce,
  separatorsOf as legacySeparatorsOf,
  settle as legacySettle,
  targetCharsOf as legacyTargetCharsOf,
  totalTargetCharsOf as legacyTotalTargetCharsOf
}
