/**
 * Event protocol — the single source of truth for a game.
 *
 * Every keystroke-level interaction is captured as an immutable, serializable
 * event. The full game state and every metric are pure functions of an ordered
 * event log, so the same log drives the live UI, replays, network transport to
 * opponents, and server-side anti-cheat validation with identical results.
 *
 * Invariants:
 * - `t` is the offset in ms from *test start*, never a raw `performance.now()`.
 *   Clients have different time bases; the log must be portable and comparable.
 * - `seq` is a monotonic sequence number assigned by the producer. It guards
 *   against loss/duplication and is the deterministic tie-break when two events
 *   share the same `t`. The canonical order of a log is ascending `seq`.
 * - Events are immutable. Character normalization (visual equivalence, unicode
 *   spaces, per-language sets) happens *before* an event exists, so the stored
 *   text is final; correctness is derivable from (text, target, position).
 */

// Branded primitives: forbid mixing a raw number with a sequence / timestamp.
declare const seqBrand: unique symbol
declare const msBrand: unique symbol

/** Monotonic per-test sequence number. */
export type Seq = number & { readonly [seqBrand]: true }
/** Milliseconds offset from test start. */
export type Ms = number & { readonly [msBrand]: true }

export const asSeq = (n: number): Seq => n as Seq
export const asMs = (n: number): Ms => n as Ms

interface EventBase {
  readonly seq: Seq
  readonly t: Ms
}

/** Insert a character or string at the caret (typing, single-char IME commit). */
export interface InsertEvent extends EventBase {
  readonly kind: 'insert'
  readonly text: string
}

/** Delete backward: one grapheme (`char`) or one word (`word`, ctrl+backspace). */
export interface DeleteEvent extends EventBase {
  readonly kind: 'delete'
  readonly unit: 'char' | 'word'
}

/** Commit the current word (space / word boundary), advancing to the next word. */
export interface CommitEvent extends EventBase {
  readonly kind: 'commit'
}

/**
 * Replace a `[from, to)` range of the current word buffer with `text`.
 * Not yet emitted by the UI, but part of the wire protocol: IME composition end
 * and paste both map to a ranged replace. Reserving it now avoids a costly
 * protocol migration later.
 */
export interface ReplaceEvent extends EventBase {
  readonly kind: 'replace'
  readonly from: number
  readonly to: number
  readonly text: string
  readonly source: 'ime' | 'paste'
}

/**
 * Log v2 keystroke telemetry: a physical key went down / came up. `code` is the
 * PHYSICAL key (`KeyboardEvent.code`, e.g. `"KeyF"`, `"ShiftLeft"`) — never the
 * produced character, so no layout or IME state can leak through it.
 *
 * Telemetry events are STATE NO-OPS: `reduce` returns the state unchanged (and
 * unlike every other kind they are legal in any phase, including `finished` —
 * the key that typed the last grapheme is still released after the run ends).
 * They consume `seq` like every event, so the contiguity guard covers them:
 * telemetry cannot be inserted, dropped, or reordered after the fact without
 * breaking the log. They carry `t` on the same clock. Scoring, metrics and fold
 * state are UNCHANGED by design — stripping every down/up from a v2 log folds
 * to a bit-identical state (pinned by the stripping property test).
 */
export interface KeyDownEvent extends EventBase {
  readonly kind: 'down'
  readonly code: string
}

/** See {@link KeyDownEvent}. */
export interface KeyUpEvent extends EventBase {
  readonly kind: 'up'
  readonly code: string
}

/** The state-affecting v1 union — what the reducer folds. */
export type StateEvent = InsertEvent | DeleteEvent | CommitEvent | ReplaceEvent
/** Log v2 telemetry union — folded as no-ops, validated structurally. */
export type TelemetryEvent = KeyDownEvent | KeyUpEvent

export type GameEvent = StateEvent | TelemetryEvent
export type GameEventKind = GameEvent['kind']

/** Narrow to telemetry (`down` / `up`). The complement is a `StateEvent`. */
export const isTelemetryEvent = (event: GameEvent): event is TelemetryEvent =>
  event.kind === 'down' || event.kind === 'up'

/**
 * Wire-format log versions. v1 is the state-event grammar; v2 adds the optional
 * `down`/`up` telemetry. The version is decided PER RUN at log start (capability
 * detection: a client without a physical keyboard keeps emitting v1, and v1 is
 * accepted forever), so both constants stay live — `EVENT_LOG_VERSION` remains
 * the v1 base the stored-run world is pinned to.
 */
export const EVENT_LOG_VERSION = 1 as const
export const EVENT_LOG_VERSION_TELEMETRY = 2 as const
export type EventLogVersion = typeof EVENT_LOG_VERSION | typeof EVENT_LOG_VERSION_TELEMETRY

export interface EventLog {
  readonly version: EventLogVersion
  readonly events: readonly GameEvent[]
}

// ── Constructors ───────────────────────────────────────────────────────────
// Used by tests and by the input layer. Keeping them here means callers never
// hand-build branded literals.

export const insertEvent = (seq: number, t: number, text: string): InsertEvent => ({
  kind: 'insert',
  seq: asSeq(seq),
  t: asMs(t),
  text
})

export const deleteEvent = (
  seq: number,
  t: number,
  unit: DeleteEvent['unit'] = 'char'
): DeleteEvent => ({
  kind: 'delete',
  seq: asSeq(seq),
  t: asMs(t),
  unit
})

export const commitEvent = (seq: number, t: number): CommitEvent => ({
  kind: 'commit',
  seq: asSeq(seq),
  t: asMs(t)
})

export const replaceEvent = (
  seq: number,
  t: number,
  from: number,
  to: number,
  text: string,
  source: ReplaceEvent['source']
): ReplaceEvent => ({
  kind: 'replace',
  seq: asSeq(seq),
  t: asMs(t),
  from,
  to,
  text,
  source
})

export const keyDownEvent = (seq: number, t: number, code: string): KeyDownEvent => ({
  kind: 'down',
  seq: asSeq(seq),
  t: asMs(t),
  code
})

export const keyUpEvent = (seq: number, t: number, code: string): KeyUpEvent => ({
  kind: 'up',
  seq: asSeq(seq),
  t: asMs(t),
  code
})

/**
 * Canonical ordering: ascending `seq`. Stable, so any equal-`seq` inputs (which
 * must not occur — `seq` is unique) keep arrival order. Producers assign `seq`
 * in processing order, so this also resolves ties on equal `t`.
 *
 * An already-ordered log is returned AS IS: every producer emits in `seq` order,
 * so the copy-and-sort was pure waste — and it ran five times per server
 * judgement over the full log. The result is `readonly` precisely because it may
 * alias the caller's array; nothing has ever mutated it.
 */
export function sortEvents(events: readonly GameEvent[]): readonly GameEvent[] {
  for (let i = 1; i < events.length; i++) {
    if (events[i].seq < events[i - 1].seq) return [...events].sort((a, b) => a.seq - b.seq)
  }
  return events
}
