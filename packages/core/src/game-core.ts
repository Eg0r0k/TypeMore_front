/**
 * GameCore — the pure, synchronous, instantiable reducer at the heart of a game.
 *
 * Contract:
 * - No DOM, no async, no clock, no `Math.random`. Time enters *only* through
 *   `event.t`; the test config is an immutable snapshot taken at construction.
 * - `reduce(ctx, state, event)` returns a brand-new state (copy-on-write) or a
 *   typed error. It never mutates its inputs and never throws — errors are
 *   `neverthrow` `Result`s. That totality includes foreign input: an event whose
 *   `kind` this build does not know reduces to an `UnknownEventKind` error, not
 *   an exception (relayed logs may come from newer clients).
 * - Metrics are not accumulated here. They are separate pure functions of the
 *   log (see `stats.ts`), so live UI, replays and server validation all recompute
 *   from the same events.
 * - Phase transitions happen only via events, with two deliberate exceptions:
 *   timed-mode completion is a pure function of the deadline (start instant + the
 *   config duration), evaluated by `settle`; and a `startPolicy: 'go'` run is
 *   already running at `t = 0` before any event exists (see below). `settle`
 *   counts no ticks and reads no clock — it just answers "given this instant, is
 *   the deadline crossed?", which is why the authoritative worker tick can drive
 *   it without ever touching metric math.
 * - START POLICY. `'input'` (default, solo) starts the run lazily on the first
 *   event: `t = 0` IS the first keystroke. `'go'` (match) declares the run live
 *   from `t = 0` — the server's go instant — with no input at all, so a timed run
 *   settles at its deadline from an EMPTY log. The policy lives in the reducer
 *   snapshot (CoreConfig), so `foldLog`/`validateLog` reconstruct it exactly;
 *   `initialStateOf` is the single place that applies it.
 */

import { Result, err, ok } from 'neverthrow'
import type { GameEvent, Ms, Seq } from './events'
import { asMs, sortEvents } from './events'
import type { GenerationMode } from './words'

export type Phase = 'idle' | 'running' | 'finished'

export type Difficulty = 'normal' | 'expert' | 'master'
/** Why a running test ended early. `null` = finished normally or still running. */
export type FailReason = 'expert' | 'master' | 'minSpeed'
/** When the run's clock starts — see the START POLICY note in the header. */
export type StartPolicy = 'input' | 'go'

/** Immutable per-test config snapshot. Mapped from the app `Config` by the store. */
export interface CoreConfig {
  readonly mode: GenerationMode
  /** Test duration in ms; only meaningful in `time` mode. */
  readonly durationMs: number
  /** Cap of extra characters allowed past a word's length (monkeytype uses +20). */
  readonly maxExtraChars: number
  /** normal | expert (fail on committing an errored word) | master (fail on any wrong keystroke). */
  readonly difficulty: Difficulty
  /** No-space mode: an insert completing a word auto-commits; no space, no extras. */
  readonly nospace: boolean
  /** Net-WPM floor (MinSpeed mod): 0 = off. Dropping below it fails the run. */
  readonly minWpm: number
  /**
   * When `t = 0` is. `'input'` (default, omitted in legacy snapshots) starts the
   * run on the first event; `'go'` starts it at `t = 0` with no input — the match
   * anchor, so an idle player still settles at the deadline.
   */
  readonly startPolicy?: StartPolicy
  /*
   * INPUT-VALIDITY SLOT. Everything below is OPTIONAL with a legacy default equal
   * to today's behaviour — same precedent as `startPolicy` above, and for the same
   * reason: this interface is serialized verbatim into the run-submit payload and
   * replayed server-side by `validate.ts`, so a snapshot written before the field
   * existed MUST reconstruct the old run exactly. Never make one of these required.
   */
  /** Backspace past the current word, even into correctly typed ones. Default (omitted): locked. */
  readonly freedomMode?: boolean
  /**
   * `'letter'` rejects a wrong grapheme outright; `'word'` blocks the commit while
   * the word is wrong. Default (omitted): `'off'`.
   */
  readonly stopOnError?: 'off' | 'word' | 'letter'
  /** Words mode: finish as soon as the last word is typed, even if it is wrong. Default (omitted): false. */
  readonly quickEnd?: boolean
}

export const DEFAULT_MAX_EXTRA_CHARS = 20

/**
 * Extra-character cap for raw-token (code) runs. A code "word" is a whole
 * indented line — `\tconsole.log(msg);\n` is 20 characters — so one mistyped
 * bracket run eats the prose-sized budget mid-line and silently freezes input;
 * 40 keeps the allowance proportional to the target it guards.
 */
export const CODE_MAX_EXTRA_CHARS = 40

export interface CoreContext {
  readonly config: CoreConfig
  readonly words: readonly string[]
}

/**
 * Mutable-by-replacement game state. `words`/config live in the context because
 * they are immutable; only these fields evolve as events are reduced.
 * `input[i]` is the typed buffer for word `i` (may exceed the target length for
 * extra characters). `lastSeq` enforces monotonic, duplicate-free application.
 */
export interface GameState {
  readonly phase: Phase
  readonly wordIndex: number
  readonly input: readonly string[]
  readonly startedAt: Ms | null
  readonly finishedAt: Ms | null
  readonly lastSeq: Seq | null
  /** Set when a difficulty rule ended the test early; `null` otherwise. */
  readonly failReason: FailReason | null
}

export type CoreErrorKind =
  | 'NonMonotonicSeq'
  | 'TestFinished'
  | 'WordLengthExceeded'
  | 'InvalidRange'
  | 'BackspaceLocked'
  /** `stopOnError`: the wrong grapheme (or the commit of a wrong word) was refused. */
  | 'StoppedOnError'
  /** `nospace`: a commit event has no meaning and must never enter the log. */
  | 'NospaceCommit'
  | 'UnknownEventKind'

export interface CoreError {
  readonly kind: CoreErrorKind
  readonly message: string
  /** The offending event's sequence number, when applicable. */
  readonly seq?: number
}

export function initialState(): GameState {
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

/*
 * ── THE INPUT BUFFERS: PURITY BOUNDARY. READ THIS BEFORE TOUCHING `state.input`.
 *
 * The contract is unchanged and absolute: the array you read off a state is an
 * immutable snapshot of that state. Reduce a thousand more events and it still
 * reads what it read the first time.
 *
 * The REPRESENTATION behind it is not one array per state. It used to be —
 * `input.slice()` on every accepted edit — and that is O(words) per keystroke,
 * i.e. a quadratic fold: the server's largest legal log (~5,000 committed words,
 * ~40,000 events) copied on the order of 1e8 references per fold, five folds per
 * judgement. So every state produced by one fold instead SHARES a single mutable
 * backing buffer plus a write journal, and carries the version it belongs to —
 * a persistent array by re-rooting (Baker's shallow binding). Reading slot `i`
 * of version `v` first seeks the buffer to `v`, undoing/redoing journal entries;
 * for the linear "fold forward" pattern that is zero entries, so writes and
 * reads are O(1) amortized. Holding an old state and reading it later still
 * works — it costs the version distance, once.
 *
 * What the next person must respect:
 *  - `state.input` is a LAZY getter that materializes and memoizes a fresh plain
 *    array. It is O(words). NEVER call it per event; inside the core use
 *    {@link bufferOf}, which is O(1).
 *  - The array it hands back is a copy. It is `readonly` and it means it: writing
 *    through it corrupts nothing, it is simply lost.
 *  - The derived counters below are accumulated against a specific `ctx.words`.
 *    They are trusted only when the store was built for the SAME array identity;
 *    any other context falls back to the original O(words) loops.
 *  - A state that never came out of this module — an object literal, a
 *    `structuredClone`, anything that crossed a serialization boundary — simply
 *    has no store attached. Every function here falls back to the plain-array
 *    path for those, so foreign states keep working at the old cost.
 */

/** Shared, mutable backing buffer for one chain of states. Never escapes this module. */
interface InputStore {
  /** The `ctx.words` this store's counters were accumulated against (identity-checked). */
  readonly words: readonly string[]
  /** Slot values as of `version`. Only `[0, len)` is meaningful. */
  readonly slots: string[]
  len: number
  version: number
  /*
   * Write journal, as four parallel arrays so a write allocates no object:
   * entry `v` is the write that turns version `v` into version `v + 1`.
   */
  readonly jIndex: number[]
  readonly jPrev: string[]
  readonly jNext: string[]
  readonly jLen: number[]
}

/** One state's view of the buffers: a version plus the counters derived at it. */
interface StateCore {
  readonly store: InputStore
  readonly version: number
  /** Committed words that are not `endsLine` — `separatorsOf` before the count-finish adjustment. */
  readonly sep: number
  /** Correct characters across the committed words — `netCharsOf`'s committed half. */
  readonly correct: number
  /** Target characters across the committed words — `targetCharsOf`'s committed half. */
  readonly target: number
  /** Memoized `state.input`; shared by every state sitting at this version. */
  cache: readonly string[] | null
}

/** Either the incremental representation or a plain array (the foreign-state fallback). */
type Buffers = StateCore | readonly string[]

// Non-enumerable, so `Object.keys`, `for...in`, spread, `JSON.stringify`,
// `structuredClone` and every deep-equality matcher see exactly the seven public
// fields — the internals are invisible to anything that compares two states.
const STATE_CORE = Symbol('gameStateBuffers')

function coreOf(state: GameState): StateCore | undefined {
  return (state as { readonly [STATE_CORE]?: StateCore })[STATE_CORE]
}

/** Move `store` to `version`, undoing or redoing journal entries as needed. */
function seek(store: InputStore, version: number): void {
  while (store.version > version) {
    const entry = store.version - 1
    store.slots[store.jIndex[entry]] = store.jPrev[entry]
    store.len = store.jLen[entry]
    store.version = entry
  }
  while (store.version < version) {
    const entry = store.version
    const index = store.jIndex[entry]
    store.slots[index] = store.jNext[entry]
    if (index >= store.len) store.len = index + 1
    store.version = entry + 1
  }
}

/**
 * The typed buffer of word `index` in `state` — O(1), and the ONLY read the
 * reducer and the metrics pass may use per event. `state.input[index]` is the
 * same value, at O(words) a call.
 */
export function bufferOf(state: GameState, index: number): string {
  const core = coreOf(state)
  if (core === undefined) return state.input[index] ?? ''
  const store = core.store
  if (store.version !== core.version) seek(store, core.version)
  return index < store.len ? store.slots[index] : ''
}

/** A fresh plain array holding `core`'s slots — what `state.input` hands out. */
function materialize(core: StateCore): readonly string[] {
  const store = core.store
  if (store.version !== core.version) seek(store, core.version)
  return store.slots.slice(0, store.len)
}

/** Copy-on-write helper for the plain-array fallback: never mutates the source. */
function setInput(input: readonly string[], index: number, value: string): string[] {
  const next = input.slice()
  next[index] = value
  return next
}

function emptyCore(words: readonly string[]): StateCore {
  return {
    store: { words, slots: [], len: 0, version: 0, jIndex: [], jPrev: [], jNext: [], jLen: [] },
    version: 0,
    sep: 0,
    correct: 0,
    target: 0,
    cache: null
  }
}

/** Write `value` into slot `index`, returning the successor version. */
function writeCore(core: StateCore, index: number, value: string): StateCore {
  let store = core.store
  if (core.version !== store.jIndex.length) {
    // A FORK: an older state is being extended while newer versions still exist
    // (the reducer never does this — a caller branching off a held state does).
    // The branch gets its own store so both histories stay readable, at the cost
    // of one copy. Everything after it is O(1) again.
    const slots = materialize(core) as string[]
    store = {
      words: store.words,
      slots,
      len: slots.length,
      version: 0,
      jIndex: [],
      jPrev: [],
      jNext: [],
      jLen: []
    }
  } else if (store.version !== core.version) {
    seek(store, core.version)
  }
  const entry = store.version
  store.jIndex[entry] = index
  store.jPrev[entry] = store.slots[index] ?? ''
  store.jNext[entry] = value
  store.jLen[entry] = store.len
  store.slots[index] = value
  if (index >= store.len) store.len = index + 1
  store.version = entry + 1
  return {
    store,
    version: entry + 1,
    sep: core.sep,
    correct: core.correct,
    target: core.target,
    cache: null
  }
}

/** Characters of `typed` that match `target` position for position. */
function matchingChars(target: string, typed: string): number {
  const shared = target.length < typed.length ? target.length : typed.length
  let correct = 0
  for (let k = 0; k < shared; k++) if (typed[k] === target[k]) correct++
  return correct
}

/**
 * The buffers `state` should be edited through under `ctx`: the incremental
 * representation when the store belongs to this exact word list, the plain
 * array otherwise (a foreign state, or a state replayed against other words).
 */
function buffersFor(ctx: CoreContext, state: GameState): Buffers {
  const core = coreOf(state)
  return core !== undefined && core.store.words === ctx.words ? core : state.input
}

/** The buffers `state` already carries — never materializes anything. */
function buffersOf(state: GameState): Buffers {
  return coreOf(state) ?? state.input
}

function writeBuffers(buffers: Buffers, index: number, value: string): Buffers {
  return Array.isArray(buffers)
    ? setInput(buffers as readonly string[], index, value)
    : writeCore(buffers as StateCore, index, value)
}

/** Word `index` (buffer `typed`) just became committed: roll the counters forward. */
function commitBuffers(ctx: CoreContext, buffers: Buffers, index: number, typed: string): Buffers {
  if (Array.isArray(buffers) || index >= ctx.words.length) return buffers
  const core = buffers as StateCore
  const word = ctx.words[index]
  return {
    store: core.store,
    version: core.version,
    sep: core.sep + (endsLine(word) ? 0 : 1),
    correct: core.correct + matchingChars(word, typed),
    target: core.target + word.length,
    cache: core.cache
  }
}

/** Word `index` is the active word again (a backspace crossed back): roll them back. */
function uncommitBuffers(
  ctx: CoreContext,
  buffers: Buffers,
  index: number,
  typed: string
): Buffers {
  if (Array.isArray(buffers) || index >= ctx.words.length) return buffers
  const core = buffers as StateCore
  const word = ctx.words[index]
  return {
    store: core.store,
    version: core.version,
    sep: core.sep - (endsLine(word) ? 0 : 1),
    correct: core.correct - matchingChars(word, typed),
    target: core.target - word.length,
    cache: core.cache
  }
}

/**
 * The single state constructor. Every field is passed explicitly — no spread, so
 * reading `input` off the source state (and materializing it) can never sneak
 * into a transition.
 */
function makeState(
  phase: Phase,
  wordIndex: number,
  buffers: Buffers,
  startedAt: Ms | null,
  finishedAt: Ms | null,
  lastSeq: Seq | null,
  failReason: FailReason | null
): GameState {
  if (Array.isArray(buffers)) {
    return {
      phase,
      wordIndex,
      input: buffers as readonly string[],
      startedAt,
      finishedAt,
      lastSeq,
      failReason
    }
  }
  const core = buffers as StateCore
  const state = {
    phase,
    wordIndex,
    get input(): readonly string[] {
      return (core.cache ??= materialize(core))
    },
    startedAt,
    finishedAt,
    lastSeq,
    failReason
  }
  // `configurable` so a reactive Proxy over a state cannot trip the
  // non-configurable-own-property invariant; still non-enumerable, still invisible.
  Object.defineProperty(state, STATE_CORE, { value: core, configurable: true })
  return state
}

/**
 * The initial state for `ctx` — the ONLY place the start policy is applied. A
 * `'go'` run is already running at `t = 0`, so `settle` (and therefore the
 * deadline, the MinSpeed floor and every fold) is live without a single event.
 */
export function initialStateOf(ctx: CoreContext): GameState {
  const running = ctx.config.startPolicy === 'go'
  return makeState(
    running ? 'running' : 'idle',
    0,
    emptyCore(ctx.words),
    running ? asMs(0) : null,
    null,
    null,
    null
  )
}

// Every accepted transition records the event's seq. This is the shape for the
// transitions that move nothing else (a no-op delete, a leading commit).
function withSeq(state: GameState, event: GameEvent): GameState {
  return makeState(
    state.phase,
    state.wordIndex,
    buffersOf(state),
    state.startedAt,
    state.finishedAt,
    event.seq,
    state.failReason
  )
}

/** MinSpeed grace: the floor is never evaluated before this many ms after the first event. */
export const MINSPEED_GRACE_MS = 3000

/**
 * A target that ends with a newline carries its OWN separator: the `\n` is a
 * typed character of that word (a code/quote line end — monkeytype's commit
 * character), so crediting a phantom space on top of it would count the break
 * twice. Prose dictionaries never contain one, which is why this rule leaves
 * every existing run bit-identical.
 */
export function endsLine(word: string): boolean {
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
export function separatorsOf(ctx: CoreContext, state: GameState): number {
  const committed = Math.min(state.wordIndex, ctx.words.length)
  const finishedByCount =
    state.phase === 'finished' && ctx.config.mode !== 'time' && ctx.config.mode !== 'free'
  const core = coreOf(state)
  if (core !== undefined && core.store.words === ctx.words) {
    // Same sum, accumulated one word at a time as the run advanced.
    const last = finishedByCount && committed > 0 && !endsLine(ctx.words[committed - 1] ?? '')
    return last ? core.sep - 1 : core.sep
  }
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
export function netCharsOf(ctx: CoreContext, state: GameState): number {
  const core = coreOf(state)
  const incremental = core !== undefined && core.store.words === ctx.words
  let correct = 0
  if (incremental) {
    // The committed half is carried on the state — see the PURITY BOUNDARY note.
    // Recomputing it here is what made a MinSpeed run quadratic: `settle` asks
    // for it on every single event.
    correct = (core as StateCore).correct
  } else {
    const committed = Math.min(state.wordIndex, ctx.words.length)
    const input = state.input
    for (let i = 0; i < committed; i++) {
      const target = ctx.words[i] ?? ''
      const typed = input[i] ?? ''
      const n = Math.min(target.length, typed.length)
      for (let k = 0; k < n; k++) if (typed[k] === target[k]) correct++
    }
  }
  if (state.wordIndex < ctx.words.length) {
    const target = ctx.words[state.wordIndex] ?? ''
    const buffer = incremental
      ? bufferOf(state, state.wordIndex)
      : (state.input[state.wordIndex] ?? '')
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
export function targetCharsOf(ctx: CoreContext, state: GameState): number {
  const core = coreOf(state)
  const incremental = core !== undefined && core.store.words === ctx.words
  let chars = 0
  if (incremental) {
    chars = (core as StateCore).target
  } else {
    const committed = Math.min(state.wordIndex, ctx.words.length)
    for (let i = 0; i < committed; i++) chars += (ctx.words[i] ?? '').length
  }
  if (state.wordIndex < ctx.words.length) {
    const target = (ctx.words[state.wordIndex] ?? '').length
    const typed = incremental
      ? bufferOf(state, state.wordIndex).length
      : (state.input[state.wordIndex] ?? '').length
    chars += typed < target ? typed : target
  }
  return chars
}

/** Total target positions of the generated text — `progressOf`'s denominator. */
export function totalTargetCharsOf(ctx: CoreContext): number {
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
export function progressOf(ctx: CoreContext, state: GameState): number {
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
export function minSpeedFailInstant(ctx: CoreContext, state: GameState): Ms | null {
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
export function settle(ctx: CoreContext, state: GameState, nowMs: Ms): GameState {
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
    return makeState(
      'finished',
      state.wordIndex,
      buffersOf(state),
      state.startedAt,
      finishAt,
      state.lastSeq,
      reason
    )
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
 * Commit word `wordIndex` (buffer `buffer`, buffers already carrying it): advance
 * to the next, or finish the test. Shared by the explicit `commit` event and by
 * nospace / quickEnd auto-commit. In `expert` difficulty a word committed with any
 * error ends the test (`failReason: 'expert'`). The caller passes the pieces
 * rather than a state so the edit path builds exactly one state object per event.
 */
function commitWord(
  ctx: CoreContext,
  event: GameEvent,
  wordIndex: number,
  buffer: string,
  buffers: Buffers,
  startedAt: Ms | null
): Result<GameState, CoreError> {
  const target = ctx.words[wordIndex] ?? ''
  if (ctx.config.difficulty === 'expert' && buffer !== target) {
    return ok(makeState('finished', wordIndex, buffers, startedAt, event.t, event.seq, 'expert'))
  }
  const nextIndex = wordIndex + 1
  const advanced = commitBuffers(ctx, buffers, wordIndex, buffer)
  const finishesByCount =
    ctx.config.mode !== 'time' && ctx.config.mode !== 'free' && nextIndex >= ctx.words.length
  if (finishesByCount) {
    return ok(makeState('finished', nextIndex, advanced, startedAt, event.t, event.seq, null))
  }
  return ok(makeState('running', nextIndex, advanced, startedAt, null, event.seq, null))
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
  const wordIndex = state.wordIndex
  const target = ctx.words[wordIndex] ?? ''
  if (next.length > target.length + ctx.config.maxExtraChars) {
    return err({
      kind: 'WordLengthExceeded',
      message: `word ${wordIndex} exceeds length cap`,
      seq: event.seq
    })
  }
  const wrongInsert = hasWrongChar(target, insertedText, insertedAt)
  const master = ctx.config.difficulty === 'master'
  // The `stopOnError: 'letter'` refusal is decided BEFORE the buffer is written.
  // `master` is still evaluated first and still wins, so the outcome is unchanged
  // — but a refused keystroke must not leave a discarded buffer version behind,
  // because that would fork the shared store on every rejected key.
  if (wrongInsert && !master && ctx.config.stopOnError === 'letter') {
    return err(stoppedOnError(`wrong character refused in word ${wordIndex}`, event))
  }
  const buffers = writeBuffers(buffersFor(ctx, state), wordIndex, next)
  const startedAt = state.startedAt ?? event.t
  if (master && wrongInsert) {
    return ok(makeState('finished', wordIndex, buffers, startedAt, event.t, event.seq, 'master'))
  }
  const countsWords = ctx.config.mode !== 'time' && ctx.config.mode !== 'free'
  const isLastWord = wordIndex + 1 >= ctx.words.length
  // nospace: reaching the target length auto-commits. quickEnd: the LAST word of a
  // count run does too — the same path, so `expert` and `finishesByCount` keep
  // their usual meaning on the final word.
  const autoCommits =
    next.length >= target.length &&
    (ctx.config.nospace || (ctx.config.quickEnd === true && countsWords && isLastWord))
  if (autoCommits) {
    return commitWord(ctx, event, wordIndex, next, buffers, startedAt)
  }
  return ok(
    makeState(
      'running',
      wordIndex,
      buffers,
      startedAt,
      state.finishedAt,
      event.seq,
      state.failReason
    )
  )
}

// The previous word is "locked" when it was committed fully correct (buffer equals
// target — no incorrect, missed, or extra). A backspace must not cross back into it.
// `freedomMode` lifts the guard entirely: it lives in CoreConfig (input-validity slot,
// optional with a legacy default of locked) so replay / validateLog reconstruct it.
function prevWordLocked(ctx: CoreContext, state: GameState): boolean {
  if (ctx.config.freedomMode === true) return false
  const previous = state.wordIndex - 1
  if (previous < 0) return false
  return bufferOf(state, previous) === (ctx.words[previous] ?? '')
}

function reduceDelete(
  ctx: CoreContext,
  state: GameState,
  event: Extract<GameEvent, { kind: 'delete' }>
): Result<GameState, CoreError> {
  const wordIndex = state.wordIndex
  const buffer = bufferOf(state, wordIndex)
  const crossesBoundary = buffer.length === 0 && wordIndex > 0
  // A backspace must not re-enter a word committed fully correct. Rejected (not a
  // no-op that mutates), so the store never logs it and a valid log never contains
  // it — a log that does is caught by foldLog / validateLog.
  if (crossesBoundary && prevWordLocked(ctx, state)) {
    return err({
      kind: 'BackspaceLocked',
      message: `backspace blocked at correct word ${wordIndex - 1}`,
      seq: event.seq
    })
  }
  const edited = (buffers: Buffers, index: number): GameState =>
    makeState(
      state.phase,
      index,
      buffers,
      state.startedAt,
      state.finishedAt,
      event.seq,
      state.failReason
    )
  if (event.unit === 'word') {
    if (buffer.length > 0) {
      return ok(edited(writeBuffers(buffersFor(ctx, state), wordIndex, ''), wordIndex))
    }
    if (crossesBoundary) {
      // Step back into the previous word AND clear it. The counters roll back
      // against the buffer as it was before the clear.
      const previous = wordIndex - 1
      const reopened = uncommitBuffers(
        ctx,
        buffersFor(ctx, state),
        previous,
        bufferOf(state, previous)
      )
      return ok(edited(writeBuffers(reopened, previous, ''), previous))
    }
    return ok(withSeq(state, event)) // at the very start: nothing to delete
  }
  // Single character.
  if (buffer.length > 0) {
    return ok(
      edited(writeBuffers(buffersFor(ctx, state), wordIndex, buffer.slice(0, -1)), wordIndex)
    )
  }
  if (crossesBoundary) {
    const previous = wordIndex - 1
    return ok(
      edited(
        uncommitBuffers(ctx, buffersFor(ctx, state), previous, bufferOf(state, previous)),
        previous
      )
    )
  }
  return ok(withSeq(state, event)) // at the very start: no-op
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
  if (state.phase !== 'running') return ok(withSeq(state, event))
  const buffer = bufferOf(state, state.wordIndex)
  // stopOnError 'word': the advance is refused while the buffer differs from the target
  // — an empty buffer included, so a word cannot be skipped either.
  const stoppedOnWrongWord =
    ctx.config.stopOnError === 'word' && buffer !== (ctx.words[state.wordIndex] ?? '')
  if (buffer.length === 0) {
    if (stoppedOnWrongWord)
      return err(stoppedOnError(`word ${state.wordIndex} cannot be skipped`, event))
    return ok(withSeq(state, event)) // empty commit: no advance
  }
  // `expert` wins: an errored commit ends the run there rather than being refused.
  if (stoppedOnWrongWord && ctx.config.difficulty !== 'expert') {
    return err(stoppedOnError(`word ${state.wordIndex} is not correct yet`, event))
  }
  return commitWord(ctx, event, state.wordIndex, buffer, buffersFor(ctx, state), state.startedAt)
}

/**
 * The reducer. Applies a single event to a state, returning the next state or a
 * typed error. Pure and total: same (ctx, state, event) => same result, always.
 */
export function reduce(
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
  // Log v2 telemetry is a STATE NO-OP: the exact same state object comes back,
  // untouched — including `lastSeq`, so stripping every down/up out of a v2 log
  // folds to a bit-identical state (the v2 compatibility property). It is also
  // the one kind legal after `finished`: the key that typed the final grapheme
  // is still physically released after the run ends, and rejecting that `up`
  // would turn every honest v2 log invalid. Cross-event guarantees (contiguous
  // seq over ALL events, monotonic t) are validateLog's structural layer.
  if (event.kind === 'down' || event.kind === 'up') {
    return ok(state)
  }
  if (state.phase === 'finished') {
    return err({ kind: 'TestFinished', message: 'test already finished', seq: event.seq })
  }

  switch (event.kind) {
    case 'insert': {
      const buffer = bufferOf(state, state.wordIndex)
      return applyEdit(ctx, state, event, buffer + event.text, event.text, buffer.length)
    }
    case 'replace': {
      const buffer = bufferOf(state, state.wordIndex)
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

export interface FoldError {
  readonly error: CoreError
  readonly at: number
}

/**
 * Reduce an entire event log to a final state, applying timed completion before
 * each event and once more at `endMs` (defaults to the last event's `t`). Aborts
 * on the first invalid event — this is the server-side validation entry point.
 */
export function foldLog(
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

export interface GameCoreInit {
  readonly config: CoreConfig
  readonly words: readonly string[]
}

/**
 * Instantiable wrapper over the pure reducer. Holds an immutable context (config
 * snapshot + generated words) and the evolving state plus the accepted event
 * log. Many instances coexist independently (own player + up to four ghosts),
 * because nothing here is a module singleton.
 */
export class GameCore {
  private readonly _ctx: CoreContext
  private _state: GameState
  private readonly _events: GameEvent[] = []

  constructor(init: GameCoreInit) {
    this._ctx = {
      config: { ...init.config },
      words: [...init.words]
    }
    this._state = initialStateOf(this._ctx)
  }

  get config(): CoreConfig {
    return this._ctx.config
  }

  get words(): readonly string[] {
    return this._ctx.words
  }

  get state(): GameState {
    return this._state
  }

  get events(): readonly GameEvent[] {
    return this._events
  }

  /** Apply one event. On success, state advances and the event is logged. */
  dispatch(event: GameEvent): Result<GameState, CoreError> {
    const settled = settle(this._ctx, this._state, event.t)
    const result = reduce(this._ctx, settled, event)
    if (result.isOk()) {
      this._state = result.value
      this._events.push(event)
    } else {
      // A rejected event still leaves any time-based completion in place.
      this._state = settled
    }
    return result
  }

  /** Advance timed completion to the given instant (called by the worker tick). */
  tick(nowMs: Ms): GameState {
    this._state = settle(this._ctx, this._state, nowMs)
    return this._state
  }

  reset(): void {
    this._state = initialStateOf(this._ctx)
    this._events.length = 0
  }
}
