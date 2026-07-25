/**
 * DemoFeed — the Phase B stand-in for the network transport: replays a
 * recorded (or synthesized) event log into a `GhostDriver` as if it were
 * arriving from a relay, with simulated per-batch latency and jitter.
 *
 * Pump-driven, zero timers, zero lifecycle: the match clock calls
 * `pump(matchNow)` and every event whose simulated arrival time has passed is
 * appended in one batch — chunk sizes emerge from pump cadence and jitter,
 * which is exactly what the equivalence property in ghost-driver.test.ts
 * hardens the driver against. Arrival times are deterministic per seed and
 * non-decreasing (the relay is ordered, like a WS stream).
 *
 * Keep `latencyMs + jitterMs` under the driver's display delay (default 250):
 * that is the jitter-buffer contract — within it, the ghost display is
 * bit-exact against the log. C1 replaces this class with the real transport
 * behind the same append() seam.
 */
import { type GameEvent, commitEvent, insertEvent, mulberry32 } from '@shared/core'
import type { GhostDriver } from './ghost-driver'

export interface DemoFeedOptions {
  /** Base simulated relay latency, ms. Default 60. */
  readonly latencyMs?: number
  /** Max additional random per-event jitter, ms. Default 100. */
  readonly jitterMs?: number
  /** Determinism seed for the jitter stream. Default 1. */
  readonly seed?: number
}

export class DemoFeed {
  private readonly driver: GhostDriver
  private readonly events: readonly GameEvent[]
  private readonly arrivals: readonly number[]
  private cursor = 0

  constructor(driver: GhostDriver, log: readonly GameEvent[], options: DemoFeedOptions = {}) {
    this.driver = driver
    this.events = log
    const latency = options.latencyMs ?? 60
    const jitter = options.jitterMs ?? 100
    const rng = mulberry32(options.seed ?? 1)
    // Ordered stream: arrival never regresses even when jitter would invert it.
    let previous = 0
    this.arrivals = log.map((event) => {
      previous = Math.max(previous, event.t + latency + rng() * jitter)
      return previous
    })
  }

  /** All events have been delivered to the driver. */
  get exhausted(): boolean {
    return this.cursor >= this.events.length
  }

  /** Deliver every event whose simulated arrival time has passed, as one batch. */
  pump(matchNowMs: number): void {
    if (this.exhausted) return
    const from = this.cursor
    while (this.cursor < this.events.length && this.arrivals[this.cursor] <= matchNowMs)
      this.cursor += 1
    if (this.cursor > from) this.driver.append(this.events.slice(from, this.cursor))
  }
}

export interface BotLogOptions {
  /** Typing speed in words per minute. Default 40. */
  readonly wpm?: number
  /** Determinism seed for cadence jitter. Default 1. */
  readonly seed?: number
  /** Stop emitting once `t` would exceed this (time-mode deadline). */
  readonly maxDurationMs?: number
}

/**
 * Synthesize a deterministic "recorded" bot log: types every word correctly at
 * a human-ish cadence (±30% jitter around the WPM interval), committing at
 * word boundaries. Space-separated flow only — nospace configs auto-commit
 * inside the reducer, so commits are simply skipped there.
 */
export function synthesizeBotLog(
  words: readonly string[],
  options: BotLogOptions & { nospace?: boolean } = {}
): GameEvent[] {
  const wpm = options.wpm ?? 40
  const rng = mulberry32(options.seed ?? 1)
  const limit = options.maxDurationMs ?? Number.POSITIVE_INFINITY
  // Standard word = 5 keystrokes; interval is per keystroke.
  const interval = 60_000 / (Math.max(1, wpm) * 5)

  const log: GameEvent[] = []
  let seq = 0
  let t = 0
  const stamp = (): { seq: number; t: number } => {
    t += interval * (0.7 + rng() * 0.6)
    return { seq: ++seq, t: Math.round(t) }
  }

  for (const word of words) {
    for (const char of word) {
      const at = stamp()
      if (at.t > limit) return log
      log.push(insertEvent(at.seq, at.t, char))
    }
    if (!options.nospace) {
      const at = stamp()
      if (at.t > limit) return log
      log.push(commitEvent(at.seq, at.t))
    }
  }
  return log
}
