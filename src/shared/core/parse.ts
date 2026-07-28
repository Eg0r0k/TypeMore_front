/**
 * Runtime parsers for foreign events — the future transport boundary.
 *
 * Everything below this module trusts its branded types (`Seq`, `Ms`,
 * `GameEvent`): brands are compile-time only, so a relayed JSON payload must
 * pass through here before it may touch a core. `parseGameEvent` /
 * `parseEventBatch` validate SHAPE only — sequencing rules (contiguous `seq`,
 * monotonic `t`) stay in `validateLog`'s structural layer, and range/validity
 * semantics stay in `reduce`.
 *
 * Hand-rolled guards on purpose: the core stays framework- and
 * dependency-free (`neverthrow` excepted), enforced by the purity scan.
 *
 * Output is canonical: events are rebuilt through the constructors in
 * `events.ts`, so unknown extra fields on a payload are tolerated on input and
 * dropped on output (wire extension room without core exposure).
 *
 * Check order per event is fixed and documented: shape → seq → t → kind →
 * kind-specific fields. A payload wrong in several ways reports the first
 * failing check.
 */

import { Result, err, ok } from 'neverthrow'

import type { DeleteEvent, EventLog, EventLogVersion, GameEvent, ReplaceEvent } from './events'
import {
  EVENT_LOG_VERSION,
  EVENT_LOG_VERSION_TELEMETRY,
  commitEvent,
  deleteEvent,
  insertEvent,
  keyDownEvent,
  keyUpEvent,
  replaceEvent
} from './events'

export type ParseErrorCode = 'bad-shape' | 'bad-seq' | 'bad-t' | 'bad-kind' | 'bad-version'

export interface ParseError {
  readonly code: ParseErrorCode
  readonly message: string
  /** Index of the offending event within a batch, when applicable. */
  readonly index?: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** `seq` is a positive integer (protocol: monotonic from 1). */
const isValidSeq = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1

/** `t` is a finite, non-negative ms offset. Floats are legal in log v1. */
const isValidT = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const isDeleteUnit = (value: unknown): value is DeleteEvent['unit'] =>
  value === 'char' || value === 'word'

const isReplaceSource = (value: unknown): value is ReplaceEvent['source'] =>
  value === 'ime' || value === 'paste'

/**
 * Log v2 telemetry `code` shape: the `KeyboardEvent.code` charset — ASCII
 * alphanumerics ("KeyF", "ShiftLeft", "Numpad0", "F12"), non-empty, ≤32 chars.
 * Anything else (characters, layout leakage, junk) is rejected.
 */
const isKeyCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9]{1,32}$/.test(value)

const isLogVersion = (value: unknown): value is EventLogVersion =>
  value === EVENT_LOG_VERSION || value === EVENT_LOG_VERSION_TELEMETRY

/** Non-negative integer (replace range endpoints). Range-vs-buffer validity is `reduce`'s job. */
const isIndex = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

/**
 * Validate one unknown payload as a `GameEvent`. On success the returned event
 * is a fresh, canonical, branded object — safe to hand to `GameCore.dispatch`.
 *
 * `version` selects the grammar: the v1 union is unchanged, v2 additionally
 * admits the `down`/`up` telemetry kinds. Under v1 a telemetry payload is an
 * unknown kind, exactly as before this parameter existed.
 */
export function parseGameEvent(
  input: unknown,
  version: EventLogVersion = EVENT_LOG_VERSION
): Result<GameEvent, ParseError> {
  if (!isRecord(input)) {
    return err({
      code: 'bad-shape',
      message: `event must be an object, got ${input === null ? 'null' : typeof input}`
    })
  }
  const { seq, t, kind } = input
  if (!isValidSeq(seq)) {
    return err({
      code: 'bad-seq',
      message: `seq must be an integer >= 1, got ${JSON.stringify(seq)}`
    })
  }
  if (!isValidT(t)) {
    return err({
      code: 'bad-t',
      message: `t must be a finite number >= 0, got ${JSON.stringify(t)}`
    })
  }

  switch (kind) {
    case 'insert': {
      const { text } = input
      if (typeof text !== 'string' || text.length === 0) {
        return err({ code: 'bad-shape', message: 'insert.text must be a non-empty string' })
      }
      return ok(insertEvent(seq, t, text))
    }
    case 'delete': {
      const { unit } = input
      if (!isDeleteUnit(unit)) {
        return err({
          code: 'bad-shape',
          message: `delete.unit must be 'char' | 'word', got ${JSON.stringify(unit)}`
        })
      }
      return ok(deleteEvent(seq, t, unit))
    }
    case 'commit':
      return ok(commitEvent(seq, t))
    case 'replace': {
      const { from, to, text, source } = input
      if (!isIndex(from) || !isIndex(to) || to < from) {
        return err({
          code: 'bad-shape',
          message: `replace range must be integers 0 <= from <= to, got [${JSON.stringify(from)},${JSON.stringify(to)})`
        })
      }
      if (typeof text !== 'string') {
        return err({ code: 'bad-shape', message: 'replace.text must be a string' })
      }
      if (!isReplaceSource(source)) {
        return err({
          code: 'bad-shape',
          message: `replace.source must be 'ime' | 'paste', got ${JSON.stringify(source)}`
        })
      }
      return ok(replaceEvent(seq, t, from, to, text, source))
    }
    case 'down':
    case 'up': {
      if (version !== EVENT_LOG_VERSION_TELEMETRY) {
        return err({ code: 'bad-kind', message: `unknown event kind ${JSON.stringify(kind)}` })
      }
      const { code } = input
      if (!isKeyCode(code)) {
        return err({
          code: 'bad-shape',
          message: `${kind}.code must be 1-32 chars of the KeyboardEvent.code charset, got ${JSON.stringify(code)}`
        })
      }
      return ok(kind === 'down' ? keyDownEvent(seq, t, code) : keyUpEvent(seq, t, code))
    }
    default:
      return err({ code: 'bad-kind', message: `unknown event kind ${JSON.stringify(kind)}` })
  }
}

/**
 * Validate one unknown payload as an `EventLog` (version envelope + events).
 * Each event is parsed via `parseGameEvent`; the first failure is reported
 * with its array `index`. Sequencing across events is NOT checked here.
 */
export function parseEventBatch(input: unknown): Result<EventLog, ParseError> {
  if (!isRecord(input)) {
    return err({
      code: 'bad-shape',
      message: `batch must be an object, got ${input === null ? 'null' : typeof input}`
    })
  }
  if (!isLogVersion(input.version)) {
    return err({
      code: 'bad-version',
      message: `unsupported log version ${JSON.stringify(input.version)}, expected ${EVENT_LOG_VERSION} or ${EVENT_LOG_VERSION_TELEMETRY}`
    })
  }
  if (!Array.isArray(input.events)) {
    return err({ code: 'bad-shape', message: 'batch.events must be an array' })
  }

  const events: GameEvent[] = []
  for (let i = 0; i < input.events.length; i++) {
    const parsed = parseGameEvent(input.events[i], input.version)
    if (parsed.isErr()) {
      return err({ ...parsed.error, index: i, message: `events[${i}]: ${parsed.error.message}` })
    }
    events.push(parsed.value)
  }
  return ok({ version: input.version, events })
}
