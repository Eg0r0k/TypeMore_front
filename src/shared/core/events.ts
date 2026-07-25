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

export type GameEvent = InsertEvent | DeleteEvent | CommitEvent | ReplaceEvent
export type GameEventKind = GameEvent['kind']

/** Wire-format log version. Bump on any breaking change to the union above. */
export const EVENT_LOG_VERSION = 1 as const

export interface EventLog {
  readonly version: typeof EVENT_LOG_VERSION
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

/**
 * Canonical ordering: ascending `seq`. Stable, so any equal-`seq` inputs (which
 * must not occur — `seq` is unique) keep arrival order. Producers assign `seq`
 * in processing order, so this also resolves ties on equal `t`.
 */
export function sortEvents(events: readonly GameEvent[]): GameEvent[] {
  return [...events].sort((a, b) => a.seq - b.seq)
}
