/**
 * Log-v1 ↔ log-v2 twinning helpers, shared by the suites that have to prove a
 * v2 log behaves exactly like the v1 capture of the same keystrokes.
 *
 * Not a test file (no `.test.ts` suffix, so vitest does not collect it) — it is
 * the one place the twin relation is spelled out, so `ghost-driver.test.ts` and
 * `replay-player.test.ts` cannot drift apart on what "the same run" means.
 */
import { type GameEvent, type GameState, asSeq, keyDownEvent, keyUpEvent } from '@typemore/core'

/** `KeyboardEvent.code` for what a state event was typed with — physical, never the glyph. */
function codeOf(event: GameEvent): string {
  if (event.kind === 'commit') return 'Space'
  if (event.kind === 'delete') return 'Backspace'
  if (event.kind !== 'insert') return 'Enter'
  const upper = event.text.toUpperCase()
  return /^[A-Z]$/.test(upper) ? `Key${upper}` : 'Digit1'
}

/**
 * The same keystrokes as a LOG-V2 capture: a physical `down` `leadMs` before
 * every event and its `up` `holdMs` after, `seq` renumbered contiguously — the
 * DOM ordering the input adapter produces (`telemetry-adapter.test.ts`).
 *
 * The caller owns monotonicity: with the defaults the source log's own interval
 * must stay above `holdMs - leadMs` or two strokes' telemetry would cross.
 */
export function withTelemetry(
  log: readonly GameEvent[],
  { leadMs = 8, holdMs = 25 }: { leadMs?: number; holdMs?: number } = {}
): GameEvent[] {
  const out: GameEvent[] = []
  let seq = 0
  for (const event of log) {
    const code = codeOf(event)
    out.push(keyDownEvent(++seq, event.t - leadMs, code))
    out.push({ ...event, seq: asSeq(++seq) })
    out.push(keyUpEvent(++seq, event.t + holdMs, code))
  }
  return out
}

/**
 * A fold with the seq counter dropped.
 *
 * Telemetry CONSUMES `seq` — that is its tamper-evidence, the contiguity guard
 * covers it — but it never writes state, so a v2 fold's `lastSeq` is its own
 * numbering while every other field must equal the v1 twin's byte for byte.
 */
export const withoutSeq = (state: GameState): Omit<GameState, 'lastSeq'> => {
  const { lastSeq: _lastSeq, ...rest } = state
  return rest
}
