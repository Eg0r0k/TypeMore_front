/**
 * Keyboard observations — the per-character extraction behind the profile's
 * keyboard heatmap (server side: the replay worker's `user_keyboard_profile`
 * projection; TypeMore_back docs/PROFILE.md).
 *
 * A pure function of the log, like everything in the core: one replay pass
 * produces, per typed character, how often it was pressed, how often it landed
 * wrong, and the inter-keystroke intervals that ended on it. The server maps
 * characters onto physical keys through the layouts DATA asset (qwerty /
 * ЙЦУКЕН — symbol → key id) and folds these rows into per-key aggregates; the
 * core deliberately knows nothing about layouts, so the mapping can grow
 * without re-vendoring the bundle.
 *
 * Upgrade path, stated where the extraction lives: when the projection starts
 * consuming log-v2 telemetry, a v2 run's observations group by the physical
 * `KeyboardEvent.code` the log already carries and this char extraction stays
 * for v1 runs only. Until then, state events are the one grammar every log
 * speaks, so chars are the portable basis.
 */

import type { GameEvent, Ms } from './events'
import { isTelemetryEvent, sortEvents } from './events'
import type { CoreContext } from './game-core'
import { bufferOf, initialStateOf, reduce, settle } from './game-core'

/** One typed character's aggregates over a single run. */
export interface CharObservation {
  /** The character, exactly as typed (case preserved — 'A' and 'a' are the
   *  same physical key, but that join belongs to the layout data). */
  readonly char: string
  /** Keystrokes that produced this character (inserts; a commit is a Space). */
  readonly presses: number
  /** Of those, how many landed WRONG at their position. A commit is never
   *  wrong: committing early is a word-level event, not a Space typo. */
  readonly errors: number
  /** Sum of the counted inter-keystroke intervals that ENDED on this char. */
  readonly intervalSumMs: number
  /** How many intervals were counted (the first keystroke has none, and gaps
   *  over {@link KEY_INTERVAL_CAP_MS} are pauses, not typing flow). */
  readonly intervalCount: number
}

/**
 * Intervals above this are excluded from the mean: a 30-second pause says
 * nothing about how fast a finger reaches a key, and one such gap would poison
 * a key's average for hundreds of presses. 2 s is far above any human
 * inter-key interval inside continuous typing and far below a deliberate
 * pause.
 */
export const KEY_INTERVAL_CAP_MS = 2000

/**
 * Per-character observations of a run, from one replay pass. Semantics mirror
 * `analyzeLog` exactly: events fold through the same reducer (so position and
 * word-boundary rules can never diverge), telemetry is invisible, and the pass
 * stops where the reducer stops — a rejected event or a finished run ends the
 * observations, so a demoted run's contribution can be recomputed bit-for-bit
 * from the same prefix the verdict judged.
 *
 * What counts as a press:
 *   - every `insert` code unit, with correctness frozen at the position it
 *     landed (the keystream rule accuracy uses);
 *   - every accepted `commit`, as a press of `' '` (the physical Space) —
 *     nospace runs contain no commits, so their heatmap honestly has none.
 *   `delete` is navigation, not text; `replace` (IME/paste) arrived without
 *   per-key typing — neither observes a key, and both still break the
 *   interval chain (the next press's interval starts from them would be a
 *   lie, so it is simply not counted).
 */
export function charObservationsOf(
  ctx: CoreContext,
  events: readonly GameEvent[]
): CharObservation[] {
  let state = initialStateOf(ctx)
  const byChar = new Map<string, { presses: number; errors: number; sum: number; n: number }>()
  const observe = (char: string, wrong: boolean, intervalMs: number | null): void => {
    let row = byChar.get(char)
    if (row === undefined) {
      row = { presses: 0, errors: 0, sum: 0, n: 0 }
      byChar.set(char, row)
    }
    row.presses++
    if (wrong) row.errors++
    if (intervalMs !== null && intervalMs >= 0 && intervalMs <= KEY_INTERVAL_CAP_MS) {
      row.sum += intervalMs
      row.n++
    }
  }

  const stateEvents = events.some(isTelemetryEvent)
    ? events.filter((e) => !isTelemetryEvent(e))
    : events
  /** The instant of the previous OBSERVED keystroke; null breaks the chain. */
  let prevT: Ms | null = null

  for (const event of sortEvents(stateEvents)) {
    state = settle(ctx, state, event.t)
    if (state.phase === 'finished') break

    if (event.kind === 'insert') {
      const target = ctx.words[state.wordIndex] ?? ''
      const startPos = bufferOf(state, state.wordIndex).length
      for (let k = 0; k < event.text.length; k++) {
        const pos = startPos + k
        const wrong = !(pos < target.length && target[pos] === event.text[k])
        // A multi-code-unit insert is one keystroke: only its first unit ends
        // the interval; the rest share the instant.
        observe(event.text[k], wrong, k === 0 && prevT !== null ? event.t - prevT : null)
      }
    }

    const before = state.wordIndex
    const result = reduce(ctx, state, event)
    if (result.isErr()) break
    state = result.value

    if (event.kind === 'insert') {
      prevT = event.t
    } else if (event.kind === 'commit' && state.wordIndex > before) {
      // Only an ACCEPTED commit was a real Space press that advanced a word.
      observe(' ', false, prevT !== null ? event.t - prevT : null)
      prevT = event.t
    } else {
      prevT = null // delete / replace break the interval chain
    }
  }

  return [...byChar.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([char, row]) => ({
      char,
      presses: row.presses,
      errors: row.errors,
      intervalSumMs: row.sum,
      intervalCount: row.n
    }))
}
